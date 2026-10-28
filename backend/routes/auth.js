const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { enviarCorreoCodigo } = require('../mailer');
const { verificarToken, requerirRol } = require('../middleware/auth');
const { ROLES, PERMISOS, ROLES_NO_ASIGNABLES_POR_CREADOR } = require('../config/roles');

const router = express.Router();
const ADMIN = 'Administrador';

const normalizarCorreo = (c) => String(c || '').trim().toLowerCase();

function datosUsuario(u) {
  const [nombre = '', ...resto] = (u.nombre || '').trim().split(/\s+/);
  return {
    id: u.id,
    nombre,
    apellidos: resto.join(' '),
    correo: u.correo,
    rol: u.rol,
    materia: u.materia || null,
  };
}

// Login por correo y contraseña
router.post('/login', async (req, res) => {
  const correo = normalizarCorreo(req.body.correo || req.body.usuario);
  const { contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  try {
    const resultado = await pool.query(
      `SELECT u.id, u.nombre, u.correo, u.password_hash, u.verificado,
              r.nom_rol AS rol, m.nombre AS materia
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN materias m ON m.id = u.materia_id
       WHERE LOWER(u.correo) = $1`,
      [correo]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const usuario = resultado.rows[0];

    if (!usuario.verificado) {
      return res.status(401).json({ error: 'La cuenta no ha sido verificada' });
    }

    if (!usuario.password_hash) {
      return res.status(401).json({ error: 'Esta cuenta no tiene contraseña configurada' });
    }

    const coincide = await bcrypt.compare(contrasena, usuario.password_hash);
    if (!coincide) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, usuario: datosUsuario(usuario) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Usuario de la sesión actual
router.get('/me', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.correo, r.nom_rol AS rol, m.nombre AS materia
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN materias m ON m.id = u.materia_id
       WHERE u.id = $1`,
      [req.usuario.id]
    );

    if (!rows[0]) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    res.json(datosUsuario(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la sesión' });
  }
});

// Cambiar contraseña del usuario autenticado
router.put('/cambiar-contrasena', verificarToken, async (req, res) => {
  const { contrasenaActual, nuevaContrasena } = req.body;
  const usuarioId = req.usuario.id;

  if (!contrasenaActual || !nuevaContrasena) {
    return res.status(400).json({ error: 'La contraseña actual y la nueva son obligatorias' });
  }

  if (String(nuevaContrasena).length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const result = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [usuarioId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const coincide = await bcrypt.compare(contrasenaActual, result.rows[0].password_hash);
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const nuevoHash = await bcrypt.hash(nuevaContrasena, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [nuevoHash, usuarioId]);

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
});

// A partir de aquí: crean cuentas el Administrador y el Creador de Cuentas.

// Generar y enviar código de verificación por correo
router.post('/enviar-codigo', verificarToken, requerirRol(...PERMISOS.crearCuentas), async (req, res) => {
  const correo = normalizarCorreo(req.body.correo);
  if (!correo) {
    return res.status(400).json({ error: 'El correo es obligatorio' });
  }

  try {
    const existe = await pool.query(
      'SELECT 1 FROM usuarios WHERE LOWER(correo) = $1',
      [correo]
    );
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    const codigo = crypto.randomInt(100000, 1000000).toString();
    const tokenHash = await bcrypt.hash(codigo, 10);
    const tokenExpira = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await pool.query(
      `INSERT INTO verificaciones_correo (correo, token_hash, token_expira)
       VALUES ($1, $2, $3)`,
      [correo, tokenHash, tokenExpira]
    );

    await enviarCorreoCodigo(correo, codigo);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo enviar el código de verificación' });
  }
});

// Confirmar código de verificación
router.post('/confirmar-codigo', verificarToken, requerirRol(...PERMISOS.crearCuentas), async (req, res) => {
  const correo = normalizarCorreo(req.body.correo);
  const { codigo } = req.body;

  if (!correo || !codigo) {
    return res.status(400).json({ error: 'Correo y código son obligatorios' });
  }

  try {
    const resultado = await pool.query(
      `SELECT id, token_hash FROM verificaciones_correo
       WHERE correo = $1 AND token_expira > NOW() AND verificado = false
       ORDER BY creado_en DESC LIMIT 1`,
      [correo]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'Código expirado o no solicitado' });
    }

    const coincide = await bcrypt.compare(String(codigo), resultado.rows[0].token_hash);
    if (!coincide) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    await pool.query(
      `UPDATE verificaciones_correo SET verificado = true WHERE id = $1`,
      [resultado.rows[0].id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo confirmar el código' });
  }
});

// Crear la cuenta si el correo fue verificado
router.post('/registro', verificarToken, requerirRol(...PERMISOS.crearCuentas), async (req, res) => {
  const { contrasena, nombre, apellidos, rol, materia } = req.body;
  const correo = normalizarCorreo(req.body.usuario || req.body.correo);

  if (!correo || !contrasena || !nombre || !apellidos || !rol) {
    return res.status(400).json({
      error: 'Correo/Usuario, contraseña, nombre, apellidos y rol son obligatorios',
    });
  }

  if (String(contrasena).length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  // El Creador de Cuentas no puede crear Administradores ni otros Creadores
  if (req.usuario.rol === ROLES.CREADOR && ROLES_NO_ASIGNABLES_POR_CREADOR.includes(rol)) {
    return res.status(403).json({ error: 'No tienes permiso para crear cuentas con ese rol' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const verificado = await client.query(
      `SELECT id FROM verificaciones_correo
       WHERE correo = $1 AND verificado = true
       ORDER BY creado_en DESC LIMIT 1`,
      [correo]
    );

    if (verificado.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El correo no ha sido verificado' });
    }

    const rolResultado = await client.query(`SELECT id FROM roles WHERE nom_rol = $1`, [rol]);
    if (rolResultado.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Rol no válido' });
    }
    const rolId = rolResultado.rows[0].id;

    let materiaId = null;
    if (rol === 'Perito') {
      if (!materia) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La materia es obligatoria para el rol de perito' });
      }
      const materiaResultado = await client.query(`SELECT id FROM materias WHERE nombre = $1`, [materia]);
      if (materiaResultado.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Materia no válida' });
      }
      materiaId = materiaResultado.rows[0].id;
    }

    const nombreCompleto = `${nombre} ${apellidos}`.trim();
    const passwordHash = await bcrypt.hash(contrasena, 10);

    const nuevoUsuario = await client.query(
      `INSERT INTO usuarios (nombre, correo, rol_id, password_hash, verificado, materia_id)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       RETURNING id, nombre, correo`,
      [nombreCompleto, correo, rolId, passwordHash, materiaId]
    );

    await client.query('DELETE FROM verificaciones_correo WHERE correo = $1', [correo]);

    await client.query(
      `INSERT INTO bitacora (us_id, acc_id)
       VALUES ($1, (SELECT id FROM acciones WHERE nom_accion = 'Crear usuario'))`,
      [req.usuario.id]
    ).catch((e) => console.error('Error en Bitácora:', e.message));

    await client.query('COMMIT');
    res.status(201).json(nuevoUsuario.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }
    console.error(error);
    res.status(500).json({ error: 'No se pudo crear la cuenta' });
  } finally {
    client.release();
  }
});

// Permite que un Administrador cambie la contraseña de cualquier usuario sin pedir la contraseña actual
router.put('/admin/cambiar-contrasena', verificarToken, requerirRol(ADMIN), async (req, res) => {
  const { id, nuevaContrasena } = req.body;

  if (!id || !nuevaContrasena) {
    return res.status(400).json({ error: 'El id y la nueva contraseña son obligatorios' });
  }

  if (String(nuevaContrasena).length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const nuevoHash = await bcrypt.hash(nuevaContrasena, 10);
    const resultado = await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [nuevoHash, id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Contraseña actualizada correctamente por el Administrador' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
});

module.exports = router;