import { useEffect, useState } from "react";
import AppLayout from "../reutilizables/AppLayout";
import { solicitudesMpApi } from "../api/solicitudesMp";
import PeticionWizard from "./PeticionWizard";

export default function SolicitudesRecibidas() {
  const [lista, setLista] = useState([]);
  const [activa, setActiva] = useState(null);
  const [error, setError] = useState("");

  const cargar = () =>
    solicitudesMpApi.listar().then(setLista).catch((e) => setError(e.message));

  useEffect(() => { cargar(); }, []);

  const verPdf = (id) => solicitudesMpApi.abrirPdf(id).catch((e) => setError(e.message));

  async function alGuardar(creada) {
    try {
      const peticionId = creada?.id ?? creada?.peticion?.id;
      if (peticionId) await solicitudesMpApi.atender(activa.id, peticionId);
      else setError("La petición se guardó, pero no se encontró su id para ligarla a la solicitud.");
    } catch (e) {
      setError(e.message);
    }
    setActiva(null);
    cargar();
  }

  if (activa) {
    return (
      <AppLayout title="Atender solicitud de MP">
        <button className="btn" onClick={() => setActiva(null)}>← Volver</button>
        <div className="card" style={{ margin: "16px 0" }}>
          <p><b>MP:</b> {activa.nombre_mp}</p>
          <p><b>Área solicitada:</b> {activa.materia}</p>
          <p><b>Reseña:</b> {activa.breve_resena}</p>
          <button className="btn" type="button" onClick={() => verPdf(activa.id)}>Ver PDF</button>
        </div>
        <PeticionWizard mode="nueva" solicitudMp={activa} onSaved={alGuardar} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Solicitudes de MP">
      {error && <div className="status-banner error">{error}</div>}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th><th>MP</th><th>Carpeta</th><th>Área</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td>{String(s.created_at).slice(0, 10)}</td>
                <td>{s.nombre_mp}</td>
                <td>{s.numero_carpeta}</td>
                <td>{s.materia}</td>
                <td>{s.estado === "ATENDIDA" ? `Atendida (${s.numero_llamado ?? ""})` : "Pendiente"}</td>
                <td>
                  {s.estado === "PENDIENTE" ? (
                    <button className="btn btn-primary" onClick={() => setActiva(s)}>Atender</button>
                  ) : (
                    <button className="btn" onClick={() => verPdf(s.id)}>PDF</button>
                  )}
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={6}>No hay solicitudes.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}