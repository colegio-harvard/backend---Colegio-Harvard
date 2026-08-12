const {
  COOKIE_NAME,
  parseCookies,
  extractToken,
  sessionCookieOptions,
} = require('../services/auth/token');

describe('sesion compatible y segura', () => {
  test('prioriza el token Bearer existente para no cerrar sesiones activas', () => {
    expect(extractToken({
      authorization: 'Bearer token-antiguo',
      cookie: `${COOKIE_NAME}=token-cookie`,
    })).toBe('token-antiguo');
  });

  test('acepta la cookie HttpOnly como canal alternativo', () => {
    expect(extractToken({ cookie: `tema=claro; ${COOKIE_NAME}=token-cookie` }))
      .toBe('token-cookie');
  });

  test('interpreta cookies codificadas y omite segmentos invalidos', () => {
    expect(parseCookies(`invalida; valor=${encodeURIComponent('a b')}`))
      .toEqual({ valor: 'a b' });
  });

  test('la cookie de produccion no queda accesible a JavaScript', () => {
    expect(sessionCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });
});
