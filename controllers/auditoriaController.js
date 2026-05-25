const prisma = require('../config/prisma');
const XLSX = require('xlsx');
const { registrarAuditoria } = require('../middleware/auditMiddleware');

const listar = async (req, res) => {
  const { fecha_inicio, fecha_fin, codigo_accion, id_usuario_actor } = req.query;
  try {
    const where = {};
    if (fecha_inicio && fecha_fin) {
      where.marca_tiempo = { gte: new Date(`${fecha_inicio}T00:00:00Z`), lte: new Date(`${fecha_fin}T23:59:59.999Z`) };
    }
    if (codigo_accion) where.codigo_accion = codigo_accion;
    if (id_usuario_actor) where.id_usuario_actor = parseInt(id_usuario_actor);

    const logs = await prisma.tbl_auditoria.findMany({
      where,
      include: { tbl_usuarios: { select: { nombres: true, username: true, tbl_roles: { select: { codigo: true, nombre: true } } } } },
      orderBy: { marca_tiempo: 'desc' },
      take: 500,
    });

    const data = logs.map(l => ({
      id: l.id,
      fecha_hora: l.marca_tiempo,
      accion: l.codigo_accion,
      tipo_entidad: l.tipo_entidad,
      id_entidad: l.id_entidad,
      resumen: l.resumen,
      id_usuario: l.id_usuario_actor,
      usuario: l.tbl_usuarios ? {
        nombres: l.tbl_usuarios.nombres,
        username: l.tbl_usuarios.username,
        rol_codigo: l.tbl_usuarios.tbl_roles?.codigo || null,
        rol_nombre: l.tbl_usuarios.tbl_roles?.nombre || null,
      } : null,
      meta: l.meta_json || null,
    }));

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al listar auditoria' }); }
};

// Listar codigos de accion unicos (para filtro)
const listarAcciones = async (req, res) => {
  try {
    const acciones = await prisma.tbl_auditoria.findMany({ distinct: ['codigo_accion'], select: { codigo_accion: true }, orderBy: { codigo_accion: 'asc' } });
    res.json({ data: acciones.map(a => a.codigo_accion) });
  } catch (error) { res.status(500).json({ error: 'Error al listar acciones' }); }
};

// Exportar auditoria a Excel
const exportarExcel = async (req, res) => {
  const { fecha_inicio, fecha_fin, codigo_accion } = req.query;
  try {
    const where = {};
    if (fecha_inicio && fecha_fin) {
      where.marca_tiempo = { gte: new Date(`${fecha_inicio}T00:00:00Z`), lte: new Date(`${fecha_fin}T23:59:59.999Z`) };
    }
    if (codigo_accion) where.codigo_accion = codigo_accion;

    const logs = await prisma.tbl_auditoria.findMany({
      where,
      include: { tbl_usuarios: { select: { nombres: true, username: true, tbl_roles: { select: { codigo: true, nombre: true } } } } },
      orderBy: { marca_tiempo: 'desc' },
      take: 5000,
    });

    const rows = logs.map(l => ({
      Fecha: l.marca_tiempo ? new Date(l.marca_tiempo).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '',
      Usuario: l.tbl_usuarios?.nombres || '',
      Username: l.tbl_usuarios?.username || '',
      Rol: l.tbl_usuarios?.tbl_roles?.codigo || '',
      Accion: l.codigo_accion,
      Entidad: l.tipo_entidad || '',
      'ID Entidad': l.id_entidad || '',
      Resumen: l.resumen || '',
      Detalle_JSON: l.meta_json ? JSON.stringify(l.meta_json) : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    await registrarAuditoria({
      userId: req.user.id,
      accion: 'EXPORTAR_AUDITORIA_EXCEL',
      tipoEntidad: 'tbl_auditoria',
      resumen: `Exportacion de auditoria a Excel (${rows.length} registros)`,
      req,
      meta: { filtros: { fecha_inicio, fecha_fin, codigo_accion }, registros: rows.length },
    });

    res.setHeader('Content-Disposition', 'attachment; filename=auditoria.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error al exportar auditoria:', error);
    res.status(500).json({ error: 'Error al exportar auditoria' });
  }
};

module.exports = { listar, listarAcciones, exportarExcel };
