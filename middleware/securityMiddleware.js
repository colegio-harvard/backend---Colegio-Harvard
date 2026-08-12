const crypto = require('crypto');

const securityHeaders = (req, res, next) => {
  const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
};

const createRateLimiter = ({ windowMs, max, keyPrefix = 'global' }) => {
  const attempts = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const identity = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${identity}`;
    const current = attempts.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    entry.count += 1;
    attempts.set(key, entry);

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(max - entry.count, 0)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Demasiados intentos. Espere un momento antes de volver a intentar.',
        request_id: req.requestId || null,
      });
    }

    // Evita que el mapa crezca indefinidamente en procesos de larga duración.
    if (attempts.size > 10000) {
      for (const [storedKey, stored] of attempts) {
        if (stored.resetAt <= now) attempts.delete(storedKey);
      }
    }
    next();
  };
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', request_id: req.requestId || null });
};

const errorHandler = (error, req, res, _next) => {
  console.error(`[ERROR] ${req.requestId || 'sin-id'} ${req.method} ${req.originalUrl}:`, error);
  if (res.headersSent) return;
  const status = Number(error.status || error.statusCode || 500);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status >= 500 ? 'Ocurrió un error inesperado' : error.message,
    request_id: req.requestId || null,
  });
};

module.exports = { securityHeaders, createRateLimiter, notFoundHandler, errorHandler };
