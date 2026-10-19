require('dotenv').config();
const express = require('express');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const estadisticasRoutes = require('./routes/estadisticas');
const cors = require('cors');
const carpetasRoutes = require('./routes/carpetas');
const peticionesRoutes = require('./routes/peticiones');
const solicitudesMpRoutes = require('./routes/solicitudesMp');
const ordenesInvestigacionRoutes = require('./routes/ordenesInvestigacion');
const { verificarToken, requerirRol } = require('./middleware/auth');
const { ROLES, PERMISOS } = require('./config/roles');
const respaldoRoutes = require('./routes/respaldo');
const app = express();
const PORT = process.env.PORT || 3000;
// Los nombres de rol y los permisos viven en config/roles.js
const { RECEPTOR, AIC, PERITO, POLICIA } = ROLES;

app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.get('/', (req, res) => {
  res.send('Servidor funcionando');
});

// Login y registro (los permisos de cada endpoint se definen en routes/auth.js)
app.use('/api/auth', authRoutes);

app.use('/api/estadisticas', verificarToken, requerirRol(...PERMISOS.estadisticas), estadisticasRoutes);

// Los roles de cada endpoint se definen dentro de routes/carpetas.js y routes/peticiones.js
// (incluye /api/peticiones/asignadas, que vive en routes/peticiones.js)
app.use('/api/carpetas', verificarToken, carpetasRoutes);
app.use('/api/peticiones', verificarToken, peticionesRoutes);

// Solicitudes del Ministerio Público (roles definidos dentro de routes/solicitudesMp.js)
app.use('/api/solicitudes-mp', verificarToken, solicitudesMpRoutes);

// Órdenes de investigación del MP hacia el AIC (roles definidos dentro de routes/ordenesInvestigacion.js)
app.use('/api/ordenes-investigacion', verificarToken, ordenesInvestigacionRoutes);

app.use('/api/notificaciones', require('./routes/notificaciones'));

// Respaldo completo (el rol Administrador se exige dentro de routes/respaldo.js)
app.use('/api/respaldo', respaldoRoutes);

// Catálogo de tipos de llamado (AGREGADO NUEVAMENTE)
app.get('/api/llamados', verificarToken, requerirRol(...PERMISOS.verCatalogos), async (req, res) => {
  try {
    const resultado = await pool.query(
      // 'OI' es el llamado interno de las órdenes de investigación: no se ofrece en los formularios
      "SELECT id, codigo, es_automatico FROM llamados WHERE codigo <> 'OI' ORDER BY codigo"
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar llamados' });
  }
});

// Usuarios. Administrador, Receptor y AIC (el wizard necesita la lista para los selects).
// Sin password_hash ni tokens.
app.get('/api/usuarios', verificarToken, requerirRol(...PERMISOS.verUsuarios), async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT u.id, u.nombre, u.correo, u.rol_id, u.verificado, u.materia_id,
              r.nom_rol AS rol, m.nombre AS materia
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN materias m ON m.id = u.materia_id
        ORDER BY u.nombre`
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar usuarios' });
  }
});

// Catálogo de materias. Con ?llamado_id=X devuelve solo las de ese llamado
// (si el llamado no tiene materias configuradas, devuelve todas).
app.get('/api/materias', verificarToken, requerirRol(...PERMISOS.verCatalogos), async (req, res) => {
  const { llamado_id } = req.query;
  try {
    if (llamado_id && /^\d+$/.test(llamado_id)) {
      const filtradas = await pool.query(
        `SELECT m.id, m.nombre
           FROM materias m
           JOIN llamado_materias lm ON lm.materia_id = m.id
          WHERE m.activo = true AND lm.llamado_id = $1
          ORDER BY m.nombre`,
        [llamado_id]
      );
      if (filtradas.rows.length > 0) return res.json(filtradas.rows);
    }
    const todas = await pool.query(
      'SELECT id, nombre FROM materias WHERE activo = true ORDER BY nombre'
    );
    res.json(todas.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar materias' });
  }
});

// Personas a las que se les puede asignar una petición.
//   Receptor      -> solo peritos (con ?materia_id=X, solo los de esa materia)
//   AIC           -> solo policías (no se filtran por materia)
//   Administrador -> peritos (filtrados por materia si se manda) y todos los policías
// Cada fila trae `rol` para poder distinguirlos en pantalla.
app.get('/api/peritos', verificarToken, requerirRol(...PERMISOS.verAsignables), async (req, res) => {
  const { materia_id } = req.query;
  const rolSolicitante = req.usuario.rol;
  const params = [];
  const condiciones = [];

  if (materia_id !== undefined && materia_id !== '' && !/^\d+$/.test(String(materia_id))) {
    return res.status(400).json({ error: 'Materia inválida' });
  }

  if (rolSolicitante !== AIC) {
    let cond = `r.nom_rol = '${PERITO}'`;
    if (materia_id !== undefined && materia_id !== '') {
      params.push(materia_id);
      cond += ` AND u.materia_id = $${params.length}`;
    }
    condiciones.push(`(${cond})`);
  }
  if (rolSolicitante !== RECEPTOR) {
    condiciones.push(`r.nom_rol = '${POLICIA}'`);
  }

  try {
    const resultado = await pool.query(
      `SELECT u.id, u.nombre, u.correo, u.materia_id, r.nom_rol AS rol
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
        WHERE ${condiciones.join(' OR ')}
        ORDER BY u.nombre`,
      params
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar peritos y policías' });
  }
});

// Bitácora de acciones (solo administrador)
app.get('/api/bitacora', verificarToken, requerirRol(...PERMISOS.administrar), async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT
          b.id,
          p.numero_llamado,
          to_char(b.fecha_hora, 'YYYY-MM-DD') AS fecha,
          to_char(b.fecha_hora, 'HH24:MI') AS hora,
          a.nom_accion AS modificacion,
          u.nombre AS realizado_por
       FROM bitacora b
       JOIN usuarios u ON u.id = b.us_id
       JOIN acciones a ON a.id = b.acc_id
       LEFT JOIN peticiones p ON p.id = b.pet_id
       ORDER BY b.fecha_hora DESC`
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar bitácora' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});