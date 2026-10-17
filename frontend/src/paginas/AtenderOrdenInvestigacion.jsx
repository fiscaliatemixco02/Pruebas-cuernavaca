import { useEffect, useState } from "react";
import { ordenesInvestigacionApi } from "../api/ordenesInvestigacion";
import { peticionesApi } from "../api/peticiones";
import { useAuth } from "../context/AuthContext";
import { SelectField, TextArea, TextField } from "../reutilizables/Field";
import "./AtenderOrden.css";

const nombreCompleto = (u) => [u?.nombre, u?.apellidos].filter(Boolean).join(" ");

/* Visor de los PDF que mandó el MP (a un costado del formulario) */
function VisorPdfs({ orden, pdfs }) {
  const [activo, setActivo] = useState(null);
  const [url, setUrl] = useState("");
  const [errorVisor, setErrorVisor] = useState("");

  useEffect(() => {
    if (pdfs.length > 0 && activo === null) setActivo(pdfs[0].id);
  }, [pdfs, activo]);

  useEffect(() => {
    if (activo === null) return undefined;
    let vivo = true;
    let blobUrl = "";
    setErrorVisor("");
    ordenesInvestigacionApi
      .pdfBlob(orden.id, activo)
      .then((blob) => {
        if (!vivo) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      })
      .catch((e) => vivo && setErrorVisor(e.message));
    return () => {
      vivo = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setUrl("");
    };
  }, [orden.id, activo]);

  const actual = pdfs.find((p) => p.id === activo);

  return (
    <div className="card atender-visor">
      <h3 style={{ marginTop: 0 }}>Oficio del MP</h3>
      {pdfs.length === 0 ? (
        <p>Esta orden no tiene archivos.</p>
      ) : (
        <>
          <div className="atender-visor-tabs">
            {pdfs.map((p) => (
              <button
                key={p.id}
                type="button"
                className={"btn " + (p.id === activo ? "btn-primary" : "btn-secondary")}
                onClick={() => setActivo(p.id)}
              >
                {p.nombre_original}
              </button>
            ))}
          </div>
          {errorVisor && <div className="status-banner error">{errorVisor}</div>}
          {url ? (
            <>
              <iframe
                className="atender-visor-marco"
                src={url}
                title={`Vista previa de ${actual?.nombre_original ?? "PDF"}`}
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

/* Formulario del AIC: el de "Nuevo registro" sin llamado, materia ni con/sin detenido */
export default function AtenderOrdenInvestigacion({ orden, onVolver, onAtendida }) {
  const { user } = useAuth();

  const [form, setForm] = useState({
    jefe_grupo: "",
    nombre_ministerio_publico: String(orden.nombre_mp ?? "").toUpperCase(),
    descripcion_solicitud: orden.breve_resena ?? "",
    perito_id: "",
  });
  const [pdfs, setPdfs] = useState([]);
  const [policias, setPolicias] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ordenesInvestigacionApi.pdfs(orden.id).then((l) => setPdfs(Array.isArray(l) ? l : [])).catch(() => setPdfs([]));
    // Para el AIC este endpoint devuelve solo policías
    peticionesApi.listarPeritos().then(setPolicias).catch(() => setPolicias([]));
  }, [orden.id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setMayus = (k, v) => set(k, v.toUpperCase());

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.perito_id) return setError("Debes asignar un policía.");
    if (!form.nombre_ministerio_publico || !form.descripcion_solicitud) {
      return setError("El nombre del MP y la descripción son obligatorios.");
    }
    setLoading(true);
    try {
      await ordenesInvestigacionApi.atender(orden.id, {
        perito_id: form.perito_id,
        jefe_grupo: form.jefe_grupo.trim(),
        nombre_ministerio_publico: form.nombre_ministerio_publico,
        descripcion_solicitud: form.descripcion_solicitud,
      });
      setSuccess("Orden atendida y asignada correctamente.");
      onAtendida?.();
    } catch (err) {
      setError(err.message || "No se pudo guardar el registro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="btn" type="button" onClick={onVolver} style={{ marginBottom: 16 }}>
        ← Volver
      </button>

      {error && <div className="status-banner error">{error}</div>}
      {success && <div className="status-banner success">{success}</div>}

      <div className="atender-grid">
        <form className="card" onSubmit={guardar}>
          <div className="form-grid two-col" style={{ marginBottom: 24 }}>
            <TextField
              label="Asignar jefe de grupo"
              value={form.jefe_grupo}
              onChange={(e) => setMayus("jefe_grupo", e.target.value)}
              placeholder="Escribe el nombre del jefe de grupo"
              autoComplete="off"
            />
            <TextField label="Fecha" value="Se genera automáticamente" readOnly disabled className="field-readonly" />
            <TextField label="Hora" value="Se genera automáticamente" readOnly disabled className="field-readonly" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <TextField label="Nombre de receptor" value={nombreCompleto(user)} readOnly disabled className="field-readonly" />
            <TextField
              label="Nombre de MP"
              value={form.nombre_ministerio_publico}
              onChange={(e) => setMayus("nombre_ministerio_publico", e.target.value)}
              readOnly
              style={{ cursor: "not-allowed" }}
              required
            />
            <TextField label="Número de carpeta" value={orden.numero_carpeta} readOnly style={{ cursor: "not-allowed" }} />
            <TextField
              label="Área solicitada"
              value={orden.area === "POLICIAL" ? "Policial" : orden.area === "ANALISIS" ? "Análisis" : orden.area}
              readOnly
              disabled
              className="field-readonly"
            />
            <SelectField
              label="Asignar policía"
              options={policias.map((p) => ({ value: p.id, label: p.nombre }))}
              placeholder={policias.length === 0 ? "No hay policías registrados" : "Selecciona un policía..."}
              value={form.perito_id}
              onChange={(e) => set("perito_id", e.target.value)}
              required
            />
            <TextArea
              label="Descripción de lo que solicita el MP"
              value={form.descripcion_solicitud}
              onChange={(e) => setMayus("descripcion_solicitud", e.target.value)}
              required
            />
          </div>

          <div className="btn-row end" style={{ marginTop: 24 }}>
            <button className="btn btn-primary" type="submit" disabled={loading || Boolean(success)}>
              {loading ? "Guardando..." : "Guardar registro"}
            </button>
          </div>
        </form>

        <VisorPdfs orden={orden} pdfs={pdfs} />
      </div>
    </div>
  );
}