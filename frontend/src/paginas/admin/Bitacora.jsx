import { useEffect, useState } from "react";
import AppLayout from "../../reutilizables/AppLayout";
import { bitacoraApi } from "../../api/bitacora";

export default function Bitacora() {
  const [registros, setRegistros] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bitacoraApi
      .listar()
      .then(setRegistros)
      .catch((err) => setError(err.message || "No se pudo cargar la bitácora."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout title="Bitácora">
      {error ? <div className="status-banner error">{error}</div> : null}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Número de llamado</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Modificación</th>
              <th>Realizado por</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="table-empty" colSpan={5}>Cargando...</td>
              </tr>
            ) : registros.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={5}>Aún no hay movimientos registrados.</td>
              </tr>
            ) : (
              registros.map((r, i) => (
                <tr key={r.id ?? i}>
                  <td>{r.numero_llamado}</td>
                  <td>{r.fecha}</td>
                  <td>{r.hora}</td>
                  <td>{r.modificacion}</td>
                  <td>{r.realizado_por}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
