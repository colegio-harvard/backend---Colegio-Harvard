jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const jwt = require('jsonwebtoken');
const verificarToken = require('../../middleware/authMiddleware');

const ejecutar = (authorization) => {
  const req = { headers: { authorization } };
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const next = jest.fn();
  verificarToken(req, { status, json }, next);
  return { req, status, json, next };
};

describe('autenticacion mediante token', () => {
  test('rechaza una solicitud sin token', () => {
    const { status, next } = ejecutar(undefined);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('acepta un token valido y adjunta el usuario', () => {
    jwt.verify.mockReturnValue({ id: 7, rol_codigo: 'ADMIN' });
    const { req, next, status } = ejecutar('Bearer token-valido');
    expect(jwt.verify).toHaveBeenCalledWith('token-valido', process.env.JWT_SECRET);
    expect(req.user).toEqual({ id: 7, rol_codigo: 'ADMIN' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  test('rechaza un token vencido o alterado', () => {
    jwt.verify.mockImplementation(() => { throw new Error('expired'); });
    const { status, next } = ejecutar('Bearer token-invalido');
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
