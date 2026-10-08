// src/permisos.jsx

export const ROLES = {
  ADMIN: "Administrador",
  PERITO: "Perito",
  RECEPTOR: "Receptor",
  CONSULTA: "Consulta",
};

const { ADMIN, PERITO, RECEPTOR, CONSULTA } = ROLES;

/*
  Roles permitidos por vista. Se usa en App.jsx: <ProtectedRoute roles={VISTAS.estadisticas}>

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
  inicio:         [ADMIN, PERITO, RECEPTOR, CONSULTA, MP],
  notificaciones: [PERITO],
  nuevoRegistro:  [ADMIN, RECEPTOR],
  expedientes:    [ADMIN, RECEPTOR],
  verPeticion:    [ADMIN, RECEPTOR, PERITO, CONSULTA],
  editarPeticion: [ADMIN],
  carpetas:       [ADMIN, RECEPTOR],
  estadisticas:   [ADMIN, CONSULTA],
  usuarios:       [ADMIN],
  crearCuenta:    [ADMIN],
  bitacora:       [ADMIN],
  porFirmar:      [ADMIN, RECEPTOR],
  respaldo:       [ADMIN],
  solicitudMP:          [MP],
  solicitudesRecibidas: [ADMIN, RECEPTOR],
};
export function puedeVer(rol, vista) {
  if (!vista || !VISTAS[vista]) return true;
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