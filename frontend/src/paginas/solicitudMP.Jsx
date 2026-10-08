import { useEffect, useState } from "react";
import AppLayout from "../reutilizables/AppLayout";
import { solicitudesMpApi } from "../api/solicitudesMp";
import { SelectField, TextArea, TextField } from "../reutilizables/Field";

const vacio = { numero_carpeta: "", materia_id: "", breve_resena: "" };

export default function SolicitudMP() {
  const [form, setForm] = useState(vacio);
  const [pdf, setPdf] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const cargar = () => solicitudesMpApi.listar().then(setLista).catch(() => setLista([]));

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
    if (!pdf) return setError("Debes adjuntar el PDF.");
    if (pdf.type !== "application/pdf") return setError("El archivo debe ser PDF.");

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("pdf", pdf);

    setLoading(true);
    try {
      await solicitudesMpApi.crear(fd);
      setSuccess("Solicitud enviada al receptor.");
      setForm(vacio);
      setPdf(null);
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
              label="Solicitud de área"
              placeholder="Selecciona..."
              options={materias.map((m) => ({ value: m.id, label: m.nombre }))}
              value={form.materia_id}
              onChange={(e) => set("materia_id", e.target.value)}
              required
            />
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                Oficio de solicitud (PDF)
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdf(e.target.files[0] || null)}
                required
              />
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
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={5}>Aún no has enviado solicitudes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}