const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const { requerirRol } = require('../middleware/auth');

const router = express.Router();

const MP = 'Ministerio Publico';
const AIC = 'AIC';
const POLICIA = 'Policia';

const AREAS = ['POLICIAL', 'ANALISIS'];
const MAX_ARCHIVOS = 10;

// Carpeta: 5 letras + 3 números + "/" + año (ej. ABCDE001/2026)
const FORMATO_CARPETA = /^[A-Z]{5}\d{3}\/\d{4}$/;

// Llamado y materia internos que se crean con OrdenesInvestigacion_paso2.sql
const CODIGO_LLAMADO = 'OI';
const NOMBRE_MATERIA = 'Investigación (AIC)';

const quien = (req) => req.user || req.usuario || {};
const mayus = (v) =>
  v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().toUpperCase();

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

// MP crea una orden de investigación (y su carpeta) con uno o varios PDF
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
    const carpeta = String(numero_carpeta).trim().toUpperCase();
    if (!FORMATO_CARPETA.test(carpeta)) {
      descartar();
      return res.status(400).json({
        error: 'La carpeta debe tener 5 letras, 3 números y el año. Ejemplo: ABCDE001/2026',
      });
    }
    if (!AREAS.includes(String(area).toUpperCase())) {
      descartar();
      return res.status(400).json({ error: 'Área inválida. Elige Policial o Análisis.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // El MP crea la carpeta (si ya existe se respeta)
      await client.query(
        `INSERT INTO carpetas (numero_carpeta)
         SELECT $1::text
          WHERE NOT EXISTS (SELECT 1 FROM carpetas WHERE UPPER(numero_carpeta) = $1::text)
         ON CONFLICT DO NOTHING`,
        [carpeta]
      );

      const r = await client.query(
        `INSERT INTO ordenes_investigacion (mp_id, numero_carpeta, area, breve_resena)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [quien(req).id, carpeta, String(area).toUpperCase(), breve_resena.toUpperCase()]
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
          [`Nueva orden de investigación para la carpeta ${orden.numero_carpeta}`, AIC, quien(req).id]
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

// Listar: el MP ve las suyas; el AIC ve todas
router.get('/', requerirRol(MP, AIC), async (req, res) => {
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
router.get('/:id/pdfs', requerirRol(MP, AIC), async (req, res) => {
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
router.get('/:id/pdf/:archivoId', requerirRol(MP, AIC), async (req, res) => {
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

// El AIC atiende la orden: crea la petición, la asigna a un policía y liga ambas
router.put('/:id/atender', requerirRol(AIC), async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Id inválido' });

  const { perito_id, jefe_grupo, descripcion_solicitud, nombre_ministerio_publico } = req.body;
  if (!perito_id) return res.status(400).json({ error: 'Debes asignar un policía.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bloquea la orden para que dos AIC no la atiendan a la vez
    const lock = await client.query(
      'SELECT id FROM ordenes_investigacion WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!lock.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    const ord = (
      await client.query('SELECT * FROM vw_ordenes_investigacion WHERE id = $1', [req.params.id])
    ).rows[0];
    if (ord.estado !== 'PENDIENTE') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La orden ya fue atendida' });
    }

    // Solo se puede asignar a un policía
    const pol = await client.query(
      `SELECT r.nom_rol AS rol FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = $1`,
      [perito_id]
    );
    if (!pol.rows[0] || pol.rows[0].rol !== POLICIA) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El AIC solo puede asignar policías' });
    }

    // Llamado y materia internos
    const ll = await client.query('SELECT id FROM llamados WHERE codigo = $1', [CODIGO_LLAMADO]);
    const mt = await client.query('SELECT id FROM materias WHERE nombre = $1', [NOMBRE_MATERIA]);
    if (!ll.rows[0] || !mt.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        error: 'Falta ejecutar OrdenesInvestigacion_paso2.sql (llamado OI y materia interna).',
      });
    }

    // La carpeta ya la creó el MP; se asegura por si acaso
    await client.query(
      `INSERT INTO carpetas (numero_carpeta)
       SELECT $1::text
        WHERE NOT EXISTS (SELECT 1 FROM carpetas WHERE UPPER(numero_carpeta) = $1::text)
       ON CONFLICT DO NOTHING`,
      [ord.numero_carpeta]
    );

    const pet = await client.query(
      `INSERT INTO peticiones
        (llamado_id, receptor_id, nombre_ministerio_publico, con_detenido, materia_id,
         numero_carpeta, descripcion_solicitud, numero_llamado, perito_id, jefe_grupo)
       VALUES ($1, $2, $3, FALSE, $4, $5, $6, NULL, $7, $8)
       RETURNING *`,
      [
        ll.rows[0].id,
        quien(req).id,
        mayus(nombre_ministerio_publico) || mayus(ord.nombre_mp),
        mt.rows[0].id,
        ord.numero_carpeta,
        mayus(descripcion_solicitud) || mayus(ord.breve_resena),
        perito_id,
        mayus(jefe_grupo),
      ]
    );
    const peticion = pet.rows[0];

    await client.query(
      `UPDATE ordenes_investigacion
          SET estado = 'ATENDIDA', peticion_id = $1, atendida_por = $2, atendida_en = NOW()
        WHERE id = $3`,
      [peticion.id, quien(req).id, ord.id]
    );

    await client.query(
      `INSERT INTO bitacora (us_id, acc_id, pet_id, fecha_hora) VALUES ($1, 3, $2, NOW())`,
      [quien(req).id, peticion.id]
    );

    await client.query('COMMIT');

    // Avisa al policía asignado (si falla, no afecta el guardado)
    try {
      await pool.query(
        `INSERT INTO notificaciones (us_id, pet_id, tipo, mensaje) VALUES ($1, $2, 'asignada', $3)`,
        [perito_id, peticion.id, `Nueva petición ${peticion.numero_llamado} asignada a ti`]
      );
    } catch (e) {
      console.error('No se pudo notificar al policía:', e.message);
    }

    res.json(peticion);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(error);
    res.status(500).json({ error: 'Error al atender la orden de investigación' });
  } finally {
    client.release();
  }
});

module.exports = router;