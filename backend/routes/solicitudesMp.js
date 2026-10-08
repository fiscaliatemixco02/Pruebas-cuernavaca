const express = require('express');
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const { requerirRol } = require('../middleware/auth');

const router = express.Router();

const MP = 'Ministerio Publico';
const ADMIN = 'Administrador';
const RECEPTOR = 'Receptor';

const quien = (req) => req.user || req.usuario || {};

const upload = multer({
  dest: path.join(__dirname, '..', 'uploads', 'solicitudes'),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Solo se permiten archivos PDF'));
  },
});

// MP crea una solicitud
router.post('/', requerirRol(MP), (req, res) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Debes adjuntar un PDF.' });

    const { numero_carpeta, materia_id, breve_resena } = req.body;
    if (!numero_carpeta || !materia_id || !breve_resena) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    try {
      const r = await pool.query(
        `INSERT INTO solicitudes_mp (mp_id, numero_carpeta, materia_id, breve_resena, archivo_pdf)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [quien(req).id, numero_carpeta.toUpperCase(), materia_id, breve_resena.toUpperCase(), req.file.path]
      );
      res.status(201).json(r.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al guardar la solicitud' });
    }
  });
});

// Listar: el MP ve las suyas; Receptor y Admin ven todas
router.get('/', requerirRol(MP, RECEPTOR, ADMIN), async (req, res) => {
  const u = quien(req);
  const esMP = u.rol === MP;
  try {
    const r = await pool.query(
      `SELECT * FROM vw_solicitudes_mp ${esMP ? 'WHERE mp_id = $1' : ''} ORDER BY created_at DESC`,
      esMP ? [u.id] : []
    );
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar solicitudes' });
  }
});

// Descargar PDF
router.get('/:id/pdf', requerirRol(MP, RECEPTOR, ADMIN), async (req, res) => {
  try {
    const u = quien(req);
    const r = await pool.query('SELECT mp_id, archivo_pdf FROM solicitudes_mp WHERE id = $1', [req.params.id]);
    const s = r.rows[0];
    if (!s) return res.sendStatus(404);
    if (u.rol === MP && String(s.mp_id) !== String(u.id)) return res.sendStatus(403);
    res.type('application/pdf');
    res.sendFile(path.resolve(s.archivo_pdf));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el PDF' });
  }
});

// El receptor marca la solicitud como atendida y la liga a la petición creada
router.put('/:id/atender', requerirRol(RECEPTOR, ADMIN), async (req, res) => {
  const { peticion_id } = req.body;
  if (!peticion_id) return res.status(400).json({ error: 'Falta peticion_id' });
  try {
    const r = await pool.query(
      `UPDATE solicitudes_mp SET estado = 'ATENDIDA', peticion_id = $1
        WHERE id = $2 AND estado = 'PENDIENTE' RETURNING *`,
      [peticion_id, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Solicitud no encontrada o ya atendida' });
    res.json(r.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la solicitud' });
  }
});

module.exports = router;