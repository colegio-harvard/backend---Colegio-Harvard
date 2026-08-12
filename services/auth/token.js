const COOKIE_NAME = 'harvard_session';

function parseCookies(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf('=');
      if (separator < 1) return cookies;
      const key = decodeURIComponent(part.slice(0, separator).trim());
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
}

function extractToken({ authorization, cookie } = {}) {
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim() || null;
  }
  return parseCookies(cookie)[COOKIE_NAME] || null;
}

function sessionCookieOptions(isProduction = false) {
  return {
    httpOnly: true,
    secure: Boolean(isProduction),
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}

module.exports = { COOKIE_NAME, parseCookies, extractToken, sessionCookieOptions };
