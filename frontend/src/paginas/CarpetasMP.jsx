import { useEffect, useState } from "react";
import AppLayout from "../reutilizables/AppLayout";
import { solicitudesMpApi } from "../api/solicitudesMp";

const TIPOS = { dictamen: "Dictamen", informe: "Informe", requerimiento: "Requerimiento" };

const fechaHora = (v) => {
  const d = new Date(v);
  return isNaN(d) ? "" : d.toLocaleString("es-MX");
};

/* Una solicitud del MP: sus oficios y, si el perito ya los subió, la resolución. Solo lectura. */
function SolicitudCard({ s, onError }) {
  const [oficios, setOficios] = useState(undefined); // undefined = cargando
  const [resolucion, setResolucion] = useState(undefined);

  useEffect(() => {
    let vivo = true;
    solicitudesMpApi
      .pdfs(s.id)
      .then((l) => vivo && setOficios(Array.isArray(l) ? l : []))
      .catch(() => vivo && setOficios([]));
    solicitudesMpApi
      .resolucion(s.id)
      .then((l) => vivo && setResolucion(Array.isArray(l) ? l : []))
      .catch(() => vivo && setResolucion([]));
    return () => {
      vivo = false;
    };
  }, [s.id, s.peticion_id]);

  const atendida = s.estado === "ATENDIDA";

  return (
    <div className="card result-card">
      <div className="result-card-meta">
        <div>
          <span className="label">Fecha</span>
          <span className="value">{String(s.created_at).slice(0, 10)}</span>
        </div>
        <div>
          <span className="label">Área</span>
          <span className="value">{s.materia}</span>
        </div>
        <div>
          <span className="label">Estado</span>
          <span className="value">{atendida ? "Atendida" : "En espera"}</span>
        </div>
        <div>
          <span className="label">Número de llamado</span>
          <span className="value">{s.numero_llamado ?? "Pendiente de asignar"}</span>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <span className="label">Reseña</span>
        <div>{s.breve_resena}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        <span className="label">Oficio de solicitud (PDF)</span>
        {oficios === undefined ? (
          <div className="table-empty">Cargando...</div>
        ) : oficios.length === 0 ? (
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => solicitudesMpApi.abrirPdf(s.id).catch((e) => onError(e.message))}
            >
              Ver
            </button>
          </div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
            {oficios.map((p) => (
              <li key={p.id} style={{ marginBottom: 4 }}>
                {p.nombre_original}{" "}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => solicitudesMpApi.abrirPdf(s.id, p.id).catch((e) => onError(e.message))}
                >
                  Ver
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <span className="label">Resolución del perito</span>
        {resolucion === undefined ? (
          <div className="table-empty">Cargando...</div>
        ) : resolucion.length === 0 ? (
          <div className="table-empty">Aún no hay resolución del perito.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
            {resolucion.map((p) => (
              <li key={p.id} style={{ marginBottom: 4 }}>
                <strong>{TIPOS[p.tipo] ?? p.tipo}</strong> · {p.nombre_original}
                {p.subido_en ? ` · ${fechaHora(p.subido_en)}` : ""}{" "}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    solicitudesMpApi.abrirResolucion(s.id, p.id).catch((e) => onError(e.message))
                  }
                >
                  Ver
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CarpetasMP() {
  const [carpetas, setCarpetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [seleccionada, setSeleccionada] = useState(null); // numero_carpeta abierto
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    solicitudesMpApi
      .carpetas()
      .then(setCarpetas)
      .catch((e) => setError(e.message || "No se pudieron cargar tus carpetas."))
      .finally(() => setLoading(false));
  }, []);

  async function abrir(numero) {
    if (seleccionada === numero) {
      setSeleccionada(null);
      setSolicitudes([]);
      return;
    }
    setSeleccionada(numero);
    setError("");
    setCargando(true);
    try {
      // Se vuelve a consultar para ver el estado más reciente (por si ya la atendieron)
      const filas = await solicitudesMpApi.listar();
      setSolicitudes(filas.filter((f) => String(f.numero_carpeta).toUpperCase() === numero));
    } catch (e) {
      setError(e.message || "No se pudo cargar el contenido de la carpeta.");
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <AppLayout title="Carpetas">
      <div className="page-heading">
        <p>Aquí aparecen tus carpetas con sus solicitudes y la resolución del perito cuando ya fue cargada.</p>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}

      <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Número de carpeta</th>
              <th>Solicitudes</th>
              <th>Con resolución</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="table-empty" colSpan={3}>Cargando...</td>
              </tr>
            ) : carpetas.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={3}>Aún no tienes carpetas.</td>
              </tr>
            ) : (
              carpetas.map((c) => (
                <tr
                  key={c.numero_carpeta}
                  className={seleccionada === c.numero_carpeta ? "is-active" : ""}
                  style={{ cursor: "pointer" }}
                  onClick={() => abrir(c.numero_carpeta)}
                >
                  <td>{c.numero_carpeta}</td>
                  <td>{c.total_solicitudes}</td>
                  <td>{c.con_resolucion}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {seleccionada && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Carpeta {seleccionada}</h3>
          {cargando ? (
            <div className="table-empty">Cargando...</div>
          ) : solicitudes.length === 0 ? (
            <div className="table-empty">Esta carpeta no tiene solicitudes.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {solicitudes.map((s) => (
                <SolicitudCard key={s.id} s={s} onError={setError} />
              ))}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}