import { useEffect, useState } from "react";
import AppLayout from "../../reutilizables/AppLayout";
import PeticionCard from "../../reutilizables/PeticionCard";
import { peticionesApi } from "../../api/peticiones";
import { useAuth } from "../../context/AuthContext";

const INTERVALO_MS = 30000;

export default function PorFirmar() {
  const { user } = useAuth();
  const esAdmin = user?.rol === "Administrador";
  const puedeFirmar = esAdmin || user?.rol === "Receptor" || user?.rol === "AIC";
  const nombreUsuario = [user?.nombre, user?.apellidos].filter(Boolean).join(" ");

  const [peticiones, setPeticiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function cargar() {
    peticionesApi
      .porFirmar()
      .then((lista) => {
        setPeticiones(lista);
        setError("");
      })
      .catch((err) => setError(err.message || "No se pudo cargar la lista de llamados por firmar."))
      .finally(() => setLoading(false));
  }

  // Carga inicial y actualización automática para ver los llamados nuevos sin recargar
  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <AppLayout title="Por firmar">
      <div className="page-heading">
        <p>
          Llamados con PDF cargado que esperan la firma de recepción.
          {!loading && peticiones.length > 0 ? ` Pendientes: ${peticiones.length}.` : ""}
        </p>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}

      {loading ? (
        <div className="table-empty">Cargando...</div>
      ) : peticiones.length === 0 ? (
        <div className="card">
          <div className="table-empty">No hay llamados pendientes de firma.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {peticiones.map((p) => (
            <PeticionCard
              key={p.id}
              p={p}
              esAdmin={esAdmin}
              puedeFirmar={puedeFirmar}
              nombreUsuario={nombreUsuario}
              onFirmado={cargar}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}