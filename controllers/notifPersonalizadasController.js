const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { emitNotificacion } = require('../utils/socketEmitter');
const { todayLima } = require('../utils/dateUtils');

// --- Resolver destinatarios según audiencia ---

const resolverDestinatarios = async (tipo_audiencia, id_ref_audiencia) => {
  const userIds = new Set();

  if (tipo_audiencia === 'COLEGIO') {
    const usuarios = await prisma.tbl_usuarios.findMany({
      where: { estado: 'ACTIVO' },
      select: { id: true },
    });
    usuarios.forEach(u => userIds.add(u.id));
    return Array.from(userIds);
  }

  const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
  if (!anioActivo) return [];

  let aulaFilter = {};

  if (tipo_audiencia === 'NIVEL') {
    aulaFilter = { id_anio_escolar: anioActivo.id, tbl_grados: { id_nivel: id_ref_audiencia } };
  } else if (tipo_audiencia === 'GRADO') {
    aulaFilter = { id_anio_escolar: anioActivo.id, id_grado: id_ref_audiencia };
  } else if (tipo_audiencia === 'AULA') {
    aulaFilter = { id: id_ref_audiencia, id_anio_escolar: anioActivo.id };
  }

  const aulas = await prisma.tbl_aulas.findMany({
    where: aulaFilter,
    select: { id: true },
  });
  const aulaIds = aulas.map(a => a.id);
  if (aulaIds.length === 0) return [];

  // Padres vía alumnos
  const alumnos = await prisma.tbl_alumnos.findMany({
    where: { id_aula: { in: aulaIds }, estado: 'ACTIVO' },
    select: { id: true },
  });
  if (alumnos.length > 0) {
    const vinculos = await prisma.tbl_padres_alumnos.findMany({
      where: { id_alumno: { in: alumnos.map(a => a.id) } },
      include: { tbl_padres: { select: { id_usuario: true } } },
    });
    vinculos.forEach(v => {
      if (v.tbl_padres?.id_usuario) userIds.add(v.tbl_padres.id_usuario);
    });
  }

  // Tutores vía asignaciones
  const tutores = await prisma.tbl_asignaciones_tutor.findMany({
    where: { id_aula: { in: aulaIds } },
    select: { id_usuario_tutor: true },
  });
  tutores.forEach(t => userIds.add(t.id_usuario_tutor));

  return Array.from(userIds);
};

// --- Crear notificación personalizada ---

// --- Lógica compartida de envío (usada por crear inmediato y cron) ---

const _enviarNotificacion = async (master, userId) => {
  const { titulo, cuerpo, tipo_entrega, tipo_audiencia, id_ref_audiencia } = master;

  const destinatarioIds = await resolverDestinatarios(tipo_audiencia, id_ref_audiencia);
  if (destinatarioIds.length === 0) return 0;

  const fechaHoy = todayLima().date;
  const incluyeBuzon = ['buzon', 'ambos'].includes(tipo_entrega);

  await prisma.$transaction(async (tx) => {
    // Crear filas de destinatarios
    await tx.tbl_destinatarios_notif_personalizada.createMany({
      data: destinatarioIds.map(uid => ({
        id_notif_personalizada: master.id,
        id_usuario: uid,
        user_id_registration: userId,
      })),
    });

    // Crear notificaciones en buzón
    if (incluyeBuzon) {
      await tx.tbl_notificaciones.createMany({
        data: destinatarioIds.map(uid => ({
          id_usuario: uid,
          codigo_plantilla: 'NOTIF_PERSONALIZADA',
          titulo,
          cuerpo,
          fecha: fechaHoy,
          referencia_id: master.id,
        })),
      });
    }

    // Actualizar totales y estado
    await tx.tbl_notificaciones_personalizadas.update({
      where: { id: master.id },
      data: { total_destinatarios: destinatarioIds.length, estado: 'ENVIADA' },
    });
  });

  // Emitir socket fuera de la transacción
  if (incluyeBuzon) {
    for (const uid of destinatarioIds) {
      emitNotificacion(uid, { titulo, cuerpo });
    }
  }

  return destinatarioIds.length;
};

// --- Crear notificación personalizada ---

const crear = async (req, res) => {
  const { titulo, cuerpo, tipo_entrega, tipo_audiencia, id_ref_audiencia, fecha_programada } = req.body;

  if (!titulo || !cuerpo || !tipo_entrega || !tipo_audiencia) {
    return res.status(400).json({ error: 'Titulo, cuerpo, tipo_entrega y tipo_audiencia son obligatorios' });
  }
  if (!['buzon', 'modal', 'ambos'].includes(tipo_entrega)) {
    return res.status(400).json({ error: 'tipo_entrega debe ser buzon, modal o ambos' });
  }
  if (!['COLEGIO', 'NIVEL', 'GRADO', 'AULA'].includes(tipo_audiencia)) {
    return res.status(400).json({ error: 'tipo_audiencia debe ser COLEGIO, NIVEL, GRADO o AULA' });
  }
  if (tipo_audiencia !== 'COLEGIO' && !id_ref_audiencia) {
    return res.status(400).json({ error: 'id_ref_audiencia es requerido para audiencia no COLEGIO' });
  }

  try {
    // Validar que la referencia exista
    if (tipo_audiencia === 'NIVEL') {
      const nivel = await prisma.tbl_niveles.findUnique({ where: { id: parseInt(id_ref_audiencia) } });
      if (!nivel) return res.status(404).json({ error: 'Nivel no encontrado' });
    } else if (tipo_audiencia === 'GRADO') {
      const grado = await prisma.tbl_grados.findUnique({ where: { id: parseInt(id_ref_audiencia) } });
      if (!grado) return res.status(404).json({ error: 'Grado no encontrado' });
    } else if (tipo_audiencia === 'AULA') {
      const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
      if (!anioActivo) return res.status(400).json({ error: 'No hay año escolar activo' });
      const aula = await prisma.tbl_aulas.findFirst({ where: { id: parseInt(id_ref_audiencia), id_anio_escolar: anioActivo.id } });
      if (!aula) return res.status(404).json({ error: 'Aula no encontrada en el año activo' });
    }

    // Determinar si es programada o inmediata
    const hoyISO = todayLima().iso;
    const esProgramada = fecha_programada && fecha_programada > hoyISO;

    if (esProgramada) {
      // --- PROGRAMADA: solo crear master, sin destinatarios ni buzón ---
      const master = await prisma.tbl_notificaciones_personalizadas.create({
        data: {
          titulo, cuerpo, tipo_entrega, tipo_audiencia,
          id_ref_audiencia: id_ref_audiencia ? parseInt(id_ref_audiencia) : null,
          estado: 'PROGRAMADA',
          fecha_programada: new Date(fecha_programada + 'T00:00:00Z'),
          creado_por: req.user.id,
          user_id_registration: req.user.id,
        },
      });

      await registrarAuditoria({
        userId: req.user.id,
        accion: 'PROGRAMAR_NOTIFICACION_PERSONALIZADA',
        tipoEntidad: 'tbl_notificaciones_personalizadas',
        idEntidad: master.id,
        resumen: `Notif "${titulo}" programada para ${fecha_programada} (${tipo_audiencia})`,
      });

      return res.status(201).json({ data: { mensaje: 'Notificación programada', id: master.id, programada_para: fecha_programada } });
    }

    // --- INMEDIATA: crear master + enviar ---
    const master = await prisma.tbl_notificaciones_personalizadas.create({
      data: {
        titulo, cuerpo, tipo_entrega, tipo_audiencia,
        id_ref_audiencia: id_ref_audiencia ? parseInt(id_ref_audiencia) : null,
        estado: 'ENVIADA',
        creado_por: req.user.id,
        user_id_registration: req.user.id,
      },
    });

    const totalDestinatarios = await _enviarNotificacion(master, req.user.id);
    if (totalDestinatarios === 0) {
      await prisma.tbl_notificaciones_personalizadas.delete({ where: { id: master.id } });
      return res.status(400).json({ error: 'No se encontraron destinatarios para la audiencia seleccionada' });
    }

    await registrarAuditoria({
      userId: req.user.id,
      accion: 'CREAR_NOTIFICACION_PERSONALIZADA',
      tipoEntidad: 'tbl_notificaciones_personalizadas',
      idEntidad: master.id,
      resumen: `Notif "${titulo}" enviada a ${totalDestinatarios} destinatarios (${tipo_audiencia})`,
    });

    res.status(201).json({ data: { mensaje: 'Notificación personalizada enviada', id: master.id, total_destinatarios: totalDestinatarios } });
  } catch (error) {
    console.error('Error al crear notificación personalizada:', error);
    res.status(500).json({ error: 'Error al crear notificación personalizada' });
  }
};

// --- Cron: ejecutar notificaciones programadas ---

const ejecutarProgramadas = async () => {
  const hoyISO = todayLima().iso;
  const hoyDate = new Date(hoyISO + 'T00:00:00Z');

  const pendientes = await prisma.tbl_notificaciones_personalizadas.findMany({
    where: { estado: 'PROGRAMADA', activa: true, fecha_programada: { lte: hoyDate } },
  });

  for (const notif of pendientes) {
    try {
      const total = await _enviarNotificacion(notif, notif.creado_por);
      console.log(`[CRON] Notif programada #${notif.id} enviada a ${total} destinatarios`);

      await registrarAuditoria({
        userId: notif.creado_por,
        accion: 'ENVIAR_NOTIFICACION_PROGRAMADA',
        tipoEntidad: 'tbl_notificaciones_personalizadas',
        idEntidad: notif.id,
        resumen: `Notif programada "${notif.titulo}" enviada a ${total} destinatarios`,
      });
    } catch (err) {
      console.error(`[CRON] Error enviando notif programada #${notif.id}:`, err.message);
    }
  }
};

// --- Listar notificaciones personalizadas con stats ---

const listar = async (req, res) => {
  try {
    const notifs = await prisma.tbl_notificaciones_personalizadas.findMany({
      orderBy: { date_time_registration: 'desc' },
      include: {
        usuario_creador: { select: { nombres: true } },
        _count: {
          select: { tbl_destinatarios_notif_personalizada: true },
        },
      },
    });

    const data = await Promise.all(notifs.map(async (n) => {
      // Contar modal aceptados
      const totalAceptadasModal = await prisma.tbl_destinatarios_notif_personalizada.count({
        where: { id_notif_personalizada: n.id, aceptada_modal: true },
      });

      // Contar buzón leídas
      const totalLeidasBuzon = await prisma.tbl_notificaciones.count({
        where: { codigo_plantilla: 'NOTIF_PERSONALIZADA', referencia_id: n.id, leida: true },
      });

      // Resolver nombre de audiencia
      let nombre_audiencia = 'Todo el colegio';
      if (n.tipo_audiencia === 'NIVEL' && n.id_ref_audiencia) {
        const nivel = await prisma.tbl_niveles.findUnique({ where: { id: n.id_ref_audiencia }, select: { nombre: true } });
        nombre_audiencia = nivel?.nombre || 'Nivel desconocido';
      } else if (n.tipo_audiencia === 'GRADO' && n.id_ref_audiencia) {
        const grado = await prisma.tbl_grados.findUnique({
          where: { id: n.id_ref_audiencia },
          select: { nombre: true, tbl_niveles: { select: { nombre: true } } },
        });
        nombre_audiencia = grado ? `${grado.tbl_niveles?.nombre || ''} - ${grado.nombre}` : 'Grado desconocido';
      } else if (n.tipo_audiencia === 'AULA' && n.id_ref_audiencia) {
        const aula = await prisma.tbl_aulas.findUnique({
          where: { id: n.id_ref_audiencia },
          select: { seccion: true, tbl_grados: { select: { nombre: true, tbl_niveles: { select: { nombre: true } } } } },
        });
        nombre_audiencia = aula ? `${aula.tbl_grados?.nombre || ''} "${aula.seccion}" - ${aula.tbl_grados?.tbl_niveles?.nombre || ''}` : 'Aula desconocida';
      }

      return {
        id: n.id,
        titulo: n.titulo,
        cuerpo: n.cuerpo,
        tipo_entrega: n.tipo_entrega,
        tipo_audiencia: n.tipo_audiencia,
        nombre_audiencia,
        estado: n.estado,
        fecha_programada: n.fecha_programada,
        total_destinatarios: n.total_destinatarios,
        total_leidas_buzon: totalLeidasBuzon,
        total_aceptadas_modal: totalAceptadasModal,
        creado_por_nombre: n.usuario_creador?.nombres || '-',
        activa: n.activa,
        date_time_registration: n.date_time_registration,
      };
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error al listar notificaciones personalizadas:', error);
    res.status(500).json({ error: 'Error al listar notificaciones personalizadas' });
  }
};

// --- Eliminar (soft-delete) ---

const eliminar = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const notif = await prisma.tbl_notificaciones_personalizadas.findUnique({ where: { id } });
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });

    await prisma.tbl_notificaciones_personalizadas.update({
      where: { id },
      data: { activa: false, user_id_modification: req.user.id, date_time_modification: new Date() },
    });

    await registrarAuditoria({
      userId: req.user.id,
      accion: 'ELIMINAR_NOTIFICACION_PERSONALIZADA',
      tipoEntidad: 'tbl_notificaciones_personalizadas',
      idEntidad: id,
      resumen: `Notif "${notif.titulo}" eliminada`,
    });

    res.json({ mensaje: 'Notificación personalizada eliminada' });
  } catch (error) {
    console.error('Error al eliminar notificación personalizada:', error);
    res.status(500).json({ error: 'Error al eliminar notificación personalizada' });
  }
};

// --- Aceptar modal ---

const aceptarModal = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const destinatario = await prisma.tbl_destinatarios_notif_personalizada.findFirst({
      where: { id_notif_personalizada: id, id_usuario: req.user.id },
    });
    if (!destinatario) return res.status(404).json({ error: 'No es destinatario de esta notificación' });

    await prisma.tbl_destinatarios_notif_personalizada.update({
      where: { id: destinatario.id },
      data: { aceptada_modal: true, fecha_aceptacion_modal: new Date() },
    });

    res.json({ mensaje: 'Modal aceptado' });
  } catch (error) {
    console.error('Error al aceptar modal:', error);
    res.status(500).json({ error: 'Error al aceptar modal' });
  }
};

module.exports = { crear, listar, eliminar, aceptarModal, ejecutarProgramadas };
