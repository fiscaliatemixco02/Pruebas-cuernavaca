// routes/entregas.js
// Se monta en index.js:  app.use('/api/peticiones', verificarToken, entregasRoutes);
// Requiere:  npm install multer  y ejecutar multiples_pdfs.sql una vez

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const { requerirRol } = require('../middleware/auth');

const router = express.Router();

const ADMIN = 'Administrador';
const PERITO = 'Perito';
const RECEPTOR = 'Receptor';

const COLUMNA_ENTREGA = {
  dictamen: 'entrega_dictamen',
  informe: 'entrega_informe',
  requerimiento: 'entrega_requerimiento',
};

const MAX_ARCHIVOS = 10;
const CARPETA = path.join(__dirname, '..', 'uploads', 'entregas');
fs.mkdirSync(CARPETA, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CARPETA),
    // sufijo aleatorio: varios archivos pueden llegar en el mismo milisegundo
    filename: (req, file, cb) =>
      cb(null, `${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}.pdf`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB por archivo
  fileFilter: (req, file, cb) =>
    file.mimetype === 'application/pdf'
      ? cb(null, true)
      : cb(new Error('Todos los archivos deben ser PDF')),
});

// El campo del FormData debe llamarse "archivos" (uno por cada PDF)
function subirPdf(req, res, next) {
  upload.array('archivos', MAX_ARCHIVOS)(req, res, (err) => {
    if (!err) return next();
    let msg = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') msg = 'Un PDF supera los 20 MB';
    if (err.code === 'LIMIT_UNEXPECTED_FILE') msg = `Máximo ${MAX_ARCHIVOS} archivos por envío`;
    res.status(400).json({ error: msg });
  });
}

// Acepta rutas guardadas como nombre de archivo o como ruta completa
function rutaAbsoluta(guardada) {
  return path.isAbsolute(guardada)
    ? guardada
    : path.join(CARPETA, path.basename(guardada));
}

// El perito solo puede tocar las peticiones que tiene asignadas.
// Administrador y Receptor pasan. Debe ir DESPUÉS de requerirRol (usa req.usuario.rol).
async function verificarAcceso(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id de petición inválido' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, perito_id FROM peticiones WHERE id = $1',
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'Petición no encontrada' });
    }
    if (req.usuario.rol === PERITO && Number(rows[0].perito_id) !== Number(req.usuario.id)) {
      return res.status(403).json({ error: 'Esta petición no está asignada a ti' });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar acceso a la petición' });
  }
}

// Detalle de una petición
router.get('/:id', requerirRol(ADMIN, RECEPTOR, PERITO), verificarAcceso, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vw_peticiones WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Petición no encontrada' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la petición' });
  }
});

// Datos de la entrega (404 si aún no hay)
router.get('/:id/entrega', requerirRol(ADMIN, RECEPTOR, PERITO), verificarAcceso, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT tipo, archivo_nombre, subido_en FROM entregas WHERE peticion_id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Sin entrega' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la entrega' });
  }
});

// Subir uno o varios PDF (se agregan a los que ya existen)
router.post('/:id/entrega', requerirRol(ADMIN, PERITO), verificarAcceso, subirPdf, async (req, res) => {
  const archivos = req.files || [];
  const tipo = req.body.tipo;

  const descartar = () => archivos.forEach((f) => fs.unlink(f.path, () => {}));

  if (!COLUMNA_ENTREGA[tipo]) {
    descartar();
    return res.status(400).json({ error: 'Tipo de entrega inválido' });
  }
  if (archivos.length === 0) {
    return res.status(400).json({ error: 'Adjunta al menos un PDF' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Un registro por cada PDF
    for (const f of archivos) {
      await client.query(
        `INSERT INTO entrega_archivos (peticion_id, tipo, archivo_nombre, archivo_ruta, subido_por)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, tipo, f.originalname, f.path, req.usuario.id]
      );
    }

    // La tabla `entregas` sigue existiendo (1 fila por petición) para firmas y reportes
    await client.query(
      `INSERT INTO entregas (peticion_id, tipo, archivo_nombre, archivo_ruta, subido_por, subido_en)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (peticion_id) DO UPDATE
         SET tipo = EXCLUDED.tipo,
             archivo_nombre = EXCLUDED.archivo_nombre,
             archivo_ruta = EXCLUDED.archivo_ruta,
             subido_por = EXCLUDED.subido_por,
             subido_en = NOW()`,
      [req.params.id, tipo, archivos[0].originalname, archivos[0].path, req.usuario.id]
    );

    // Marca la casilla del tipo entregado (las anteriores se conservan)
    await client.query(
      `UPDATE peticiones SET ${COLUMNA_ENTREGA[tipo]} = TRUE WHERE id = $1`,
      [req.params.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ok: true, tipo, total: archivos.length });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    descartar();
    console.error(error);
    res.status(500).json({ error: 'Error al guardar la entrega' });
  } finally {
    client.release();
  }
});

// Lista de PDF de la entrega
router.get('/:id/entrega/archivos', requerirRol(ADMIN, RECEPTOR, PERITO), verificarAcceso, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, tipo, archivo_nombre AS nombre_original, subido_en
         FROM entrega_archivos
        WHERE peticion_id = $1
        ORDER BY subido_en, id`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar los archivos' });
  }
});

// Ver un PDF concreto
router.get('/:id/entrega/archivo/:archivoId', requerirRol(ADMIN, RECEPTOR, PERITO), verificarAcceso, async (req, res) => {
  if (!/^\d+$/.test(req.params.archivoId)) {
    return res.status(400).json({ error: 'Id de archivo inválido' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT archivo_ruta FROM entrega_archivos
        WHERE id = $1 AND peticion_id = $2`,
      [req.params.archivoId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Archivo no encontrado' });

    const ruta = rutaAbsoluta(rows[0].archivo_ruta);
    if (!fs.existsSync(ruta)) return res.status(404).json({ error: 'Archivo no encontrado en disco' });

    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(path.resolve(ruta));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el archivo' });
  }
});

// Compatibilidad: devuelve el último PDF cargado
router.get('/:id/entrega/archivo', requerirRol(ADMIN, RECEPTOR, PERITO), verificarAcceso, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT archivo_ruta FROM entrega_archivos
        WHERE peticion_id = $1
        ORDER BY id DESC LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Sin entrega' });

    const ruta = rutaAbsoluta(rows[0].archivo_ruta);
    if (!fs.existsSync(ruta)) return res.status(404).json({ error: 'Archivo no encontrado' });

    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(path.resolve(ruta));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el archivo' });
  }
});

module.exports = router;