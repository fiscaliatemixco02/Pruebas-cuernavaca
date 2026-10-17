import { api } from "./client";

export const ordenesInvestigacionApi = {
  listar: () => api.get("/ordenes-investigacion"),
  crear: (formData) => api.postForm("/ordenes-investigacion", formData),
  atender: (id) => api.put(`/ordenes-investigacion/${id}/atender`, {}),
  pdfs: (id) => api.get(`/ordenes-investigacion/${id}/pdfs`),

  async abrirPdf(id, archivoId) {
    const blob = await api.getBlob(`/ordenes-investigacion/${id}/pdf/${archivoId}`);
    window.open(URL.createObjectURL(blob), "_blank");
  },
};