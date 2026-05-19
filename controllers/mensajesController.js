const prisma = require('../config/prisma');
const path = require('path');
const { emitToUser, emitToHilo } = require('../utils/socketEmitter');
const { enviarNotificacion } = require('../utils/notifUtils');
const { uploadFile } = require('../utils/storageService');

// FLW-19: Crear hilo de mensaje (padre<->tutor via alumno)
const crearHilo = async (req, res) => {
  const { id_alumno, asunto, mensaje } = req.body;
  if (!id_alumno || !asunto || !mensaje) {
    return res.status(400).json({ error: 'Alumno, asunto y mensaje son obligatorios' });
  }

  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });

    const hilo = await prisma.tbl_hilos_mensaje.create({
      data: { id_anio_escolar: anioActivo.id, id_alumno: parseInt(id_alumno), asunto, creado_por: req.user.id, user_id_registration: req.user.id },
    });

    const msgData = { id_hilo: hilo.id, id_usuario_emisor: req.user.id, cuerpo: mensaje, user_id_registration: req.user.id };
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const key = `adjuntos/msg-${req.user.id}-${Date.now()}${ext}`;
      msgData.adjunto_url = await uploadFile(req.file.buffer, key, req.file.mimetype);
      msgData.adjunto_nombre = req.file.originalname;
    }
    await prisma.tbl_mensajes.create({ data: msgData });

    // Notificar al receptor
    const alumno = await prisma.tbl_alumnos.findUnique({
      where: { id: parseInt(id_alumno) },
      include: {
        tbl_aulas: { include: { tbl_asignaciones_tutor: true } },
        tbl_padres_alumnos: { include: { tbl_padres: { select: { id_usuario: true } } } },
      },
    });

    let idUsuarioDestino;
    if (req.user.rol_codigo === 'PADRE') {
      idUsuarioDestino = alumno?.tbl_aulas?.tbl_asignaciones_tutor?.[0]?.id_usuario_tutor;
    } else {
      idUsuarioDestino = alumno?.tbl_padres_alumnos?.tbl_padres?.id_usuario;
    }

    if (idUsuarioDestino) {
      await enviarNotificacion('NUEVO_MENSAJE', idUsuarioDestino, {
        asunto,
        alumno: alumno?.nombre_completo || '',
      }, { referencia_id: parseInt(id_alumno) });
      emitToUser(idUsuarioDestino, 'hilo:actualizado', { id_hilo: hilo.id });
    }

    res.status(201).json({ data: { mensaje: 'Hilo creado', id: hilo.id } });
  } catch (error) {
    console.error('Error al crear hilo:', error);
    res.status(500).json({ error: 'Error al crear hilo' });
  }
};

// Responder en hilo
const responder = async (req, res) => {
  const id_hilo = parseInt(req.params.id_hilo);
  const { mensaje } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Mensaje obligatorio' });

  try {
    const msgData = { id_hilo, id_usuario_emisor: req.user.id, cuerpo: mensaje, user_id_registration: req.user.id };
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const key = `adjuntos/msg-${req.user.id}-${Date.now()}${ext}`;
      msgData.adjunto_url = await uploadFile(req.file.buffer, key, req.file.mimetype);
      msgData.adjunto_nombre = req.file.originalname;
    }
    const msg = await prisma.tbl_mensajes.create({ data: msgData });

    // Obtener mensaje completo con datos del remitente para emitir por WebSocket
    const msgCompleto = await prisma.tbl_mensajes.findUnique({
      where: { id: msg.id },
      include: { tbl_usuarios: { select: { id: true, nombres: true } } },
    });

    // Emitir al room del hilo (ambos participantes lo reciben)
    emitToHilo(id_hilo, 'mensaje:nuevo', {
      id_hilo,
      mensaje: {
        id: msgCompleto.id,
        contenido: msgCompleto.cuerpo,
        id_remitente: msgCompleto.id_usuario_emisor,
        remitente: msgCompleto.tbl_usuarios ? {
          id: msgCompleto.tbl_usuarios.id,
          nombres: msgCompleto.tbl_usuarios.nombres,
        } : null,
        adjunto_url: msgCompleto.adjunto_url || null,
        adjunto_nombre: msgCompleto.adjunto_nombre || null,
        enviado_en: msgCompleto.enviado_en,
      },
    });

    // Notificar al otro participante (notificacion + actualizar lista de hilos)
    const hilo = await prisma.tbl_hilos_mensaje.findUnique({
      where: { id: id_hilo },
      include: {
        tbl_alumnos: {
          include: {
            tbl_aulas: { include: { tbl_asignaciones_tutor: true } },
            tbl_padres_alumnos: { include: { tbl_padres: { select: { id_usuario: true } } } },
          },
        },
      },
    });

    if (hilo) {
      const tutorId = hilo.tbl_alumnos?.tbl_aulas?.tbl_asignaciones_tutor?.[0]?.id_usuario_tutor;
      const padreId = hilo.tbl_alumnos?.tbl_padres_alumnos?.tbl_padres?.id_usuario;
      const destino = req.user.id === tutorId ? padreId : tutorId;

      if (destino) {
        const alumnoNombre = hilo.tbl_alumnos?.nombre_completo || '';
        await enviarNotificacion('NUEVO_MENSAJE', destino, {
          asunto: hilo.asunto,
          alumno: alumnoNombre,
        }, { referencia_id: hilo.id_alumno });
        emitToUser(destino, 'hilo:actualizado', { id_hilo });
      }
    }

    res.status(201).json({ data: { mensaje: 'Mensaje enviado', id: msg.id } });
  } catch (error) { res.status(500).json({ error: 'Error al enviar mensaje' }); }
};

// Listar hilos (filtrado por rol)
const listarHilos = async (req, res) => {
  const { id_alumno } = req.query;
  const rolCodigo = req.user.rol_codigo;

  try {
    const where = {};
    if (id_alumno) where.id_alumno = parseInt(id_alumno);

    // Padre: solo hilos de sus hijos
    if (rolCodigo === 'PADRE') {
      const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
      if (padre) {
        const vinculos = await prisma.tbl_padres_alumnos.findMany({ where: { id_padre: padre.id }, select: { id_alumno: true } });
        where.id_alumno = { in: vinculos.map(v => v.id_alumno) };
      }
    }
    // Tutor: solo hilos de alumnos de sus aulas
    else if (rolCodigo === 'TUTOR') {
      const asignaciones = await prisma.tbl_asignaciones_tutor.findMany({ where: { id_usuario_tutor: req.user.id }, select: { id_aula: true } });
      const alumnos = await prisma.tbl_alumnos.findMany({ where: { id_aula: { in: asignaciones.map(a => a.id_aula) } }, select: { id: true } });
      where.id_alumno = { in: alumnos.map(a => a.id) };
    }
    // Admin/SuperAdmin: ven todos (opcionalmente filtrado por alumno)

    const hilos = await prisma.tbl_hilos_mensaje.findMany({
      where,
      include: {
        tbl_alumnos: { select: { nombre_completo: true } },
        tbl_usuarios: { select: { nombres: true } },
        tbl_mensajes: { orderBy: { enviado_en: 'desc' }, take: 1, select: { cuerpo: true, enviado_en: true, id_usuario_emisor: true } },
        _count: { select: { tbl_mensajes: true } },
      },
      orderBy: { date_time_registration: 'desc' },
    });

    const data = hilos.map(h => ({
      id: h.id,
      asunto: h.asunto,
      alumno: h.tbl_alumnos?.nombre_completo || null,
      creador: h.tbl_usuarios?.nombres || null,
      creado_por: h.creado_por,
      total_mensajes: h._count.tbl_mensajes,
      ultimo_mensaje: h.tbl_mensajes[0]?.cuerpo || null,
      ultimo_mensaje_fecha: h.tbl_mensajes[0]?.enviado_en || null,
      date_time_registration: h.date_time_registration,
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error al listar hilos:', error);
    res.status(500).json({ error: 'Error al listar hilos' });
  }
};

// Obtener mensajes de un hilo
const obtenerMensajes = async (req, res) => {
  const id_hilo = parseInt(req.params.id_hilo);
  try {
    const mensajes = await prisma.tbl_mensajes.findMany({
      where: { id_hilo },
      include: { tbl_usuarios: { select: { id: true, nombres: true, tbl_roles: { select: { codigo: true } } } } },
      orderBy: { enviado_en: 'asc' },
    });

    const data = mensajes.map(m => ({
      id: m.id,
      contenido: m.cuerpo,
      id_remitente: m.id_usuario_emisor,
      remitente: m.tbl_usuarios ? {
        id: m.tbl_usuarios.id,
        nombres: m.tbl_usuarios.nombres,
        rol: m.tbl_usuarios.tbl_roles?.codigo || null,
      } : null,
      adjunto_url: m.adjunto_url || null,
      adjunto_nombre: m.adjunto_nombre || null,
      enviado_en: m.enviado_en,
      date_time_registration: m.date_time_registration,
    }));

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al obtener mensajes' }); }
};

// Listar destinatarios validos para nuevo hilo (B6 fix)
const listarDestinatarios = async (req, res) => {
  const rolCodigo = req.user.rol_codigo;
  try {
    let destinatarios = [];

    if (rolCodigo === 'PADRE') {
      // Padre ve a los tutores de sus hijos
      const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
      if (padre) {
        const vinculos = await prisma.tbl_padres_alumnos.findMany({
          where: { id_padre: padre.id },
          include: {
            tbl_alumnos: {
              select: {
                id: true, nombre_completo: true,
                tbl_aulas: {
                  select: {
                    seccion: true,
                    tbl_grados: { select: { nombre: true } },
                    tbl_asignaciones_tutor: { include: { tbl_usuarios: { select: { id: true, nombres: true } } } },
                  },
                },
              },
            },
          },
        });
        vinculos.forEach(v => {
          const al = v.tbl_alumnos;
          const tutor = al.tbl_aulas?.tbl_asignaciones_tutor?.[0]?.tbl_usuarios;
          if (tutor) {
            destinatarios.push({
              id_alumno: al.id,
              alumno: al.nombre_completo,
              aula: `${al.tbl_aulas?.tbl_grados?.nombre || ''} ${al.tbl_aulas?.seccion || ''}`.trim(),
              tutor: { id: tutor.id, nombres: tutor.nombres },
            });
          }
        });
      }
    } else if (rolCodigo === 'TUTOR') {
      // Tutor ve a los padres de sus alumnos
      const asignaciones = await prisma.tbl_asignaciones_tutor.findMany({ where: { id_usuario_tutor: req.user.id }, select: { id_aula: true } });
      const alumnos = await prisma.tbl_alumnos.findMany({
        where: { id_aula: { in: asignaciones.map(a => a.id_aula) }, estado: 'ACTIVO' },
        include: {
          tbl_aulas: { select: { seccion: true, tbl_grados: { select: { nombre: true } } } },
          tbl_padres_alumnos: { include: { tbl_padres: { select: { id: true, nombre_completo: true, id_usuario: true } } } },
        },
      });
      alumnos.forEach(al => {
        const padre = al.tbl_padres_alumnos?.tbl_padres;
        destinatarios.push({
          id_alumno: al.id,
          alumno: al.nombre_completo,
          aula: `${al.tbl_aulas?.tbl_grados?.nombre || ''} ${al.tbl_aulas?.seccion || ''}`.trim(),
          padre: padre ? { id: padre.id, nombres: padre.nombre_completo } : null,
        });
      });
    } else {
      // Admin/SuperAdmin: all students with parents
      const alumnos = await prisma.tbl_alumnos.findMany({
        where: { estado: 'ACTIVO' },
        include: {
          tbl_aulas: { select: { seccion: true, tbl_grados: { select: { nombre: true } } } },
          tbl_padres_alumnos: { include: { tbl_padres: { select: { id: true, nombre_completo: true } } } },
        },
        orderBy: { nombre_completo: 'asc' },
      });
      destinatarios = alumnos.map(al => ({
        id_alumno: al.id,
        alumno: al.nombre_completo,
        aula: `${al.tbl_aulas?.tbl_grados?.nombre || ''} ${al.tbl_aulas?.seccion || ''}`.trim(),
        padre: al.tbl_padres_alumnos?.tbl_padres ? { id: al.tbl_padres_alumnos.tbl_padres.id, nombres: al.tbl_padres_alumnos.tbl_padres.nombre_completo } : null,
      }));
    }

    res.json({ data: destinatarios });
  } catch (error) {
    console.error('Error al listar destinatarios:', error);
    res.status(500).json({ error: 'Error al listar destinatarios' });
  }
};

module.exports = { crearHilo, responder, listarHilos, obtenerMensajes, listarDestinatarios };
