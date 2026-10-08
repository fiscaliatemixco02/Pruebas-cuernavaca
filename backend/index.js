require('dotenv').config();
const express = require('express');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const estadisticasRoutes = require('./routes/estadisticas');
const cors = require('cors');
const carpetasRoutes = require('./routes/carpetas');
const peticionesRoutes = require('./routes/peticiones');
const solicitudesMpRoutes = require('./routes/solicitudesMP');
const { verificarToken, requerirRol } = require('./middleware/auth');
const respaldoRoutes = require('./routes/respaldo');
const app = express();
const PORT = process.env.PORT || 3000;
// Nombres de rol: deben coincidir EXACTO con roles.nom_rol en la BD
const ADMIN = 'Administrador';
const RECEPTOR = 'Receptor';
const PERITO = 'Perito';
const CONSULTA = 'Consulta';
const MP = 'Ministerio Publico';
const TODOS = [ADMIN, RECEPTOR, PERITO, CONSULTA, MP];

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

app.use('/api/estadisticas', verificarToken, requerirRol(ADMIN, CONSULTA), estadisticasRoutes);

// Los roles de cada endpoint se definen dentro de routes/carpetas.js y routes/peticiones.js
// (incluye /api/peticiones/asignadas, que vive en routes/peticiones.js)
app.use('/api/carpetas', verificarToken, carpetasRoutes);
app.use('/api/peticiones', verificarToken, peticionesRoutes);

// Solicitudes del Ministerio Público (roles definidos dentro de routes/solicitudesMp.js)
app.use('/api/solicitudes-mp', verificarToken, solicitudesMpRoutes);

app.use('/api/notificaciones', require('./routes/notificaciones'));

// Respaldo completo (el rol Administrador se exige dentro de routes/respaldo.js)
app.use('/api/respaldo', respaldoRoutes);

// Catálogo de tipos de llamado (AGREGADO NUEVAMENTE)
app.get('/api/llamados', verificarToken, requerirRol(...TODOS), async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, codigo, es_automatico FROM llamados ORDER BY codigo'
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar llamados' });
  }
});

// Usuarios. Administrador y Receptor (el wizard necesita la lista para los selects).
// Sin password_hash ni tokens.
app.get('/api/usuarios', verificarToken, requerirRol(ADMIN, RECEPTOR), async (req, res) => {
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
app.get('/api/materias', verificarToken, requerirRol(...TODOS), async (req, res) => {
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

// Usuarios con rol de Perito. Con ?materia_id=X devuelve solo los de esa materia.
app.get('/api/peritos', verificarToken, requerirRol(ADMIN, RECEPTOR), async (req, res) => {
  const { materia_id } = req.query;
  const params = [PERITO];
  let filtroMateria = '';

  if (materia_id !== undefined && materia_id !== '') {
    if (!/^\d+$/.test(String(materia_id))) {
      return res.status(400).json({ error: 'Materia inválida' });
    }
    params.push(materia_id);
    filtroMateria = `AND u.materia_id = $${params.length}`;
  }

  try {
    const resultado = await pool.query(
      `SELECT u.id, u.nombre, u.correo, u.materia_id
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
        WHERE r.nom_rol = $1 ${filtroMateria}
        ORDER BY u.nombre`,
      params
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar peritos' });
  }
});

// Bitácora de acciones (solo administrador)
app.get('/api/bitacora', verificarToken, requerirRol(ADMIN), async (req, res) => {
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