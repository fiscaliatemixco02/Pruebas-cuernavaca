import { api } from "./client";

export const solicitudesMpApi = {
  materias: () => api.get("/materias"),
  listar: () => api.get("/solicitudes-mp"),
  crear: (formData) => api.postForm("/solicitudes-mp", formData),
  atender: (id, peticion_id) => api.put(`/solicitudes-mp/${id}/atender`, { peticion_id }),
  async abrirPdf(id) {
    const blob = await api.getBlob(`/solicitudes-mp/${id}/pdf`);
    window.open(URL.createObjectURL(blob), "_blank");
  },
};