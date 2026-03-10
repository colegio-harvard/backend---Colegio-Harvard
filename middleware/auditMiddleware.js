const prisma = require('../config/prisma');

/**
 * Registrar accion en auditoria
 */
async function registrarAuditoria({ userId, accion, tipoEntidad, idEntidad, resumen, meta }) {
  try {
    await prisma.tbl_auditoria.create({
      data: {
        id_usuario_actor: userId,
        codigo_accion: accion,
        tipo_entidad: tipoEntidad,
        id_entidad: idEntidad || null,
        resumen,
        meta_json: meta || null,
      },
    });
  } catch (error) {
    console.error('Error al registrar auditoria:', error);
  }
}

module.exports = { registrarAuditoria };
