// backend/scripts/crear-admin-inicial.js
//
// Se ejecuta antes de arrancar el servidor (ver Dockerfile).
// Si la tabla usuarios está VACÍA, crea el primer administrador con los datos de .env
// (ADMIN_CORREO, ADMIN_NOMBRE, ADMIN_PASSWORD). Si ya hay usuarios, no hace nada.

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

async function main() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
  if (rows[0].n > 0) {
    console.log('[inicio] Ya existen usuarios: no se crea el administrador inicial.');
    return;
  }

  const correo = String(process.env.ADMIN_CORREO || '').trim().toLowerCase();
  const nombre = String(process.env.ADMIN_NOMBRE || 'Administrador').trim();
  const contrasena = process.env.ADMIN_PASSWORD || '';

  if (!correo || !contrasena) {
    throw new Error('La base está vacía y faltan ADMIN_CORREO y ADMIN_PASSWORD en el archivo .env');
  }
  if (contrasena.length < 8) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres');
  }

  const rol = await pool.query("SELECT id FROM roles WHERE nom_rol = 'Administrador'");
  if (!rol.rows[0]) {
    throw new Error("No existe el rol 'Administrador': revisa que se cargaron los catálogos (database/init)");
  }

  const hash = await bcrypt.hash(contrasena, 10);
  await pool.query(
    `INSERT INTO usuarios (nombre, correo, rol_id, password_hash, verificado)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [nombre, correo, rol.rows[0].id, hash]
  );
  console.log(`[inicio] Administrador inicial creado: ${correo}`);
}

main()
  .catch((e) => {
    console.error(`[inicio] No se pudo preparar el administrador inicial: ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
