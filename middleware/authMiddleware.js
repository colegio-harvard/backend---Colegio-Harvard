const jwt = require('jsonwebtoken');
const { extractToken } = require('../services/auth/token');

function verificarToken(req, res, next) {
  const token = extractToken({
    authorization: req.headers.authorization,
    cookie: req.headers.cookie,
  });

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalido o expirado' });
  }
}

module.exports = verificarToken;
