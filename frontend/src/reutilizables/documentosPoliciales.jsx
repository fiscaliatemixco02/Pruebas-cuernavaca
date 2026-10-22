// frontend/src/reutilizables/DocumentosPoliciales.jsx
//
// Formulario (carpeta + iniciales + PDFs) y lista de lo ya subido.
// Lo usan Entrevistas e Informe inicial; cada pantalla solo cambia los textos y los permisos.

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { TextField } from "./Field";
import SelectorArchivos from "./SelectorArchivos";
import { mostrarPdf } from "./visorPdf";

// Carpeta: 5 letras + 3 números + "/" + año (ej. ABCDE001/2026). Igual que en el servidor.
const FORMATO_CARPETA = /^[A-Z]{5}\d{3}\/\d{4}$/;

const fmtFecha = (f) => (f ? String(f).slice(0, 10) : "");

/**
 * api:               entrevistasApi o informesInicialesApi
 * puedeSubir:        si el usuario puede ver el formulario (si no, solo ve la lista)
 * etiquetaIniciales: texto del campo de iniciales
 * ayudaIniciales:    ejemplo debajo del campo
 * mensajeGuardado:   aviso al guardar
 */
export default function DocumentosPoliciales({
  api,
  puedeSubir,
  etiquetaIniciales,
  ayudaIniciales,
  mensajeGuardado,
}) {
  const { user } = useAuth();
  const esAdmin = user?.rol === "Administrador";
  const verQuienSubio = user?.rol !== "Policia"; // el policía solo ve lo suyo, no hace falta la columna

  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [carpeta, setCarpeta] = useState("");
  const [iniciales, setIniciales] = useState("");
  const [pdfs, setPdfs] = useState([]);

  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    try {
      setLista(await api.listar());
    } catch (err) {
      setError(err.message || "No se pudo cargar la lista.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setAviso("");

    const carpetaLimpia = carpeta.trim().toUpperCase();
    if (!carpetaLimpia || !iniciales.trim()) {
      return setError("La carpeta y las iniciales son obligatorias.");
    }
    if (!FORMATO_CARPETA.test(carpetaLimpia)) {
      return setError("La carpeta debe tener 5 letras, 3 números y el año. Ejemplo: ABCDE001/2026");
    }
    if (pdfs.length === 0) return setError("Debes adjuntar al menos un PDF.");
    if (pdfs.some((f) => f.type !== "application/pdf")) {
      return setError("Todos los archivos deben ser PDF.");
    }

    const fd = new FormData();
    fd.append("numero_carpeta", carpetaLimpia);
    fd.append("iniciales", iniciales.trim().toUpperCase());
    pdfs.forEach((f) => fd.append("pdfs", f)); // mismo nombre para todos

    setEnviando(true);
    try {
      await api.crear(fd);
      setAviso(mensajeGuardado || "Guardado correctamente.");
      setCarpeta("");
      setIniciales("");
      setPdfs([]);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo guardar.");
    } finally {
      setEnviando(false);
    }
  }

  async function abrirPdf(id, archivoId, nombre) {
    setError("");
    try {
      await api.abrirPdf(id, archivoId, nombre);
    } catch (err) {
      setError(err.message || "No se pudo abrir el PDF.");
    }
  }

  async function eliminar(registro) {
    if (!window.confirm(`¿Eliminar el registro de la carpeta ${registro.numero_carpeta}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError("");
    setAviso("");
    try {
      await api.eliminar(registro.id);
      setAviso("Registro eliminado.");
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo eliminar.");
    }
  }

  const columnas = verQuienSubio ? 6 : 5;

  return (
    <>
      {error ? <div className="status-banner error">{error}</div> : null}
      {aviso ? <div className="status-banner success">{aviso}</div> : null}

      {puedeSubir && (
        <form className="card" onSubmit={enviar}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <TextField
              label="Número de carpeta"
              hint="5 letras, 3 números y el año. Ejemplo: ABCDE001/2026"
              value={carpeta}
              onChange={(e) => setCarpeta(e.target.value.toUpperCase())}
              required
            />
            <TextField
              label={etiquetaIniciales}
              hint={ayudaIniciales}
              value={iniciales}
              onChange={(e) => setIniciales(e.target.value.toUpperCase())}
              required
            />

            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                Archivos PDF (uno o varios)
              </label>
              <SelectorArchivos
                accept="application/pdf"
                multiple
                onChange={(e) => {
                  const nuevos = Array.from(e.target.files || []); // copiar ANTES de limpiar
                  e.target.value = ""; // permite volver a elegir el mismo archivo
                  setPdfs((prev) => [...prev, ...nuevos]);
                }}
              />
              {pdfs.length > 0 && (
                <ul style={{ listStyleType: "disc", paddingLeft: "20px", margin: "8px 0", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {pdfs.map((archivo, index) => (
                    <li key={index} style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span>{archivo.name}</span>

                      {/* Este botón abre el modal flotante en la misma ventana */}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => mostrarPdf(archivo, archivo.name)}
                      >
                        Vista previa
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setPdfs((p) => p.filter((_, j) => j !== index))}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <span className="field-hint">Solo PDF, máximo 15 MB cada uno y hasta 10 por envío.</span>
            </div>
          </div>

          <div className="btn-row end" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" type="submit" disabled={enviando}>
              {enviando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ marginTop: puedeSubir ? 24 : 0, padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Carpeta</th>
              <th>{etiquetaIniciales}</th>
              {verQuienSubio ? <th>Subido por</th> : null}
              <th>PDF</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td className="table-empty" colSpan={columnas}>Cargando...</td>
              </tr>
            ) : lista.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={columnas}>Todavía no hay registros.</td>
              </tr>
            ) : (
              lista.map((r) => {
                const puedeEliminar = esAdmin || String(r.creado_por) === String(user?.id);
                return (
                  <tr key={r.id}>
                    <td>{fmtFecha(r.created_at)}</td>
                    <td>{r.numero_carpeta}</td>
                    <td>{r.iniciales_victima}</td>
                    {verQuienSubio ? <td>{r.creado_por_nombre}</td> : null}
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(r.archivos || []).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className="btn btn-secondary"
                            title={a.nombre}
                            onClick={() => abrirPdf(r.id, a.id, a.nombre)}
                          >
                            Ver {a.nombre?.length > 22 ? a.nombre.slice(0, 20) + "…" : a.nombre}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {puedeEliminar && (
                        <button type="button" className="btn btn-secondary" onClick={() => eliminar(r)}>
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}