// frontend/src/reutilizables/visorPdf.js
//
// Punto único para mostrar un PDF en la vista previa:
//
//   import { mostrarPdf } from "../reutilizables/visorPdf";
//   mostrarPdf(blobOFile, "Nombre.pdf");   // el nombre es opcional
//
// El visor (VisorPdf.jsx) está montado una sola vez en AppLayout y escucha este aviso.

const oyentes = new Set();

export function mostrarPdf(fuente, titulo) {
  if (!fuente) return;
  if (oyentes.size === 0) {
    // Por si el visor no está montado: se abre en otra pestaña, como antes
    window.open(URL.createObjectURL(fuente), "_blank");
    return;
  }
  oyentes.forEach((fn) => fn({ fuente, titulo }));
}

export function suscribirVisor(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}