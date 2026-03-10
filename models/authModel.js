const prisma = require('../config/prisma');

/**
 * Buscar usuario por username con su rol y permisos
 */
const findUserByUsername = async (username) => {
  const rows = await prisma.$queryRaw`
    SELECT
      u.id,
      u.nombres,
      u.username,
      u.contrasena,
      u.id_rol,
      u.estado,
      u.intentos_fallidos,
      u.bloqueado_hasta,
      r.nombre AS rol,
      r.codigo AS rol_codigo,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'codigo', p.codigo,
            'nombre', p.nombre,
            'tipo', p.tipo,
            'recurso', p.recurso
          )
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'
      ) AS permisos
    FROM tbl_usuarios u
    JOIN tbl_roles r ON u.id_rol = r.id
    LEFT JOIN tbl_roles_permisos rp ON r.id = rp.id_rol
    LEFT JOIN tbl_permisos p ON rp.id_permiso = p.id
    WHERE u.username = ${username}
    GROUP BY u.id, u.nombres, u.username, u.contrasena, u.id_rol, u.estado,
             u.intentos_fallidos, u.bloqueado_hasta, r.nombre, r.codigo
  `;

  return rows.length > 0 ? rows[0] : null;
};

/**
 * Incrementar intentos fallidos
 */
const incrementFailedAttempts = async (userId, currentAttempts) => {
  const MAX_ATTEMPTS = 5;
  const newAttempts = currentAttempts + 1;

  if (newAttempts >= MAX_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.tbl_usuarios.update({
      where: { id: userId },
      data: {
        intentos_fallidos: newAttempts,
        bloqueado_hasta: lockUntil,
        estado: 'BLOQUEADO',
      },
    });
  } else {
    await prisma.tbl_usuarios.update({
      where: { id: userId },
      data: { intentos_fallidos: newAttempts },
    });
  }
};

/**
 * Resetear intentos fallidos al loguearse correctamente
 */
const resetFailedAttempts = async (userId) => {
  await prisma.tbl_usuarios.update({
    where: { id: userId },
    data: {
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      estado: 'ACTIVO',
    },
  });
};

/**
 * Verificar si un padre tiene vinculo con algun alumno
 */
const parentHasLink = async (userId) => {
  const link = await prisma.tbl_padres_alumnos.findFirst({
    where: {
      tbl_padres: {
        id_usuario: userId,
      },
    },
  });
  return !!link;
};

module.exports = {
  findUserByUsername,
  incrementFailedAttempts,
  resetFailedAttempts,
  parentHasLink,
};
