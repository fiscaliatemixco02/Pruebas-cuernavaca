const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const { requerirRol } = require('../middleware/auth');

const router = express.Router();

const MP = 'Ministerio Publico';
const ADMIN = 'Administrador';
const RECEPTOR = 'Receptor';
const AIC = 'AIC';

const MAX_ARCHIVOS = 10;

const quien = (req) => req.user || req.usuario || {};

const DIR = path.join(__dirname, '..', 'uploads', 'solicitudes');
fs.mkdirSync(DIR, { recursive: true });

const upload = multer({
  dest: DIR,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB por archivo
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Solo se permiten archivos PDF'));
  },
});

// Devuelve la solicitud si el usuario puede verla; si no, responde el error y devuelve null
async function solicitudAccesible(req, res) {
  const u = quien(req);
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'Id inválido' });
    return null;
  }
  const r = await pool.query('SELECT id, mp_id, archivo_pdf FROM solicitudes_mp WHERE id = $1', [
    req.params.id,
  ]);
  const s = r.rows[0];
  if (!s) {
    res.sendStatus(404);
    return null;
  }
  if (u.rol === MP && String(s.mp_id) !== String(u.id)) {
    res.sendStatus(403);
    return null;
  }
  return s;
}

// MP crea una solicitud con uno o varios PDF
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

    const { numero_carpeta, materia_id, breve_resena } = req.body;
    if (!numero_carpeta || !materia_id || !breve_resena) {
      descartar();
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // archivo_pdf conserva la ruta del primer PDF (compatibilidad con la vista y datos anteriores)
      const r = await client.query(
        `INSERT INTO solicitudes_mp (mp_id, numero_carpeta, materia_id, breve_resena, archivo_pdf)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [
          quien(req).id,
          numero_carpeta.toUpperCase(),
          materia_id,
          breve_resena.toUpperCase(),
          archivos[0].path,
        ]
      );
      const solicitud = r.rows[0];

      for (const f of archivos) {
        await client.query(
          `INSERT INTO solicitud_mp_archivos (solicitud_id, nombre_original, ruta)
           VALUES ($1,$2,$3)`,
          [solicitud.id, f.originalname, f.path]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ ...solicitud, total_pdfs: archivos.length });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      descartar();
      console.error(error);
      res.status(500).json({ error: 'Error al guardar la solicitud' });
    } finally {
      client.release();
    }
  });
});

// Listar: el MP ve las suyas; Receptor y Admin ven todas
router.get('/', requerirRol(MP, RECEPTOR, AIC, ADMIN), async (req, res) => {
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

// Carpetas del MP: una por número de carpeta de sus solicitudes
// (con_resolucion = solicitudes cuya petición ya tiene PDF subidos por el perito/policía)
router.get('/carpetas', requerirRol(MP), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT UPPER(s.numero_carpeta) AS numero_carpeta,
              COUNT(*)::int AS total_solicitudes,
              COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM entrega_archivos ea WHERE ea.peticion_id = s.peticion_id
                )
              )::int AS con_resolucion
         FROM solicitudes_mp s
        WHERE s.mp_id = $1
        GROUP BY UPPER(s.numero_carpeta)
        ORDER BY UPPER(s.numero_carpeta)`,
      [quien(req).id]
    );
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar las carpetas' });
  }
});

// PDF de la resolución (los que subió el perito/policía a la petición ligada a la solicitud)
router.get('/:id/resolucion', requerirRol(MP, RECEPTOR, AIC, ADMIN), async (req, res) => {
  try {
    const sol = await solicitudAccesible(req, res);
    if (!sol) return;
    const r = await pool.query(
      `SELECT ea.id, ea.tipo, ea.archivo_nombre AS nombre_original, ea.subido_en
         FROM solicitudes_mp s
         JOIN entrega_archivos ea ON ea.peticion_id = s.peticion_id
        WHERE s.id = $1
        ORDER BY ea.subido_en, ea.id`,
      [sol.id]
    );
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la resolución' });
  }
});

// Ver un PDF concreto de la resolución
router.get('/:id/resolucion/:archivoId', requerirRol(MP, RECEPTOR, AIC, ADMIN), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.archivoId)) {
      return res.status(400).json({ error: 'Id de archivo inválido' });
    }
    const sol = await solicitudAccesible(req, res);
    if (!sol) return;
    const r = await pool.query(
      `SELECT ea.archivo_ruta
         FROM solicitudes_mp s
         JOIN entrega_archivos ea ON ea.peticion_id = s.peticion_id
        WHERE s.id = $1 AND ea.id = $2`,
      [sol.id, req.params.archivoId]
    );
    if (!r.rows[0]) return res.sendStatus(404);

    const guardada = r.rows[0].archivo_ruta;
    const ruta = path.isAbsolute(guardada)
      ? guardada
      : path.join(__dirname, '..', 'uploads', 'entregas', path.basename(guardada));
    if (!fs.existsSync(ruta)) return res.status(404).json({ error: 'Archivo no encontrado en disco' });

    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(path.resolve(ruta));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el PDF de la resolución' });
  }
});

// Lista de PDF de una solicitud
router.get('/:id/pdfs', requerirRol(MP, RECEPTOR, AIC, ADMIN), async (req, res) => {
  try {
    const s = await solicitudAccesible(req, res);
    if (!s) return;
    const r = await pool.query(
      `SELECT id, nombre_original FROM solicitud_mp_archivos
        WHERE solicitud_id = $1 ORDER BY id`,
      [s.id]
    );
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar los PDF' });
  }
});

// Ver un PDF concreto
router.get('/:id/pdf/:archivoId', requerirRol(MP, RECEPTOR, AIC, ADMIN), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.archivoId)) {
      return res.status(400).json({ error: 'Id de archivo inválido' });
    }
    const s = await solicitudAccesible(req, res);
    if (!s) return;
    const r = await pool.query(
      'SELECT ruta FROM solicitud_mp_archivos WHERE id = $1 AND solicitud_id = $2',
      [req.params.archivoId, s.id]
    );
    if (!r.rows[0]) return res.sendStatus(404);
    res.type('application/pdf');
    res.sendFile(path.resolve(r.rows[0].ruta));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el PDF' });
  }
});

// Compatibilidad: devuelve el primer PDF de la solicitud
router.get('/:id/pdf', requerirRol(MP, RECEPTOR, AIC, ADMIN), async (req, res) => {
  try {
    const s = await solicitudAccesible(req, res);
    if (!s) return;
    res.type('application/pdf');
    res.sendFile(path.resolve(s.archivo_pdf));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el PDF' });
  }
});

// El receptor marca la solicitud como atendida y la liga a la petición creada
router.put('/:id/atender', requerirRol(RECEPTOR, AIC, ADMIN), async (req, res) => {
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