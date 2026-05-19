/**
 * Middleware RBAC - Verificar roles permitidos
 * @param  {...string} rolesPermitidos - Codigos de rol (SUPER_ADMIN, ADMIN, TUTOR, PADRE, PORTERIA, PSICOLOGIA)
 */
function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !req.user.rol_codigo) {
      return res.status(403).json({ error: 'Acceso denegado: sin rol asignado' });
    }

    if (!rolesPermitidos.includes(req.user.rol_codigo)) {
      return res.status(403).json({ error: 'Acceso denegado: no tiene permisos para esta accion' });
    }

    next();
  };
}

module.exports = verificarRol;
