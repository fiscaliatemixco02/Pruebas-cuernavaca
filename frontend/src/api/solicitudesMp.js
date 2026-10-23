import { api } from "./client";

export const solicitudesMpApi = {
  materias: () => api.get("/materias"),
  listar: () => api.get("/solicitudes-mp"),
  crear: (formData) => api.postForm("/solicitudes-mp", formData),
  atender: (id, peticion_id) => api.put(`/solicitudes-mp/${id}/atender`, { peticion_id }),

  // Lista de PDF de una solicitud: [{ id, nombre_original }]
  pdfs: (id) => api.get(`/solicitudes-mp/${id}/pdfs`),

  // Blob de un PDF (para la vista previa dentro de la pantalla)
  pdfBlob: (id, archivoId) =>
    api.getBlob(archivoId ? `/solicitudes-mp/${id}/pdf/${archivoId}` : `/solicitudes-mp/${id}/pdf`),

  // Carpetas del MP (una por número de carpeta de sus solicitudes)
  carpetas: () => api.get("/solicitudes-mp/carpetas"),

  // PDF que subió el perito para una solicitud: [{ id, tipo, nombre_original, subido_en }]
  resolucion: (id) => api.get(`/solicitudes-mp/${id}/resolucion`),

  // Abre un PDF de la resolución del perito
  async abrirResolucion(id, archivoId) {
    const blob = await api.getBlob(`/solicitudes-mp/${id}/resolucion/${archivoId}`);
    window.open(URL.createObjectURL(blob), "_blank");
  },

  // Abre un PDF concreto. Sin archivoId abre el primero (como antes).
  async abrirPdf(id, archivoId) {
    const ruta = archivoId
      ? `/solicitudes-mp/${id}/pdf/${archivoId}`
      : `/solicitudes-mp/${id}/pdf`;
    const blob = await api.getBlob(ruta);
    window.open(URL.createObjectURL(blob), "_blank");
  },
};