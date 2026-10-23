import { useEffect, useState } from "react";
import AppLayout from "../../reutilizables/AppLayout";
import { ordenesInvestigacionApi } from "../../api/ordenesInvestigacion";
import { SelectField, TextArea, TextField } from "../../reutilizables/Field";
import BotonesPdfOrden from "../../reutilizables/BotonesPdfOrden";
import SelectorArchivos from "../../reutilizables/SelectorArchivos";
import VisorPdfsPanel, { idArchivo } from "../../reutilizables/VisorPdfsPanel";

const AREAS = [
  { value: "POLICIAL", label: "Policial" },
  { value: "ANALISIS", label: "Análisis" },
];
const nombreArea = (v) => AREAS.find((a) => a.value === v)?.label ?? v;

// 5 letras + 3 números + "/" + año (ej. ABCDE001/2026)
const FORMATO_CARPETA = /^[A-Z]{5}\d{3}\/\d{4}$/;

const vacio = { numero_carpeta: "", area: "", breve_resena: "" };

export default function OrdenInvestigacion() {
  const [form, setForm] = useState(vacio);
  const [pdfs, setPdfs] = useState([]);
  const [lista, setLista] = useState([]);
  const [pdfsPorOrden, setPdfsPorOrden] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    try {
      const filas = await ordenesInvestigacionApi.listar();
      setLista(filas);
      const entradas = await Promise.all(
        filas.map((f) =>
          ordenesInvestigacionApi
            .pdfs(f.id)
            .then((l) => [f.id, Array.isArray(l) ? l : []])
            .catch(() => [f.id, []])
        )
      );
      setPdfsPorOrden(Object.fromEntries(entradas));
    } catch {
      setLista([]);
    }
  };

  useEffect(() => { cargar(); }, []);

  const verPdf = (ordenId, archivoId) =>
    ordenesInvestigacionApi.abrirPdf(ordenId, archivoId).catch((e) => setError(e.message));

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function enviar(e) {
    e.preventDefault();
    const formEl = e.target;
    setError("");
    setSuccess("");
    if (!form.numero_carpeta || !form.area || !form.breve_resena) {
      return setError("Todos los campos son obligatorios.");
    }
    if (!FORMATO_CARPETA.test(form.numero_carpeta)) {
      return setError("La carpeta debe tener 5 letras, 3 números y el año. Ejemplo: ABCDE001/2026");
    }
    if (pdfs.length === 0) return setError("Debes adjuntar al menos un PDF.");
    if (pdfs.some((f) => f.type !== "application/pdf")) {
      return setError("Todos los archivos deben ser PDF.");
    }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    pdfs.forEach((f) => fd.append("pdfs", f));

    setLoading(true);
    try {
      await ordenesInvestigacionApi.crear(fd);
      setSuccess("Orden de investigación enviada al AIC.");
      setForm(vacio);
      setPdfs([]);
      formEl.reset();
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout title="Orden de investigación (AIC)">
      {error && <div className="status-banner error">{error}</div>}
      {success && <div className="status-banner success">{success}</div>}

      <div className="atender-grid">
        <form className="card" onSubmit={enviar}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <TextField
              label="Número de carpeta"
              value={form.numero_carpeta}
              onChange={(e) => set("numero_carpeta", e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="ABCDE001/2026"
              hint="5 letras, 3 números y el año. Ejemplo: ABCDE001/2026"
              maxLength={13}
              autoComplete="off"
              required
            />
            <SelectField
              label="Solicitud de área"
              placeholder="Selecciona..."
              options={AREAS}
              value={form.area}
              onChange={(e) => set("area", e.target.value)}
              required
            />
            <TextArea
              label="Reseña"
              value={form.breve_resena}
              onChange={(e) => set("breve_resena", e.target.value.toUpperCase())}
              required
            />

            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                Oficio de solicitud (PDF, uno o varios)
              </label>
              <SelectorArchivos
                accept="application/pdf"
                multiple
                onChange={(e) => {
                  const nuevos = Array.from(e.target.files || []);
                  e.target.value = "";
                  setPdfs((prev) => [...prev, ...nuevos]);
                }}
              />

              {/* Archivos elegidos: se previsualizan en el panel de la derecha */}
              {pdfs.length > 0 && (
                <ul style={{ listStyleType: "disc", paddingLeft: "20px", margin: "8px 0", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {pdfs.map((archivo, index) => (
                    <li key={idArchivo(archivo)} style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span>{archivo.name}</span>
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
            </div>
          </div>

          <div className="btn-row end" style={{ marginTop: 24 }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar al AIC"}
            </button>
          </div>
        </form>

        <VisorPdfsPanel
          titulo="Vista previa del oficio"
          textoVacio="Selecciona un PDF para ver su vista previa aquí."
          items={pdfs.map((f) => ({
            id: idArchivo(f),
            nombre: f.name,
            fuente: f,
          }))}
        />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Mis órdenes de investigación</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Carpeta</th>
              <th>Área</th>
              <th>Estado</th>
              <th>Oficio (PDF)</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.id}>
                <td>{String(o.created_at).slice(0, 10)}</td>
                <td>{o.numero_carpeta}</td>
                <td>{nombreArea(o.area)}</td>
                <td>{o.estado === "ATENDIDA" ? "Atendida" : "En espera"}</td>
                <td><BotonesPdfOrden ordenId={o.id} pdfs={pdfsPorOrden[o.id]} onVer={verPdf} /></td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={5}>Aún no has enviado órdenes de investigación.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}