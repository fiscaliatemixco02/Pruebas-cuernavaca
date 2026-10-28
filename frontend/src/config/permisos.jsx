// src/permisos.jsx

export const ROLES = {
  ADMIN: "Administrador",
  PERITO: "Perito",
  RECEPTOR: "Receptor",
  AIC: "AIC",
  POLICIA: "Policia",
  CONSULTA: "Consulta",
  CREADOR: "Creador de Cuentas",
};

const { ADMIN, PERITO, RECEPTOR, AIC, POLICIA, CONSULTA, CREADOR } = ROLES;

/*
  Roles permitidos por vista. Se usa en App.jsx: <ProtectedRoute roles={VISTAS.estadisticas}>

  AIC hace lo mismo que Receptor; Policia hace lo mismo que Perito.

  inicio          -> Home
  notificaciones  -> Notificaciones, PeticionPerito
  nuevoRegistro   -> NuevaPeticion
  expedientes     -> BuscarPeticion
  verPeticion     -> EditarPeticion (ruta /peticiones/editar/:id, sin ítem de menú)
  editarPeticion  -> ítem de menú "Editar petición" (solo Administrador)
  carpetas        -> Carpetas
  estadisticas    -> Estadisticas
  usuarios        -> Usuarios
  crearCuenta     -> CrearCuenta
  bitacora        -> Bitacora

  El Administrador está en todas.
*/
export const MP = "Ministerio Publico";

export const VISTAS = {
  inicio:         [ADMIN, PERITO, POLICIA, RECEPTOR, AIC, CONSULTA, MP, CREADOR], // CREADOR: Home lo redirige a /crear-cuenta
  notificaciones: [PERITO, POLICIA],
  nuevoRegistro:  [ADMIN, RECEPTOR],
  expedientes:    [ADMIN, RECEPTOR, AIC],
  verPeticion:    [ADMIN, RECEPTOR, AIC, PERITO, POLICIA, CONSULTA],
  editarPeticion: [ADMIN],
  carpetas:       [ADMIN, RECEPTOR, AIC],
  estadisticas:   [ADMIN, CONSULTA],
  usuarios:       [ADMIN],
  crearCuenta:    [ADMIN, CREADOR],
  bitacora:       [ADMIN],
  porFirmar:      [ADMIN, RECEPTOR, AIC],
  respaldo:       [ADMIN],
  solicitudMP:          [MP],
  misCarpetas:          [MP],
  solicitudesRecibidas: [ADMIN, RECEPTOR],
  ordenInvestigacion:   [MP],
  ordenesRecibidas:     [AIC],
  entrevistas:    [ADMIN, AIC, POLICIA],
  informeInicial: [ADMIN, POLICIA],
  cambiarContrasena: [ADMIN, RECEPTOR, AIC, PERITO, POLICIA, CONSULTA, MP],
};
export function puedeVer(rol, vista) {
  if (!vista || !VISTAS[vista]) return true;
  // El Creador de Cuentas no ve "Inicio" en el menú: la ruta "/" solo existe para redirigirlo
  if (rol === CREADOR && vista === "inicio") return false;
  return VISTAS[vista].includes(rol);
}

// Ítems del menú lateral / navbar.
const MENU = [
  { vista: "inicio",         ruta: "/",                   texto: "Inicio" },
  { vista: "notificaciones", ruta: "/notificaciones",     texto: "Notificaciones" },
  { vista: "nuevoRegistro",  ruta: "/peticiones/nueva",   texto: "Nuevo registro" },
  { vista: "expedientes",    ruta: "/peticiones/buscar",  texto: "Expedientes" },
  { vista: "editarPeticion", ruta: "/peticiones/editar",  texto: "Editar petición" },
  { vista: "carpetas",       ruta: "/carpetas",           texto: "Carpetas" },
  { vista: "estadisticas",   ruta: "/estadisticas",       texto: "Estadísticas" },
  { vista: "usuarios",       ruta: "/usuarios",           texto: "Usuarios" },
  { vista: "crearCuenta",    ruta: "/crear-cuenta",       texto: "Crear cuenta" },
  { vista: "bitacora",       ruta: "/bitacora",           texto: "Bitácora" },
];

export function menuPara(rol) {
  return MENU.filter((item) => puedeVer(rol, item.vista));
}