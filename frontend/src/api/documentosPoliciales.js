// frontend/src/api/documentosPoliciales.js
// Entrevistas e informes iniciales: las dos usan el mismo formato (carpeta + iniciales + PDFs)
import { api } from "./client";
import { mostrarPdf } from "../reutilizables/visorPdf";

function crearApi(base) {
  return {
    listar: () => api.get(base),
    crear: (formData) => api.postForm(base, formData),
    eliminar: (id) => api.post(`${base}/${id}/eliminar`, {}),
    // Abre la vista previa del PDF (titulo es opcional)
    async abrirPdf(id, archivoId, titulo) {
      const blob = await api.getBlob(`${base}/${id}/pdf/${archivoId}`);
      mostrarPdf(blob, titulo);
    },
  };
}

export const entrevistasApi = crearApi("/entrevistas");
export const informesInicialesApi = crearApi("/informes-iniciales");