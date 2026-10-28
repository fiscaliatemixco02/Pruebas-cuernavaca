// backend/config/roles.js
//
// ÚNICO lugar del backend donde se definen los roles y quién puede hacer qué.
// Las rutas no escriben nombres de rol: usan  requerirRol(...PERMISOS.firmar)
//
// Para cambiar un permiso, se cambia aquí y nada más.
// Los nombres de rol deben coincidir EXACTO con roles.nom_rol en la base de datos.
// (El equivalente en el frontend es src/paginas/permisos.jsx)

const ROLES = {
  ADMIN: 'Administrador',
  RECEPTOR: 'Receptor',
  AIC: 'AIC',
  PERITO: 'Perito',
  POLICIA: 'Policia',
  CONSULTA: 'Consulta',
  MP: 'Ministerio Publico',
  CREADOR: 'Creador de Cuentas',
};

const { ADMIN, RECEPTOR, AIC, PERITO, POLICIA, CONSULTA, MP, CREADOR } = ROLES;

// ---------- Grupos ----------
// Reciben los llamados, asignan y firman las entregas
const RECEPTORES = [RECEPTOR, AIC];
// Reciben peticiones asignadas y suben entregas (PDF)
const ASIGNADOS = [PERITO, POLICIA];

// ---------- Quién puede hacer qué ----------
const PERMISOS = {
  // Peticiones
  verPeticiones:      [ADMIN, RECEPTOR, AIC, PERITO, POLICIA, CONSULTA], // listar, ver detalle, ver y abrir PDFs
  registrar:          [ADMIN, RECEPTOR, AIC],                            // crear llamado, asignar, editar
  misAsignadas:       [ADMIN, PERITO, POLICIA],                          // "Notificaciones" del perito / policía
  subirEntrega:       [ADMIN, PERITO, POLICIA],                          // subir y eliminar PDFs de la entrega
  firmar:             [ADMIN, RECEPTOR, AIC],                            // "Por firmar" y firma de recepción
  verPendientes:      [ADMIN, RECEPTOR, AIC, PERITO, POLICIA],           // puntitos rojos del menú
  reporteMensual:     [ADMIN, RECEPTOR, AIC, CONSULTA],
  reporteEstadistico: [ADMIN, CONSULTA],

  // Carpetas
  verCarpetas:          [ADMIN, RECEPTOR, AIC, PERITO, POLICIA, CONSULTA],
  solicitudesDeCarpeta: [ADMIN, RECEPTOR],

  // Solicitudes del Ministerio Público
  enviarSolicitud:  [MP],
  verMisCarpetas:   [MP],                       // carpetas del MP y la resolución de sus solicitudes
  verSolicitudes:   [MP, RECEPTOR, ADMIN],   // solicitudes periciales: las atiende el Receptor (el AIC atiende las órdenes de investigación)
  atenderSolicitud: [RECEPTOR, ADMIN],

  // Entrevistas e informes iniciales (carpeta + iniciales de la víctima + PDFs)
  subirEntrevista:      [AIC, POLICIA],
  verEntrevistas:       [ADMIN, AIC, POLICIA],   // el Policía solo ve las suyas
  subirInformeInicial:  [POLICIA],
  verInformesIniciales: [ADMIN, POLICIA],        // el Policía solo ve los suyos

  // Catálogos y listas de apoyo
  verCatalogos:  [ADMIN, RECEPTOR, AIC, PERITO, POLICIA, CONSULTA, MP], // llamados, materias
  verUsuarios:   [ADMIN, RECEPTOR, AIC],
  verAsignables: [ADMIN, RECEPTOR, AIC],                               // peritos y policías disponibles

  // Alta de cuentas: el Administrador y el rol dedicado "Creador de Cuentas"
  crearCuentas: [ADMIN, CREADOR],
  verMateriasAlta: [ADMIN, CREADOR],   // el combo de materias del formulario de alta

  // Solo administrador
  administrar: [ADMIN], // bitácora, crear / eliminar carpetas, respaldo, etc.
  estadisticas: [ADMIN, CONSULTA],
};

// ---------- Ayudas ----------
const esAsignado = (rol) => ASIGNADOS.includes(rol);
const esReceptor = (rol) => RECEPTORES.includes(rol);

// Roles que el Creador de Cuentas NO puede asignar (evita escalar privilegios)
const ROLES_NO_ASIGNABLES_POR_CREADOR = [ADMIN, CREADOR];

// A quién le corresponde firmar cada tipo de asignado:
//   Receptor -> lo de peritos, AIC -> lo de policías, Administrador (null) -> todo
function rolAsignadoPara(rol) {
  if (rol === RECEPTOR) return PERITO;
  if (rol === AIC) return POLICIA;
  return null;
}

module.exports = {
  ROLES,
  RECEPTORES,
  ASIGNADOS,
  PERMISOS,
  esAsignado,
  esReceptor,
  rolAsignadoPara,
  ROLES_NO_ASIGNABLES_POR_CREADOR,
};