import { useEffect, useState } from "react";
import AppLayout from "../../reutilizables/AppLayout";
import { solicitudesMpApi } from "../../api/solicitudesMp";
import { SelectField, TextArea, TextField } from "../../reutilizables/Field";
import SelectorArchivos from "../../reutilizables/SelectorArchivos"; 
import { mostrarPdf } from "../../reutilizables/visorPdf";

const vacio = { numero_carpeta: "", materia_id: "", breve_resena: "" };

export default function SolicitudMP() {
  const [form, setForm] = useState(vacio);
  const [pdfs, setPdfs] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [pdfsPorSolicitud, setPdfsPorSolicitud] = useState({});

  const cargar = async () => {
    try {
      const filas = await solicitudesMpApi.listar();
      setLista(filas);
      const entradas = await Promise.all(
        filas.map((f) =>
          solicitudesMpApi
            .pdfs(f.id)
            .then((l) => [f.id, Array.isArray(l) ? l : []])
            .catch(() => [f.id, []])
        )
      );
      setPdfsPorSolicitud(Object.fromEntries(entradas));
    } catch {
      setLista([]);
    }
  };

  const verPdf = async (solicitudId, archivoId) => {
    try {
      await solicitudesMpApi.abrirPdf(solicitudId, archivoId);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    solicitudesMpApi.materias().then(setMaterias).catch((e) => setError(e.message));
    cargar();
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function enviar(e) {
    e.preventDefault();
    const formEl = e.target;
    setError("");
    setSuccess("");
    if (!form.numero_carpeta || !form.materia_id || !form.breve_resena) {
      return setError("Todos los campos son obligatorios.");
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
      await solicitudesMpApi.crear(fd);
      setSuccess("Solicitud enviada al receptor.");
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
    <AppLayout title="Solicitud ministerio público">
      {error && <div className="status-banner error">{error}</div>}
      {success && <div className="status-banner success">{success}</div>}

      <form className="card" onSubmit={enviar}>
        <div className="form-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <TextField
              label="Número de carpeta"
              value={form.numero_carpeta}
              onChange={(e) => set("numero_carpeta", e.target.value.toUpperCase())}
              required
            />
            <SelectField
              label="Solicitud de area"
              placeholder="Selecciona..."
              options={materias.map((m) => ({ value: m.id, label: m.nombre }))}
              value={form.materia_id}
              onChange={(e) => set("materia_id", e.target.value)}
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
              
              {/* Lista de PDFs pendientes con botón de Vista Previa local integrado en la misma ventana */}
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
            </div>
          </div>
          <TextArea
            label="Breve reseña"
            value={form.breve_resena}
            onChange={(e) => set("breve_resena", e.target.value.toUpperCase())}
            required
          />
        </div>
        <div className="btn-row end">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </form>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Mis solicitudes</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Carpeta</th>
              <th>Área</th>
              <th>Estado</th>
              <th>Número de llamado</th>
              <th>Oficio (PDF)</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td>{String(s.created_at).slice(0, 10)}</td>
                <td>{s.numero_carpeta}</td>
                <td>{s.materia}</td>
                <td>{s.estado === "ATENDIDA" ? "Atendida" : "En espera"}</td>
                <td>{s.numero_llamado ?? "Pendiente de asignar"}</td>
                <td>
                  {(pdfsPorSolicitud[s.id] || []).length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                      {pdfsPorSolicitud[s.id].map((p) => (
                        <li key={p.id} style={{ marginBottom: 4 }}>
                          {p.nombre_original}{" "}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => verPdf(s.id, p.id)}
                          >
                            Ver
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <button type="button" className="btn btn-secondary" onClick={() => verPdf(s.id)}>
                      Ver
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={6}>Aún no has enviado solicitudes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}