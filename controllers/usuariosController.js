const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const { registrarAuditoria } = require('../middleware/auditMiddleware');
const { validarContrasena } = require('../utils/validaciones');

const listar = async (req, res) => {
  try {
    const where = { estado: { not: 'ELIMINADO' } };
    // Filtrar por rol si se pasa
    if (req.query.rol) {
      const rol = await prisma.tbl_roles.findUnique({ where: { codigo: req.query.rol } });
      if (rol) where.id_rol = rol.id;
    }

    const usuarios = await prisma.tbl_usuarios.findMany({
      where,
      select: { id: true, username: true, nombres: true, id_rol: true, estado: true, date_time_registration: true, tbl_roles: { select: { nombre: true, codigo: true } } },
      orderBy: { id: 'asc' },
    });

    const data = usuarios.map(u => ({
      ...u,
      rol: u.tbl_roles,
      tbl_roles: undefined,
    }));

    res.json({ data, total: data.length });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
};

const obtenerPorId = async (req, res) => {
  try {
    const usuario = await prisma.tbl_usuarios.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { id: true, username: true, nombres: true, id_rol: true, estado: true, intentos_fallidos: true, bloqueado_hasta: true, date_time_registration: true, tbl_roles: { select: { nombre: true, codigo: true } } },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const data = { ...usuario, rol: usuario.tbl_roles, tbl_roles: undefined };
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
};

const crear = async (req, res) => {
  const { username, contrasena, nombres, id_rol } = req.body;
  if (!username || !contrasena || !nombres || !id_rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  const validacion = validarContrasena(contrasena);
  if (!validacion.valida) {
    return res.status(400).json({ error: validacion.mensaje });
  }

  try {
    // Verificar que ADMIN solo puede crear PADRE
    if (req.user.rol_codigo === 'ADMIN') {
      const rol = await prisma.tbl_roles.findUnique({ where: { id: id_rol } });
      if (!rol || rol.codigo !== 'PADRE') {
        return res.status(403).json({ error: 'Administrador solo puede crear usuarios tipo Padre' });
      }
    }

    const existe = await prisma.tbl_usuarios.findUnique({ where: { username } });
    if (existe) return res.status(409).json({ error: 'Username ya existe' });

    const hash = await bcrypt.hash(contrasena, 10);
    const usuario = await prisma.tbl_usuarios.create({
      data: { username, contrasena: hash, nombres, id_rol, estado: 'ACTIVO', user_id_registration: req.user.id },
    });

    await registrarAuditoria({ userId: req.user.id, accion: 'CREAR_USUARIO', tipoEntidad: 'tbl_usuarios', idEntidad: usuario.id, resumen: `Usuario ${username} creado con rol ${id_rol}` });

    res.status(201).json({ mensaje: 'Usuario creado', id: usuario.id });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

const actualizar = async (req, res) => {
  const { nombres, id_rol, estado } = req.body;
  const id = parseInt(req.params.id);

  try {
    const data = {};
    if (nombres) data.nombres = nombres;
    if (id_rol) data.id_rol = id_rol;
    if (estado) data.estado = estado;
    data.user_id_modification = req.user.id;
    data.date_time_modification = new Date();

    await prisma.tbl_usuarios.update({ where: { id }, data });
    await registrarAuditoria({ userId: req.user.id, accion: 'ACTUALIZAR_USUARIO', tipoEntidad: 'tbl_usuarios', idEntidad: id, resumen: `Usuario ${id} actualizado` });

    res.json({ mensaje: 'Usuario actualizado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

const resetearContrasena = async (req, res) => {
  const { nueva_contrasena } = req.body;
  const id = parseInt(req.params.id);

  const validacion = validarContrasena(nueva_contrasena);
  if (!validacion.valida) {
    return res.status(400).json({ error: validacion.mensaje });
  }

  try {
    const hash = await bcrypt.hash(nueva_contrasena, 10);
    await prisma.tbl_usuarios.update({
      where: { id },
      data: { contrasena: hash, intentos_fallidos: 0, bloqueado_hasta: null, estado: 'ACTIVO', user_id_modification: req.user.id, date_time_modification: new Date() },
    });

    await registrarAuditoria({ userId: req.user.id, accion: 'RESET_CONTRASENA', tipoEntidad: 'tbl_usuarios', idEntidad: id, resumen: `Contrasena reseteada para usuario ${id}` });

    res.json({ mensaje: 'Contrasena reseteada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al resetear contrasena' });
  }
};

const eliminar = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.tbl_usuarios.update({ where: { id }, data: { estado: 'ELIMINADO', user_id_modification: req.user.id, date_time_modification: new Date() } });
    await registrarAuditoria({ userId: req.user.id, accion: 'ELIMINAR_USUARIO', tipoEntidad: 'tbl_usuarios', idEntidad: id, resumen: `Usuario ${id} eliminado (soft)` });
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) { res.status(500).json({ error: 'Error al eliminar usuario' }); }
};

const listarRoles = async (_req, res) => {
  try {
    const roles = await prisma.tbl_roles.findMany({
      select: { id: true, codigo: true, nombre: true },
      orderBy: { id: 'asc' },
    });
    res.json({ data: roles });
  } catch (error) {
    console.error('Error al listar roles:', error);
    res.status(500).json({ error: 'Error al listar roles' });
  }
};

module.exports = { listar, obtenerPorId, crear, actualizar, resetearContrasena, eliminar, listarRoles };
