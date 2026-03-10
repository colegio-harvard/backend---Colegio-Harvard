const prisma = require('../config/prisma');
const { emitNotificacion } = require('./socketEmitter');
const { todayLima } = require('./dateUtils');

/**
 * Reemplaza {{placeholders}} en un template string con los valores proporcionados.
 * Placeholders no encontrados en vars quedan como estan.
 */
const renderTemplate = (templateStr, vars = {}) => {
  return templateStr.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
};

/**
 * Crea una notificacion en buzon usando la plantilla configurada.
 * Respeta: habilitada, tipo_entrega, titulo y cuerpo de la plantilla.
 *
 * @param {string} codigoPlantilla - Codigo de la plantilla (ej: 'NO_LLEGO', 'TARDANZA')
 * @param {number} userId - ID del usuario destinatario
 * @param {Object} vars - Variables para reemplazar en el template (ej: { alumno, fecha, hora })
 * @param {Object} [opciones] - Opciones adicionales
 * @param {Date} [opciones.fecha] - Fecha de la notificacion (default: hoy Lima)
 * @param {number} [opciones.referencia_id] - ID de la entidad relacionada (alumno, comunicado, etc.)
 * @returns {Promise<{enviado: boolean, tipo_entrega: string|null}>}
 */
const enviarNotificacion = async (codigoPlantilla, userId, vars = {}, opciones = {}) => {
  const plantilla = await prisma.tbl_plantillas_notificacion.findUnique({
    where: { codigo: codigoPlantilla },
  });

  // Si no hay plantilla o esta deshabilitada, no enviar nada
  if (!plantilla || !plantilla.habilitada) {
    return { enviado: false, tipo_entrega: null };
  }

  const tipoEntrega = plantilla.tipo_entrega || 'buzon';

  // Solo crear notificacion en buzon si tipo_entrega lo incluye
  if (['buzon', 'ambos'].includes(tipoEntrega)) {
    const titulo = renderTemplate(plantilla.titulo, vars);
    const cuerpo = renderTemplate(plantilla.cuerpo, vars);
    const fecha = opciones.fecha || todayLima().date;

    await prisma.tbl_notificaciones.create({
      data: {
        id_usuario: userId,
        codigo_plantilla: codigoPlantilla,
        titulo,
        cuerpo,
        fecha,
        referencia_id: opciones.referencia_id || null,
      },
    });

    emitNotificacion(userId, { titulo, cuerpo });
  }

  return { enviado: true, tipo_entrega: tipoEntrega };
};

module.exports = { renderTemplate, enviarNotificacion };
