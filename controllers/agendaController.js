const prisma = require('../config/prisma');
const { todayLima, parseDateOnly } = require('../utils/dateUtils');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { emitToAula, emitToUser } = require('../utils/socketEmitter');
const { enviarNotificacion } = require('../utils/notifUtils');

const AGENDA_INCLUDE = {
  tbl_firmas_agenda: { include: { tbl_padres: { select: { id: true, nombre_completo: true } } } },
  tbl_respuestas_agenda: { include: { tbl_padres: { select: { nombre_completo: true } } } },
  tbl_usuarios: { select: { nombres: true } },
  tbl_alumnos: { select: { nombre_completo: true } },
  tbl_aulas: { select: { seccion: true, tbl_grados: { select: { nombre: true } } } },
};

const mapEntrada = (e, padreId) => ({
  id: e.id,
  fecha: e.fecha,
  alcance: e.alcance,
  contenido: e.contenido_texto,
  requiere_firma: e.requiere_firma,
  publicado_en: e.publicado_en,
  date_time_registration: e.date_time_registration,
  tutor: e.tbl_usuarios,
  alumno: e.tbl_alumnos,
  aula: e.tbl_aulas ? { seccion: e.tbl_aulas.seccion, grado: e.tbl_aulas.tbl_grados } : null,
  firmas: (e.tbl_firmas_agenda || []).map(f => ({
    id: f.id,
    firmado_en: f.firmado_en,
    padre: f.tbl_padres,
  })),
  firmada: padreId ? (e.tbl_firmas_agenda || []).some(f => f.id_padre === padreId) : false,
  respuestas: (e.tbl_respuestas_agenda || []).map(r => ({
    id: r.id,
    contenido: r.mensaje,
    padre: r.tbl_padres,
    date_time_registration: r.date_time_registration,
  })),
});

// Listar entradas de agenda
const listar = async (req, res) => {
  const { id_aula, id_alumno, fecha } = req.query;
  try {
    const where = { esta_publicado: true };
    if (fecha) where.fecha = parseDateOnly(fecha);

    // Cuando se filtra por alumno, traer también las entradas del aula del alumno
    if (id_alumno) {
      const alumno = await prisma.tbl_alumnos.findUnique({
        where: { id: parseInt(id_alumno) },
        select: { id_aula: true },
      });
      where.OR = [
        { id_alumno: parseInt(id_alumno), alcance: 'ALUMNO' },
        ...(alumno?.id_aula ? [{ id_aula: alumno.id_aula, alcance: 'AULA' }] : []),
      ];
    } else if (id_aula) {
      where.id_aula = parseInt(id_aula);
    }

    // Si es PADRE, restringir a alumnos vinculados
    if (req.user.rol_codigo === 'PADRE' && !id_alumno) {
      const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
      if (padre) {
        const vinculos = await prisma.tbl_padres_alumnos.findMany({ where: { id_padre: padre.id }, select: { id_alumno: true } });
        const idsAlumnos = vinculos.map(v => v.id_alumno);
        const hijos = await prisma.tbl_alumnos.findMany({ where: { id: { in: idsAlumnos } }, select: { id_aula: true } });
        const idsAulas = [...new Set(hijos.map(h => h.id_aula))];
        where.OR = [
          { id_aula: { in: idsAulas }, alcance: 'AULA' },
          { id_alumno: { in: idsAlumnos }, alcance: 'ALUMNO' },
        ];
      }
    }

    // Si es TUTOR sin filtro específico, restringir a sus aulas
    if (req.user.rol_codigo === 'TUTOR' && !id_aula && !id_alumno) {
      const asignaciones = await prisma.tbl_asignaciones_tutor.findMany({ where: { id_usuario_tutor: req.user.id }, select: { id_aula: true } });
      if (asignaciones.length > 0) {
        where.id_aula = { in: asignaciones.map(a => a.id_aula) };
      }
    }

    const entradas = await prisma.tbl_entradas_agenda.findMany({
      where,
      include: AGENDA_INCLUDE,
      orderBy: { fecha: 'desc' },
    });

    let padreId = null;
    if (req.user.rol_codigo === 'PADRE') {
      const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
      padreId = padre?.id;
    }

    const data = entradas.map(e => mapEntrada(e, padreId));
    res.json({ data });
  } catch (error) {
    console.error('Error al listar agenda:', error);
    res.status(500).json({ error: 'Error al listar agenda' });
  }
};

// Tutor/Admin publica entrada de agenda
const publicar = async (req, res) => {
  const { fecha, alcance, id_aula, id_alumno, contenido_texto } = req.body;

  if (!contenido_texto) {
    return res.status(400).json({ error: 'Contenido es obligatorio' });
  }
  if (!id_aula) {
    return res.status(400).json({ error: 'Aula es obligatoria' });
  }

  const alcanceReal = alcance || 'AULA';
  const fechaPublicacion = fecha || todayLima().iso;
  const aulaId = parseInt(id_aula);

  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });

    const entrada = await prisma.tbl_entradas_agenda.create({
      data: {
        id_anio_escolar: anioActivo.id,
        fecha: parseDateOnly(fechaPublicacion),
        alcance: alcanceReal,
        id_aula: aulaId,
        id_alumno: id_alumno ? parseInt(id_alumno) : null,
        contenido_texto,
        requiere_firma: true,
        publicado_por: req.user.id,
        esta_publicado: true,
        user_id_registration: req.user.id,
      },
    });

    // Notificar padres
    let alumnosIds = [];
    if (alcanceReal === 'AULA') {
      const alumnos = await prisma.tbl_alumnos.findMany({ where: { id_aula: aulaId, estado: 'ACTIVO' }, select: { id: true } });
      alumnosIds = alumnos.map(a => a.id);
    } else if (alcanceReal === 'ALUMNO' && id_alumno) {
      alumnosIds = [parseInt(id_alumno)];
    }

    for (const alId of alumnosIds) {
      const vinculo = await prisma.tbl_padres_alumnos.findUnique({
        where: { id_alumno: alId },
        include: { tbl_padres: { select: { id_usuario: true } }, tbl_alumnos: { select: { nombre_completo: true } } },
      });
      if (vinculo) {
        await enviarNotificacion('NUEVA_AGENDA', vinculo.tbl_padres.id_usuario, {
          alumno: vinculo.tbl_alumnos?.nombre_completo || '',
          fecha: fechaPublicacion,
        }, { fecha: parseDateOnly(fechaPublicacion), referencia_id: alId });
        emitToUser(vinculo.tbl_padres.id_usuario, 'agenda:nueva', { id: entrada.id });
      }
    }

    await registrarAuditoria({ userId: req.user.id, accion: 'PUBLICAR_AGENDA', tipoEntidad: 'tbl_entradas_agenda', idEntidad: entrada.id, resumen: `Agenda publicada: ${alcanceReal} - ${fechaPublicacion}` });
    res.status(201).json({ mensaje: 'Agenda publicada', id: entrada.id });
  } catch (error) {
    console.error('Error al publicar agenda:', error);
    res.status(500).json({ error: 'Error al publicar agenda' });
  }
};

// Tutor/Admin publica agenda masiva (multiples aulas o alumnos)
const publicarMasivo = async (req, res) => {
  const { fecha, contenido_texto, alcance, ids_aulas, ids_alumnos } = req.body;

  if (!contenido_texto) {
    return res.status(400).json({ error: 'Contenido es obligatorio' });
  }

  const alcanceReal = alcance || 'AULA';
  const fechaPublicacion = fecha || todayLima().iso;

  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });

    // Obtener aulas asignadas al tutor para validacion
    const asignaciones = await prisma.tbl_asignaciones_tutor.findMany({
      where: { id_usuario_tutor: req.user.id },
      select: { id_aula: true },
    });
    const aulasDelTutor = asignaciones.map(a => a.id_aula);
    const esSuperAdmin = req.user.rol_codigo === 'SUPER_ADMIN';

    let entradasData = [];

    if (alcanceReal === 'AULA') {
      if (!ids_aulas || !Array.isArray(ids_aulas) || ids_aulas.length === 0) {
        return res.status(400).json({ error: 'Debe seleccionar al menos un aula' });
      }
      const aulasIds = ids_aulas.map(Number);

      // Validar que el tutor tiene asignadas todas las aulas
      if (!esSuperAdmin) {
        const sinPermiso = aulasIds.filter(id => !aulasDelTutor.includes(id));
        if (sinPermiso.length > 0) {
          return res.status(403).json({ error: 'No tiene permiso sobre algunas aulas seleccionadas' });
        }
      }

      entradasData = aulasIds.map(aulaId => ({
        id_anio_escolar: anioActivo.id,
        fecha: parseDateOnly(fechaPublicacion),
        alcance: 'AULA',
        id_aula: aulaId,
        id_alumno: null,
        contenido_texto,
        requiere_firma: true,
        publicado_por: req.user.id,
        esta_publicado: true,
        user_id_registration: req.user.id,
      }));
    } else if (alcanceReal === 'ALUMNO') {
      if (!ids_alumnos || !Array.isArray(ids_alumnos) || ids_alumnos.length === 0) {
        return res.status(400).json({ error: 'Debe seleccionar al menos un alumno' });
      }

      const alumnos = await prisma.tbl_alumnos.findMany({
        where: { id: { in: ids_alumnos.map(Number) } },
        select: { id: true, id_aula: true },
      });

      if (!esSuperAdmin) {
        const aulasDeAlumnos = [...new Set(alumnos.map(a => a.id_aula))];
        const sinPermiso = aulasDeAlumnos.filter(id => !aulasDelTutor.includes(id));
        if (sinPermiso.length > 0) {
          return res.status(403).json({ error: 'No tiene permiso sobre algunos alumnos seleccionados' });
        }
      }

      entradasData = alumnos.map(al => ({
        id_anio_escolar: anioActivo.id,
        fecha: parseDateOnly(fechaPublicacion),
        alcance: 'ALUMNO',
        id_aula: al.id_aula,
        id_alumno: al.id,
        contenido_texto,
        requiere_firma: true,
        publicado_por: req.user.id,
        esta_publicado: true,
        user_id_registration: req.user.id,
      }));
    }

    if (entradasData.length === 0) {
      return res.status(400).json({ error: 'No hay entradas para crear' });
    }

    // Crear todas las entradas en transaccion
    const resultado = await prisma.$transaction(
      entradasData.map(data => prisma.tbl_entradas_agenda.create({ data }))
    );

    // Notificar padres
    for (const entrada of resultado) {
      let alumnosIds = [];
      if (entrada.alcance === 'AULA') {
        const als = await prisma.tbl_alumnos.findMany({
          where: { id_aula: entrada.id_aula, estado: 'ACTIVO' },
          select: { id: true },
        });
        alumnosIds = als.map(a => a.id);
      } else if (entrada.alcance === 'ALUMNO' && entrada.id_alumno) {
        alumnosIds = [entrada.id_alumno];
      }

      for (const alId of alumnosIds) {
        const vinculo = await prisma.tbl_padres_alumnos.findUnique({
          where: { id_alumno: alId },
          include: {
            tbl_padres: { select: { id_usuario: true } },
            tbl_alumnos: { select: { nombre_completo: true } },
          },
        });
        if (vinculo) {
          await enviarNotificacion('NUEVA_AGENDA', vinculo.tbl_padres.id_usuario, {
            alumno: vinculo.tbl_alumnos?.nombre_completo || '',
            fecha: fechaPublicacion,
          }, { fecha: parseDateOnly(fechaPublicacion), referencia_id: alId });
          emitToUser(vinculo.tbl_padres.id_usuario, 'agenda:nueva', { id: entrada.id });
        }
      }
    }

    await registrarAuditoria({
      userId: req.user.id,
      accion: 'PUBLICAR_AGENDA_MASIVO',
      tipoEntidad: 'tbl_entradas_agenda',
      idEntidad: resultado[0].id,
      resumen: `Agenda masiva: ${alcanceReal} - ${entradasData.length} entradas - ${fechaPublicacion}`,
    });

    res.status(201).json({
      mensaje: `Agenda publicada en ${resultado.length} ${alcanceReal === 'AULA' ? 'aula(s)' : 'alumno(s)'}`,
      total: resultado.length,
    });
  } catch (error) {
    console.error('Error al publicar agenda masiva:', error);
    res.status(500).json({ error: 'Error al publicar agenda masiva' });
  }
};

// Padre firma agenda
const firmar = async (req, res) => {
  const { id_entrada_agenda } = req.body;
  try {
    const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
    if (!padre) return res.status(404).json({ error: 'Padre no encontrado' });

    const firma = await prisma.tbl_firmas_agenda.create({
      data: { id_entrada_agenda, id_padre: padre.id, user_id_registration: req.user.id },
    });

    const entrada = await prisma.tbl_entradas_agenda.findUnique({ where: { id: id_entrada_agenda }, select: { id_aula: true } });
    if (entrada?.id_aula) {
      emitToAula(entrada.id_aula, 'agenda:firma', { id_entrada: id_entrada_agenda, padre: padre.nombre_completo });
    }

    await registrarAuditoria({ userId: req.user.id, accion: 'FIRMA_AGENDA', tipoEntidad: 'tbl_firmas_agenda', idEntidad: firma.id, resumen: `Padre ${padre.nombre_completo} firmo agenda ${id_entrada_agenda}` });
    res.json({ mensaje: 'Agenda firmada' });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Ya firmo esta agenda' });
    res.status(500).json({ error: 'Error al firmar agenda' });
  }
};

// Padre responde agenda
const responder = async (req, res) => {
  const { id_entrada_agenda, contenido } = req.body;
  try {
    const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
    if (!padre) return res.status(404).json({ error: 'Padre no encontrado' });

    await prisma.tbl_respuestas_agenda.create({
      data: { id_entrada_agenda, id_padre: padre.id, mensaje: contenido, user_id_registration: req.user.id },
    });

    const entradaResp = await prisma.tbl_entradas_agenda.findUnique({ where: { id: id_entrada_agenda }, select: { id_aula: true } });
    if (entradaResp?.id_aula) {
      emitToAula(entradaResp.id_aula, 'agenda:respuesta', { id_entrada: id_entrada_agenda, padre: padre.nombre_completo });
    }

    res.json({ mensaje: 'Respuesta enviada' });
  } catch (error) { res.status(500).json({ error: 'Error al responder agenda' }); }
};

module.exports = { listar, publicar, publicarMasivo, firmar, responder };
