import { useEffect, useState } from "react";
import AppLayout from "../reutilizables/AppLayout";
import { ordenesInvestigacionApi } from "../api/ordenesInvestigacion";
import BotonesPdfOrden from "../reutilizables/BotonesPdfOrden";

const nombreArea = (v) => (v === "POLICIAL" ? "Policial" : v === "ANALISIS" ? "Análisis" : v);

export default function OrdenesInvestigacionRecibidas() {
  const [lista, setLista] = useState([]);
  const [pdfsPorOrden, setPdfsPorOrden] = useState({});
  const [error, setError] = useState("");

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
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { cargar(); }, []);

  const verPdf = (ordenId, archivoId) =>
    ordenesInvestigacionApi.abrirPdf(ordenId, archivoId).catch((e) => setError(e.message));

  async function atender(id) {
    setError("");
    try {
      await ordenesInvestigacionApi.atender(id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppLayout title="Órdenes de investigación recibidas">
      {error && <div className="status-banner error">{error}</div>}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th><th>MP</th><th>Carpeta</th><th>Área</th><th>Reseña</th>
              <th>Estado</th><th>Oficio (PDF)</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.id}>
                <td>{String(o.created_at).slice(0, 10)}</td>
                <td>{o.nombre_mp}</td>
                <td>{o.numero_carpeta}</td>
                <td>{nombreArea(o.area)}</td>
                <td>{o.breve_resena}</td>
                <td>{o.estado === "ATENDIDA" ? `Atendida${o.nombre_aic ? ` (${o.nombre_aic})` : ""}` : "Pendiente"}</td>
                <td><BotonesPdfOrden ordenId={o.id} pdfs={pdfsPorOrden[o.id]} onVer={verPdf} /></td>
                <td>
                  {o.estado === "PENDIENTE" && (
                    <button className="btn btn-primary" onClick={() => atender(o.id)}>
                      Marcar atendida
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={8}>No hay órdenes de investigación.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}