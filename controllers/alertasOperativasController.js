const prisma = require('../config/prisma');
const { registrarAuditoria } = require('../middleware/auditMiddleware');

const selectAlerta = { id: true, id_alumno: true, mensaje: true, prioridad: true, estado: true, ultima_accion: true, ultima_accion_en: true, date_time_registration: true };

const listar = async (req, res) => {
  const estado = String(req.query.estado || 'ACTIVA').toUpperCase();
  const prioridad = String(req.query.prioridad || '').toUpperCase();
  if (!['ACTIVA', 'RESUELTA', 'TODAS'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  if (prioridad && !['IMPORTANTE', 'URGENTE'].includes(prioridad)) return res.status(400).json({ error: 'Prioridad inválida' });
  try {
    const alertas = await prisma.tbl_alertas_operativas_alumno.findMany({
      where: {
        ...(estado !== 'TODAS' ? { estado } : {}),
        ...(prioridad ? { prioridad } : {}),
        tbl_alumnos: { estado: { not: 'DELETED' } },
      },
      include: {
        tbl_alumnos: {
          select: {
            id: true, codigo_alumno: true, dni: true, nombre_completo: true, foto_url: true,
            tbl_aulas: { select: { seccion: true, tbl_grados: { select: { nombre: true, tbl_niveles: { select: { nombre: true } } } } } },
          },
        },
      },
      orderBy: [{ estado: 'asc' }, { prioridad: 'desc' }, { date_time_registration: 'desc' }],
    });
    return res.json({ data: alertas, total: alertas.length });
  } catch (error) { console.error('Error al listar alertas operativas:', error); return res.status(500).json({ error: 'No se pudieron listar las alertas internas' }); }
};

const obtenerActiva = async (req, res) => {
  const idAlumno = Number(req.params.idAlumno || req.params.id);
  if (!Number.isInteger(idAlumno)) return res.status(400).json({ error: 'Alumno inválido' });
  try {
    const alerta = await prisma.tbl_alertas_operativas_alumno.findFirst({ where: { id_alumno: idAlumno, estado: 'ACTIVA' }, select: selectAlerta, orderBy: { date_time_registration: 'desc' } });
    return res.json({ data: alerta });
  } catch (error) { console.error('Error al consultar alerta operativa:', error); return res.status(500).json({ error: 'No se pudo consultar la alerta operativa' }); }
};

const guardar = async (req, res) => {
  const idAlumno = Number(req.params.id);
  const mensaje = String(req.body.mensaje || '').trim();
  const prioridad = String(req.body.prioridad || 'URGENTE').toUpperCase();
  if (!Number.isInteger(idAlumno)) return res.status(400).json({ error: 'Alumno inválido' });
  if (!mensaje || mensaje.length > 250) return res.status(400).json({ error: 'La alerta debe tener entre 1 y 250 caracteres' });
  if (!['IMPORTANTE', 'URGENTE'].includes(prioridad)) return res.status(400).json({ error: 'Prioridad inválida' });
  try {
    const alumno = await prisma.tbl_alumnos.findUnique({ where: { id: idAlumno }, select: { id: true, nombre_completo: true } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    const ahora = new Date();
    const alerta = await prisma.$transaction(async (tx) => {
      const activa = await tx.tbl_alertas_operativas_alumno.findFirst({ where: { id_alumno: idAlumno, estado: 'ACTIVA' }, orderBy: { date_time_registration: 'desc' } });
      if (activa) return tx.tbl_alertas_operativas_alumno.update({ where: { id: activa.id }, data: { mensaje, prioridad, date_time_modification: ahora }, select: selectAlerta });
      return tx.tbl_alertas_operativas_alumno.create({ data: { id_alumno: idAlumno, mensaje, prioridad, creado_por: req.user.id }, select: selectAlerta });
    });
    await registrarAuditoria({ userId: req.user.id, accion: 'GUARDAR_ALERTA_OPERATIVA', tipoEntidad: 'tbl_alertas_operativas_alumno', idEntidad: alerta.id, resumen: `Alerta operativa actualizada para ${alumno.nombre_completo}`, req });
    return res.json({ data: alerta, message: 'Alerta operativa guardada' });
  } catch (error) { console.error('Error al guardar alerta operativa:', error); return res.status(500).json({ error: 'No se pudo guardar la alerta operativa' }); }
};

const resolver = async (req, res) => {
  const idAlumno = Number(req.params.id);
  if (!Number.isInteger(idAlumno)) return res.status(400).json({ error: 'Alumno inválido' });
  try {
    const ahora = new Date();
    const resultado = await prisma.tbl_alertas_operativas_alumno.updateMany({ where: { id_alumno: idAlumno, estado: 'ACTIVA' }, data: { estado: 'RESUELTA', resuelto_por: req.user.id, resuelta_en: ahora, date_time_modification: ahora } });
    await registrarAuditoria({ userId: req.user.id, accion: 'RESOLVER_ALERTA_OPERATIVA', tipoEntidad: 'tbl_alumnos', idEntidad: idAlumno, resumen: `Alertas operativas resueltas: ${resultado.count}`, req });
    return res.json({ data: { resueltas: resultado.count }, message: 'Alerta marcada como resuelta' });
  } catch (error) { console.error('Error al resolver alerta operativa:', error); return res.status(500).json({ error: 'No se pudo resolver la alerta operativa' }); }
};

const registrarAccion = async (req, res) => {
  const id = Number(req.params.id);
  const accion = String(req.body.accion || '').toUpperCase();
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Alerta inválida' });
  if (!['DERIVAR_OFICINA', 'AVISAR_ADMINISTRACION'].includes(accion)) return res.status(400).json({ error: 'Acción inválida' });
  try {
    const alerta = await prisma.tbl_alertas_operativas_alumno.findFirst({ where: { id, estado: 'ACTIVA' } });
    if (!alerta) return res.status(404).json({ error: 'La alerta ya no está activa' });
    const actualizada = await prisma.tbl_alertas_operativas_alumno.update({ where: { id }, data: { ultima_accion: accion, ultima_accion_por: req.user.id, ultima_accion_en: new Date(), date_time_modification: new Date() }, select: selectAlerta });
    await registrarAuditoria({ userId: req.user.id, accion, tipoEntidad: 'tbl_alertas_operativas_alumno', idEntidad: id, resumen: accion === 'DERIVAR_OFICINA' ? 'Alumno derivado a oficina' : 'Administración avisada por alerta operativa', req });
    return res.json({ data: actualizada, message: accion === 'DERIVAR_OFICINA' ? 'Derivación registrada' : 'Aviso registrado' });
  } catch (error) { console.error('Error al registrar atención de alerta:', error); return res.status(500).json({ error: 'No se pudo registrar la acción' }); }
};

module.exports = { listar, obtenerActiva, guardar, resolver, registrarAccion };
