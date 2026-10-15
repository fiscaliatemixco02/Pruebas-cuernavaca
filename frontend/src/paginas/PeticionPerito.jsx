import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../reutilizables/AppLayout";
import { peticionesApi } from "../api/peticiones";
import { api } from "../api/client";
import { SelectField } from "../reutilizables/Field";
import ListaPdfsPendientes from "../reutilizables/ListaPdfsPendientes";

const TIPOS = [
  { value: "dictamen", label: "Dictamen" },
  { value: "informe", label: "Informe" },
  { value: "requerimiento", label: "Requerimiento" },
];

const fmtFecha = (f) => (f ? String(f).slice(0, 10) : "");
const fmtHora = (h) => (h ? String(h).slice(0, 8) : "");

export default function PeticionPerito() {
  const { id } = useParams();

  const [peticion, setPeticion] = useState(null);
  const [entrega, setEntrega] = useState(null);
  const [pdfsCargados, setPdfsCargados] = useState([]);
  const [tipo, setTipo] = useState("");
  const [archivos, setArchivos] = useState([]);
  const [descripcion, setDescripcion] = useState("");

  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function cargarPdfs() {
    try {
      const lista = await api.get(`/peticiones/${id}/entrega/archivos`);
      setPdfsCargados(Array.isArray(lista) ? lista : []);
    } catch {
      setPdfsCargados([]);
    }
  }

  async function cargar() {
    setError("");
    setLoading(true);
    try {
      const [datosPeticion, datosEntrega] = await Promise.all([
        peticionesApi.obtener(id),
        peticionesApi.obtenerEntrega(id).catch(() => null),
      ]);
      setPeticion(datosPeticion);
      setEntrega(datosEntrega);
      setTipo(datosEntrega?.tipo || "");
      await cargarPdfs();
    } catch (err) {
      setError(err.message || "No se encontró la petición.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubir(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    if (!tipo) {
      setError("Selecciona qué vas a entregar: dictamen, informe o requerimiento.");
      return;
    }
    if (archivos.length === 0) {
      setError("Adjunta al menos un PDF.");
      return;
    }
    if (archivos.some((f) => f.type !== "application/pdf")) {
      setError("Todos los archivos deben ser PDF.");
      return;
    }

    const fd = new FormData();
    archivos.forEach((f) => fd.append("archivos", f)); // mismo nombre para todos
    fd.append("tipo", tipo);
    if (descripcion.trim()) fd.append("descripcion", descripcion.trim());

    setSubiendo(true);
    try {
      const guardada = await api.postForm(`/peticiones/${id}/entrega`, fd);
      if (guardada?.tipo) setEntrega(guardada);
      setAviso(`${archivos.length} PDF(s) subido(s) correctamente.`);
      setArchivos([]);
      setDescripcion("");
      e.target.reset?.();
      await cargarPdfs();
    } catch (err) {
      setError(err.message || "No se pudo subir la entrega.");
    } finally {
      setSubiendo(false);
    }
  }

  async function handleVerPdf(archivoId) {
    setError("");
    try {
      const blob = await api.getBlob(`/peticiones/${id}/entrega/archivo/${archivoId}`);
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err) {
      setError(err.message || "No se pudo abrir el PDF.");
    }
  }

  async function handleEliminar(archivoId, nombre) {
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    setError("");
    setAviso("");
    try {
      await peticionesApi.eliminarArchivoEntrega(id, archivoId);
      setAviso("PDF eliminado.");
      await cargarPdfs();
      setEntrega(await peticionesApi.obtenerEntrega(id).catch(() => null));
    } catch (err) {
      setError(err.message || "No se pudo eliminar el PDF.");
    }
  }

  return (
    <AppLayout title="Petición asignada">
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <Link className="btn btn-secondary" to="/notificaciones">
          Volver a Notificaciones
        </Link>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}
      {aviso ? <div className="status-banner success">{aviso}</div> : null}

      {loading ? (
        <div className="card table-empty">Cargando...</div>
      ) : !peticion ? null : (
        <>
          <div className="card">
            <div className="page-heading" style={{ marginBottom: 16 }}>
              <h2>{peticion.numero_llamado}</h2>
              <p>Datos capturados por el receptor. Solo lectura.</p>
            </div>
            <div className="detalle-grid">
              <div>
                <span className="label">Fecha recibido</span>
                <span className="value">{fmtFecha(peticion.fecha_recibido)}</span>
              </div>
              <div>
                <span className="label">Hora recibido</span>
                <span className="value">{fmtHora(peticion.hora_recibido)}</span>
              </div>
              <div>
                <span className="label">Materia</span>
                <span className="value">{peticion.materia}</span>
              </div>
              <div>
                <span className="label">Número de carpeta</span>
                <span className="value">{peticion.numero_carpeta}</span>
              </div>
              <div>
                <span className="label">Ministerio público</span>
                <span className="value">{peticion.nombre_ministerio_publico}</span>
              </div>
              <div>
                <span className="label">Detenido</span>
                <span className="value">{peticion.estatus_detenido}</span>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <span className="label">Descripción de lo que solicita el MP</span>
              <p style={{ marginTop: 6 }}>{peticion.descripcion_solicitud}</p>
            </div>
          </div>

          <div className="card">
            <div className="page-heading" style={{ marginBottom: 16 }}>
              <h2>Tu entrega</h2>
              <p>Selecciona qué vas a entregar para esta petición y sube uno o varios PDF.</p>
            </div>

            {pdfsCargados.length > 0 || entrega ? (
              <div style={{ marginBottom: 20 }}>
                <span className="badge badge-done">
                  Entregado
                  {entrega?.tipo
                    ? ` · ${TIPOS.find((t) => t.value === entrega.tipo)?.label || entrega.tipo}`
                    : ""}
                </span>
                {pdfsCargados.length > 0 && (
                  <ul style={{ margin: "12px 0 0", paddingLeft: 18 }}>
                    {pdfsCargados.map((p) => (
                      <li key={p.id} style={{ marginBottom: 6 }}>
                        <strong>
                          {TIPOS.find((t) => t.value === p.tipo)?.label || p.tipo}
                        </strong>
                        {" — "}
                        {p.nombre_original}
                        <span className="field-hint" style={{ margin: "0 8px" }}>
                          {p.subido_en
                            ? new Date(p.subido_en).toLocaleString("es-MX")
                            : ""}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleVerPdf(p.id)}
                        >
                          Ver PDF
                        </button>{" "}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleEliminar(p.id, p.nombre_original)}
                        >
                          Eliminar
                        </button>
                        {p.descripcion ? (
                          <div className="field-hint" style={{ marginTop: 4 }}>
                            Reseña: {p.descripcion}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="btn-row" style={{ marginBottom: 20 }}>
                <span className="badge badge-pending">Pendiente de entrega</span>
              </div>
            )}

            <form onSubmit={handleSubir}>
              <div className="form-grid two-col" style={{ marginBottom: 16 }}>
                <SelectField
                  label="¿Qué vas a entregar?"
                  options={TIPOS}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 260px" }}>
              <div className="file-input-row">
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(e) => {
                    const nuevos = Array.from(e.target.files || []); // copiar ANTES de limpiar
                    e.target.value = ""; // permite volver a elegir el mismo archivo
                    setArchivos((prev) => [...prev, ...nuevos]);
                  }}
                />
                <span className="field-hint" style={{ margin: 0 }}>
                  Solo PDF, máximo 20 MB cada uno y hasta 10 por envío.
                </span>
              </div>
                </div>

                <div style={{ flex: "1 1 260px" }}>
                  <label className="label" htmlFor="descripcion-entrega">
                    Breve descripción o reseña (opcional)
                  </label>
                  <textarea
                    id="descripcion-entrega"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
                    maxLength={500}
                    rows={3}
                    placeholder="Escribe una breve descripción de lo que subes"
                    style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
                  />
                  <span className="field-hint">{descripcion.length}/500</span>
                </div>
              </div>

              <ListaPdfsPendientes
                archivos={archivos}
                onQuitar={(i) => setArchivos((p) => p.filter((_, j) => j !== i))}
                style={{ marginTop: 12 }}
              />

              <div className="btn-row end" style={{ marginTop: 20 }}>
                <button className="btn btn-primary" type="submit" disabled={subiendo}>
                  {subiendo ? "Subiendo..." : "Subir PDF"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </AppLayout>
  );
}