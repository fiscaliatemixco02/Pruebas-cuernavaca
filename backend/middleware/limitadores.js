// backend/middleware/limitadores.js
//
// Límite de peticiones SIN dependencias, en memoria.
//   - Se reinicia si el servidor se reinicia.
//   - Si algún día corres varias instancias del backend, cada una cuenta por separado
//     (en ese caso conviene pasar a express-rate-limit con Redis).
//
// Las llaves usan el id del usuario cuando hay sesión y la IP cuando no. Para que la IP sea la real
// detrás de un proxy hay que configurar TRUST_PROXY (ver .env.example).

const crypto = require('crypto');

const MAX_REGISTROS = 50000; // tope de memoria: si se llena, se descartan los más viejos

function recortar(mapa) {
  if (mapa.size <= MAX_REGISTROS) return;
  let sobran = mapa.size - MAX_REGISTROS;
  for (const k of mapa.keys()) {
    mapa.delete(k);
    if (--sobran <= 0) break;
  }
}

// ---------- Límite por número de peticiones en una ventana ----------
function crearLimitador({ ventanaMs, max, clave, mensaje = 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' }) {
  const registros = new Map(); // llave -> { desde, cuenta }

  const limpieza = setInterval(() => {
    const ahora = Date.now();
    for (const [k, r] of registros) if (ahora - r.desde >= ventanaMs) registros.delete(k);
  }, Math.min(ventanaMs, 60 * 1000));
  limpieza.unref();

  const middleware = (req, res, next) => {
    const llave = String(clave ? clave(req) : req.ip);
    const ahora = Date.now();
    let r = registros.get(llave);
    if (!r || ahora - r.desde >= ventanaMs) {
      r = { desde: ahora, cuenta: 0 };
      registros.set(llave, r);
      recortar(registros);
    }
    r.cuenta += 1;

    const segundos = Math.max(1, Math.ceil((r.desde + ventanaMs - ahora) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - r.cuenta)));
    res.setHeader('RateLimit-Reset', String(segundos));

    if (r.cuenta > max) {
      res.setHeader('Retry-After', String(segundos));
      return res.status(429).json({ error: mensaje });
    }
    next();
  };
  middleware._registros = registros; // solo para pruebas
  return middleware;
}

// ---------- Límite por intentos FALLIDOS (login, contraseña al firmar) ----------
// Solo los fallos cuentan: un usuario que acierta nunca se queda bloqueado por usar el sistema.
function crearLimitadorFallos({ ventanaMs, max }) {
  const registros = new Map();

  const limpieza = setInterval(() => {
    const ahora = Date.now();
    for (const [k, r] of registros) if (ahora - r.desde >= ventanaMs) registros.delete(k);
  }, Math.min(ventanaMs, 60 * 1000));
  limpieza.unref();

  return {
    // segundos que faltan para poder reintentar (0 = no está bloqueado)
    bloqueado(llave) {
      const r = registros.get(llave);
      if (!r) return 0;
      const ahora = Date.now();
      if (ahora - r.desde >= ventanaMs) {
        registros.delete(llave);
        return 0;
      }
      return r.cuenta >= max ? Math.ceil((r.desde + ventanaMs - ahora) / 1000) : 0;
    },
    fallo(llave) {
      const ahora = Date.now();
      let r = registros.get(llave);
      if (!r || ahora - r.desde >= ventanaMs) {
        r = { desde: ahora, cuenta: 0 };
        registros.set(llave, r);
        recortar(registros);
      }
      r.cuenta += 1;
    },
    exito(llave) {
      registros.delete(llave);
    },
    _registros: registros,
  };
}

// ---------- Llaves ----------
const porUsuarioOIp = (req) => (req.usuario?.id ? `u:${req.usuario.id}` : `ip:${req.ip}`);

// Para el límite general (corre antes de verificar la sesión): la firma del token identifica a la sesión
function llaveGeneral(req) {
  const auth = req.headers.authorization;
  const cookieCruda = req.headers.cookie;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) return `t:${crypto.createHash('sha1').update(token).digest('hex')}`;
  if (cookieCruda && /(?:^|;\s*)(?:__Host-)?sesion=/.test(cookieCruda)) {
    const m = cookieCruda.match(/(?:^|;\s*)(?:__Host-)?sesion=([^;]+)/);
    return `t:${crypto.createHash('sha1').update(m[1]).digest('hex')}`;
  }
  return `ip:${req.ip}`;
}

const MIN = 60 * 1000;
const HORA = 60 * MIN;

// ---------- Límites del sistema ----------
const limitadores = {
  // Toda la API: 600 peticiones por minuto por sesión (o por IP si no hay sesión). Holgado a propósito:
  // la pantalla consulta notificaciones y pendientes de forma periódica.
  general: crearLimitador({ ventanaMs: MIN, max: 600, clave: llaveGeneral }),

  // Intentos fallidos de inicio de sesión
  loginFallosCuentaIp: crearLimitadorFallos({ ventanaMs: 15 * MIN, max: 8 }), // misma IP + mismo correo
  loginFallosCuenta: crearLimitadorFallos({ ventanaMs: 15 * MIN, max: 30 }), // mismo correo, desde cualquier IP
  loginFallosIp: crearLimitadorFallos({ ventanaMs: 15 * MIN, max: 40 }), // misma IP, cualquier correo
  // Tope de intentos de login (aciertos o fallos) por IP, contra scripts
  loginIp: crearLimitador({
    ventanaMs: 15 * MIN,
    max: 200,
    clave: (req) => `ip:${req.ip}`,
    mensaje: 'Demasiados intentos de inicio de sesión. Espera unos minutos.',
  }),

  // Contraseña equivocada al firmar una recepción
  firmarFallos: crearLimitadorFallos({ ventanaMs: 15 * MIN, max: 8 }),

  // Códigos de verificación por correo
  enviarCodigoUsuario: crearLimitador({
    ventanaMs: HORA,
    max: 30,
    clave: porUsuarioOIp,
    mensaje: 'Enviaste demasiados códigos. Intenta más tarde.',
  }),
  enviarCodigoDestino: crearLimitador({
    ventanaMs: 10 * MIN,
    max: 3,
    clave: (req) => `c:${String(req.body?.correo || '').trim().toLowerCase()}`,
    mensaje: 'Ya se envió un código a ese correo. Espera unos minutos antes de pedir otro.',
  }),
  // El código tiene 6 dígitos: se limitan los intentos para que no se pueda adivinar
  confirmarCodigo: crearLimitador({
    ventanaMs: 10 * MIN,
    max: 8,
    clave: (req) => `${porUsuarioOIp(req)}|${String(req.body?.correo || '').trim().toLowerCase()}`,
    mensaje: 'Demasiados intentos con el código. Solicita uno nuevo en unos minutos.',
  }),

  registro: crearLimitador({ ventanaMs: HORA, max: 60, clave: porUsuarioOIp }),
  cambiarContrasena: crearLimitador({ ventanaMs: 15 * MIN, max: 10, clave: porUsuarioOIp }),
  adminCambiarContrasena: crearLimitador({ ventanaMs: HORA, max: 60, clave: porUsuarioOIp }),

  // Subida de PDF (cada envío puede traer hasta 10 archivos)
  subidas: crearLimitador({ ventanaMs: HORA, max: 120, clave: porUsuarioOIp, mensaje: 'Demasiadas cargas de archivos. Intenta más tarde.' }),
  // Reportes PDF y respaldo completo (pesados)
  reportes: crearLimitador({ ventanaMs: 10 * MIN, max: 30, clave: porUsuarioOIp }),
  respaldo: crearLimitador({ ventanaMs: HORA, max: 6, clave: porUsuarioOIp, mensaje: 'Ya generaste varios respaldos. Intenta más tarde.' }),
};

module.exports = { crearLimitador, crearLimitadorFallos, limitadores, porUsuarioOIp };
