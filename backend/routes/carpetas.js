const express = require('express');
const pool = require('../db');
const { verificarToken, requerirRol } = require('../middleware/auth');
const { PERMISOS } = require('../config/roles');

const router = express.Router();

// Todas las rutas exigen sesión
router.use(verificarToken);

// Catálogo de carpetas activas (todos los roles pueden verlo)
router.get('/', requerirRol(...PERMISOS.verCarpetas), async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, numero_carpeta FROM carpetas WHERE activo = true ORDER BY numero_carpeta'
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar carpetas' });
  }
});

// Solicitudes de MP que llegaron con el número de esta carpeta (Administrador y Receptor)
router.get('/:id/solicitudes', requerirRol(...PERMISOS.solicitudesDeCarpeta), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Id de carpeta inválido' });
  }

  try {
    const resultado = await pool.query(
      `SELECT v.*
         FROM vw_solicitudes_mp v
         JOIN carpetas c ON UPPER(c.numero_carpeta) = UPPER(v.numero_carpeta)
        WHERE c.id = $1
        ORDER BY v.created_at DESC`,
      [id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar las solicitudes de la carpeta' });
  }
});

// Crear carpeta nueva (solo Administrador)
router.post('/', requerirRol(...PERMISOS.administrar), async (req, res) => {
  const { numero_carpeta } = req.body;
  if (!numero_carpeta || !numero_carpeta.trim()) {
    return res.status(400).json({ error: 'El número de carpeta es obligatorio' });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO carpetas (numero_carpeta) VALUES ($1) RETURNING id, numero_carpeta`,
      [numero_carpeta.trim()]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      // violación de UNIQUE
      return res.status(409).json({ error: 'Ese número de carpeta ya existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear la carpeta' });
  }
});

// Baja lógica (solo Administrador)
router.delete('/:id', requerirRol(...PERMISOS.administrar), async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Id de carpeta inválido' });
  }

  try {
    const resultado = await pool.query(
      `UPDATE carpetas SET activo = false WHERE id = $1 RETURNING id`,
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Carpeta no encontrada' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la carpeta' });
  }
});

module.exports = router;