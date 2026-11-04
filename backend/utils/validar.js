// backend/utils/validar.js
//
// Validación de lo que llega en req.body / req.query. Regla: de un body solo se toman los campos
// que la ruta declara (nada de pasar req.body entero a la base) y cada uno con su tipo.
// Si algo no cumple se lanza ErrorValidacion y la ruta responde 400.

class ErrorValidacion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorValidacion';
  }
}

const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

// Id numérico positivo. Acepta 5 o "5". Devuelve número (o null si es opcional y viene vacío).
function entero(v, { campo = 'valor', requerido = false } = {}) {
  if (vacio(v)) {
    if (requerido) throw new ErrorValidacion(`${campo} es obligatorio`);
    return null;
  }
  const s = String(v).trim();
  if (typeof v === 'object' || !/^\d{1,15}$/.test(s)) throw new ErrorValidacion(`${campo} no es válido`);
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1) throw new ErrorValidacion(`${campo} no es válido`);
  return n;
}

// Texto recortado con largo máximo. Solo acepta cadenas (no objetos ni arreglos).
function texto(v, { campo = 'valor', max = 255, requerido = false } = {}) {
  if (vacio(v)) {
    if (requerido) throw new ErrorValidacion(`${campo} es obligatorio`);
    return null;
  }
  if (typeof v !== 'string') throw new ErrorValidacion(`${campo} no es válido`);
  const t = v.trim();
  if (t.length > max) throw new ErrorValidacion(`${campo} no puede pasar de ${max} caracteres`);
  return t;
}

// true/false (también "true"/"false"). Si viene vacío devuelve null.
function booleano(v, { campo = 'valor' } = {}) {
  if (v === undefined || v === null || v === '') return null;
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  throw new ErrorValidacion(`${campo} no es válido`);
}

// Fecha AAAA-MM-DD
function fechaISO(v, { campo = 'fecha' } = {}) {
  if (vacio(v)) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    throw new ErrorValidacion(`${campo} debe tener el formato AAAA-MM-DD`);
  }
  return v.trim();
}

// Un query string repetido (?a=1&a=2) llega como arreglo: solo se acepta texto simple
function parametro(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// Escapa % _ \ para usarlo dentro de un ILIKE sin que el usuario meta comodines
function escaparLike(v) {
  return String(v).replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Toma SOLO las claves permitidas de un objeto
function tomar(obj, claves) {
  const salida = {};
  if (!obj || typeof obj !== 'object') return salida;
  for (const k of claves) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) salida[k] = obj[k];
  }
  return salida;
}

// Envuelve un handler: si lanza ErrorValidacion responde 400 con el mensaje
function conValidacion(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (e) {
      if (e instanceof ErrorValidacion) return res.status(400).json({ error: e.message });
      next(e);
    }
  };
}

module.exports = {
  ErrorValidacion,
  entero,
  texto,
  booleano,
  fechaISO,
  parametro,
  escaparLike,
  tomar,
  conValidacion,
};
