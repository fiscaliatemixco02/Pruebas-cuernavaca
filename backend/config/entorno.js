// backend/config/entorno.js
//
// Lee y valida las variables de entorno UNA sola vez. Nada de aquí se manda al navegador.
// Los secretos (JWT_SECRET, DB_PASSWORD, EMAIL_PASS, PASSWORD_ENCRYPTION_KEY, TURNSTILE_SECRET_KEY)
// solo viven en backend/.env o en las variables del servidor; nunca en el código ni en git.

require('dotenv').config();

const PRODUCCION = process.env.NODE_ENV === 'production';

const lista = (valor, porDefecto = []) => {
  const items = String(valor || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return items.length ? items : porDefecto;
};

// Orígenes del frontend autorizados (CORS y comprobación de origen). FRONTEND_URL admite varios, separados por comas.
const ORIGENES_PERMITIDOS = lista(process.env.FRONTEND_URL, ['http://localhost:5173']);

// HTTPS: se fuerza en producción, o cuando FORCE_HTTPS=true. FORCE_HTTPS=false lo apaga.
const FORZAR_HTTPS =
  process.env.FORCE_HTTPS === 'true' || (PRODUCCION && process.env.FORCE_HTTPS !== 'false');

function validarEntorno() {
  const problemas = [];
  const avisos = [];

  if (!process.env.JWT_SECRET) {
    problemas.push('Falta JWT_SECRET en backend/.env (sin él nadie puede iniciar sesión).');
  } else if (process.env.JWT_SECRET.length < 32) {
    avisos.push('JWT_SECRET tiene menos de 32 caracteres. Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  }

  if (!/^[0-9a-fA-F]{64}$/.test(process.env.PASSWORD_ENCRYPTION_KEY || '')) {
    avisos.push('PASSWORD_ENCRYPTION_KEY no está configurada (64 caracteres hexadecimales): crear cuentas y cambiar contraseñas va a fallar.');
  }

  if (PRODUCCION && !process.env.FRONTEND_URL) {
    avisos.push('FRONTEND_URL no está definida: CORS solo aceptará http://localhost:5173.');
  }
  if (PRODUCCION && ORIGENES_PERMITIDOS.some((o) => o.startsWith('http://') && !/localhost|127\.0\.0\.1/.test(o))) {
    avisos.push('FRONTEND_URL usa http:// en producción. Usa https://.');
  }
  if (PRODUCCION && !process.env.TRUST_PROXY) {
    avisos.push('TRUST_PROXY no está definido. Si el servidor está detrás de nginx/Render/Railway/Cloudflare, ponlo (por ejemplo TRUST_PROXY=1) para que los límites de peticiones vean la IP real.');
  }

  if (problemas.length) {
    problemas.forEach((p) => console.error(`[config] ERROR: ${p}`));
    process.exit(1);
  }
  avisos.forEach((a) => console.warn(`[config] AVISO: ${a}`));
}

module.exports = { PRODUCCION, ORIGENES_PERMITIDOS, FORZAR_HTTPS, validarEntorno, lista };
