const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { CANALES, ESTADOS_ENVIO, ESTADOS_COMPROMISO, normalizarTelefonoPeru, saldoPension, compromisoVigente, crearMensaje, crearEnlace } = require('../utils/cobranzaMensajeria');

const includeCobranza = {
  tbl_alumnos: { include: { tbl_padres_alumnos: { include: { tbl_padres: true } } } },
  tbl_compromisos_pago: { orderBy: { fecha_compromiso: 'desc' } },
};

function presentarCandidato(estado) {
  const vinculo = estado.tbl_alumnos.tbl_padres_alumnos;
  const padre = vinculo?.tbl_padres || null;
  const telefono = padre ? normalizarTelefonoPeru(padre.celular) : null;
  const saldo = saldoPension(estado);
  const vigente = compromisoVigente(estado.tbl_compromisos_pago);
  const ultimo = vigente || (estado.tbl_compromisos_pago || []).find((c) => c.estado === 'VIGENTE') || null;
  return {
    id_estado_pension: estado.id, alumno: estado.tbl_alumnos.nombre_completo,
    id_padre: padre?.id || null, apoderado: padre?.nombre_completo || null, telefono,
    clave_mes: estado.clave_mes, saldo,
    compromiso: ultimo ? { id: ultimo.id, fecha: ultimo.fecha_compromiso.toISOString().slice(0, 10), monto: ultimo.monto === null ? null : Number(ultimo.monto), estado: vigente ? vigente.estado : 'VENCIDO', observacion: ultimo.observacion } : null,
    elegible: saldo > 0 && Boolean(padre && telefono) && !vigente,
    motivo_exclusion: saldo <= 0 ? 'SIN_DEUDA' : !padre ? 'SIN_APODERADO' : !telefono ? 'TELEFONO_INVALIDO' : vigente ? 'COMPROMISO_VIGENTE' : null,
  };
}

async function listarCandidatos(req, res) {
  try {
    const estados = await prisma.tbl_estado_pension.findMany({ where: { estado: { not: 'PAGADO' } }, include: includeCobranza, orderBy: [{ clave_mes: 'asc' }, { id_alumno: 'asc' }] });
    res.json({ data: estados.map(presentarCandidato).filter((item) => item.saldo > 0) });
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
    const [estados, colegio] = await Promise.all([prisma.tbl_estado_pension.findMany({ where: { id: { in: ids } }, include: includeCobranza }), prisma.tbl_colegio.findFirst()]);
    const preparados = []; const omitidos = [];
    for (const estado of estados) {
      const candidato = presentarCandidato(estado);
      if (!candidato.elegible) { omitidos.push({ id_estado_pension: estado.id, motivo: candidato.motivo_exclusion }); continue; }
      const mensaje = crearMensaje({ canal, colegio: colegio?.nombre || 'COLEGIO HARVARD', alumno: candidato.alumno, mes: candidato.clave_mes, saldo: candidato.saldo, telefonoContacto: colegio && (colegio.telefono_whatsapp || colegio.telefono) });
      const envio = await prisma.tbl_cobranza_envios.create({ data: { id_estado_pension: estado.id, id_padre: candidato.id_padre, canal, telefono: candidato.telefono, mensaje, enlace_apertura: crearEnlace(canal, candidato.telefono, mensaje), creado_por: req.user.id, user_id_registration: req.user.id } });
      preparados.push({ ...envio, alumno: candidato.alumno, apoderado: candidato.apoderado });
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



