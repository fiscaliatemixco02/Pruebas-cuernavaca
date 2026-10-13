import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../reutilizables/AppLayout";
import { carpetasApi } from "../api/carpetas";
import { peticionesApi } from "../api/peticiones";
import { useAuth } from "../context/AuthContext";

function formatoFechaHora(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  return isNaN(d) ? String(valor) : d.toLocaleString("es-MX");
}

// "2026-09-29T06:00:00.000Z" -> "2026-09-29"
function soloFecha(valor) {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}T/.test(valor) ? valor.slice(0, 10) : valor;
}

/* Tarjeta de una petición: datos, estado del PDF y firma de recepción.
   Los PDF se consultan desde "Ver / editar". */
function PeticionCard({ p, esAdmin, puedeFirmar, nombreUsuario, onFirmado }) {
  const [entrega, setEntrega] = useState(undefined); // undefined = cargando, null = sin PDF
  const [abierto, setAbierto] = useState(false);
  const [contrasena, setContrasena] = useState("");
  const [firmando, setFirmando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    peticionesApi
      .obtenerEntrega(p.id)
      .then((e) => vivo && setEntrega(e))
      .catch(() => vivo && setEntrega(null));
    return () => {
      vivo = false;
    };
  }, [p.id]);

  function cancelar() {
    setAbierto(false);
    setContrasena("");
    setError("");
  }

  async function firmar(e) {
    e.preventDefault();
    if (!contrasena) {
      setError("Escribe tu contraseña para firmar.");
      return;
    }
    setFirmando(true);
    setError("");
    try {
      await peticionesApi.firmar(p.id, contrasena);
      cancelar();
      onFirmado();
    } catch (err) {
      setError(err.message || "No se pudo firmar la entrega.");
    } finally {
      setFirmando(false);
    }
  }

  const firmada = Boolean(p.firmado_en);

  return (
    <div className="card result-card">
      <div className="result-card-meta">
        <div>
          <span className="label">Llamado</span>
          <span className="value">{p.numero_llamado}</span>
        </div>
        <div>
          <span className="label">Fecha</span>
          <span className="value">{soloFecha(p.fecha_recibido)}</span>
        </div>
        <div>
          <span className="label">Perito</span>
          <span className="value">{p.nombre_perito || "Sin asignar"}</span>
        </div>
        <div>
          <span className="label">Materia</span>
          <span className="value">{p.materia}</span>
        </div>
        <div>
          <span className="label">MP</span>
          <span className="value">{p.nombre_ministerio_publico}</span>
        </div>
        <div>
          <span className="label">Estado</span>
          <span className="value">{firmada ? "Completada" : "Pendiente"}</span>
        </div>
      </div>

      {/* Estado del PDF (para verlo, usa "Ver / editar") */}
      <div style={{ marginTop: 12 }}>
        <span className="label">Entrega (PDF)</span>
        {entrega === undefined ? (
          <div className="table-empty">Cargando...</div>
        ) : entrega === null ? (
          <div className="table-empty">El perito todavía no carga el PDF.</div>
        ) : (
          <span className="value">Cargado</span>
        )}
      </div>

      {/* Firma de recepción */}
      {entrega && (
        <div style={{ marginTop: 12 }}>
          <span className="label">Firma de recepción</span>

          {firmada ? (
            <div className="status-banner success" style={{ marginTop: 6 }}>
              Recibida por {p.nombre_quien_recibe || "—"} el {formatoFechaHora(p.firmado_en)}
            </div>
          ) : puedeFirmar ? (
            abierto ? (
              <form onSubmit={firmar} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                <span>
                  Firmarás como <strong>{nombreUsuario}</strong>. Confirma con tu contraseña.
                </span>
                <input
                  type="password"
                  className="field-input"
                  placeholder="Tu contraseña"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  style={{ maxWidth: 280 }}
                />
                {error ? <div className="status-banner error">{error}</div> : null}
                <div className="btn-row">
                  <button type="submit" className="btn btn-primary" disabled={firmando}>
                    {firmando ? "Firmando..." : "Confirmar firma"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={cancelar}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="btn-row" style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-primary" onClick={() => setAbierto(true)}>
                  Firmar entrega
                </button>
              </div>
            )
          ) : (
            <div className="table-empty">Pendiente de firma por el receptor.</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <Link className="btn btn-secondary" to={`/peticiones/editar/${p.id}`}>
          {esAdmin ? "Ver / editar" : "Ver"}
        </Link>
      </div>
    </div>
  );
}

export default function Carpetas() {
  const { user } = useAuth();
  const esAdmin = user?.rol === "Administrador";
  const puedeFirmar = esAdmin || user?.rol === "Receptor";
  const nombreUsuario = [user?.nombre, user?.apellidos].filter(Boolean).join(" ");

  const [carpetas, setCarpetas] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [seleccionada, setSeleccionada] = useState(null);
  const [peticiones, setPeticiones] = useState([]);
  const [cargandoPeticiones, setCargandoPeticiones] = useState(false);
  const [errorPeticiones, setErrorPeticiones] = useState("");

  useEffect(() => {
    carpetasApi
      .listar()
      .then(setCarpetas)
      .catch((err) => setError(err.message || "No se pudo cargar la lista de carpetas."))
      .finally(() => setLoading(false));
  }, []);

  async function handleEliminar(id) {
    setError("");
    try {
      await carpetasApi.eliminar(id);
      setCarpetas((prev) => prev.filter((c) => c.id !== id));
      if (seleccionada?.id === id) {
        setSeleccionada(null);
        setPeticiones([]);
      }
    } catch (err) {
      setError(err.message || "No se pudo eliminar la carpeta.");
    }
  }

  function cargarPeticiones(carpeta) {
    setErrorPeticiones("");
    setCargandoPeticiones(true);
    peticionesApi
      .buscar({ numero_carpeta: carpeta.numero_carpeta })
      .then(setPeticiones)
      .catch((err) => {
        setErrorPeticiones(err.message || "No se pudo cargar el contenido de la carpeta.");
        setPeticiones([]);
      })
      .finally(() => setCargandoPeticiones(false));
  }

  function verContenido(carpeta) {
    if (seleccionada?.id === carpeta.id) {
      setSeleccionada(null);
      setPeticiones([]);
      return;
    }
    setSeleccionada(carpeta);
    cargarPeticiones(carpeta);
  }

  return (
    <AppLayout title="Carpetas">
      <div className="page-heading">
        <p>Las carpetas se crean automáticamente al registrar una petición.</p>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}

      <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Número de carpeta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="table-empty" colSpan={2}>Cargando...</td>
              </tr>
            ) : carpetas.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={2}>No hay carpetas registradas.</td>
              </tr>
            ) : (
              carpetas.map((c) => (
                <tr
                  key={c.id}
                  className={seleccionada?.id === c.id ? "is-active" : ""}
                  style={{ cursor: "pointer" }}
                  onClick={() => verContenido(c)}
                >
                  <td>{c.numero_carpeta}</td>
                  <td style={{ textAlign: "right" }}>
                    {esAdmin && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEliminar(c.id);
                        }}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {seleccionada && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Contenido de la carpeta {seleccionada.numero_carpeta}</h3>

          {errorPeticiones ? <div className="status-banner error">{errorPeticiones}</div> : null}

          {cargandoPeticiones ? (
            <div className="table-empty">Cargando...</div>
          ) : peticiones.length === 0 ? (
            <div className="table-empty">Esta carpeta todavía no tiene ninguna petición guardada.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {peticiones.map((p) => (
                <PeticionCard
                  key={p.id}
                  p={p}
                  esAdmin={esAdmin}
                  puedeFirmar={puedeFirmar}
                  nombreUsuario={nombreUsuario}
                  onFirmado={() => cargarPeticiones(seleccionada)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}