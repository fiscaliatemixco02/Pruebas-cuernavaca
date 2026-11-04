// backend/middleware/bots.js
//
// Protección contra bots en los endpoints públicos (login). Tres capas, todas "a prueba de romper":
//
//  1. Trampa (honeypot): el formulario de login lleva un campo oculto "sitio_web". Una persona nunca
//     lo llena; un bot que rellena todo, sí. Si llega con contenido se rechaza.
//  2. User-Agent de herramientas de automatización o vacío -> se rechaza (solo en producción;
//     BLOQUEAR_USER_AGENTS=false lo apaga si tus propios scripts llaman al login).
//  3. CAPTCHA Cloudflare Turnstile (gratis). OPCIONAL: solo se exige si defines TURNSTILE_SECRET_KEY.
//     Sin esa variable no hace nada, así que no rompe el login actual.
//
// Además, el login ya tiene límite de intentos fallidos por cuenta/IP (middleware/limitadores.js).

const { PRODUCCION } = require('../config/entorno');

const AUTOMATIZACION =
  /(sqlmap|nikto|nmap|masscan|zgrab|hydra|medusa|havij|acunetix|nessus|wpscan|dirbuster|gobuster|ffuf|python-requests|python-urllib|aiohttp|httpx|go-http-client|libwww-perl|scrapy|okhttp|java\/|curl\/|wget\/|phantomjs|headlesschrome)/i;

const bloquearUserAgents = process.env.BLOQUEAR_USER_AGENTS
  ? process.env.BLOQUEAR_USER_AGENTS === 'true'
  : PRODUCCION;

function bloquearAutomatizacion(req, res, next) {
  // La trampa siempre está activa
  if (req.body && typeof req.body.sitio_web === 'string' && req.body.sitio_web.trim() !== '') {
    return res.status(400).json({ error: 'Solicitud inválida' });
  }
  if (bloquearUserAgents) {
    const ua = req.headers['user-agent'];
    if (!ua || AUTOMATIZACION.test(ua)) {
      return res.status(403).json({ error: 'Solicitud no permitida' });
    }
  }
  next();
}

// Verificación de Turnstile en el servidor (el token que da el navegador no vale si no se confirma aquí)
async function verificarTurnstile(req, res, next) {
  const secreto = process.env.TURNSTILE_SECRET_KEY;
  if (!secreto) return next(); // CAPTCHA no configurado: se omite

  const token = req.body?.turnstileToken;
  if (typeof token !== 'string' || !token || token.length > 2048) {
    return res.status(400).json({ error: 'Completa la verificación de seguridad' });
  }

  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 5000);
  try {
    const cuerpo = new URLSearchParams({ secret: secreto, response: token });
    if (req.ip) cuerpo.set('remoteip', req.ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: cuerpo,
      signal: control.signal,
    });
    const datos = await r.json();
    if (!datos.success) {
      return res.status(400).json({ error: 'No se pudo validar la verificación de seguridad. Inténtalo de nuevo' });
    }
    next();
  } catch (error) {
    console.error('Turnstile:', error.message);
    res.status(503).json({ error: 'No se pudo verificar la seguridad en este momento. Inténtalo de nuevo' });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { bloquearAutomatizacion, verificarTurnstile };
