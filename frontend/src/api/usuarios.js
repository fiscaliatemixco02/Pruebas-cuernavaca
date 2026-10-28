import { api } from "./client";

export const usuariosApi = {
  // Lista todos los usuarios
  listar: () => api.get("/usuarios"),

  // Cambiar la contraseña de un usuario (solo Administrador)
  cambiarContrasena: (datos) => api.put("/auth/admin/cambiar-contrasena", datos),

  // Ver la contraseña de un usuario; exige la contraseña del propio administrador
  // datos = { id, contrasenaAdmin } -> { contrasena }
  verContrasena: (datos) => api.post("/auth/admin/ver-contrasena", datos),
};