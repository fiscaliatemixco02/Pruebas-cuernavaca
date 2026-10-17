const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const { requerirRol } = require('../middleware/auth');

const router = express.Router();

const MP = 'Ministerio Publico';
const ADMIN = 'Administrador';
const AIC = 'AIC';

const AREAS = ['POLICIAL', 'ANALISIS'];
const MAX_ARCHIVOS = 10;

const quien = (req) => req.user || req.usuario || {};

const DIR = path.join(__dirname, '..', 'uploads', 'ordenes-investigacion');
fs.mkdirSync(DIR, { recursive: true });

const upload = multer({
  dest: DIR,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Solo se permiten archivos PDF'));
  },
});

async function ordenAccesible(req, res) {
  const u = quien(req);
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'Id inválido' });
    return null;
  }
  const r = await pool.query('SELECT id, mp_id FROM ordenes_investigacion WHERE id = $1', [
    req.params.id,
  ]);
  const o = r.rows[0];
  if (!o) {
    res.sendStatus(404);
    return null;
  }
  if (u.rol === MP && String(o.mp_id) !== String(u.id)) {
    res.sendStatus(403);
    return null;
  }
  return o;
}

// MP crea una orden con uno o varios PDF
router.post('/', requerirRol(MP), (req, res) => {
  upload.array('pdfs', MAX_ARCHIVOS)(req, res, async (err) => {
    const archivos = req.files || [];
    const descartar = () => archivos.forEach((f) => fs.unlink(f.path, () => {}));

    if (err) {
      descartar();
      let msg = err.message;
      if (err.code === 'LIMIT_FILE_SIZE') msg = 'Un PDF supera los 15 MB';
      if (err.code === 'LIMIT_UNEXPECTED_FILE') msg = `Máximo ${MAX_ARCHIVOS} archivos por envío`;
      return res.status(400).json({ error: msg });
    }
    if (archivos.length === 0) {
      return res.status(400).json({ error: 'Debes adjuntar al menos un PDF.' });
    }

    const { numero_carpeta, area, breve_resena } = req.body;
    if (!numero_carpeta || !area || !breve_resena) {
      descartar();
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    if (!AREAS.includes(String(area).toUpperCase())) {
      descartar();
      return res.status(400).json({ error: 'Área inválida. Elige Policial o Análisis.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const r = await client.query(
        `INSERT INTO ordenes_investigacion (mp_id, numero_carpeta, area, breve_resena)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [
          quien(req).id,
          numero_carpeta.toUpperCase(),
          String(area).toUpperCase(),
          breve_resena.toUpperCase(),
        ]
      );
      const orden = r.rows[0];

      for (const f of archivos) {
        await client.query(
          `INSERT INTO orden_investigacion_archivos (orden_id, nombre_original, ruta)
           VALUES ($1,$2,$3)`,
          [orden.id, f.originalname, f.path]
        );
      }

      await client.query('COMMIT');

      // Avisa SOLO al AIC
      try {
        await pool.query(
          `INSERT INTO notificaciones (us_id, pet_id, tipo, mensaje)
           SELECT u.id, NULL, 'orden_aic', $1
             FROM usuarios u
             JOIN roles r ON r.id = u.rol_id
            WHERE r.nom_rol = $2 AND u.id <> $3`,
          [
            `Nueva orden de investigación para la carpeta ${orden.numero_carpeta}`,
            AIC,
            quien(req).id,
          ]
        );
      } catch (e) {
        console.error('No se pudo notificar la orden de investigación:', e.message);
      }

      res.status(201).json({ ...orden, total_pdfs: archivos.length });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      descartar();
      console.error(error);
      res.status(500).json({ error: 'Error al guardar la orden de investigación' });
    } finally {
      client.release();
    }
  });
});

// Listar: el MP ve las suyas; AIC y Admin ven todas
router.get('/', requerirRol(MP, AIC, ADMIN), async (req, res) => {
  const u = quien(req);
  const esMP = u.rol === MP;
  try {
    const r = await pool.query(
      `SELECT * FROM vw_ordenes_investigacion ${esMP ? 'WHERE mp_id = $1' : ''} ORDER BY created_at DESC`,
      esMP ? [u.id] : []
    );
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar las órdenes de investigación' });
  }
});

// Lista de PDF de una orden
router.get('/:id/pdfs', requerirRol(MP, AIC, ADMIN), async (req, res) => {
  try {
    const o = await ordenAccesible(req, res);
    if (!o) return;
    const r = await pool.query(
      `SELECT id, nombre_original FROM orden_investigacion_archivos
        WHERE orden_id = $1 ORDER BY id`,
      [o.id]
    );
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar los PDF' });
  }
});

// Ver un PDF concreto
router.get('/:id/pdf/:archivoId', requerirRol(MP, AIC, ADMIN), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.archivoId)) {
      return res.status(400).json({ error: 'Id de archivo inválido' });
    }
    const o = await ordenAccesible(req, res);
    if (!o) return;
    const r = await pool.query(
      'SELECT ruta FROM orden_investigacion_archivos WHERE id = $1 AND orden_id = $2',
      [req.params.archivoId, o.id]
    );
    if (!r.rows[0]) return res.sendStatus(404);
    const ruta = path.resolve(r.rows[0].ruta);
    if (!fs.existsSync(ruta)) return res.status(404).json({ error: 'Archivo no encontrado en disco' });
    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(ruta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el PDF' });
  }
});

// El AIC marca la orden como atendida
router.put('/:id/atender', requerirRol(AIC, ADMIN), async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Id inválido' });
  try {
    const r = await pool.query(
      `UPDATE ordenes_investigacion
          SET estado = 'ATENDIDA', atendida_por = $1, atendida_en = NOW()
        WHERE id = $2 AND estado = 'PENDIENTE' RETURNING *`,
      [quien(req).id, req.params.id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada o ya atendida' });
    }
    res.json(r.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la orden' });
  }
});

module.exports = router;