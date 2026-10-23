import { useEffect, useState } from "react";
import AppLayout from "../../reutilizables/AppLayout";
import { solicitudesMpApi } from "../../api/solicitudesMp";
import PeticionWizard from "../compartidas/PeticionWizard";
import VisorPdfsPanel from "../../reutilizables/VisorPdfsPanel";

/* Botones "Ver" de los PDF de una solicitud (uno por archivo).
   Si la solicitud es antigua y no tiene lista de archivos, abre el primero. */
function BotonesPdf({ solicitudId, pdfs, onVer }) {
  if (!pdfs || pdfs.length === 0) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => onVer(solicitudId)}>
        Ver PDF
      </button>
    );
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
      {pdfs.map((p) => (
        <li key={p.id} style={{ marginBottom: 4 }}>
          {p.nombre_original}{" "}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onVer(solicitudId, p.id)}
          >
            Ver
          </button>
        </li>
      ))}
    </ul>
  );
}

/* Archivos de una solicitud en el formato del visor. Si es una solicitud antigua
   sin lista de archivos, se muestra el primero (ruta de compatibilidad). */
const itemsVisor = (solicitudId, pdfs) =>
  !pdfs || pdfs.length === 0
    ? [{ id: "principal", nombre: "Oficio.pdf", fuente: () => solicitudesMpApi.pdfBlob(solicitudId) }]
    : pdfs.map((p) => ({
        id: p.id,
        nombre: p.nombre_original,
        fuente: () => solicitudesMpApi.pdfBlob(solicitudId, p.id),
      }));

export default function SolicitudesRecibidas() {
  const [lista, setLista] = useState([]);
  const [pdfsPorSolicitud, setPdfsPorSolicitud] = useState({}); // { [id]: [{ id, nombre_original }] }
  const [activa, setActiva] = useState(null);
  const [error, setError] = useState("");

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
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { cargar(); }, []);

  const verPdf = (solicitudId, archivoId) =>
    solicitudesMpApi.abrirPdf(solicitudId, archivoId).catch((e) => setError(e.message));

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
        <div className="atender-grid" style={{ marginTop: 16 }}>
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <p><b>MP:</b> {activa.nombre_mp}</p>
              <p><b>Área solicitada:</b> {activa.materia}</p>
              <p style={{ marginBottom: 0 }}><b>Reseña:</b> {activa.breve_resena}</p>
            </div>
            <PeticionWizard mode="nueva" solicitudMp={activa} onSaved={alGuardar} />
          </div>

          <VisorPdfsPanel
            titulo="Oficio del MP"
            textoVacio="Esta solicitud no tiene archivos."
            items={itemsVisor(activa.id, pdfsPorSolicitud[activa.id])}
          />
        </div>
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
              <th>Fecha</th><th>MP</th><th>Carpeta</th><th>Área</th><th>Estado</th>
              <th>Oficio (PDF)</th><th></th>
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
                  <BotonesPdf solicitudId={s.id} pdfs={pdfsPorSolicitud[s.id]} onVer={verPdf} />
                </td>
                <td>
                  {s.estado === "PENDIENTE" && (
                    <button className="btn btn-primary" onClick={() => setActiva(s)}>Atender</button>
                  )}
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={7}>No hay solicitudes.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
