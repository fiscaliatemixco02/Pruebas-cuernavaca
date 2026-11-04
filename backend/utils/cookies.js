// backend/utils/cookies.js — lectura y escritura de cookies sin dependencias.

function leerCookie(req, nombre) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const par of header.split(';')) {
    const i = par.indexOf('=');
    if (i < 0) continue;
    if (par.slice(0, i).trim() !== nombre) continue;
    try {
      return decodeURIComponent(par.slice(i + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function serializarCookie(nombre, valor, { maxAgeSeg, httpOnly, secure, sameSite, path = '/' } = {}) {
  let c = `${nombre}=${encodeURIComponent(valor)}; Path=${path}`;
  if (maxAgeSeg !== undefined) {
    c += `; Max-Age=${Math.floor(maxAgeSeg)}`;
    if (maxAgeSeg <= 0) c += '; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
  if (httpOnly) c += '; HttpOnly';
  if (secure) c += '; Secure';
  if (sameSite) c += `; SameSite=${sameSite}`;
  return c;
}

function ponerCookie(res, nombre, valor, opciones) {
  res.append('Set-Cookie', serializarCookie(nombre, valor, opciones));
}

module.exports = { leerCookie, serializarCookie, ponerCookie };
