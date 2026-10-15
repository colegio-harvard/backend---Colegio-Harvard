const { tieneCapacidadUsuario } = require('../services/capacidadesService');

/**
 * Autoriza por rol principal o por una capacidad directa vigente.
 * Las capacidades se consultan en base de datos para que una revocación tenga
 * efecto inmediato, incluso si el usuario conserva un JWT emitido antes.
 */
function verificarRolOCapacidad(rolesPermitidos = [], capacidadesPermitidas = []) {
  return async (req, res, next) => {
    if (!req.user?.id || !req.user?.rol_codigo) {
      return res.status(403).json({ error: 'Acceso denegado: sin identidad asignada' });
    }

    if (rolesPermitidos.includes(req.user.rol_codigo)) return next();

    try {
      const autorizado = await tieneCapacidadUsuario(req.user.id, capacidadesPermitidas);
      if (!autorizado) {
        return res.status(403).json({ error: 'Acceso denegado: no tiene el rol o capacidad requerida' });
      }
      return next();
    } catch (error) {
      console.error('Error verificando capacidad:', error);
      return res.status(500).json({ error: 'No se pudo verificar la autorización' });
    }
  };
}

module.exports = verificarRolOCapacidad;
