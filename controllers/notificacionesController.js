const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { todayLima, currentMesLima, MES_LABELS } = require('../utils/dateUtils');
const { renderTemplate, enviarNotificacion } = require('../utils/notifUtils');

const listar = async (req, res) => {
  try {
    const notificaciones = await prisma.tbl_notificaciones.findMany({
      where: { id_usuario: req.user.id },
      orderBy: { date_time_registration: 'desc' },
      take: 50,
    });

    const data = notificaciones.map(n => ({
      id: n.id,
      codigo_plantilla: n.codigo_plantilla,
      referencia_id: n.referencia_id,
      titulo: n.titulo,
      mensaje: n.cuerpo,
      leida: n.leida,
      fecha: n.fecha,
      date_time_registration: n.date_time_registration,
    }));

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar notificaciones' }); }
};

const marcarLeida = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.tbl_notificaciones.update({ where: { id }, data: { leida: true } });
    res.json({ mensaje: 'Notificacion marcada como leida' });
  } catch (error) { res.status(500).json({ error: 'Error al marcar notificacion' }); }
};

const marcarTodasLeidas = async (req, res) => {
  try {
    await prisma.tbl_notificaciones.updateMany({ where: { id_usuario: req.user.id, leida: false }, data: { leida: true } });
    res.json({ mensaje: 'Todas las notificaciones marcadas como leidas' });
  } catch (error) { res.status(500).json({ error: 'Error al marcar notificaciones' }); }
};

const contarNoLeidas = async (req, res) => {
  try {
    const count = await prisma.tbl_notificaciones.count({ where: { id_usuario: req.user.id, leida: false } });
    res.json({ no_leidas: count });
  } catch (error) { res.status(500).json({ error: 'Error al contar notificaciones' }); }
};

const listarPlantillas = async (req, res) => {
  try {
    const plantillas = await prisma.tbl_plantillas_notificacion.findMany({ orderBy: { id: 'asc' } });
    res.json({ data: plantillas });
  } catch (error) { res.status(500).json({ error: 'Error al listar plantillas' }); }
};

const actualizarPlantilla = async (req, res) => {
  const id = parseInt(req.params.id);
  const { titulo, cuerpo, habilitada, tipo_entrega } = req.body;
  try {
    const data = { user_id_modification: req.user.id, date_time_modification: new Date() };
    if (titulo !== undefined) data.titulo = titulo;
    if (cuerpo !== undefined) data.cuerpo = cuerpo;
    if (habilitada !== undefined) data.habilitada = habilitada;
    if (tipo_entrega !== undefined) {
      if (!['buzon', 'modal', 'ambos'].includes(tipo_entrega)) {
        return res.status(400).json({ error: 'tipo_entrega debe ser buzon, modal o ambos' });
      }
      data.tipo_entrega = tipo_entrega;
    }

    await prisma.tbl_plantillas_notificacion.update({ where: { id }, data });
    await registrarAuditoria({ userId: req.user.id, accion: 'CONFIGURAR_PLANTILLA_NOTIFICACION', tipoEntidad: 'tbl_plantillas_notificacion', idEntidad: id, resumen: `Plantilla ${id} actualizada` });
    res.json({ mensaje: 'Plantilla actualizada' });
  } catch (error) { res.status(500).json({ error: 'Error al actualizar plantilla' }); }
};

// --- Config Pension Reminder ---

const obtenerConfigPension = async (req, res) => {
  try {
    const config = await prisma.tbl_config_pension_reminder.findFirst();
    if (!config) return res.status(404).json({ error: 'Config de pension no encontrada. Ejecute el seed.' });
    res.json({ data: config });
  } catch (error) { res.status(500).json({ error: 'Error al obtener configuracion de pension' }); }
};

const actualizarConfigPension = async (req, res) => {
  const { dia_inicio, frecuencia_dias, activa } = req.body;
  try {
    if (dia_inicio !== undefined && (dia_inicio < 1 || dia_inicio > 28)) {
      return res.status(400).json({ error: 'dia_inicio debe estar entre 1 y 28' });
    }
    if (frecuencia_dias !== undefined && (frecuencia_dias < 1 || frecuencia_dias > 30)) {
      return res.status(400).json({ error: 'frecuencia_dias debe estar entre 1 y 30' });
    }

    const data = { user_id_modification: req.user.id, date_time_modification: new Date() };
    if (dia_inicio !== undefined) data.dia_inicio = dia_inicio;
    if (frecuencia_dias !== undefined) data.frecuencia_dias = frecuencia_dias;
    if (activa !== undefined) data.activa = activa;

    const config = await prisma.tbl_config_pension_reminder.update({
      where: { id: 1 },
      data,
    });

    await registrarAuditoria({ userId: req.user.id, accion: 'CONFIGURAR_PENSION_REMINDER', tipoEntidad: 'tbl_config_pension_reminder', idEntidad: config.id, resumen: `Config pension: dia=${config.dia_inicio}, freq=${config.frecuencia_dias}, activa=${config.activa}` });
    res.json({ mensaje: 'Configuracion actualizada', data: config });
  } catch (error) { res.status(500).json({ error: 'Error al actualizar configuracion de pension' }); }
};

// --- Shared pension check logic ---

const _checkPensionData = async (userId) => {
  const config = await prisma.tbl_config_pension_reminder.findFirst();
  if (!config || !config.activa) return null;

  const plantilla = await prisma.tbl_plantillas_notificacion.findUnique({ where: { codigo: 'PENSION_25_30' } });
  if (!plantilla || !plantilla.habilitada) return null;

  const limaToday = todayLima();
  const dia = parseInt(limaToday.iso.split('-')[2]);

  if (dia < config.dia_inicio) return null;
  if ((dia - config.dia_inicio) % config.frecuencia_dias !== 0) return null;

  const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: userId } });
  if (!padre) return null;

  const vinculos = await prisma.tbl_padres_alumnos.findMany({ where: { id_padre: padre.id }, select: { id_alumno: true } });
  const idsAlumnos = vinculos.map(v => v.id_alumno);
  if (idsAlumnos.length === 0) return null;

  const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
  if (!anioActivo) return null;

  const { key: mesActual, label: mesLabel } = currentMesLima();

  const pendientes = await prisma.tbl_estado_pension.findMany({
    where: { id_alumno: { in: idsAlumnos }, clave_mes: mesActual, estado: { not: 'PAGADO' } },
    include: { tbl_alumnos: { select: { nombre_completo: true } } },
  });

  const alumnosSinRegistro = [];
  for (const idAlumno of idsAlumnos) {
    const tiene = await prisma.tbl_estado_pension.findFirst({
      where: { id_alumno: idAlumno, clave_mes: mesActual },
    });
    if (!tiene) {
      const al = await prisma.tbl_alumnos.findUnique({ where: { id: idAlumno }, select: { nombre_completo: true } });
      if (al) alumnosSinRegistro.push({ nombre_completo: al.nombre_completo });
    }
  }

  const todosPendientes = [...pendientes.map(p => p.tbl_alumnos.nombre_completo), ...alumnosSinRegistro.map(a => a.nombre_completo)];
  if (todosPendientes.length === 0) return null;

  // Renderizar el cuerpo de la plantilla para uso en el modal
  const cuerpoRenderizado = renderTemplate(plantilla.cuerpo, { mes: mesLabel });

  return { mes: mesActual, mesLabel, alumnos: todosPendientes, tipo_entrega: plantilla.tipo_entrega, titulo: plantilla.titulo, cuerpo: cuerpoRenderizado };
};

const verificarPensionReminder = async (req, res) => {
  try {
    if (req.user.rol_codigo !== 'PADRE') return res.json({ mostrar: false });
    const result = await _checkPensionData(req.user.id);
    if (!result) return res.json({ mostrar: false });
    res.json({ mostrar: true, mes: result.mes, mesLabel: result.mesLabel, alumnos: result.alumnos, tipo_entrega: result.tipo_entrega });
  } catch (error) { res.status(500).json({ error: 'Error al verificar pension' }); }
};

const obtenerModalPendiente = async (req, res) => {
  try {
    // 1. Verificar modal de pensión (solo PADRE)
    if (req.user.rol_codigo === 'PADRE') {
      const result = await _checkPensionData(req.user.id);
      if (result) {
        // Crear notificacion buzon si tipo_entrega lo incluye (deduplicada por dia)
        if (['buzon', 'ambos'].includes(result.tipo_entrega)) {
          const fechaHoy = todayLima().date;
          const yaExiste = await prisma.tbl_notificaciones.findFirst({
            where: { id_usuario: req.user.id, codigo_plantilla: 'PENSION_25_30', fecha: fechaHoy },
          });
          if (!yaExiste) {
            await enviarNotificacion('PENSION_25_30', req.user.id, { mes: result.mesLabel }, { fecha: fechaHoy });
          }
        }

        // Retornar modal de pensión si tipo_entrega lo incluye
        if (['modal', 'ambos'].includes(result.tipo_entrega)) {
          return res.json({ data: { tipo: 'pension', mes: result.mes, mesLabel: result.mesLabel, alumnos: result.alumnos, titulo: result.titulo, cuerpo: result.cuerpo } });
        }
      }
    }

    // 2. Verificar modal de notificación personalizada (todos los roles)
    const notifPendiente = await prisma.tbl_destinatarios_notif_personalizada.findFirst({
      where: {
        id_usuario: req.user.id,
        aceptada_modal: false,
        tbl_notificaciones_personalizadas: {
          activa: true,
          tipo_entrega: { in: ['modal', 'ambos'] },
        },
      },
      include: {
        tbl_notificaciones_personalizadas: {
          select: { id: true, titulo: true, cuerpo: true },
        },
      },
      orderBy: {
        tbl_notificaciones_personalizadas: { date_time_registration: 'asc' },
      },
    });

    if (notifPendiente) {
      const np = notifPendiente.tbl_notificaciones_personalizadas;
      return res.json({ data: { tipo: 'notificacion_personalizada', id: np.id, titulo: np.titulo, cuerpo: np.cuerpo } });
    }

    res.json({ data: null });
  } catch (error) { res.status(500).json({ error: 'Error al verificar modales pendientes' }); }
};

module.exports = { listar, marcarLeida, marcarTodasLeidas, contarNoLeidas, listarPlantillas, actualizarPlantilla, verificarPensionReminder, obtenerConfigPension, actualizarConfigPension, obtenerModalPendiente };
