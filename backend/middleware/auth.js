const jwt = require('jsonwebtoken');
const pool = require('../db');
const { NOMBRE_COOKIE } = require('../config/sesion');
const { ORIGENES_PERMITIDOS } = require('../config/entorno');
const { leerCookie } = require('../utils/cookies');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// El token se acepta en la cookie HttpOnly de sesión (lo normal) o en "Authorization: Bearer"
// (para Postman, scripts, etc.).
function extraerToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { token: authHeader.slice(7).trim(), via: 'header' };
  }
  const cookie = leerCookie(req, NOMBRE_COOKIE);
  if (cookie) return { token: cookie, via: 'cookie' };
  return null;
}

// Defensa CSRF para la sesión por cookie: el navegador manda la cookie solo, así que otra página
// podría intentar hacer peticiones en nombre del usuario. En métodos que modifican datos se exige
//   1) la cabecera X-Requested-With (una página ajena no puede ponerla sin permiso de CORS), y
//   2) que el Origin, si viene, sea el del frontend autorizado.
// (A esto se suma SameSite=Lax en la cookie.)
function origenConfiable(req) {
  if (METODOS_SEGUROS.has(req.method)) return true;
  if (!req.headers['x-requested-with']) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  if (ORIGENES_PERMITIDOS.includes(origin)) return true;
  return origin === `${req.protocol}://${req.get('host')}`;
}

function verificarToken(req, res, next) {
  const encontrado = extraerToken(req);

  if (!encontrado) {
    return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
  }

  let payload;
  try {
    payload = jwt.verify(encontrado.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  if (!Number.isInteger(payload?.id)) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  if (encontrado.via === 'cookie' && !origenConfiable(req)) {
    return res.status(403).json({ error: 'Solicitud rechazada por seguridad' });
  }

  req.usuario = payload;
  // Contexto del usuario para la base de datos (solo se usa si RLS_ENABLED=true)
  req.contextoDb = { id: payload.id, rol: payload.rol };
  return pool.contexto.run(req.contextoDb, () => next());
}

function requerirRol(...rolesPermitidos) {
  return async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT r.nom_rol
           FROM usuarios u
           JOIN roles r ON r.id = u.rol_id
          WHERE u.id = $1`,
        [req.usuario.id]
      );

      const rol = rows[0]?.nom_rol;
      if (!rol || !rolesPermitidos.includes(rol)) {
        return res.status(403).json({ error: 'No tienes permiso para esta acción' });
      }

      req.usuario.rol = rol;
      if (req.contextoDb) req.contextoDb.rol = rol; // el rol que cuenta es el de la base, no el del token
      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al verificar permisos' });
    }
  };
}

module.exports = { verificarToken, requerirRol };
