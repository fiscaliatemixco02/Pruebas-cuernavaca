// backend/config/sesion.js
//
// La sesión viaja en una cookie HttpOnly (el JavaScript de la página no puede leerla,
// así que un XSS ya no puede robar el token como pasaba con localStorage).
//
// Variables opcionales en .env:
//   COOKIE_SAMESITE = Lax (por defecto) | Strict | None
//       Usa None SOLO si el frontend y la API están en sitios distintos (otro dominio);
//       None obliga a HTTPS.
//   COOKIE_SECURE   = true | false  (por defecto: true en producción)

const { PRODUCCION } = require('./entorno');

const SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : PRODUCCION;

const permitidas = { lax: 'Lax', strict: 'Strict', none: 'None' };
let SAMESITE = permitidas[String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase()] || 'Lax';
// Los navegadores rechazan SameSite=None sin Secure
const SECURE_FINAL = SAMESITE === 'None' ? true : SECURE;

// El prefijo __Host- obliga al navegador a aceptar la cookie solo si es Secure, Path=/ y sin Domain
const NOMBRE_COOKIE = SECURE_FINAL ? '__Host-sesion' : 'sesion';

const DURACION_SEG = 8 * 60 * 60; // igual que el JWT (8 h)

module.exports = {
  NOMBRE_COOKIE,
  DURACION_SEG,
  OPCIONES_COOKIE: { httpOnly: true, secure: SECURE_FINAL, sameSite: SAMESITE, path: '/' },
};
