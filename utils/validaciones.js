/**
 * Valida contrasena
 * Requisitos: no vacia
 * @param {string} contrasena
 * @returns {{ valida: boolean, mensaje: string }}
 */
const validarContrasena = (contrasena) => {
  if (!contrasena || contrasena.trim().length === 0) {
    return { valida: false, mensaje: 'La contrasena es obligatoria' };
  }
  return { valida: true, mensaje: '' };
};

module.exports = { validarContrasena };
