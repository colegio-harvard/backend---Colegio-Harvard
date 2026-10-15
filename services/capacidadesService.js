const prisma = require('../config/prisma');

const CAPACIDAD_ACADEMICO_DOCENTE = 'ACADEMICO_DOCENTE';

async function tieneCapacidadUsuario(idUsuario, codigos) {
  const permitidos = Array.isArray(codigos) ? codigos : [codigos];
  if (!idUsuario || !permitidos.length) return false;

  const capacidad = await prisma.tbl_usuarios_permisos.findFirst({
    where: {
      id_usuario: Number(idUsuario),
      permiso: { codigo: { in: permitidos } },
    },
    select: { id: true },
  });

  return Boolean(capacidad);
}

module.exports = { CAPACIDAD_ACADEMICO_DOCENTE, tieneCapacidadUsuario };
