const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { validarContrasena } = require('../utils/validaciones');

const listar = async (req, res) => {
  try {
    const padres = await prisma.tbl_padres.findMany({
      include: {
        tbl_usuarios: { select: { id: true, username: true, estado: true } },
        tbl_padres_alumnos: { include: { tbl_alumnos: { select: { id: true, nombre_completo: true, codigo_alumno: true } } } },
      },
      orderBy: { id: 'asc' },
    });

    const data = padres.map(p => ({
      id: p.id,
      dni: p.dni,
      nombre_completo: p.nombre_completo,
      celular: p.celular,
      id_usuario: p.id_usuario,
      date_time_registration: p.date_time_registration,
      usuario: p.tbl_usuarios,
      hijos: (p.tbl_padres_alumnos || []).map(pa => pa.tbl_alumnos),
    }));

    res.json({ data, total: data.length });
  } catch (error) { res.status(500).json({ error: 'Error al listar padres' }); }
};

const obtenerPorId = async (req, res) => {
  try {
    const padre = await prisma.tbl_padres.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        tbl_usuarios: { select: { id: true, username: true, estado: true } },
        tbl_padres_alumnos: {
          include: {
            tbl_alumnos: {
              select: {
                id: true, nombre_completo: true, codigo_alumno: true, estado: true, foto_url: true,
                tbl_aulas: { select: { seccion: true, tbl_grados: { select: { nombre: true, tbl_niveles: { select: { nombre: true } } } } } },
              },
            },
          },
        },
      },
    });
    if (!padre) return res.status(404).json({ error: 'Padre no encontrado' });

    const data = {
      id: padre.id,
      dni: padre.dni,
      nombre_completo: padre.nombre_completo,
      celular: padre.celular,
      id_usuario: padre.id_usuario,
      date_time_registration: padre.date_time_registration,
      usuario: padre.tbl_usuarios,
      hijos: (padre.tbl_padres_alumnos || []).map(pa => {
        const a = pa.tbl_alumnos;
        return {
          id: a.id,
          nombre_completo: a.nombre_completo,
          codigo_alumno: a.codigo_alumno,
          estado: a.estado,
          foto_url: a.foto_url,
          aula: a.tbl_aulas ? {
            seccion: a.tbl_aulas.seccion,
            grado: a.tbl_aulas.tbl_grados?.nombre,
            nivel: a.tbl_aulas.tbl_grados?.tbl_niveles?.nombre,
          } : null,
        };
      }),
    };

    res.json({ data });
  } catch (error) { res.status(500).json({ error: 'Error al obtener padre' }); }
};

const crear = async (req, res) => {
  const { dni, nombre_completo, celular, username, contrasena } = req.body;
  if (!dni || !nombre_completo || !celular || !username || !contrasena) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  const validacion = validarContrasena(contrasena);
  if (!validacion.valida) {
    return res.status(400).json({ error: validacion.mensaje });
  }

  try {
    const dniExiste = await prisma.tbl_padres.findUnique({ where: { dni } });
    if (dniExiste) return res.status(409).json({ error: 'DNI ya registrado' });

    const usernameExiste = await prisma.tbl_usuarios.findUnique({ where: { username } });
    if (usernameExiste) return res.status(409).json({ error: 'Username ya existe' });

    const rolPadre = await prisma.tbl_roles.findUnique({ where: { codigo: 'PADRE' } });

    const hash = await bcrypt.hash(contrasena, 10);

    const result = await prisma.$transaction(async (tx) => {
      const usuario = await tx.tbl_usuarios.create({
        data: { username, contrasena: hash, nombres: nombre_completo, id_rol: rolPadre.id, estado: 'ACTIVO', user_id_registration: req.user.id },
      });
      const padre = await tx.tbl_padres.create({
        data: { dni, nombre_completo, celular, id_usuario: usuario.id, user_id_registration: req.user.id },
      });
      return { usuario, padre };
    });

    await registrarAuditoria({ userId: req.user.id, accion: 'CREAR_PADRE', tipoEntidad: 'tbl_padres', idEntidad: result.padre.id, resumen: `Padre ${nombre_completo} (DNI: ${dni}) creado` });

    res.status(201).json({ mensaje: 'Padre creado', id: result.padre.id, id_usuario: result.usuario.id });
  } catch (error) {
    console.error('Error al crear padre:', error);
    res.status(500).json({ error: 'Error al crear padre' });
  }
};

const actualizar = async (req, res) => {
  const id = parseInt(req.params.id);
  const { dni, nombre_completo, celular } = req.body;

  try {
    const data = { user_id_modification: req.user.id, date_time_modification: new Date() };
    if (dni) data.dni = dni;
    if (nombre_completo) data.nombre_completo = nombre_completo;
    if (celular) data.celular = celular;

    await prisma.tbl_padres.update({ where: { id }, data });
    await registrarAuditoria({ userId: req.user.id, accion: 'ACTUALIZAR_PADRE', tipoEntidad: 'tbl_padres', idEntidad: id, resumen: `Padre ${id} actualizado` });
    res.json({ mensaje: 'Padre actualizado' });
  } catch (error) { res.status(500).json({ error: 'Error al actualizar padre' }); }
};

const eliminar = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const padre = await prisma.tbl_padres.findUnique({ where: { id } });
    if (!padre) return res.status(404).json({ error: 'Padre no encontrado' });

    if (padre.id_usuario) {
      await prisma.tbl_usuarios.update({ where: { id: padre.id_usuario }, data: { estado: 'ELIMINADO', user_id_modification: req.user.id, date_time_modification: new Date() } });
    }

    await registrarAuditoria({ userId: req.user.id, accion: 'ELIMINAR_PADRE', tipoEntidad: 'tbl_padres', idEntidad: id, resumen: `Padre ${padre.nombre_completo} eliminado (soft)` });
    res.json({ mensaje: 'Padre eliminado' });
  } catch (error) { res.status(500).json({ error: 'Error al eliminar padre' }); }
};

const buscar = async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'La busqueda requiere al menos 2 caracteres' });
  }
  try {
    const padres = await prisma.tbl_padres.findMany({
      where: {
        OR: [
          { dni: { startsWith: q } },
          { nombre_completo: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, dni: true, nombre_completo: true, celular: true },
      take: 10,
      orderBy: { nombre_completo: 'asc' },
    });
    res.json({ data: padres });
  } catch (error) {
    console.error('Error al buscar padres:', error);
    res.status(500).json({ error: 'Error al buscar padres' });
  }
};

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar, buscar };
