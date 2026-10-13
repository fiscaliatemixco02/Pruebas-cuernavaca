import { api } from "./client";

export const peticionesApi = {
  crear: (payload) => api.post("/peticiones", payload),
  completar: (id, payload) => api.put(`/peticiones/${id}`, payload),
  obtener: (id) => api.get(`/peticiones/${id}`),
  buscar: (filtros) => api.get("/peticiones", filtros),
  listarPeritos: (materiaId) => api.get("/peritos", materiaId ? { materia_id: materiaId } : undefined),
  listarMaterias: (llamadoId) => api.get("/materias", llamadoId ? { llamado_id: llamadoId } : undefined),
  listarLlamados: () => api.get("/llamados"),
  listarAsignadas: () => api.get("/peticiones/asignadas"),
  porFirmar: () => api.get("/peticiones/por-firmar"),
  pendientes: () => api.get("/peticiones/pendientes"),

  // Entrega (PDF) de una petición
  obtenerEntrega: (id) => api.get(`/peticiones/${id}/entrega`),

  // Sube uno o varios PDF. Acepta { tipo, archivos: [File, ...] }
  // (también { tipo, archivo: File } para no romper código viejo).
  subirEntrega: (id, { tipo, archivos, archivo }) => {
    const lista = archivos ?? (archivo ? [archivo] : []);
    const fd = new FormData();
    lista.forEach((f) => fd.append("archivos", f)); // mismo nombre para todos
    fd.append("tipo", tipo);
    return api.postForm(`/peticiones/${id}/entrega`, fd);
  },

  // Lista de PDF de la entrega: [{ id, tipo, nombre_original, subido_en }]
  listarArchivosEntrega: (id) => api.get(`/peticiones/${id}/entrega/archivos`),

  // Devuelve el blob de un PDF concreto
  descargarArchivoEntrega: (id, archivoId) =>
    api.getBlob(`/peticiones/${id}/entrega/archivo/${archivoId}`),

  // Elimina un PDF concreto de la entrega
  eliminarArchivoEntrega: (id, archivoId) =>
    api.post(`/peticiones/${id}/entrega/archivo/${archivoId}/eliminar`, {}),

  // Último PDF cargado (compatibilidad)
  descargarEntrega: (id) => api.getBlob(`/peticiones/${id}/entrega/archivo`),

  // Firma de recepción (Administrador / Receptor), con su contraseña
  firmar: (id, contrasena) => api.post(`/peticiones/${id}/firmar`, { contrasena }),
};