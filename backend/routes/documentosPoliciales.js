// backend/routes/documentosPoliciales.js
//
// Entrevistas e Informes iniciales: el usuario captura la carpeta, las iniciales de la
// víctima y sube uno o varios PDF. Las dos cosas funcionan igual, así que comparten
// este archivo: se monta dos veces en index.js, con su tipo y sus permisos.
//
//   app.use('/api/entrevistas',        verificarToken, crearRouter('ENTREVISTA', {...}));
//   app.use('/api/informes-iniciales', verificarToken, crearRouter('INFORME_INICIAL', {...}));
//
// Quién ve qué:
//   - El Policía solo ve lo que él subió.
//   - El resto de los roles con permiso de ver (AIC, Administrador) ve todo.

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const { requerirRol } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

const { ADMIN, POLICIA } = ROLES;

const MAX_ARCHIVOS = 10;

// Carpeta: 5 letras + 3 números + "/" + año (ej. ABCDE001/2026), igual que en las órdenes de investigación
const FORMATO_CARPETA = /^[A-Z]{5}\d{3}\/\d{4}$/;
// Iniciales: letras, puntos, comas, espacios, guion y diagonal (ej. "J.L.M." o "A.B.C., D.E.F.")
const FORMATO_INICIALES = /^(?=.*[A-ZÁÉÍÓÚÜÑ])[A-ZÁÉÍÓÚÜÑ.,\s/-]{1,60}$/;

const DIR = path.join(__dirname, '..', 'uploads', 'documentos-policiales');
fs.mkdirSync(DIR, { recursive: true });

const upload = multer({
  dest: DIR,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB por archivo
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Solo se permiten archivos PDF'));
  },
});

const quien = (req) => req.usuario || req.user || {};

/**
 * tipo:     'ENTREVISTA' | 'INFORME_INICIAL'
 * permisos: { subir: [roles], ver: [roles] }
 */
function crearRouter(tipo, permisos) {
  const router = express.Router();

  // Devuelve el documento si el usuario puede verlo; si no, responde el error y devuelve null
  async function documentoAccesible(req, res) {
    const u = quien(req);
    if (!/^\d+$/.test(req.params.id)) {
      res.status(400).json({ error: 'Id inválido' });
      return null;
    }
    const r = await pool.query(
      'SELECT id, creado_por FROM documentos_policiales WHERE id = $1 AND tipo = $2',
      [req.params.id, tipo]
    );
    const d = r.rows[0];
    if (!d) {
      res.sendStatus(404);
      return null;
    }
    if (u.rol === POLICIA && String(d.creado_por) !== String(u.id)) {
      res.sendStatus(403);
      return null;
    }
    return d;
  }

  // Crear: carpeta + iniciales + uno o varios PDF
  router.post('/', requerirRol(...permisos.subir), (req, res) => {
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

      const carpeta = String(req.body.numero_carpeta || '').trim().toUpperCase();
      const iniciales = String(req.body.iniciales || '').trim().toUpperCase();

      if (!carpeta || !iniciales) {
        descartar();
        return res.status(400).json({ error: 'La carpeta y las iniciales son obligatorias.' });
      }
      if (!FORMATO_CARPETA.test(carpeta)) {
        descartar();
        return res.status(400).json({
          error: 'La carpeta debe tener 5 letras, 3 números y el año. Ejemplo: ABCDE001/2026',
        });
      }
      if (!FORMATO_INICIALES.test(iniciales)) {
        descartar();
        return res.status(400).json({
          error: 'Las iniciales solo pueden llevar letras, puntos, comas y espacios. Ejemplo: J.L.M.',
        });
      }
      if (archivos.length === 0) {
        return res.status(400).json({ error: 'Debes adjuntar al menos un PDF.' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const r = await client.query(
          `INSERT INTO documentos_policiales (tipo, numero_carpeta, iniciales_victima, creado_por)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [tipo, carpeta, iniciales, quien(req).id]
        );
        const doc = r.rows[0];

        for (const f of archivos) {
          await client.query(
            `INSERT INTO documento_policial_archivos (documento_id, nombre_original, ruta)
             VALUES ($1, $2, $3)`,
            [doc.id, f.originalname, f.path]
          );
        }

        await client.query('COMMIT');
        res.status(201).json({ ...doc, total_pdfs: archivos.length });
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        descartar();
        console.error(error);
        res.status(500).json({ error: 'Error al guardar el registro' });
      } finally {
        client.release();
      }
    });
  });

  // Listar (con sus PDF). El Policía solo ve lo suyo.
  router.get('/', requerirRol(...permisos.ver), async (req, res) => {
    const u = quien(req);
    const params = [tipo];
    let filtro = '';
    if (u.rol === POLICIA) {
      params.push(u.id);
      filtro = 'AND d.creado_por = $2';
    }
    try {
      const r = await pool.query(
        `SELECT d.id, d.numero_carpeta, d.iniciales_victima, d.creado_por, d.created_at,
                u.nombre AS creado_por_nombre,
                COALESCE(
                  json_agg(json_build_object('id', a.id, 'nombre', a.nombre_original) ORDER BY a.id)
                    FILTER (WHERE a.id IS NOT NULL),
                  '[]'::json
                ) AS archivos
           FROM documentos_policiales d
           JOIN usuarios u ON u.id = d.creado_por
           LEFT JOIN documento_policial_archivos a ON a.documento_id = d.id
          WHERE d.tipo = $1 ${filtro}
          GROUP BY d.id, u.nombre
          ORDER BY d.created_at DESC`,
        params
      );
      res.json(r.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al consultar los registros' });
    }
  });

  // Ver un PDF concreto
  router.get('/:id/pdf/:archivoId', requerirRol(...permisos.ver), async (req, res) => {
    try {
      if (!/^\d+$/.test(req.params.archivoId)) {
        return res.status(400).json({ error: 'Id de archivo inválido' });
      }
      const d = await documentoAccesible(req, res);
      if (!d) return;

      const r = await pool.query(
        'SELECT ruta FROM documento_policial_archivos WHERE id = $1 AND documento_id = $2',
        [req.params.archivoId, d.id]
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

  // Eliminar un registro completo (por si se subió por error). Solo quien lo creó o el Administrador.
  router.post('/:id/eliminar', requerirRol(...permisos.ver), async (req, res) => {
    const u = quien(req);
    try {
      const d = await documentoAccesible(req, res);
      if (!d) return;

      if (u.rol !== ADMIN && String(d.creado_por) !== String(u.id)) {
        return res.status(403).json({ error: 'Solo puede eliminarlo quien lo subió' });
      }

      const archivos = await pool.query(
        'SELECT ruta FROM documento_policial_archivos WHERE documento_id = $1',
        [d.id]
      );
      await pool.query('DELETE FROM documentos_policiales WHERE id = $1', [d.id]); // los PDF se van en cascada
      archivos.rows.forEach((a) => fs.unlink(path.resolve(a.ruta), () => {}));

      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al eliminar el registro' });
    }
  });

  return router;
}

module.exports = crearRouter;