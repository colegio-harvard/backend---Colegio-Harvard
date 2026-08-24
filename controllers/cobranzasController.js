const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { CANALES, ESTADOS_ENVIO, ESTADOS_COMPROMISO, alumnoActivo, normalizarTelefonoPeru, compromisoVigente, crearMensaje, crearEnlace } = require('../utils/cobranzaMensajeria');
const { todayLima } = require('../utils/dateUtils');
const { normalizarMesesPlantilla, montoTotalVigente } = require('../services/pensiones/calculoConceptos');
const { conceptoExigible, fechaVencimientoConcepto } = require('../services/cobranzas/reglasVencimiento');

const includeCobranza = {
  tbl_alumnos: { include: { tbl_padres_alumnos: { include: { tbl_padres: true } } } },
  tbl_compromisos_pago: { orderBy: { fecha_compromiso: 'desc' } },
};

function presentarCandidato(estado, concepto, anio) {
  const activo = alumnoActivo(estado.tbl_alumnos);
  const vinculo = estado.tbl_alumnos.tbl_padres_alumnos;
  const padre = vinculo?.tbl_padres || null;
  const telefono = padre ? normalizarTelefonoPeru(padre.celular) : null;
  const montoTotal = montoTotalVigente(estado.tbl_alumnos, concepto || estado.clave_mes, estado);
  const saldo = Math.max(0, Number((montoTotal - Number(estado.monto_pagado || 0)).toFixed(2)));
  const vigente = compromisoVigente(estado.tbl_compromisos_pago);
  const ultimo = vigente || (estado.tbl_compromisos_pago || []).find((c) => c.estado === 'VIGENTE') || null;
  return {
    id_estado_pension: estado.id, id_alumno: estado.id_alumno, alumno: estado.tbl_alumnos.nombre_completo,
    id_padre: padre?.id || null, apoderado: padre?.nombre_completo || null, telefono,
    clave_mes: estado.clave_mes, concepto: concepto?.nombre || estado.clave_mes, saldo,
    fecha_vencimiento: fechaVencimientoConcepto({ concepto: concepto || { clave: estado.clave_mes }, anio, fechaRegistro: estado.tbl_alumnos.date_time_registration })?.toISOString().slice(0, 10) || null,
    compromiso: ultimo ? { id: ultimo.id, fecha: ultimo.fecha_compromiso.toISOString().slice(0, 10), monto: ultimo.monto === null ? null : Number(ultimo.monto), estado: vigente ? vigente.estado : 'VENCIDO', observacion: ultimo.observacion } : null,
    elegible: activo && saldo > 0 && Boolean(padre && telefono) && !vigente,
    motivo_exclusion: !activo ? 'ALUMNO_NO_ACTIVO' : saldo <= 0 ? 'SIN_DEUDA' : !padre ? 'SIN_APODERADO' : !telefono ? 'TELEFONO_INVALIDO' : vigente ? 'COMPROMISO_VIGENTE' : null,
  };
}

async function listarCandidatos(req, res) {
  try {
    const anio = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anio) return res.status(400).json({ error: 'No hay año escolar activo' });
    const plantilla = await prisma.tbl_plantilla_pension.findFirst({ where: { id_anio_escolar: anio.id } });
    if (!plantilla) return res.status(404).json({ error: 'No hay plantilla de pagos configurada' });
    const conceptos = normalizarMesesPlantilla(plantilla.meses_json);
    const hoy = todayLima().date;
    const alumnos = await prisma.tbl_alumnos.findMany({ where: { estado: 'ACTIVO' }, select: { id: true, monto_matricula: true, monto_materiales: true, monto_pension: true, date_time_registration: true } });
    const pendientes = [];
    for (const alumno of alumnos) {
      for (const concepto of conceptos) {
        if (!conceptoExigible({ concepto, anio: anio.anio, fechaRegistro: alumno.date_time_registration, hoy })) continue;
        const total = montoTotalVigente(alumno, concepto, null);
        if (total <= 0) continue;
        pendientes.push({ id_plantilla: plantilla.id, id_alumno: alumno.id, clave_mes: concepto.clave, actualizado_por: req.user.id, estado: 'PENDIENTE', monto_total: total, monto_pagado: 0, user_id_registration: req.user.id });
      }
    }
    if (pendientes.length) await prisma.tbl_estado_pension.createMany({ data: pendientes, skipDuplicates: true });
    const conceptosPorClave = new Map(conceptos.map((x) => [x.clave, x]));
    const estados = await prisma.tbl_estado_pension.findMany({ where: { id_plantilla: plantilla.id, estado: { in: ['PENDIENTE', 'PAGO_PARCIAL'] }, tbl_alumnos: { estado: 'ACTIVO' } }, include: includeCobranza, orderBy: [{ id_alumno: 'asc' }, { clave_mes: 'asc' }] });
    const exigibles = estados.filter((estado) => conceptoExigible({ concepto: conceptosPorClave.get(estado.clave_mes), anio: anio.anio, fechaRegistro: estado.tbl_alumnos.date_time_registration, hoy }));
    res.json({ data: exigibles.map((estado) => presentarCandidato(estado, conceptosPorClave.get(estado.clave_mes), anio.anio)).filter((item) => item.saldo > 0) });
  } catch (error) { console.error('Error al listar candidatos de cobranza:', error); res.status(500).json({ error: 'Error al listar candidatos de cobranza' }); }
}

async function registrarCompromiso(req, res) {
  const { id_estado_pension, fecha_compromiso, monto, observacion } = req.body;
  if (!Number.isInteger(Number(id_estado_pension)) || Number(id_estado_pension) <= 0 || !fecha_compromiso) return res.status(400).json({ error: 'Estado de pension y fecha son obligatorios' });
  const fecha = new Date(`${fecha_compromiso}T00:00:00-05:00`);
  if (Number.isNaN(fecha.getTime())) return res.status(400).json({ error: 'Fecha de compromiso invalida' });
  const montoNormalizado = monto === null || monto === undefined || monto === '' ? null : Number(monto);
  if (montoNormalizado !== null && (!Number.isFinite(montoNormalizado) || montoNormalizado <= 0)) return res.status(400).json({ error: 'Monto de compromiso invalido' });
  try {
    const compromiso = await prisma.$transaction(async (tx) => {
      await tx.tbl_compromisos_pago.updateMany({ where: { id_estado_pension: Number(id_estado_pension), estado: 'VIGENTE' }, data: { estado: 'CANCELADO', user_id_modification: req.user.id, date_time_modification: new Date() } });
      return tx.tbl_compromisos_pago.create({ data: { id_estado_pension: Number(id_estado_pension), fecha_compromiso: fecha, monto: montoNormalizado, observacion: observacion || null, creado_por: req.user.id, user_id_registration: req.user.id } });
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'REGISTRAR_COMPROMISO_PAGO', tipoEntidad: 'tbl_compromisos_pago', idEntidad: compromiso.id, resumen: `Compromiso de pago para ${fecha_compromiso}`, req });
    res.status(201).json({ data: compromiso });
  } catch (error) { console.error('Error al registrar compromiso:', error); res.status(500).json({ error: 'Error al registrar compromiso de pago' }); }
}

async function actualizarCompromiso(req, res) {
  const estado = String(req.body.estado || '').toUpperCase();
  if (!ESTADOS_COMPROMISO.has(estado)) return res.status(400).json({ error: 'Estado de compromiso no valido' });
  try { const compromiso = await prisma.tbl_compromisos_pago.update({ where: { id: Number(req.params.id) }, data: { estado, user_id_modification: req.user.id, date_time_modification: new Date() } }); res.json({ data: compromiso }); }
  catch { res.status(404).json({ error: 'Compromiso no encontrado' }); }
}

async function prepararMensajes(req, res) {
  const canal = String(req.body.canal || '').toUpperCase();
  const ids = [...new Set((req.body.ids_estado_pension || []).map(Number).filter(Number.isInteger))];
  if (!CANALES.has(canal)) return res.status(400).json({ error: 'Canal no valido' });
  if (!ids.length) return res.status(400).json({ error: 'Seleccione al menos una pension' });
  try {
    const [estados, colegio, anio] = await Promise.all([prisma.tbl_estado_pension.findMany({ where: { id: { in: ids } }, include: { ...includeCobranza, tbl_plantilla_pension: true } }), prisma.tbl_colegio.findFirst(), prisma.tbl_anios_escolares.findFirst({ where: { activo: true } })]);
    const preparados = []; const omitidos = []; const grupos = new Map();
    for (const estado of estados) {
      const conceptos = normalizarMesesPlantilla(estado.tbl_plantilla_pension?.meses_json);
      const concepto = conceptos.find((x) => x.clave === estado.clave_mes);
      const exigible = conceptoExigible({ concepto, anio: anio?.anio, fechaRegistro: estado.tbl_alumnos.date_time_registration, hoy: todayLima().date });
      const candidato = presentarCandidato(estado, concepto, anio?.anio);
      if (!exigible) candidato.elegible = false, candidato.motivo_exclusion = 'NO_VENCIDO';
      if (!candidato.elegible) { omitidos.push({ id_estado_pension: estado.id, motivo: candidato.motivo_exclusion }); continue; }
      const grupo = grupos.get(candidato.id_alumno) || { candidato, conceptos: [] };
      grupo.conceptos.push({ id_estado_pension: estado.id, clave_mes: candidato.clave_mes, concepto: candidato.concepto, saldo: candidato.saldo });
      grupos.set(candidato.id_alumno, grupo);
    }
    for (const { candidato, conceptos } of grupos.values()) {
      const mensaje = crearMensaje({ canal, colegio: colegio?.nombre || 'COLEGIO HARVARD', alumno: candidato.alumno, conceptos, telefonoContacto: colegio && (colegio.telefono_whatsapp || colegio.telefono) });
      const envio = await prisma.tbl_cobranza_envios.create({ data: { id_estado_pension: conceptos[0].id_estado_pension, id_padre: candidato.id_padre, canal, telefono: candidato.telefono, mensaje, enlace_apertura: crearEnlace(canal, candidato.telefono, mensaje), creado_por: req.user.id, user_id_registration: req.user.id } });
      preparados.push({ ...envio, alumno: candidato.alumno, apoderado: candidato.apoderado, conceptos });
    }
    await registrarAuditoria({ userId: req.user.id, accion: 'PREPARAR_COBRANZA', tipoEntidad: 'tbl_cobranza_envios', resumen: `${preparados.length} mensajes ${canal} preparados`, meta: { ids, omitidos }, req });
    res.status(201).json({ data: { preparados, omitidos } });
  } catch (error) { console.error('Error al preparar mensajes:', error); res.status(500).json({ error: 'Error al preparar mensajes de cobranza' }); }
}

async function listarCola(req, res) {
  const estado = String(req.query.estado || 'PREPARADO').toUpperCase(); const canal = req.query.canal ? String(req.query.canal).toUpperCase() : undefined;
  if (!ESTADOS_ENVIO.has(estado) || (canal && !CANALES.has(canal))) return res.status(400).json({ error: 'Filtro no valido' });
  try { const data = await prisma.tbl_cobranza_envios.findMany({ where: { estado, ...(canal ? { canal } : {}) }, include: { tbl_padres: { select: { nombre_completo: true } }, tbl_estado_pension: { include: { tbl_alumnos: { select: { nombre_completo: true } } } } }, orderBy: { preparado_en: 'asc' } }); res.json({ data: data.map((x) => ({ ...x, apoderado: x.tbl_padres.nombre_completo, alumno: x.tbl_estado_pension.tbl_alumnos.nombre_completo, tbl_padres: undefined, tbl_estado_pension: undefined })) }); }
  catch { res.status(500).json({ error: 'Error al obtener cola de cobranza' }); }
}

async function actualizarEstadoEnvio(req, res) {
  const estado = String(req.body.estado || '').toUpperCase(); if (!ESTADOS_ENVIO.has(estado)) return res.status(400).json({ error: 'Estado de envio no valido' });
  try { const envio = await prisma.tbl_cobranza_envios.update({ where: { id: Number(req.params.id) }, data: { estado, error: req.body.error || null, enviado_en: estado === 'CONFIRMADO' ? new Date() : undefined, user_id_modification: req.user.id, date_time_modification: new Date() } }); res.json({ data: envio }); }
  catch { res.status(404).json({ error: 'Envio no encontrado' }); }
}

module.exports = { listarCandidatos, registrarCompromiso, actualizarCompromiso, prepararMensajes, listarCola, actualizarEstadoEnvio };

