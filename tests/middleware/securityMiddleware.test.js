const {
  securityHeaders,
  createRateLimiter,
  notFoundHandler,
} = require('../../middleware/securityMiddleware');

const response = () => {
  const headers = {};
  return {
    headers,
    setHeader: jest.fn((key, value) => { headers[key] = value; }),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
};

describe('protecciones HTTP', () => {
  test('agrega identificador y cabeceras de seguridad', () => {
    const req = { headers: {} };
    const res = response();
    const next = jest.fn();
    securityHeaders(req, res, next);
    expect(req.requestId).toEqual(expect.any(String));
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['X-Frame-Options']).toBe('DENY');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('limita intentos repetidos desde el mismo origen', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 2, keyPrefix: 'test' });
    const req = { ip: '127.0.0.1', requestId: 'request-1' };
    const first = response();
    const second = response();
    const third = response();
    limiter(req, first, jest.fn());
    limiter(req, second, jest.fn());
    limiter(req, third, jest.fn());
    expect(third.status).toHaveBeenCalledWith(429);
    expect(third.json).toHaveBeenCalledWith(expect.objectContaining({ request_id: 'request-1' }));
  });

  test('las rutas inexistentes responden en formato uniforme', () => {
    const res = response();
    notFoundHandler({ requestId: 'abc' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ruta no encontrada', request_id: 'abc' });
  });
});
