import { useEffect, useRef, useState } from "react";
import "./VisorPdfsPanel.css";

// Id estable por archivo (no cambia al quitar otros archivos de la lista)
const idsArchivos = new WeakMap();
let contador = 0;
export function idArchivo(file) {
  if (!idsArchivos.has(file)) idsArchivos.set(file, `archivo-${++contador}`);
  return idsArchivos.get(file);
}

export default function VisorPdfsPanel({
  titulo = "Oficio del MP",
  items,
  textoVacio = "Aún no hay archivos para mostrar.",
}) {
  const [activo, setActivo] = useState(null);
  const [url, setUrl] = useState("");
  const [errorVisor, setErrorVisor] = useState("");
  const idsAnteriores = useRef([]);

  const ids = items.map((i) => i.id);
  const clave = ids.join("|");

  // Elige qué PDF mostrar: el recién agregado, o el primero si se quitó el activo
  useEffect(() => {
    const previos = idsAnteriores.current;
    idsAnteriores.current = ids;
    if (ids.length === 0) return setActivo(null);
    const nuevos = ids.filter((id) => !previos.includes(id));
    if (previos.length > 0 && nuevos.length > 0) return setActivo(nuevos[nuevos.length - 1]);
    setActivo((a) => (a !== null && ids.includes(a) ? a : ids[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const actual = items.find((i) => i.id === activo);

  useEffect(() => {
    if (!actual) return undefined;
    let vivo = true;
    let blobUrl = "";
    setErrorVisor("");
    Promise.resolve(typeof actual.fuente === "function" ? actual.fuente() : actual.fuente)
      .then((blob) => {
        if (!vivo) return;
        blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setUrl(blobUrl);
      })
      .catch((e) => vivo && setErrorVisor(e.message || "No se pudo cargar el PDF."));
    return () => {
      vivo = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setUrl("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual?.id, actual?.fuente instanceof Blob ? actual.fuente : null]);

  return (
    <div className="card atender-visor">
      <h3 style={{ marginTop: 0 }}>{titulo}</h3>
      {items.length === 0 ? (
        <p>{textoVacio}</p>
      ) : (
        <>
          <div className="atender-visor-tabs">
            {items.map((p) => (
              <button
                key={p.id}
                type="button"
                className={"btn " + (p.id === activo ? "btn-primary" : "btn-secondary")}
                onClick={() => setActivo(p.id)}
              >
                {p.nombre}
              </button>
            ))}
          </div>
          {errorVisor && <div className="status-banner error">{errorVisor}</div>}
          {url ? (
            <>
              <iframe
                className="atender-visor-marco"
                src={url}
                title={`Vista previa de ${actual?.nombre ?? "PDF"}`}
              />
              <p style={{ marginBottom: 0 }}>
                <a href={url} target="_blank" rel="noreferrer">Abrir en pestaña nueva</a>
              </p>
            </>
          ) : (
            !errorVisor && <p>Cargando PDF...</p>
          )}
        </>
      )}
    </div>
  );
}