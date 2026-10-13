import { api } from "./client";

export const solicitudesMpApi = {
  materias: () => api.get("/materias"),
  listar: () => api.get("/solicitudes-mp"),
  crear: (formData) => api.postForm("/solicitudes-mp", formData),
  atender: (id, peticion_id) => api.put(`/solicitudes-mp/${id}/atender`, { peticion_id }),

  // Lista de PDF de una solicitud: [{ id, nombre_original }]
  pdfs: (id) => api.get(`/solicitudes-mp/${id}/pdfs`),

  // Abre un PDF concreto. Sin archivoId abre el primero (como antes).
  async abrirPdf(id, archivoId) {
    const ruta = archivoId
      ? `/solicitudes-mp/${id}/pdf/${archivoId}`
      : `/solicitudes-mp/${id}/pdf`;
    const blob = await api.getBlob(ruta);
    window.open(URL.createObjectURL(blob), "_blank");
  },
};