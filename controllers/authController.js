const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findUserByUsername, incrementFailedAttempts, resetFailedAttempts, parentHasLink } = require('../models/authModel');

const login = async (req, res) => {
  const { username, contrasena } = req.body;

  if (!username || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contrasena son obligatorios' });
  }

  try {
    const usuario = await findUserByUsername(username);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no registrado' });
    }

    // Verificar si esta bloqueado temporalmente
    if (usuario.estado === 'BLOQUEADO' && usuario.bloqueado_hasta) {
      const ahora = new Date();
      if (ahora < new Date(usuario.bloqueado_hasta)) {
        const minutosRestantes = Math.ceil((new Date(usuario.bloqueado_hasta) - ahora) / 60000);
        return res.status(423).json({
          error: `Cuenta bloqueada temporalmente. Intente en ${minutosRestantes} minuto(s).`
        });
      }
      // Si ya paso el tiempo de bloqueo, resetear
      await resetFailedAttempts(usuario.id);
    }

    if (usuario.estado === 'BLOQUEADO' && !usuario.bloqueado_hasta) {
      return res.status(403).json({ error: 'Cuenta bloqueada. Contacte al administrador.' });
    }

    // Comparar contrasenas
    const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!coincide) {
      await incrementFailedAttempts(usuario.id, usuario.intentos_fallidos);
      const restantes = 5 - (usuario.intentos_fallidos + 1);
      if (restantes > 0) {
        return res.status(401).json({ error: `Contrasena incorrecta. ${restantes} intento(s) restante(s).` });
      }
      return res.status(423).json({ error: 'Cuenta bloqueada por multiples intentos fallidos. Intente en 15 minutos.' });
    }

    // Verificar si es PADRE y tiene vinculo
    if (usuario.rol_codigo === 'PADRE') {
      const tieneVinculo = await parentHasLink(usuario.id);
      if (!tieneVinculo) {
        return res.status(403).json({ error: 'Su cuenta aun no tiene alumnos vinculados. Contacte al administrador.' });
      }
    }

    // Login exitoso - resetear intentos
    await resetFailedAttempts(usuario.id);

    // Generar token
    const token = jwt.sign(
      {
        id: usuario.id,
        username: usuario.username,
        id_rol: usuario.id_rol,
        rol_codigo: usuario.rol_codigo,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        username: usuario.username,
        id_rol: usuario.id_rol,
        rol: usuario.rol,
        rol_codigo: usuario.rol_codigo,
        permisos: usuario.permisos,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
};

module.exports = { login };
