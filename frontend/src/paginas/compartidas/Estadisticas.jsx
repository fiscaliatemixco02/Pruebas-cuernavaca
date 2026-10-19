import { useEffect, useMemo, useState } from "react";
import AppLayout from "../../reutilizables/AppLayout";
import { SelectField } from "../../reutilizables/Field";
import { peticionesApi } from "../../api/peticiones";
import { estadisticasApi } from "../../api/estadisticas";
import ReporteEstadisticoPDF from "../../reutilizables/ReporteEstadisticoPDF";
import "./Estadisticas.css";

const COLORES = [
  "#1c2b4e", "#2c4272", "#3f5f9e", "#5b8ac4", "#7fb0dd",
  "#e0a458", "#d97b56", "#b3564e", "#8c4a6b", "#5c4a8c",
  "#3d6b5c", "#6b9c5a", "#a3b942", "#c9973d", "#9e7b4f",
  "#4f7a9e", "#8a5fa0", "#c95f8f", "#5f9ea0", "#7a7a7a",
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// AJUSTA estas dos líneas a como lo hace tu proyecto (mira tu api/client.js)
const API_URL = "http://localhost:3000/api";
const obtenerToken = () => localStorage.getItem("token");

export default function Estadisticas() {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("todas");

  const [conteos, setConteos] = useState({ dia: 0, semana: 0, mes: 0 });
  const [porMateria, setPorMateria] = useState([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Reporte mensual en PDF
  const hoy = new Date();
  const [repMes, setRepMes] = useState(String(hoy.getMonth() + 1));
  const [repAnio, setRepAnio] = useState(String(hoy.getFullYear()));
  const [descargando, setDescargando] = useState(false);
  const [errorPdf, setErrorPdf] = useState("");

  const esTodas = materiaId === "todas";

  useEffect(() => {
    peticionesApi
      .listarMaterias()
      .then(setMaterias)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError("");

    const tareas = [estadisticasApi.conteos(materiaId)];
    if (esTodas) tareas.push(estadisticasApi.porMateria());

    Promise.all(tareas)
      .then(([conteosData, porMateriaData]) => {
        if (cancelado) return;
        setConteos(conteosData);
        if (esTodas) setPorMateria(porMateriaData || []);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message || "No se pudieron cargar las estadísticas.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [materiaId, esTodas]);

  const totalPorMateria = useMemo(
    () => porMateria.reduce((acc, m) => acc + m.total, 0),
    [porMateria]
  );

  const gradiente = useMemo(() => {
    if (!totalPorMateria) return "conic-gradient(var(--sky-100) 0 100%)";
    let acumulado = 0;
    const segmentos = porMateria
      .filter((m) => m.total > 0)
      .map((m, i) => {
        const inicio = (acumulado / totalPorMateria) * 100;
        acumulado += m.total;
        const fin = (acumulado / totalPorMateria) * 100;
        return `${COLORES[i % COLORES.length]} ${inicio}% ${fin}%`;
      });
    return `conic-gradient(${segmentos.join(", ")})`;
  }, [porMateria, totalPorMateria]);

  const opcionesAnio = useMemo(() => {
    const actual = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => {
      const a = actual - i;
      return { value: String(a), label: String(a) };
    });
  }, []);

  async function descargarReporte() {
    setDescargando(true);
    setErrorPdf("");
    try {
      const resp = await fetch(
        `${API_URL}/peticiones/reporte-mensual?mes=${repMes}&anio=${repAnio}`,
        { headers: { Authorization: `Bearer ${obtenerToken()}` } }
      );
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo generar el PDF.");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `peticiones-${repAnio}-${String(repMes).padStart(2, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorPdf(err.message || "No se pudo descargar el PDF.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <AppLayout title="Estadísticas">
      <div className="stats-toolbar">
        {/* Sin placeholder: la única opción "Todas" es la manual (value "todas") */}
        <SelectField
          label="Materia"
          options={[
            { value: "todas", label: "Todas" },
            ...materias.map((m) => ({ value: m.id, label: m.nombre })),
          ]}
          value={materiaId}
          onChange={(e) => setMateriaId(e.target.value)}
        />
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}

      <div className="card">
        <div className="page-heading" style={{ marginBottom: 16 }}>
          <h2>
            {esTodas ? "Peticiones de todas las materias" : "Peticiones de la materia seleccionada"}
          </h2>
          <p>Número total de peticiones recibidas por periodo.</p>
        </div>
        <div className="stats-cards">
          <div className="card stats-card">
            <span className="stats-card-label">Hoy</span>
            <span className="stats-card-value">{loading ? "…" : conteos.dia}</span>
          </div>
          <div className="card stats-card">
            <span className="stats-card-label">Esta semana</span>
            <span className="stats-card-value">{loading ? "…" : conteos.semana}</span>
          </div>
          <div className="card stats-card">
            <span className="stats-card-label">Este mes</span>
            <span className="stats-card-value">{loading ? "…" : conteos.mes}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="page-heading" style={{ marginBottom: 16 }}>
          <h2>Reporte mensual en PDF</h2>
          <p>Descarga las peticiones recibidas en el mes y año que elijas.</p>
        </div>

        {errorPdf ? <div className="status-banner error">{errorPdf}</div> : null}

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <SelectField
            label="Mes"
            options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
            value={repMes}
            onChange={(e) => setRepMes(e.target.value)}
          />
          <SelectField
            label="Año"
            options={opcionesAnio}
            value={repAnio}
            onChange={(e) => setRepAnio(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={descargarReporte}
            disabled={descargando}
          >
            {descargando ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      </div>
      <ReporteEstadisticoPDF />
      {esTodas ? (
        <div className="card">
          <div className="page-heading" style={{ marginBottom: 16 }}>
            <h2>Peticiones por materia</h2>
            <p>Distribución del total histórico de peticiones entre cada materia pericial.</p>
          </div>

          {loading ? (
            <div className="table-empty">Cargando...</div>
          ) : totalPorMateria === 0 ? (
            <div className="table-empty">Aún no hay peticiones registradas.</div>
          ) : (
            <div className="pie-section">
              <div className="pie-chart" style={{ background: gradiente }} />
              <ul className="pie-legend">
                {porMateria
                  .filter((m) => m.total > 0)
                  .map((m, i) => (
                    <li key={m.materia_id}>
                      <span className="swatch" style={{ background: COLORES[i % COLORES.length] }} />
                      {m.materia}
                      <span className="pie-legend-total">{m.total}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </AppLayout>
  );
}