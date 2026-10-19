import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../reutilizables/AppLayout";
import { peticionesApi } from "../../api/peticiones";
import { useAuth } from "../../context/AuthContext";

export default function BuscarPeticion() {
  const { user } = useAuth();
  const esAdmin = user?.rol === "Administrador";

  const [filtros, setFiltros] = useState({ numero_llamado: "", perito: "", fecha: "", numero_carpeta: "" });
  const [resultados, setResultados] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setFiltros((f) => ({ ...f, [field]: value }));
  }

  async function buscar(campo) {
    const valor = (filtros[campo] || "").trim();

    if (!valor) {
      setResultados(null);
      setError("Escribe un dato en el campo antes de buscar.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const data = await peticionesApi.buscar({ [campo]: valor });
      setResultados(data);
    } catch (err) {
      setError(err.message || "No se pudo completar la búsqueda.");
      setResultados([]);
    } finally {
      setLoading(false);
    }
  }

  function formatearFecha(f) {
    return f ? String(f).slice(0, 10) : "";
  }

  return (
    <AppLayout title="Búsqueda de petición">
      <div className="card">
        <div className="search-row">
          <label>Número de llamado:</label>
          <input
            className="field-input"
            value={filtros.numero_llamado}
            onChange={(e) => update("numero_llamado", e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => buscar("numero_llamado")} disabled={loading}>
            Buscar
          </button>
        </div>

        <div className="search-row">
          <label>Perito asignado:</label>
          <input
            className="field-input"
            value={filtros.perito}
            onChange={(e) => update("perito", e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => buscar("perito")} disabled={loading}>
            Buscar
          </button>
        </div>

        <div className="search-row">
          <label>Fecha:</label>
          <input
            type="date"
            className="field-input"
            value={filtros.fecha}
            onChange={(e) => update("fecha", e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => buscar("fecha")} disabled={loading}>
            Buscar
          </button>
        </div>

        <div className="search-row" style={{ marginBottom: 0 }}>
          <label>Número de carpeta:</label>
          <input
            className="field-input"
            value={filtros.numero_carpeta}
            onChange={(e) => update("numero_carpeta", e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => buscar("numero_carpeta")} disabled={loading}>
            Buscar
          </button>
        </div>
      </div>

      {error ? <div className="status-banner error" style={{ marginTop: 20 }}>{error}</div> : null}

      {resultados !== null && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {resultados.length === 0 ? (
            <div className="card table-empty">No se encontraron peticiones con esos criterios.</div>
          ) : (
            resultados.map((r) => (
              <div key={r.id} className="card result-card">
                <div className="result-card-meta">
                  <div>
                    <span className="label">Llamado</span>
                    <span className="value">{r.numero_llamado}</span>
                  </div>
                  <div>
                    <span className="label">Fecha</span>
                    <span className="value">{formatearFecha(r.fecha_recibido)}</span>
                  </div>
                  <div>
                    <span className="label">Perito</span>
                    <span className="value">{r.nombre_perito || "Sin asignar"}</span>
                  </div>
                  <div>
                    <span className="label">Materia</span>
                    <span className="value">{r.materia}</span>
                  </div>
                  <div>
                    <span className="label">Carpeta</span>
                    <span className="value">{r.numero_carpeta}</span>
                  </div>
                </div>
                <Link className="btn btn-secondary" to={`/peticiones/editar/${r.id}`}>
                  {esAdmin ? "Ver / editar" : "Ver"}
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </AppLayout>
  );
}