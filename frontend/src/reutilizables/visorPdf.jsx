// frontend/src/reutilizables/VisorPdf.jsx
//
// Ventana de vista previa de PDF. Se monta UNA sola vez, dentro de AppLayout:
//   <VisorPdf />
// Para abrir un PDF desde cualquier parte:  mostrarPdf(blobOFile, "Nombre.pdf")  (ver visorPdf.js)

import { useEffect, useRef, useState } from "react";
import { suscribirVisor } from "./visorPdf";

export default function VisorPdf() {
  const [abierto, setAbierto] = useState(null); // { url, titulo }
  const urlActual = useRef(null);

  function liberar() {
    if (urlActual.current) URL.revokeObjectURL(urlActual.current);
    urlActual.current = null;
  }

  function cerrar() {
    liberar();
    setAbierto(null);
  }

  // Escucha las peticiones de mostrar un PDF (Blob de una descarga o File recién elegido)
  useEffect(() => {
    const quitar = suscribirVisor(({ fuente, titulo }) => {
      liberar();
      const url = URL.createObjectURL(new Blob([fuente], { type: "application/pdf" }));
      urlActual.current = url;
      setAbierto({ url, titulo: titulo || fuente.name || "Vista previa del PDF" });
    });
    return () => {
      quitar();
      liberar();
    };
  }, []);

  // Escape cierra la ventana y se bloquea el scroll de la página mientras está abierta
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowAnterior;
    };
  }, [abierto]);

  if (!abierto) return null;

  const nombreDescarga = /\.pdf$/i.test(abierto.titulo) ? abierto.titulo : "documento.pdf";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={abierto.titulo}
      onClick={cerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff",
          color: "#111111",
          borderRadius: 12,
          width: "min(1100px, 100%)",
          height: "min(92vh, 100%)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderBottom: "1px solid #dddddd",
          }}
        >
          <strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {abierto.titulo}
          </strong>
          <a className="btn btn-secondary" href={abierto.url} target="_blank" rel="noreferrer">
            Abrir en otra pestaña
          </a>
          <a className="btn btn-secondary" href={abierto.url} download={nombreDescarga}>
            Descargar
          </a>
          <button type="button" className="btn btn-primary" onClick={cerrar}>
            Cerrar
          </button>
        </div>
        <iframe title={abierto.titulo} src={abierto.url} style={{ flex: 1, border: 0, width: "100%" }} />
      </div>
    </div>
  );
}