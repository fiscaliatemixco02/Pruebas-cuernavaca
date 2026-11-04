require('dotenv').config();
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  // DB_SSL=true cuando la base está en otro servidor/nube y exige conexión cifrada
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_NO_VERIFICAR !== 'true' } : undefined,
});

// ---------------------------------------------------------------------------
// Contexto del usuario para Row-Level Security (database/Migraciones/RLS.sql)
//
// verificarToken guarda { id, rol } aquí; mientras dure la petición, cada conexión que use la
// base recibe  app.user_id  y  app.user_rol, y las políticas RLS filtran las filas con ellos.
//
// Está APAGADO por defecto (RLS_ENABLED distinto de "true"): en ese caso este archivo se comporta
// exactamente igual que antes y no cambia ninguna consulta.
// ---------------------------------------------------------------------------
const contexto = new AsyncLocalStorage();
pool.contexto = contexto;

if (process.env.RLS_ENABLED === 'true') {
  const conectarOriginal = pool.connect.bind(pool);

  const FIJAR = "SELECT set_config('app.user_id', $1, false), set_config('app.user_rol', $2, false)";
  const LIMPIAR = "SELECT set_config('app.user_id', '', false), set_config('app.user_rol', '', false)";

  pool.connect = async function conectar(...args) {
    if (args.length) return conectarOriginal(...args); // forma con callback: no se usa en este proyecto
    const client = await conectarOriginal();
    try {
      const ctx = contexto.getStore();
      // Sin sesión (login, etc.) las variables van vacías: las políticas RLS no dejan ver nada
      await client.query(FIJAR, [ctx ? String(ctx.id) : '', ctx?.rol || '']);
    } catch (e) {
      client.release(true);
      throw e;
    }
    const liberarOriginal = client.release.bind(client);
    client.release = (err) => {
      // Antes de devolver la conexión al pool se borra el usuario, para que no pase a otra petición
      client.query(LIMPIAR).then(
        () => liberarOriginal(err),
        () => liberarOriginal(true) // si no se pudo limpiar, la conexión se destruye
      );
    };
    return client;
  };

  const consultaOriginal = pool.query.bind(pool);
  pool.query = async function consultar(...args) {
    if (!contexto.getStore() || typeof args[args.length - 1] === 'function') return consultaOriginal(...args);
    const client = await pool.connect();
    try {
      return await client.query(...args);
    } finally {
      client.release();
    }
  };
}

module.exports = pool;
