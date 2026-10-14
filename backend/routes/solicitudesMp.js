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

// Crea la carpeta si no existe (sin importar mayúsculas). Usa el mismo client de la transacción.
// Devuelve { numero_carpeta, creada }.
async function asegurarCarpeta(client, numero) {
  const nueva = await client.query(
    `INSERT INTO carpetas (numero_carpeta)
     SELECT $1::text
      WHERE NOT EXISTS (SELECT 1 FROM carpetas WHERE UPPER(numero_carpeta) = $1::text)
     ON CONFLICT DO NOTHING
     RETURNING numero_carpeta`,
    [numero]
  );
  if (nueva.rows.length > 0) return { numero_carpeta: nueva.rows[0].numero_carpeta, creada: true };

  // Ya existía: si estaba dada de baja (activo = false) se reactiva para que vuelva a aparecer
  const r = await client.query(
    `UPDATE carpetas SET activo = true
      WHERE UPPER(numero_carpeta) = $1
      RETURNING numero_carpeta`,
    [numero]
  );
  return { numero_carpeta: r.rows[0]?.numero_carpeta ?? numero, creada: false };
}

// Avisa a todos los Administradores y Receptores. Un fallo aquí nunca debe romper el envío.
async function notificarReceptores(mensaje) {
  try {
    await pool.query(
      `INSERT INTO notificaciones (us_id, pet_id, tipo, mensaje)
       SELECT u.id, NULL, 'solicitud_mp', $1::text
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
        WHERE r.nom_rol = ANY($2)`,
      [mensaje, [ADMIN, RECEPTOR]]
    );
  } catch (error) {
    console.error('No se pudo notificar la solicitud de MP:', error.message);
  }
}

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

      // La carpeta se crea (o se reutiliza) en cuanto el MP envía la solicitud
      const carpeta = await asegurarCarpeta(client, numero_carpeta.trim().toUpperCase());

      // archivo_pdf conserva la ruta del primer PDF (compatibilidad con la vista y datos anteriores)
      const r = await client.query(
        `INSERT INTO solicitudes_mp (mp_id, numero_carpeta, materia_id, breve_resena, archivo_pdf)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [
          quien(req).id,
          carpeta.numero_carpeta,
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

      // Aviso a Administradores y Receptores (fuera de la transacción)
      const nombreMp = quien(req).nombre ? ` de ${quien(req).nombre}` : '';
      await notificarReceptores(
        carpeta.creada
          ? `Nueva carpeta ${carpeta.numero_carpeta}: solicitud${nombreMp}`
          : `Nueva solicitud${nombreMp} en la carpeta ${carpeta.numero_carpeta}`
      );

      res.status(201).json({
        ...solicitud,
        total_pdfs: archivos.length,
        carpeta_creada: carpeta.creada,
      });
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

// Lista de PDF de una solicitud
router.get('/:id/pdfs', requerirRol(MP, RECEPTOR, ADMIN), async (req, res) => {
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
router.get('/:id/pdf/:archivoId', requerirRol(MP, RECEPTOR, ADMIN), async (req, res) => {
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
router.get('/:id/pdf', requerirRol(MP, RECEPTOR, ADMIN), async (req, res) => {
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