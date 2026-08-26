const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');

const normalizar = raw => (Array.isArray(raw) ? raw : []).map(item => ({
  clave: String(item.clave || item.clave_mes || item.mes || '').trim(),
  nombre: String(item.nombre || item.label || item.clave || '').trim(),
  tipo: item.tipo || 'mes',
  monto: item.monto === '' || item.monto === undefined || item.monto === null ? null : Number(item.monto),
})).filter(item => item.clave);

const texto = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const monto = (alumno, concepto) => {
  const descriptor = texto(`${concepto.clave} ${concepto.nombre}`);
  if (descriptor.includes('MATRICULA')) return Number(alumno.monto_matricula || 0);
  if (descriptor.includes('MATERIAL')) return Math.min(Number(alumno.monto_materiales || 0), 150);
  if (concepto.tipo === 'personalizado' && Number.isFinite(concepto.monto)) return concepto.monto;
  return Number(alumno.monto_pension || 0);
};

const cargarContexto = async id => {
  const alumno = await prisma.tbl_alumnos.findFirst({
    where: { id, estado: { not: 'DELETED' } },
    include: { tbl_aulas: { include: { tbl_grados: true } } },
  });
  if (!alumno) return { error: [404, 'Alumno no encontrado'] };
  const anio = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
  if (!anio) return { error: [400, 'No hay año escolar activo'] };
  const plantilla = await prisma.tbl_plantilla_pension.findFirst({ where: { id_anio_escolar: anio.id } });
  if (!plantilla) return { error: [404, 'No hay plantilla de pagos configurada'] };
  const conceptos = normalizar(plantilla.meses_json);
  const estados = await prisma.tbl_estado_pension.findMany({
    where: { id_alumno: id, id_plantilla: plantilla.id },
    include: { tbl_pagos_pension: { select: { id: true } } },
  });
  return { alumno, anio, plantilla, conceptos, estados, mapa: new Map(estados.map(e => [e.clave_mes, e])) };
};

const obtenerInfoRetiro = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Alumno inválido' });
    const ctx = await cargarContexto(id);
    if (ctx.error) return res.status(ctx.error[0]).json({ error: ctx.error[1] });
    const conceptos = ctx.conceptos.map((concepto, indice) => {
      const estado = ctx.mapa.get(concepto.clave);
      const montoActual = monto(ctx.alumno, concepto);
      const total = ['PENDIENTE', 'PAGO_PARCIAL'].includes(estado?.estado || 'PENDIENTE')
        ? montoActual
        : Number(estado?.monto_total ?? montoActual);
      const pagado = Number(estado?.monto_pagado || 0);
      return {
        ...concepto, indice, estado: estado?.estado || 'PENDIENTE',
        monto_total: total, monto_pagado: pagado,
        saldo: estado?.estado === 'NO_CORRESPONDE' ? 0 : Math.max(total - pagado, 0),
      };
    });
    res.json({ data: {
      alumno: {
        id: ctx.alumno.id, codigo_alumno: ctx.alumno.codigo_alumno,
        nombre_completo: ctx.alumno.nombre_completo, estado: ctx.alumno.estado,
        fecha_retiro: ctx.alumno.fecha_retiro, ultima_clave_cobro: ctx.alumno.ultima_clave_cobro,
        motivo_retiro: ctx.alumno.motivo_retiro, observacion_retiro: ctx.alumno.observacion_retiro,
        aula: `${ctx.alumno.tbl_aulas?.tbl_grados?.nombre || ''} ${ctx.alumno.tbl_aulas?.seccion || ''}`.trim(),
      },
      anio: ctx.anio.anio, conceptos,
    } });
  } catch (error) {
    console.error('Error al preparar retiro:', error);
    res.status(500).json({ error: 'No se pudo preparar el retiro del alumno' });
  }
};

const retirar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fechaRetiro = String(req.body.fecha_retiro || '').trim();
    const ultimaClave = String(req.body.ultima_clave_cobro || '').trim();
    const motivo = String(req.body.motivo_retiro || '').trim();
    const observacion = String(req.body.observacion_retiro || '').trim();
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Alumno inválido' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaRetiro)) return res.status(400).json({ error: 'Indique una fecha de retiro válida' });
    if (!ultimaClave) return res.status(400).json({ error: 'Seleccione el último concepto que corresponde cobrar' });
    if (!motivo) return res.status(400).json({ error: 'Indique el motivo del retiro' });

    const ctx = await cargarContexto(id);
    if (ctx.error) return res.status(ctx.error[0]).json({ error: ctx.error[1] });
    if (ctx.alumno.estado === 'RETIRADO') return res.status(409).json({ error: 'El alumno ya se encuentra retirado' });
    const indice = ctx.conceptos.findIndex(c => c.clave === ultimaClave);
    if (indice < 0) return res.status(400).json({ error: 'El concepto seleccionado no pertenece a la plantilla actual' });
    const posteriores = ctx.conceptos.slice(indice + 1);
    const pagados = posteriores.filter(c => {
      const e = ctx.mapa.get(c.clave);
      return Number(e?.monto_pagado || 0) > 0 || (e?.tbl_pagos_pension?.length || 0) > 0;
    });
    if (pagados.length) return res.status(409).json({
      error: `Hay pagos posteriores registrados: ${pagados.map(c => c.nombre).join(', ')}. Revíselos antes de retirar al alumno.`,
    });

    const detalle = `Retiro efectivo ${fechaRetiro}. Último concepto: ${ctx.conceptos[indice].nombre}. Motivo: ${motivo}`;
    await prisma.$transaction(async tx => {
      for (const concepto of posteriores) {
        await tx.tbl_estado_pension.upsert({
          where: { id_alumno_clave_mes: { id_alumno: id, clave_mes: concepto.clave } },
          update: {
            id_plantilla: ctx.plantilla.id, estado: 'NO_CORRESPONDE', monto_total: null, monto_pagado: 0,
            observacion_no_corresponde: detalle, actualizado_por: req.user.id,
            user_id_modification: req.user.id, date_time_modification: new Date(),
          },
          create: {
            id_plantilla: ctx.plantilla.id, id_alumno: id, clave_mes: concepto.clave,
            estado: 'NO_CORRESPONDE', monto_total: null, monto_pagado: 0,
            observacion_no_corresponde: detalle, actualizado_por: req.user.id,
            user_id_registration: req.user.id,
          },
        });
      }
      await tx.tbl_alumnos.update({
        where: { id },
        data: {
          estado: 'RETIRADO', fecha_retiro: new Date(`${fechaRetiro}T12:00:00.000Z`),
          ultima_clave_cobro: ultimaClave, motivo_retiro: motivo,
          observacion_retiro: observacion || null, retirado_por: req.user.id,
          user_id_modification: req.user.id, date_time_modification: new Date(),
        },
      });
    });
    await registrarAuditoria({
      userId: req.user.id, accion: 'RETIRAR_ALUMNO', tipoEntidad: 'tbl_alumnos', idEntidad: id,
      resumen: `${ctx.alumno.codigo_alumno} retirado el ${fechaRetiro}; deuda conservada hasta ${ctx.conceptos[indice].nombre}`,
      req, meta: { fecha_retiro: fechaRetiro, ultima_clave_cobro: ultimaClave, motivo, observacion: observacion || null, conceptos_anulados: posteriores.map(c => c.clave) },
    });
    res.json({ data: { id, estado: 'RETIRADO', conceptos_anulados: posteriores.length }, message: 'Alumno retirado. La deuda histórica se conserva y no se generarán cobros posteriores.' });
  } catch (error) {
    console.error('Error al retirar alumno:', error);
    res.status(500).json({ error: 'No se pudo retirar al alumno' });
  }
};

const reactivar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fechaReingreso = String(req.body.fecha_reingreso || '').trim();
    const primeraClave = String(req.body.primera_clave_cobro || '').trim();
    const observacion = String(req.body.observacion_reingreso || '').trim();
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Alumno inválido' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaReingreso)) return res.status(400).json({ error: 'Indique una fecha de reingreso válida' });
    if (!primeraClave) return res.status(400).json({ error: 'Seleccione el primer concepto que corresponde cobrar' });

    const ctx = await cargarContexto(id);
    if (ctx.error) return res.status(ctx.error[0]).json({ error: ctx.error[1] });
    if (ctx.alumno.estado !== 'RETIRADO') return res.status(409).json({ error: 'El alumno no se encuentra retirado' });
    const indice = ctx.conceptos.findIndex(c => c.clave === primeraClave);
    if (indice < 0) return res.status(400).json({ error: 'El concepto seleccionado no pertenece a la plantilla actual' });

    const deudaHistorica = ctx.conceptos.reduce((suma, concepto) => {
      const estado = ctx.mapa.get(concepto.clave);
      if (estado?.estado === 'NO_CORRESPONDE') return suma;
      return suma + Math.max(monto(ctx.alumno, concepto) - Number(estado?.monto_pagado || 0), 0);
    }, 0);
    const primerEstado = ctx.mapa.get(primeraClave);
    const cobroReingreso = !primerEstado || primerEstado.estado === 'NO_CORRESPONDE'
      ? Math.max(monto(ctx.alumno, ctx.conceptos[indice]) - Number(primerEstado?.monto_pagado || 0), 0)
      : 0;
    const detalle = `Reingreso efectivo ${fechaReingreso}. Primer concepto reactivado: ${ctx.conceptos[indice].nombre}.`;

    await prisma.$transaction(async tx => {
      for (const concepto of ctx.conceptos.slice(indice)) {
        const estadoActual = ctx.mapa.get(concepto.clave);
        if (estadoActual && estadoActual.estado !== 'NO_CORRESPONDE') continue;
        await tx.tbl_estado_pension.upsert({
          where: { id_alumno_clave_mes: { id_alumno: id, clave_mes: concepto.clave } },
          update: {
            id_plantilla: ctx.plantilla.id, estado: 'PENDIENTE', monto_total: monto(ctx.alumno, concepto), monto_pagado: 0,
            observacion_no_corresponde: null, actualizado_por: req.user.id,
            user_id_modification: req.user.id, date_time_modification: new Date(),
          },
          create: {
            id_plantilla: ctx.plantilla.id, id_alumno: id, clave_mes: concepto.clave,
            estado: 'PENDIENTE', monto_total: monto(ctx.alumno, concepto), monto_pagado: 0,
            actualizado_por: req.user.id, user_id_registration: req.user.id,
          },
        });
      }
      await tx.tbl_alumnos.update({
        where: { id },
        data: { estado: 'ACTIVO', user_id_modification: req.user.id, date_time_modification: new Date() },
      });
    });
    await registrarAuditoria({
      userId: req.user.id, accion: 'REACTIVAR_ALUMNO', tipoEntidad: 'tbl_alumnos', idEntidad: id,
      resumen: `${ctx.alumno.codigo_alumno} reactivado el ${fechaReingreso}; cobra desde ${ctx.conceptos[indice].nombre}`,
      req, meta: { fecha_reingreso: fechaReingreso, primera_clave_cobro: primeraClave, observacion: observacion || null, detalle },
    });
    res.json({ data: { id, estado: 'ACTIVO', deuda_historica: deudaHistorica, cobro_reingreso: cobroReingreso, total_para_reincorporarse: deudaHistorica + cobroReingreso }, message: 'Alumno reactivado. Se conservó la deuda histórica y se habilitaron los conceptos desde el periodo seleccionado.' });
  } catch (error) {
    console.error('Error al reactivar alumno:', error);
    res.status(500).json({ error: 'No se pudo reactivar al alumno' });
  }
};

module.exports = { obtenerInfoRetiro, retirar, reactivar };

