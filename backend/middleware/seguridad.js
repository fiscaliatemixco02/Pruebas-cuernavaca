// backend/middleware/seguridad.js
//
// Cabeceras de seguridad, HTTPS forzado, CORS, limpieza del body y manejo de errores.
// (Equivale a lo que hace "helmet", pero sin instalar nada.)

const { PRODUCCION, ORIGENES_PERMITIDOS, FORZAR_HTTPS } = require('../config/entorno');

// ---------- Cabeceras ----------
function cabecerasSeguras(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  // Esta API solo devuelve JSON y PDF: no necesita cargar nada más
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  next();
}

// La información de la API (personas, carpetas, PDF) no debe quedarse en cachés del navegador ni de proxies
function sinCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}

// ---------- HTTPS ----------
const esHttps = (req) =>
  req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';

// El balanceador consulta "/" para saber si el servicio vive: se deja pasar aunque sea por http
const RUTAS_SALUD = new Set(['/', '/healthz']);

function forzarHttps(req, res, next) {
  if (!FORZAR_HTTPS) return next();

  if (esHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return next();
  }
  if (RUTAS_SALUD.has(req.path)) return next();

  // Un GET se redirige. Cualquier otro método se rechaza: ya viajó en claro y no debe repetirse
  if (req.method === 'GET' || req.method === 'HEAD') {
    const host = process.env.PUBLIC_HOST || req.headers.host;
    if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
      return res.redirect(308, `https://${host}${req.originalUrl}`);
    }
  }
  return res.status(403).json({ error: 'Se requiere una conexión segura (HTTPS)' });
}

// ---------- CORS ----------
const corsOpciones = {
  origin(origin, cb) {
    // Sin cabecera Origin = herramienta que no es un navegador (o misma-origen): CORS no aplica
    if (!origin || ORIGENES_PERMITIDOS.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 600,
};

// ---------- Body ----------
// Quita claves que sirven para ataques de "prototype pollution"
const PELIGROSAS = new Set(['__proto__', 'constructor', 'prototype']);
function limpiar(obj, nivel = 0) {
  if (!obj || typeof obj !== 'object' || nivel > 8) return;
  for (const k of Object.keys(obj)) {
    if (PELIGROSAS.has(k)) delete obj[k];
    else limpiar(obj[k], nivel + 1);
  }
}
function limpiarBody(req, res, next) {
  if (req.body === undefined) req.body = {}; // petición sin JSON: evita errores al leer campos
  limpiar(req.body);
  next();
}

// ---------- Aviso de proxy mal configurado ----------
let avisado = false;
function avisarProxy(req, res, next) {
  if (!avisado && PRODUCCION && !process.env.TRUST_PROXY && req.headers['x-forwarded-for']) {
    avisado = true;
    console.warn('[config] AVISO: llegan peticiones con X-Forwarded-For pero TRUST_PROXY no está definido; los límites de peticiones verán la IP del proxy.');
  }
  next();
}

// ---------- Errores ----------
function noEncontrado(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud es demasiado grande' });
  const estado = err?.status || err?.statusCode;
  if (estado >= 400 && estado < 500) {
    return res.status(estado).json({ error: estado === 404 ? 'No encontrado' : 'Solicitud inválida' });
  }
  console.error(err); // el detalle queda en el log del servidor, nunca en la respuesta
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = {
  cabecerasSeguras,
  sinCache,
  forzarHttps,
  corsOpciones,
  limpiarBody,
  avisarProxy,
  noEncontrado,
  manejarErrores,
};
