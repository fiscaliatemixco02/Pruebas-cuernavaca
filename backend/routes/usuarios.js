// routes/usuarios.js
const express = require('express');
const pool = require('../db');
const { verificarToken, requerirRol } = require('../middleware/auth');
const { PERMISOS } = require('../config/roles');

const router = express.Router();

router.get('/', verificarToken, requerirRol(...PERMISOS.verUsuarios), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.correo, r.nom_rol AS rol, m.nombre AS materia
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN materias m ON m.id = u.materia_id
       ORDER BY u.id DESC`
    );

    const usuariosFormateados = rows.map((u) => {
      const [nombre = '', ...resto] = (u.nombre || '').trim().split(/\s+/);
      return {
        id: u.id,
        nombre,
        apellidos: resto.join(' '),
        correo: u.correo,
        rol: u.rol,
        materia: u.materia || null,
      };
    });

    res.json(usuariosFormateados);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la lista de usuarios' });
  }
});

module.exports = router;