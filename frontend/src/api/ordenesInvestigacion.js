import { api } from "./client";

export const ordenesInvestigacionApi = {
  listar: () => api.get("/ordenes-investigacion"),
  crear: (formData) => api.postForm("/ordenes-investigacion", formData),

  // El AIC atiende la orden: { perito_id, jefe_grupo, descripcion_solicitud, nombre_ministerio_publico }
  atender: (id, datos) => api.put(`/ordenes-investigacion/${id}/atender`, datos),

  pdfs: (id) => api.get(`/ordenes-investigacion/${id}/pdfs`),

  // Blob de un PDF (para la vista previa dentro de la pantalla)
  pdfBlob: (id, archivoId) => api.getBlob(`/ordenes-investigacion/${id}/pdf/${archivoId}`),

  async abrirPdf(id, archivoId) {
    const blob = await api.getBlob(`/ordenes-investigacion/${id}/pdf/${archivoId}`);
    window.open(URL.createObjectURL(blob), "_blank");
  },
};