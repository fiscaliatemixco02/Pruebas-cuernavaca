import { useEffect, useState } from "react";

/* Lista de PDF elegidos pero aún NO subidos.
   Cada archivo tiene un botón "Ver" (abre una vista previa local, sin subirlo)
   y un botón "Quitar". Props:
   - archivos: File[]
   - onQuitar(indice): quita un archivo de la lista
   - style: estilos opcionales para el <ul> */
export default function ListaPdfsPendientes({ archivos, onQuitar, style }) {
  const [vista, setVista] = useState(null); // { url, nombre } | null

  // Libera el blob al cerrar la vista previa o al desmontar el componente
  useEffect(() => {
    return () => {
      if (vista?.url) URL.revokeObjectURL(vista.url);
    };
  }, [vista]);

  // Cerrar con la tecla Escape
  useEffect(() => {
    if (!vista) return undefined;
    const onKey = (e) => e.key === "Escape" && setVista(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vista]);

  if (!archivos || archivos.length === 0) return null;

  const abrir = (file) => setVista({ url: URL.createObjectURL(file), nombre: file.name });

  return (
    <>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, ...style }}>
        {archivos.map((f, i) => (
          <li key={`${f.name}-${f.lastModified}-${i}`} style={{ marginBottom: 6 }}>
            {f.name}{" "}
            <button type="button" className="btn btn-secondary" onClick={() => abrir(f)}>
              Ver
            </button>{" "}
            <button type="button" className="btn btn-secondary" onClick={() => onQuitar(i)}>
              Quitar
            </button>
          </li>
        ))}
      </ul>

      {vista && (
        <div
          className="pdf-modal-fondo"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa de ${vista.nombre}`}
          onClick={() => setVista(null)}
        >
          <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-modal-barra">
              <strong className="pdf-modal-titulo">{vista.nombre}</strong>
              <div className="pdf-modal-acciones">
                <a className="btn btn-secondary" href={vista.url} target="_blank" rel="noreferrer">
                  Abrir en pestaña nueva
                </a>
                <button type="button" className="btn btn-primary" onClick={() => setVista(null)}>
                  Cerrar
                </button>
              </div>
            </div>
            <iframe className="pdf-modal-visor" src={vista.url} title={`Vista previa de ${vista.nombre}`} />
          </div>
        </div>
      )}
    </>
  );
}