const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt'); // usa 'bcryptjs' si es el que tienes instalado
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { verificarToken, requerirRol } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

const TODOS = ['Administrador', 'Receptor', 'Perito', 'Consulta','Ministerio publico'];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ---------- CONFIGURACIÓN DE MULTER (subida de PDF) ----------
const DIR_ENTREGAS = path.join(__dirname, '..', 'uploads', 'entregas');
fs.mkdirSync(DIR_ENTREGAS, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: DIR_ENTREGAS,
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}.pdf`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const esPdf =
      file.mimetype === 'application/pdf' &&
      path.extname(file.originalname).toLowerCase() === '.pdf';
    cb(esPdf ? null : new Error('Solo se permiten archivos PDF'), esPdf);
  },
});

const COLUMNA_ENTREGA = {
  dictamen: 'entrega_dictamen',
  informe: 'entrega_informe',
  requerimiento: 'entrega_requerimiento',
};

// ---------- MAYÚSCULAS Y CARPETAS ----------
// Texto recortado y en mayúsculas; vacío/undefined -> null
const mayus = (v) =>
  v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().toUpperCase();

// Devuelve el número de carpeta a usar: si ya existe (sin importar mayúsculas) usa la
// existente; si no existe, la crea.
async function asegurarCarpeta(valor) {
  const numero = mayus(valor);
  if (!numero) return null;

  await pool.query(
    `INSERT INTO carpetas (numero_carpeta)
     SELECT $1::text
      WHERE NOT EXISTS (SELECT 1 FROM carpetas WHERE UPPER(numero_carpeta) = $1::text)
     ON CONFLICT DO NOTHING`,
    [numero]
  );
  const r = await pool.query(
    'SELECT numero_carpeta FROM carpetas WHERE UPPER(numero_carpeta) = $1 LIMIT 1',
    [numero]
  );
  return r.rows[0]?.numero_carpeta ?? numero;
}

// ---------- NOTIFICACIONES (un fallo aquí nunca debe romper la operación) ----------
async function notificar(usuarioIds, petId, tipo, mensaje) {
  const ids = [...new Set(usuarioIds.filter(Boolean))];
  if (!ids.length) return;
  try {
    await pool.query(
      `INSERT INTO notificaciones (us_id, pet_id, tipo, mensaje)
       SELECT unnest($1::int[]), $2::int, $3::text, $4::text`,
      [ids, petId, tipo, mensaje]
    );
  } catch (error) {
    console.error('No se pudo crear la notificación:', error.message);
  }
}

async function notificarRoles(roles, excluirId, petId, tipo, mensaje) {
  try {
    const r = await pool.query(
      `SELECT u.id FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
        WHERE r.nom_rol = ANY($1) AND u.id <> $2`,
      [roles, excluirId]
    );
    await notificar(r.rows.map((x) => x.id), petId, tipo, mensaje);
  } catch (error) {
    console.error('No se pudo notificar a los roles:', error.message);
  }
}

// =====================================================================
// RUTAS FIJAS: todas deben ir ANTES de cualquier ruta con "/:id"
// =====================================================================

// ---------- ASIGNADAS AL USUARIO LOGUEADO ----------
router.get('/asignadas', requerirRol('Administrador', 'Perito'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT v.*, e.tipo AS entrega_tipo
         FROM vw_peticiones v
         LEFT JOIN entregas e ON e.peticion_id = v.id
        WHERE v.perito_id = $1
        ORDER BY v.fecha_recibido DESC, v.hora_recibido DESC`,
      [req.usuario.id]
    );
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar peticiones asignadas' });
  }
});

// ---------- LLAMADOS LISTOS PARA FIRMAR (PDF cargado, sin firma) ----------
router.get('/por-firmar', requerirRol('Administrador', 'Receptor'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT v.*
         FROM vw_peticiones v
         JOIN entregas e ON e.peticion_id = v.id
        WHERE v.firmado_en IS NULL
        ORDER BY e.subido_en ASC`
    );
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar los llamados por firmar' });
  }
});

// ---------- CONTEO PARA EL PUNTITO DEL MENÚ ----------
router.get('/pendientes', requerirRol('Administrador', 'Receptor', 'Perito'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int
            FROM peticiones p
            JOIN entregas e ON e.peticion_id = p.id
           WHERE p.firmado_en IS NULL) AS por_firmar,
         (SELECT COUNT(*)::int
            FROM peticiones p
           WHERE p.perito_id = $1
             AND NOT EXISTS (SELECT 1 FROM entregas e WHERE e.peticion_id = p.id)) AS por_entregar`,
      [req.usuario.id]
    );
    res.json(r.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar los pendientes' });
  }
});

// ---------- REPORTE MENSUAL EN PDF (debe ir ANTES de /:id) ----------
router.get('/reporte-mensual', requerirRol('Administrador', 'Receptor', 'Consulta'), async (req, res) => {
  const mes = parseInt(req.query.mes, 10);
  const anio = parseInt(req.query.anio, 10);
  if (!(mes >= 1 && mes <= 12) || !(anio >= 2000 && anio <= 2100)) {
    return res.status(400).json({ error: 'Mes o año inválido' });
  }

  try {
    // Solo el mes pedido: desde el día 1 hasta antes del día 1 del mes siguiente
    const r = await pool.query(
      `SELECT numero_llamado,
              to_char(fecha_recibido, 'DD/MM/YYYY') AS fecha,
              LEFT(hora_recibido::text, 5)          AS hora,
              nombre_receptor,
              nombre_ministerio_publico,
              estatus_detenido,
              materia,
              numero_carpeta,
              nombre_perito
         FROM vw_peticiones
        WHERE fecha_recibido >= make_date($1, $2, 1)
          AND fecha_recibido <  make_date($1, $2, 1) + INTERVAL '1 month'
        ORDER BY fecha_recibido, hora_recibido`,
      [anio, mes]
    );

    const cols = [
      { t: 'Número de llamado',  k: 'numero_llamado',            w: 90 },
      { t: 'Fecha',              k: 'fecha',                     w: 62 },
      { t: 'Hora',               k: 'hora',                      w: 45 },
      { t: 'Nombre de receptor', k: 'nombre_receptor',           w: 110 },
      { t: 'Nombre del MP',      k: 'nombre_ministerio_publico', w: 120 },
      { t: 'Con o sin detenido', k: 'estatus_detenido',          w: 75 },
      { t: 'Materia',            k: 'materia',                   w: 85 },
      { t: 'Número de carpeta',  k: 'numero_carpeta',            w: 70 },
      { t: 'Perito asignado',    k: 'nombre_perito',             w: 125 },
    ];
    const X0 = 30;
    const PAD = 4;
    const anchoTotal = cols.reduce((s, c) => s + c.w, 0);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="peticiones-${anio}-${String(mes).padStart(2, '0')}.pdf"`
    );
    doc.pipe(res);

    const limiteInferior = doc.page.height - 40;

    // Alto que ocupará una fila
    function altoFila(valores, cabecera) {
      doc.font(cabecera ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      return Math.max(
        ...valores.map((v, i) =>
          doc.heightOfString(String(v ?? ''), { width: cols[i].w - PAD * 2 })
        )
      ) + PAD * 2;
    }

    // Dibuja una fila y devuelve la "y" donde termina
    function dibujarFila(y, valores, cabecera) {
      const alto = altoFila(valores, cabecera);
      if (cabecera) doc.rect(X0, y, anchoTotal, alto).fill('#1f2a44');

      let x = X0;
      valores.forEach((v, i) => {
        if (!cabecera) doc.lineWidth(0.5).rect(x, y, cols[i].w, alto).stroke('#bbbbbb');
        doc.font(cabecera ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
          .fillColor(cabecera ? '#ffffff' : '#000000')
          .text(String(v ?? ''), x + PAD, y + PAD, { width: cols[i].w - PAD * 2 });
        x += cols[i].w;
      });
      return y + alto;
    }

    // Encabezado del documento
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000')
      .text(`Peticiones de ${MESES[mes - 1]} ${anio}`, X0, 30);
    doc.font('Helvetica').fontSize(9)
      .text(`Total: ${r.rows.length}`, X0, 50);

    let y = 70;
    y = dibujarFila(y, cols.map((c) => c.t), true);

    if (r.rows.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#000000')
        .text('No hay peticiones registradas en este mes.', X0, y + 10);
    }

    for (const fila of r.rows) {
      const valores = cols.map((c) => fila[c.k]);
      // Si no cabe, nueva página y se repite el encabezado de la tabla
      if (y + altoFila(valores, false) > limiteInferior) {
        doc.addPage();
        y = 30;
        y = dibujarFila(y, cols.map((c) => c.t), true);
      }
      y = dibujarFila(y, valores, false);
    }

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

// ---------- REPORTE ESTADÍSTICO ANUAL EN PDF (debe ir ANTES de /:id) ----------
// Solicitados: peticiones recibidas en el mes.
// Realizados: entregas (PDF del perito) cargadas en el mes.
router.get('/reporte-estadistico', requerirRol('Administrador', 'Consulta'), async (req, res) => {
  const anio = req.query.anio ? parseInt(req.query.anio, 10) : new Date().getFullYear();
  if (!(anio >= 2000 && anio <= 2100)) {
    return res.status(400).json({ error: 'Año inválido' });
  }

  try {
    const [mat, sol, rea] = await Promise.all([
      pool.query('SELECT id, nombre, activo FROM materias ORDER BY nombre'),
      pool.query(
        `SELECT p.materia_id, EXTRACT(MONTH FROM p.fecha_recibido)::int AS mes, COUNT(*)::int AS total
           FROM peticiones p
          WHERE p.fecha_recibido >= make_date($1, 1, 1)
            AND p.fecha_recibido <  make_date($1 + 1, 1, 1)
          GROUP BY p.materia_id, mes`,
        [anio]
      ),
      pool.query(
        `SELECT p.materia_id, EXTRACT(MONTH FROM e.subido_en)::int AS mes, COUNT(*)::int AS total
           FROM entregas e
           JOIN peticiones p ON p.id = e.peticion_id
          WHERE e.subido_en >= make_date($1, 1, 1)
            AND e.subido_en <  make_date($1 + 1, 1, 1)
          GROUP BY p.materia_id, mes`,
        [anio]
      ),
    ]);

    // materia_id -> [12 conteos, uno por mes]
    const acumular = (filas) => {
      const mapa = new Map();
      for (const f of filas) {
        if (!mapa.has(f.materia_id)) mapa.set(f.materia_id, Array(12).fill(0));
        mapa.get(f.materia_id)[f.mes - 1] = f.total;
      }
      return mapa;
    };
    const solicitados = acumular(sol.rows);
    const realizados = acumular(rea.rows);

    // Materias activas, más las inactivas que tengan movimiento ese año
    const materias = mat.rows.filter(
      (m) => m.activo || solicitados.has(m.id) || realizados.has(m.id)
    );

    const MES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const X0 = 30;
    const PAD = 4;
    const W_MAT = 120;
    const W_MES = 48;
    const W_TOT = 60;
    const anchoTotal = W_MAT + W_MES * 12 + W_TOT;

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="informes-periciales-${anio}.pdf"`);
    doc.pipe(res);

    // La paginación se maneja a mano: sin margen inferior, PDFKit no agrega hojas por su cuenta
    doc.page.margins.bottom = 0;
    doc.on('pageAdded', () => {
      doc.page.margins.bottom = 0;
    });

    const limiteInferior = doc.page.height - 40;

    // Celda con borde y texto centrado vertical y horizontalmente
    function celda(x, y, w, h, texto, { fondo, color = '#000000', negrita = false } = {}) {
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      if (fondo) doc.rect(x, y, w, h).fill(fondo);
      doc.lineWidth(0.5).rect(x, y, w, h).stroke('#000000');
      const t = String(texto);
      const alto = doc.heightOfString(t, { width: w - PAD * 2 });
      doc.fillColor(color).text(t, x + PAD, y + (h - alto) / 2, { width: w - PAD * 2, align: 'center' });
    }

    let y = 30;

    const ALTO_TITULO = 18;
    const ALTO_ENC = 18;
    const ALTO_TOTAL = 20;

    // Barra de título de la tabla + fila de encabezados de columna
    function encabezado(titulo, colores) {
      celda(X0, y, anchoTotal, ALTO_TITULO, titulo, { fondo: colores.titulo, color: '#ffffff', negrita: true });
      y += ALTO_TITULO;

      let x = X0;
      const enc = { fondo: colores.encabezado, color: '#ffffff', negrita: true };
      celda(x, y, W_MAT, ALTO_ENC, 'MATERIA', enc);
      x += W_MAT;
      MES_CORTO.forEach((mes) => {
        celda(x, y, W_MES, ALTO_ENC, mes, enc);
        x += W_MES;
      });
      celda(x, y, W_TOT, ALTO_ENC, 'TOTAL', enc);
      y += ALTO_ENC;
    }

    function nuevaHoja(titulo, colores) {
      doc.addPage();
      y = 30;
      encabezado(`${titulo} (continuación)`, colores);
    }

    let tablasDibujadas = 0;

    function tabla(titulo, datos, colores) {
      const filas = materias.map((m) => ({
        nombre: m.nombre.toUpperCase(),
        valores: datos.get(m.id) || Array(12).fill(0),
      }));
      const altos = filas.map((f) => {
        doc.font('Helvetica-Bold').fontSize(8);
        return Math.max(20, doc.heightOfString(f.nombre, { width: W_MAT - PAD * 2 }) + PAD * 2);
      });
      const alto = ALTO_TITULO + ALTO_ENC + altos.reduce((a, b) => a + b, 0) + ALTO_TOTAL;

      // Si la tabla cabe completa en una hoja, pero no en lo que queda de esta, empieza en hoja nueva
      const cabeEnUnaHoja = alto <= limiteInferior - 30;
      if (tablasDibujadas > 0 && cabeEnUnaHoja && y + alto > limiteInferior) {
        doc.addPage();
        y = 30;
      }

      encabezado(titulo, colores);

      // Filas por materia: si una no cabe, la tabla sigue en otra hoja repitiendo el encabezado
      const totalesMes = Array(12).fill(0);
      filas.forEach((f, i) => {
        if (y + altos[i] > limiteInferior) nuevaHoja(titulo, colores);

        let x = X0;
        celda(x, y, W_MAT, altos[i], f.nombre, { negrita: true });
        x += W_MAT;
        f.valores.forEach((v, j) => {
          totalesMes[j] += v;
          celda(x, y, W_MES, altos[i], v || '');
          x += W_MES;
        });
        celda(x, y, W_TOT, altos[i], f.valores.reduce((a, b) => a + b, 0), { fondo: '#e6b8b7', negrita: true });
        y += altos[i];
      });

      // Fila de totales
      if (y + ALTO_TOTAL > limiteInferior) nuevaHoja(titulo, colores);
      const tot = { fondo: colores.total, color: colores.textoTotal, negrita: true };
      let x = X0;
      celda(x, y, W_MAT, ALTO_TOTAL, 'TOTAL', tot);
      x += W_MAT;
      totalesMes.forEach((v) => {
        celda(x, y, W_MES, ALTO_TOTAL, v, tot);
        x += W_MES;
      });
      celda(x, y, W_TOT, ALTO_TOTAL, totalesMes.reduce((a, b) => a + b, 0), tot);
      y += ALTO_TOTAL + 24;
      tablasDibujadas += 1;
    }

    // Encabezado del documento
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000')
      .text(`Informes periciales ${anio}`, X0, y);
    y += 26;

    tabla('INFORMES PERICIALES SOLICITADOS', solicitados, {
      titulo: '#77933c', encabezado: '#31869b', total: '#92cddc', textoTotal: '#000000',
    });
    tabla('INFORMES PERICIALES REALIZADOS', realizados, {
      titulo: '#77933c', encabezado: '#974706', total: '#e46c0a', textoTotal: '#ffffff',
    });

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

// ---------- LISTA (el perito solo ve las suyas) ----------
router.get('/', requerirRol(...TODOS), async (req, res) => {
  const { numero_llamado, perito, fecha, numero_carpeta } = req.query;
  const condiciones = [];
  const params = [];

  if (req.usuario.rol === 'Perito') {
    params.push(req.usuario.id);
    condiciones.push(`perito_id = $${params.length}`);
  }
  if (numero_llamado && numero_llamado.trim()) {
    params.push(`%${numero_llamado.trim()}%`);
    condiciones.push(`numero_llamado ILIKE $${params.length}`);
  }
  if (perito && perito.trim()) {
    params.push(`%${perito.trim()}%`);
    condiciones.push(`nombre_perito ILIKE $${params.length}`);
  }
  if (numero_carpeta && numero_carpeta.trim()) {
    params.push(numero_carpeta.trim());
    condiciones.push(`LOWER(numero_carpeta) = LOWER($${params.length})`);
  }
  if (fecha && fecha.trim()) {
    params.push(fecha.trim());
    condiciones.push(`fecha_recibido = $${params.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  try {
    const r = await pool.query(
      `SELECT * FROM vw_peticiones ${where}
       ORDER BY fecha_recibido DESC, hora_recibido DESC`,
      params
    );
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar peticiones' });
  }
});

// =====================================================================
// RUTAS CON "/:id"
// =====================================================================

// ---------- UNA petición (el perito solo si es suya) ----------
router.get('/:id', requerirRol(...TODOS), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Id de petición inválido' });

  try {
    const r = await pool.query('SELECT * FROM vw_peticiones WHERE id = $1', [id]);
    const peticion = r.rows[0];
    if (!peticion) return res.status(404).json({ error: 'Petición no encontrada' });

    if (req.usuario.rol === 'Perito' && peticion.perito_id !== req.usuario.id) {
      return res.status(403).json({ error: 'Esta petición no está asignada a ti' });
    }
    res.json(peticion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la petición' });
  }
});

// ---------- CREAR (Administrador y Receptor) ----------
// El perito ya se asigna aquí, en el primer formulario.
router.post('/', requerirRol('Administrador', 'Receptor'), async (req, res) => {
  const {
    llamado_id,
    nombre_ministerio_publico,
    con_detenido,
    materia_id,
    numero_carpeta,
    descripcion_solicitud,
    numero_llamado,
    perito_id,
  } = req.body;

  const receptor_id = req.usuario.id; // sale del token, no del body

  try {
    const ll = await pool.query(
      'SELECT codigo, es_automatico FROM llamados WHERE id = $1',
      [llamado_id]
    );
    if (!ll.rows[0]) return res.status(400).json({ error: 'Llamado no válido' });
    const { codigo, es_automatico } = ll.rows[0];

    // La materia debe corresponder al llamado (si el llamado tiene materias configuradas)
    const ok = await pool.query(
      `SELECT NOT EXISTS (SELECT 1 FROM llamado_materias WHERE llamado_id = $1)
           OR EXISTS (SELECT 1 FROM llamado_materias WHERE llamado_id = $1 AND materia_id = $2)
              AS valido`,
      [llamado_id, materia_id]
    );
    if (!ok.rows[0].valido) {
      return res.status(400).json({ error: `Esa materia no corresponde al llamado ${codigo}` });
    }

    // Si viene perito, debe ser un usuario con rol Perito y de la misma materia
    const peritoFinal = perito_id === '' || perito_id === undefined || perito_id === null ? null : perito_id;
    if (peritoFinal !== null) {
      const pr = await pool.query(
        `SELECT 1 FROM usuarios u
           JOIN roles r ON r.id = u.rol_id
          WHERE u.id = $1 AND r.nom_rol = 'Perito' AND u.materia_id = $2`,
        [peritoFinal, materia_id]
      );
      if (!pr.rows[0]) {
        return res.status(400).json({ error: 'El perito seleccionado no es válido o no corresponde a la materia' });
      }
    }

    // Número manual (FMG, FMAP): obligatorio; FMAP con formato ZO/123 o JO/123
    let numero = null;
    if (!es_automatico) {
      numero = String(numero_llamado || '').trim().toUpperCase();
      if (!numero) {
        return res.status(400).json({ error: 'El número debe capturarse manualmente' });
      }
      if (codigo === 'FMAP' && !/^(ZO|JO)\/\d+$/.test(numero)) {
        return res.status(400).json({
          error: 'El número de apoyo debe tener el formato ZO/123 o JO/123',
        });
      }
    }

    // Si la carpeta ya existe se usa la existente; si no, se crea
    const carpetaFinal = await asegurarCarpeta(numero_carpeta);
    if (!carpetaFinal) return res.status(400).json({ error: 'El número de carpeta es obligatorio' });

    const resultado = await pool.query(
      `INSERT INTO peticiones
        (llamado_id, receptor_id, nombre_ministerio_publico, con_detenido, materia_id, numero_carpeta, descripcion_solicitud, numero_llamado, perito_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        llamado_id,
        receptor_id,
        mayus(nombre_ministerio_publico),
        con_detenido,
        materia_id,
        carpetaFinal,
        mayus(descripcion_solicitud),
        numero, // ya viene en mayúsculas
        peritoFinal,
      ]
    );

    const nuevaPeticion = resultado.rows[0];

    await pool.query(
      `INSERT INTO bitacora (us_id, acc_id, pet_id, fecha_hora)
       VALUES ($1, 3, $2, NOW())`,
      [receptor_id, nuevaPeticion.id]
    );

    if (peritoFinal !== null) {
      await notificar([peritoFinal], nuevaPeticion.id, 'asignada',
        `Nueva petición ${nuevaPeticion.numero_llamado} asignada a ti`);
    }

    res.status(201).json(nuevaPeticion);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ese número ya está registrado, no se puede duplicar' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear la petición' });
  }
});

// ---------- EDITAR ----------
// Administrador: todo (menos quien recibe/firma, que solo se llena con /firmar).
// Receptor: solo asignar perito en una petición suya que todavía no tiene perito.
router.put('/:id', requerirRol('Administrador', 'Receptor'), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Id de petición inválido' });

  const b = req.body;
  const n = (v) => (v === '' || v === undefined ? null : v);

  try {
    if (req.usuario.rol === 'Receptor') {
      const p = await pool.query(
        'SELECT receptor_id, perito_id, materia_id FROM peticiones WHERE id = $1',
        [id]
      );
      if (!p.rows[0]) return res.status(404).json({ error: 'Petición no encontrada' });
      if (p.rows[0].receptor_id !== req.usuario.id || p.rows[0].perito_id !== null) {
        return res.status(403).json({ error: 'No tienes permiso para editar esta petición' });
      }

      // El perito debe ser de la materia de la petición
      if (n(b.perito_id)) {
        const pr = await pool.query(
          `SELECT 1 FROM usuarios u
             JOIN roles r ON r.id = u.rol_id
            WHERE u.id = $1 AND r.nom_rol = 'Perito' AND u.materia_id = $2`,
          [n(b.perito_id), p.rows[0].materia_id]
        );
        if (!pr.rows[0]) {
          return res.status(400).json({ error: 'El perito seleccionado no corresponde a la materia' });
        }
      }

      const r = await pool.query(
        `UPDATE peticiones SET perito_id = $1 WHERE id = $2 RETURNING *`,
        [n(b.perito_id), id]
      );
      await pool.query(
        `INSERT INTO bitacora (us_id, acc_id, pet_id) VALUES ($1, 4, $2)`,
        [req.usuario.id, id]
      );

      await notificar([n(b.perito_id)], id, 'asignada',
        `Nueva petición ${r.rows[0].numero_llamado} asignada a ti`);

      return res.json(r.rows[0]);
    }

    // Administrador
    const previa = await pool.query(
      'SELECT perito_id, materia_id FROM peticiones WHERE id = $1',
      [id]
    );
    if (!previa.rows[0]) return res.status(404).json({ error: 'Petición no encontrada' });

    // El perito debe ser de la materia. Solo se valida si el perito o la materia
    // cambian, para no bloquear la edición de peticiones antiguas que ya no coinciden.
    const peritoNuevo = 'perito_id' in b ? n(b.perito_id) : previa.rows[0].perito_id;
    const materiaNueva = n(b.materia_id) ?? previa.rows[0].materia_id;
    const cambioPerito = String(peritoNuevo ?? '') !== String(previa.rows[0].perito_id ?? '');
    const cambioMateria = String(materiaNueva) !== String(previa.rows[0].materia_id);

    if (peritoNuevo && (cambioPerito || cambioMateria)) {
      const pr = await pool.query(
        `SELECT 1 FROM usuarios u
           JOIN roles r ON r.id = u.rol_id
          WHERE u.id = $1 AND r.nom_rol = 'Perito' AND u.materia_id = $2`,
        [peritoNuevo, materiaNueva]
      );
      if (!pr.rows[0]) {
        return res.status(400).json({ error: 'El perito seleccionado no es válido o no corresponde a la materia' });
      }
    }

    const carpetaFinal = b.numero_carpeta ? await asegurarCarpeta(b.numero_carpeta) : null;

    const resultado = await pool.query(
      `UPDATE peticiones SET
         receptor_id               = COALESCE($1, receptor_id),
         nombre_ministerio_publico = COALESCE($2, nombre_ministerio_publico),
         con_detenido              = COALESCE($3, con_detenido),
         materia_id                = COALESCE($4, materia_id),
         numero_carpeta            = COALESCE($5, numero_carpeta),
         descripcion_solicitud     = COALESCE($6, descripcion_solicitud),
         perito_id       = CASE WHEN $7 THEN $8 ELSE perito_id END,
         entrega_dictamen      = COALESCE($9,  entrega_dictamen),
         entrega_informe       = COALESCE($10, entrega_informe),
         entrega_requerimiento = COALESCE($11, entrega_requerimiento)
       WHERE id = $12
       RETURNING *`,
      [
        n(b.receptor_id),
        mayus(b.nombre_ministerio_publico),
        n(b.con_detenido),
        n(b.materia_id),
        carpetaFinal,
        mayus(b.descripcion_solicitud),
        'perito_id' in b, n(b.perito_id),
        n(b.entrega_dictamen),
        n(b.entrega_informe),
        n(b.entrega_requerimiento),
        id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Petición no encontrada' });
    }

    await pool.query(
      `INSERT INTO bitacora (us_id, acc_id, pet_id) VALUES ($1, 4, $2)`,
      [req.usuario.id, id]
    );

    // Solo se avisa al perito cuando cambia, no en cada edición
    const nuevoPerito = resultado.rows[0].perito_id;
    if (nuevoPerito && nuevoPerito !== previa.rows[0]?.perito_id) {
      await notificar([nuevoPerito], id, 'asignada',
        `Nueva petición ${resultado.rows[0].numero_llamado} asignada a ti`);
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la petición' });
  }
});

// ---------- SUBIR PDF (Administrador o Perito asignado) ----------
router.post(
  '/:id/entrega',
  requerirRol('Administrador', 'Perito'),
  (req, res, next) =>
    upload.single('archivo')(req, res, (err) =>
      err ? res.status(400).json({ error: err.message }) : next()
    ),
  async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;
    const borrar = () => req.file && fs.unlink(req.file.path, () => {});

    if (!/^\d+$/.test(id)) { borrar(); return res.status(400).json({ error: 'Id inválido' }); }
    if (!req.file) return res.status(400).json({ error: 'Adjunta un archivo PDF' });
    if (!COLUMNA_ENTREGA[tipo]) { borrar(); return res.status(400).json({ error: 'Tipo de entrega inválido' }); }

    try {
      const p = await pool.query(
        'SELECT perito_id, firmado_en, numero_llamado FROM peticiones WHERE id = $1',
        [id]
      );
      if (!p.rows[0]) { borrar(); return res.status(404).json({ error: 'Petición no encontrada' }); }

      if (req.usuario.rol === 'Perito' && p.rows[0].perito_id !== req.usuario.id) {
        borrar();
        return res.status(403).json({ error: 'Esta petición no está asignada a ti' });
      }

      // Una entrega ya firmada no puede reemplazarse por el perito
      if (req.usuario.rol === 'Perito' && p.rows[0].firmado_en) {
        borrar();
        return res.status(409).json({ error: 'La entrega ya fue firmada y no se puede reemplazar' });
      }

      const previo = await pool.query('SELECT archivo_ruta FROM entregas WHERE peticion_id = $1', [id]);

      const guardada = await pool.query(
        `INSERT INTO entregas (peticion_id, tipo, archivo_nombre, archivo_ruta, subido_por)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (peticion_id) DO UPDATE
           SET tipo = EXCLUDED.tipo,
               archivo_nombre = EXCLUDED.archivo_nombre,
               archivo_ruta = EXCLUDED.archivo_ruta,
               subido_por = EXCLUDED.subido_por,
               subido_en = NOW()
         RETURNING tipo, archivo_nombre, subido_en`,
        [id, tipo, req.file.originalname, req.file.path, req.usuario.id]
      );

      // Deja marcada solo la casilla del tipo entregado
      await pool.query(
        `UPDATE peticiones
            SET entrega_dictamen = $2, entrega_informe = $3, entrega_requerimiento = $4
          WHERE id = $1`,
        [id, tipo === 'dictamen', tipo === 'informe', tipo === 'requerimiento']
      );

      if (previo.rows[0]?.archivo_ruta) fs.unlink(previo.rows[0].archivo_ruta, () => {});

      await notificarRoles(
        ['Administrador', 'Receptor'], req.usuario.id, id, 'lista_firma',
        `El llamado ${p.rows[0].numero_llamado} ya tiene PDF y está listo para firmarse`
      );

      res.status(201).json(guardada.rows[0]);
    } catch (error) {
      borrar();
      console.error('ERROR ENTREGA:', error);
      res.status(500).json({ error: 'Error al guardar la entrega: ' + error.message });
    }
  }
);

// ---------- DATOS DE LA ENTREGA (JSON; null si no hay) ----------
router.get('/:id/entrega', requerirRol(...TODOS), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Id inválido' });

  try {
    const r = await pool.query(
      `SELECT e.tipo, e.archivo_nombre, e.subido_en, p.perito_id
         FROM entregas e JOIN peticiones p ON p.id = e.peticion_id
        WHERE e.peticion_id = $1`,
      [id]
    );
    const e = r.rows[0];
    if (!e) return res.json(null);
    if (req.usuario.rol === 'Perito' && e.perito_id !== req.usuario.id) {
      return res.status(403).json({ error: 'Esta petición no está asignada a ti' });
    }
    res.json({ tipo: e.tipo, archivo_nombre: e.archivo_nombre, subido_en: e.subido_en });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la entrega' });
  }
});

// ---------- DESCARGAR EL PDF ----------
router.get('/:id/entrega/archivo', requerirRol(...TODOS), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Id inválido' });

  try {
    const r = await pool.query(
      `SELECT e.archivo_nombre, e.archivo_ruta, p.perito_id
         FROM entregas e JOIN peticiones p ON p.id = e.peticion_id
        WHERE e.peticion_id = $1`,
      [id]
    );
    const e = r.rows[0];
    if (!e) return res.status(404).json({ error: 'Sin PDF cargado' });
    if (req.usuario.rol === 'Perito' && e.perito_id !== req.usuario.id) {
      return res.status(403).json({ error: 'Esta petición no está asignada a ti' });
    }
    res.download(e.archivo_ruta, e.archivo_nombre);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al descargar el archivo' });
  }
});

// ---------- FIRMAR RECEPCIÓN (Administrador o Receptor, con contraseña) ----------
router.post('/:id/firmar', requerirRol('Administrador', 'Receptor'), async (req, res) => {
  const { id } = req.params;
  const { contrasena } = req.body;

  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Id de petición inválido' });
  if (!contrasena) return res.status(400).json({ error: 'Escribe tu contraseña para firmar' });

  try {
    // 1) Verifica la contraseña del usuario de la sesión (el id sale del token)
    const u = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [req.usuario.id]);
    const coincide = u.rows[0] && (await bcrypt.compare(contrasena, u.rows[0].password_hash));
    if (!coincide) {
      // 403 y no 401, para que el frontend no lo tome como sesión vencida
      return res.status(403).json({ error: 'Contraseña incorrecta' });
    }

    // 2) La petición debe existir, tener PDF cargado y no estar firmada
    const p = await pool.query(
      `SELECT p.firmado_en, e.peticion_id AS tiene_pdf
         FROM peticiones p
         LEFT JOIN entregas e ON e.peticion_id = p.id
        WHERE p.id = $1`,
      [id]
    );
    if (!p.rows[0]) return res.status(404).json({ error: 'Petición no encontrada' });
    if (!p.rows[0].tiene_pdf) {
      return res.status(400).json({ error: 'El perito todavía no carga el PDF' });
    }
    if (p.rows[0].firmado_en) {
      return res.status(409).json({ error: 'Esta entrega ya fue firmada' });
    }

    // 3) Firma: quien recibe sale del token, nunca del body
    const r = await pool.query(
      `UPDATE peticiones
          SET quien_recibe_id = $1, firmado_en = NOW()
        WHERE id = $2 AND firmado_en IS NULL
        RETURNING id, quien_recibe_id, firmado_en`,
      [req.usuario.id, id]
    );
    if (!r.rows[0]) return res.status(409).json({ error: 'Esta entrega ya fue firmada' });

    await pool.query(
      `INSERT INTO bitacora (us_id, acc_id, pet_id, fecha_hora)
       VALUES ($1, 7, $2, NOW())`,
      [req.usuario.id, id]
    );

    res.json(r.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al firmar: ' + error.message });
  }
});

module.exports = router;