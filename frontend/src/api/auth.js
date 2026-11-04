// src/api/auth.js
import { api } from "./client";

// Versiones anteriores guardaban el JWT en localStorage (un XSS podía robarlo). Ya no se usa:
// la sesión vive en una cookie HttpOnly. Aquí se borra el token viejo que pudiera quedar en el navegador.
const TOKEN_ANTIGUO = "token";
try {
  localStorage.removeItem(TOKEN_ANTIGUO);
} catch {
  /* sin acceso a localStorage: no hay nada que borrar */
}

// Backend:
//   POST /api/auth/login   { usuario, contrasena, [turnstileToken], [sitio_web] } -> { usuario: { id, nombre, apellidos, correo, rol, materia } }
//                          (además pone la cookie de sesión HttpOnly)
//   POST /api/auth/logout                          -> borra la cookie de sesión
//   GET  /api/auth/me      (cookie de sesión)      -> { id, nombre, apellidos, correo, rol, materia } | 401
//   POST /api/auth/registro, /enviar-codigo, /confirmar-codigo  (Administrador / Creador de Cuentas)

export const authApi = {
  login: async (usuario, contrasena, extra = {}) => {
    const data = await api.post("/auth/login", { usuario, contrasena, ...extra });
    return data.usuario;
  },

  // El servidor borra la cookie de sesión
  logout: () => api.post("/auth/logout", {}),

  me: () => api.get("/auth/me"),

  registrar: (payload) => api.post("/auth/registro", payload),
  enviarCodigoVerificacion: (correo) => api.post("/auth/enviar-codigo", { correo }),
  confirmarCodigoVerificacion: (correo, codigo) =>
    api.post("/auth/confirmar-codigo", { correo, codigo }),
};