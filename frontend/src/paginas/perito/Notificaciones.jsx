import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../reutilizables/AppLayout";
import { useAuth } from "../../context/AuthContext";
import { peticionesApi } from "../../api/peticiones";
import "./Notificaciones.css";

const TABS = [
  { value: "todas", label: "Todas" },
  { value: "pendientes", label: "Pendientes" },
  { value: "terminadas", label: "Terminadas" },
];

export default function Notificaciones() {
  const { user } = useAuth();
  const [peticiones, setPeticiones] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("todas");

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    peticionesApi
      .listarAsignadas()
      .then(setPeticiones)
      .catch((err) => setError(err.message || "No se pudieron cargar tus peticiones asignadas."))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const pendientes = useMemo(() => peticiones.filter((r) => !r.entrega_tipo), [peticiones]);
  const terminadas = useMemo(() => peticiones.filter((r) => r.entrega_tipo), [peticiones]);

  const visibles =
    tab === "pendientes" ? pendientes : tab === "terminadas" ? terminadas : peticiones;

  return (
    <AppLayout title="Notificaciones">
      <div className="page-heading">
        <h2>Peticiones asignadas a ti</h2>
        <p>Aquí aparecen las peticiones periciales que te han sido asignadas.</p>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}

      <div className="notif-cards">
        <div className="card notif-card">
          <span className="notif-card-label">Total asignadas</span>
          <span className="notif-card-value">{loading ? "…" : peticiones.length}</span>
        </div>
        <div className="card notif-card is-pending">
          <span className="notif-card-label">Pendientes</span>
          <span className="notif-card-value">{loading ? "…" : pendientes.length}</span>
        </div>
        <div className="card notif-card is-done">
          <span className="notif-card-label">Terminadas</span>
          <span className="notif-card-value">{loading ? "…" : terminadas.length}</span>
        </div>
      </div>

      <div className="notif-tabs">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={"notif-tab" + (tab === t.value ? " is-active" : "")}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card table-empty">Cargando...</div>
      ) : peticiones.length === 0 ? (
        <div className="card table-empty">No tienes peticiones asignadas por el momento.</div>
      ) : visibles.length === 0 ? (
        <div className="card table-empty">
          {tab === "pendientes"
            ? "No tienes peticiones pendientes."
            : "Aún no has terminado ninguna petición."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visibles.map((r) => (
            <div key={r.id} className="card result-card">
              <div className="result-card-meta">
                <div>
                  <span className="label">Llamado</span>
                  <span className="value">{r.numero_llamado}</span>
                </div>
                <div>
                  <span className="label">Fecha</span>
                  <span className="value">{String(r.fecha_recibido).slice(0, 10)}</span>
                </div>
                <div>
                  <span className="label">Materia</span>
                  <span className="value">{r.materia}</span>
                </div>
                <div>
                  <span className="label">Carpeta</span>
                  <span className="value">{r.numero_carpeta}</span>
                </div>
                <div>
                  <span className="label">Estatus</span>
                  <span className="value">
                    {r.entrega_tipo ? (
                      <span className="badge badge-done">Entregado · {r.entrega_tipo}</span>
                    ) : (
                      <span className="badge badge-pending">Pendiente</span>
                    )}
                  </span>
                </div>
              </div>
              <Link className="btn btn-secondary" to={`/peticiones/perito/${r.id}`}>
                Ver detalle
              </Link>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}