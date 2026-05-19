const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { parseDateOnly } = require('../utils/dateUtils');
const { emitToUser, emitToAula } = require('../utils/socketEmitter');
const { enviarNotificacion } = require('../utils/notifUtils');

// Tutor/Admin crea reporte semanal
const crear = async (req, res) => {
  const { semana_inicio, semana_fin, contenido, alcance, id_aula, id_alumno } = req.body;

  if (!semana_inicio || !semana_fin || !contenido) {
    return res.status(400).json({ error: 'Inicio, fin de semana y contenido son obligatorios' });
  }
  if (!id_aula) {
    return res.status(400).json({ error: 'Aula es obligatoria' });
  }

  const alcanceReal = alcance || 'AULA';

  try {
    const reporte = await prisma.tbl_reportes_semanales.create({
      data: {
        inicio_semana: parseDateOnly(semana_inicio),
        fin_semana: parseDateOnly(semana_fin),
        alcance: alcanceReal,
        id_aula: parseInt(id_aula),
        id_alumno: id_alumno ? parseInt(id_alumno) : null,
        contenido_json: contenido,
        requiere_firma: true,
        publicado_por: req.user.id,
        user_id_registration: req.user.id,
      },
    });

    // Notificar padres
    const aulaId = parseInt(id_aula);
    let alumnosIds = [];
    if (alcanceReal === 'AULA') {
      const alumnos = await prisma.tbl_alumnos.findMany({ where: { id_aula: aulaId, estado: 'ACTIVO' }, select: { id: true } });
      alumnosIds = alumnos.map(a => a.id);
    } else if (alcanceReal === 'ALUMNO' && id_alumno) {
      alumnosIds = [parseInt(id_alumno)];
    }

    const semanaLabel = `${semana_inicio} a ${semana_fin}`;
    for (const alId of alumnosIds) {
      const vinculo = await prisma.tbl_padres_alumnos.findUnique({
        where: { id_alumno: alId },
        include: { tbl_padres: { select: { id_usuario: true } }, tbl_alumnos: { select: { nombre_completo: true } } },
      });
      if (vinculo) {
        await enviarNotificacion('NUEVO_REPORTE', vinculo.tbl_padres.id_usuario, {
          alumno: vinculo.tbl_alumnos?.nombre_completo || '',
          semana: semanaLabel,
        }, { referencia_id: alId });
        emitToUser(vinculo.tbl_padres.id_usuario, 'reporte:nuevo', { id: reporte.id });
      }
    }

    await registrarAuditoria({ userId: req.user.id, accion: 'PUBLICAR_REPORTE_SEMANAL', tipoEntidad: 'tbl_reportes_semanales', idEntidad: reporte.id, resumen: `Reporte semanal ${semana_inicio} a ${semana_fin}` });
    res.status(201).json({ mensaje: 'Reporte semanal publicado', id: reporte.id });
  } catch (error) {
    console.error('Error al crear reporte semanal:', error);
    res.status(500).json({ error: 'Error al crear reporte semanal' });
  }
};

// Listar reportes
const listar = async (req, res) => {
  const { id_aula, id_alumno } = req.query;
  try {
    const where = {};

    // Cuando se filtra por alumno, traer también reportes AULA del aula del alumno
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

    // Padre: filtrar solo reportes de sus hijos (cuando no hay filtro específico)
    if (req.user.rol_codigo === 'PADRE' && !id_alumno) {
      const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
      if (padre) {
        const vinculos = await prisma.tbl_padres_alumnos.findMany({ where: { id_padre: padre.id }, select: { id_alumno: true } });
        const idsAlumnos = vinculos.map(v => v.id_alumno);
        const alumnos = await prisma.tbl_alumnos.findMany({ where: { id: { in: idsAlumnos } }, select: { id_aula: true } });
        const idsAulas = [...new Set(alumnos.map(a => a.id_aula).filter(Boolean))];
        where.OR = [
          { id_alumno: { in: idsAlumnos } },
          { id_aula: { in: idsAulas }, alcance: 'AULA' },
        ];
      }
    }

    // Tutor: solo reportes publicados por él (cuando no hay filtro específico)
    if (req.user.rol_codigo === 'TUTOR' && !id_aula && !id_alumno) {
      where.publicado_por = req.user.id;
    }

    const reportes = await prisma.tbl_reportes_semanales.findMany({
      where,
      include: {
        tbl_usuarios: { select: { nombres: true } },
        tbl_alumnos: { select: { nombre_completo: true } },
        tbl_aulas: { select: { seccion: true, tbl_grados: { select: { nombre: true } } } },
        tbl_firmas_reporte_semanal: { include: { tbl_padres: { select: { id: true, nombre_completo: true } } } },
      },
      orderBy: { inicio_semana: 'desc' },
    });

    let padreId = null;
    if (req.user.rol_codigo === 'PADRE') {
      const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
      padreId = padre?.id;
    }

    const data = reportes.map(r => ({
      id: r.id,
      semana_inicio: r.inicio_semana,
      semana_fin: r.fin_semana,
      alcance: r.alcance,
      contenido: r.contenido_json,
      requiere_firma: r.requiere_firma,
      tutor: { nombres: r.tbl_usuarios?.nombres || null },
      alumno: r.tbl_alumnos?.nombre_completo || null,
      aula: r.tbl_aulas ? `${r.tbl_aulas.tbl_grados?.nombre || ''} ${r.tbl_aulas.seccion}`.trim() : null,
      firmada: padreId ? (r.tbl_firmas_reporte_semanal || []).some(f => f.id_padre === padreId) : false,
      firmas: (r.tbl_firmas_reporte_semanal || []).map(f => ({
        id: f.id,
        padre: { nombre_completo: f.tbl_padres?.nombre_completo || 'Padre' },
      })),
      date_time_registration: r.date_time_registration,
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error al listar reportes:', error);
    res.status(500).json({ error: 'Error al listar reportes' });
  }
};

// Padre firma reporte
const firmar = async (req, res) => {
  const { id_reporte_semanal } = req.body;
  try {
    const padre = await prisma.tbl_padres.findUnique({ where: { id_usuario: req.user.id } });
    if (!padre) return res.status(404).json({ error: 'Padre no encontrado' });

    await prisma.tbl_firmas_reporte_semanal.create({
      data: { id_reporte_semanal, id_padre: padre.id, user_id_registration: req.user.id },
    });

    const reporte = await prisma.tbl_reportes_semanales.findUnique({
      where: { id: id_reporte_semanal }, select: { id_aula: true },
    });
    if (reporte) {
      emitToAula(reporte.id_aula, 'reporte:firmado', { id_reporte: id_reporte_semanal, padre: padre.nombre_completo });
    }

    await registrarAuditoria({ userId: req.user.id, accion: 'FIRMA_REPORTE_SEMANAL', tipoEntidad: 'tbl_firmas_reporte_semanal', resumen: `Padre ${padre.nombre_completo} firmo reporte ${id_reporte_semanal}` });
    res.json({ mensaje: 'Reporte semanal firmado' });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Ya firmo este reporte' });
    res.status(500).json({ error: 'Error al firmar reporte' });
  }
};

module.exports = { crear, listar, firmar };
