const prisma = require('../config/prisma');

/**
 * Registrar accion en auditoria
 */
function obtenerMetaRequest(req) {
  if (!req) return {};
  return {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || null,
    user_agent: req.headers['user-agent'] || null,
    metodo: req.method || null,
    ruta: req.originalUrl || req.url || null,
  };
}

async function registrarAuditoria({ userId, accion, tipoEntidad, idEntidad, resumen, meta, req }) {
  try {
    const metaFinal = {
      ...obtenerMetaRequest(req),
      ...(meta || {}),
    };
    await prisma.tbl_auditoria.create({
      data: {
        id_usuario_actor: userId,
        codigo_accion: accion,
        tipo_entidad: tipoEntidad,
        id_entidad: idEntidad || null,
        resumen,
        meta_json: Object.keys(metaFinal).length > 0 ? metaFinal : null,
      },
    });
  } catch (error) {
    console.error('Error al registrar auditoria:', error);
  }
}

module.exports = { registrarAuditoria, obtenerMetaRequest };
