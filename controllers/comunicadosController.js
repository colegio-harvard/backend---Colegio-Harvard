const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { emitToUser } = require('../utils/socketEmitter');
const { enviarNotificacion } = require('../utils/notifUtils');
const { todayLima } = require('../utils/dateUtils');

// FLW-20: Crear comunicado (con notificacion a audiencia)
const crear = async (req, res) => {
  const { titulo, cuerpo, prioridad, tipo_audiencia, id_ref_audiencia, ids_alumnos } = req.body;
  if (!titulo || !cuerpo || !tipo_audiencia) {
    return res.status(400).json({ error: 'Titulo, cuerpo y tipo de audiencia son obligatorios' });
  }

  try {
    const anioActivo = await prisma.tbl_anios_escolares.findFirst({ where: { activo: true } });
    if (!anioActivo) return res.status(400).json({ error: 'No hay ano escolar activo' });

    // Validar que ALUMNO tenga al menos un alumno seleccionado
    if (tipo_audiencia === 'ALUMNO' && (!ids_alumnos || !Array.isArray(ids_alumnos) || ids_alumnos.length === 0)) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un alumno' });
    }

    const comunicado = await prisma.tbl_comunicados.create({
      data: {
        id_anio_escolar: anioActivo.id, creado_por: req.user.id,
        prioridad: prioridad || 'NORMAL', titulo, cuerpo,
        tipo_audiencia,
        id_ref_audiencia: tipo_audiencia !== 'ALUMNO' && id_ref_audiencia ? parseInt(id_ref_audiencia) : null,
        ids_alumnos: tipo_audiencia === 'ALUMNO' ? ids_alumnos.map(Number) : null,
        esta_publicado: true, publicado_en: new Date(), user_id_registration: req.user.id,
      },
    });

    // Generar notificaciones a padres de la audiencia
    let padresIds = [];
    if (tipo_audiencia === 'COLEGIO') {
      const padres = await prisma.tbl_padres.findMany({ select: { id_usuario: true } });
      padresIds = padres.map(p => p.id_usuario);
    } else if (tipo_audiencia === 'NIVEL' && id_ref_audiencia) {
      const alumnos = await prisma.tbl_alumnos.findMany({
        where: { estado: 'ACTIVO', tbl_aulas: { tbl_grados: { id_nivel: parseInt(id_ref_audiencia) } } },
        select: { id: true },
      });
      const vinculos = await prisma.tbl_padres_alumnos.findMany({
        where: { id_alumno: { in: alumnos.map(a => a.id) } },
        include: { tbl_padres: { select: { id_usuario: true } } },
      });
      padresIds = vinculos.map(v => v.tbl_padres.id_usuario);
    } else if (tipo_audiencia === 'GRADO' && id_ref_audiencia) {
      const alumnos = await prisma.tbl_alumnos.findMany({
        where: { estado: 'ACTIVO', tbl_aulas: { id_grado: parseInt(id_ref_audiencia) } },
        select: { id: true },
      });
      const vinculos = await prisma.tbl_padres_alumnos.findMany({
        where: { id_alumno: { in: alumnos.map(a => a.id) } },
        include: { tbl_padres: { select: { id_usuario: true } } },
      });
      padresIds = vinculos.map(v => v.tbl_padres.id_usuario);
    } else if (tipo_audiencia === 'AULA' && id_ref_audiencia) {
      const alumnos = await prisma.tbl_alumnos.findMany({
        where: { id_aula: parseInt(id_ref_audiencia), estado: 'ACTIVO' },
        select: { id: true },
      });
      const vinculos = await prisma.tbl_padres_alumnos.findMany({
        where: { id_alumno: { in: alumnos.map(a => a.id) } },
        include: { tbl_padres: { select: { id_usuario: true } } },
      });
      padresIds = vinculos.map(v => v.tbl_padres.id_usuario);
    } else if (tipo_audiencia === 'ALUMNO' && ids_alumnos?.length > 0) {
      const vinculos = await prisma.tbl_padres_alumnos.findMany({
        where: { id_alumno: { in: ids_alumnos.map(Number) } },
        include: { tbl_padres: { select: { id_usuario: true } } },
      });
      padresIds = [...new Set(vinculos.map(v => v.tbl_padres.id_usuario))];
    }

    // Crear notificaciones (respeta plantilla configurada)
    if (padresIds.length > 0) {
      for (const padreId of padresIds) {
        await enviarNotificacion('NUEVO_COMUNICADO', padreId, { titulo }, { referencia_id: comunicado.id });
        emitToUser(padreId, 'comunicado:nuevo', { id: comunicado.id, titulo, prioridad: prioridad || 'NORMAL' });
      }
    }

    await registrarAuditoria({ userId: req.user.id, accion: 'CREAR_COMUNICADO', tipoEntidad: 'tbl_comunicados', idEntidad: comunicado.id, resumen: `Comunicado "${titulo}" creado para ${tipo_audiencia}` });
    res.status(201).json({ data: { mensaje: 'Comunicado publicado', id: comunicado.id } });
  } catch (error) {
    console.error('Error al crear comunicado:', error);
    res.status(500).json({ error: 'Error al crear comunicado' });
  }
};

// Listar comunicados (filtrado por rol)
const listar = async (req, res) => {
  try {
    const where = { esta_publicado: true };
    const rolCodigo = req.user.rol_codigo;

    const comunicados = await prisma.tbl_comunicados.findMany({
      where,
      include: {
        tbl_usuarios: { select: { nombres: true } },
        tbl_lecturas_comunicado: {
          where: { id_usuario: req.user.id },
          select: { id: true },
        },
        _count: { select: { tbl_lecturas_comunicado: true } },
      },
      orderBy: [{ prioridad: 'asc' }, { publicado_en: 'desc' }],
    });

    let resultado = comunicados;

    // Para padres, filtrar solo los que les corresponden
    if (rolCodigo === 'PADRE') {
      const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
      if (padre) {
        const vinculos = await prisma.tbl_padres_alumnos.findMany({
          where: { id_padre: padre.id },
          include: { tbl_alumnos: { select: { id: true, id_aula: true, tbl_aulas: { select: { id_grado: true, tbl_grados: { select: { id_nivel: true } } } } } } },
        });
        const idsAlumnos = vinculos.map(v => v.id_alumno);
        const idsAulas = vinculos.map(v => v.tbl_alumnos.id_aula);
        const idsGrados = vinculos.map(v => v.tbl_alumnos.tbl_aulas?.id_grado).filter(Boolean);
        const idsNiveles = vinculos.map(v => v.tbl_alumnos.tbl_aulas?.tbl_grados?.id_nivel).filter(Boolean);

        resultado = comunicados.filter(c => {
          if (c.tipo_audiencia === 'COLEGIO') return true;
          if (c.tipo_audiencia === 'NIVEL') return idsNiveles.includes(c.id_ref_audiencia);
          if (c.tipo_audiencia === 'GRADO') return idsGrados.includes(c.id_ref_audiencia);
          if (c.tipo_audiencia === 'AULA') return idsAulas.includes(c.id_ref_audiencia);
          if (c.tipo_audiencia === 'ALUMNO') {
            const ids = Array.isArray(c.ids_alumnos) ? c.ids_alumnos : [];
            return ids.some(id => idsAlumnos.includes(id));
          }
          return false;
        });
      }
    }

    const data = resultado.map(c => ({
      id: c.id,
      titulo: c.titulo,
      contenido: c.cuerpo,
      prioridad: c.prioridad,
      audiencia: c.tipo_audiencia,
      id_ref_audiencia: c.id_ref_audiencia,
      ids_alumnos: c.ids_alumnos || null,
      creador: c.tbl_usuarios?.nombres || null,
      leido: c.tbl_lecturas_comunicado.length > 0,
      total_lecturas: c._count.tbl_lecturas_comunicado,
      publicado_en: c.publicado_en,
      date_time_registration: c.date_time_registration,
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error al listar comunicados:', error);
    res.status(500).json({ error: 'Error al listar comunicados' });
  }
};

// Listar comunicados filtrados por alumno
const listarPorAlumno = async (req, res) => {
  const id_alumno = parseInt(req.params.id);
  try {
    const alumno = await prisma.tbl_alumnos.findUnique({
      where: { id: id_alumno },
      select: {
        id: true, id_aula: true,
        tbl_aulas: { select: { id: true, id_grado: true, tbl_grados: { select: { id: true, id_nivel: true } } } },
      },
    });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    const idAula = alumno.id_aula;
    const idGrado = alumno.tbl_aulas?.id_grado;
    const idNivel = alumno.tbl_aulas?.tbl_grados?.id_nivel;

    const comunicados = await prisma.tbl_comunicados.findMany({
      where: {
        esta_publicado: true,
        OR: [
          { tipo_audiencia: 'COLEGIO' },
          { tipo_audiencia: 'NIVEL', id_ref_audiencia: idNivel },
          { tipo_audiencia: 'GRADO', id_ref_audiencia: idGrado },
          { tipo_audiencia: 'AULA', id_ref_audiencia: idAula },
          { tipo_audiencia: 'ALUMNO' },
        ],
      },
      include: {
        tbl_usuarios: { select: { nombres: true } },
        tbl_lecturas_comunicado: {
          where: { id_usuario: req.user.id },
          select: { id: true },
        },
        _count: { select: { tbl_lecturas_comunicado: true } },
      },
      orderBy: [{ prioridad: 'asc' }, { publicado_en: 'desc' }],
    });

    // Filtrar ALUMNO en JS (ids_alumnos es JSON array)
    const resultado = comunicados.filter(c => {
      if (c.tipo_audiencia !== 'ALUMNO') return true;
      const ids = Array.isArray(c.ids_alumnos) ? c.ids_alumnos : [];
      return ids.includes(id_alumno);
    });

    const data = resultado.map(c => ({
      id: c.id,
      titulo: c.titulo,
      contenido: c.cuerpo,
      prioridad: c.prioridad,
      audiencia: c.tipo_audiencia,
      id_ref_audiencia: c.id_ref_audiencia,
      ids_alumnos: c.ids_alumnos || null,
      creador: c.tbl_usuarios?.nombres || null,
      leido: c.tbl_lecturas_comunicado.length > 0,
      total_lecturas: c._count.tbl_lecturas_comunicado,
      publicado_en: c.publicado_en,
      date_time_registration: c.date_time_registration,
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error al listar comunicados por alumno:', error);
    res.status(500).json({ error: 'Error al listar comunicados' });
  }
};

// Marcar como leido (auto-mark on open)
const marcarLeido = async (req, res) => {
  const id_comunicado = parseInt(req.params.id);
  try {
    await prisma.tbl_lecturas_comunicado.upsert({
      where: { id_comunicado_id_usuario: { id_comunicado, id_usuario: req.user.id } },
      update: {},
      create: { id_comunicado, id_usuario: req.user.id, user_id_registration: req.user.id },
    });
    res.json({ data: { mensaje: 'Comunicado marcado como leido' } });
  } catch (error) { res.status(500).json({ error: 'Error al marcar como leido' }); }
};

module.exports = { crear, listar, listarPorAlumno, marcarLeido };
