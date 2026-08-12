const verificarRol = require('../../middleware/rbacMiddleware');

const ejecutar = (roles, user) => {
  const req = { user };
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const next = jest.fn();
  verificarRol(...roles)(req, { status, json }, next);
  return { status, json, next };
};

describe('control de acceso por rol', () => {
  test('permite un rol autorizado', () => {
    const { next, status } = ejecutar(['SUPER_ADMIN', 'ADMIN'], { rol_codigo: 'SUPER_ADMIN' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  test('rechaza un rol no autorizado', () => {
    const { next, status, json } = ejecutar(['SUPER_ADMIN'], { rol_codigo: 'TUTOR' });
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  test('rechaza solicitudes sin identidad', () => {
    const { status, next } = ejecutar(['SUPER_ADMIN'], null);
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
