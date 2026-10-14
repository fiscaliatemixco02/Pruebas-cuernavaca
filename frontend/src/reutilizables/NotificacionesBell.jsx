import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notificacionesApi } from "../api/notificaciones";

const INTERVALO_MS = 30000;

function hace(valor) {
  const d = new Date(valor);
  if (isNaN(d)) return "";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "justo ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return d.toLocaleDateString("es-MX");
}

const estiloInsignia = {
  display: "inline-block",
  minWidth: 20,
  marginLeft: 8,
  padding: "0 6px",
  borderRadius: 10,
  background: "#c0392b",
  color: "#fff",
  fontSize: 12,
  lineHeight: "20px",
  textAlign: "center",
};

const estiloPanel = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  width: 340,
  maxHeight: 420,
  overflowY: "auto",
  background: "#fff",
  border: "1px solid #dfe3ee",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(20, 30, 60, 0.12)",
  zIndex: 50,
};

export default function NotificacionesBell({ icono }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const conocidas = useRef(null); // ids ya vistos; null = primera carga (no avisa)
  const caja = useRef(null);

  async function cargar() {
    try {
      const data = await notificacionesApi.listar();

      // Aviso del navegador solo para notificaciones nuevas (no en la primera carga)
      if (
        conocidas.current &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        data
          .filter((n) => !n.leida && !conocidas.current.has(n.id))
          .forEach((n) => new Notification("Nuevo aviso", { body: n.mensaje }));
      }

      conocidas.current = new Set(data.map((n) => n.id));
      setItems(data);
    } catch {
      /* si falla una consulta, se reintenta en el siguiente ciclo */
    }
  }

  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, []);

  // Cierra el panel al hacer clic fuera
  useEffect(() => {
    function fuera(e) {
      if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const noLeidas = items.filter((n) => !n.leida).length;

  function alternar() {
    if (!abierto && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setAbierto((v) => !v);
  }

  function abrir(n) {
    setAbierto(false);
    if (!n.leida) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      notificacionesApi.marcarLeida(n.id).catch(() => {});
    }
    if (n.tipo === "solicitud_mp") navigate("/carpetas");
    else navigate(n.tipo === "lista_firma" ? "/por-firmar" : `/peticiones/editar/${n.pet_id}`);
  }

  function marcarTodas() {
    setItems((prev) => prev.map((x) => ({ ...x, leida: true })));
    notificacionesApi.marcarTodas().catch(() => {});
  }

  return (
    <div ref={caja} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={alternar}
        aria-haspopup="true"
        aria-expanded={abierto}
      >
        Notificaciones
        {noLeidas > 0 && <span style={estiloInsignia}>{noLeidas}</span>}
      </button>

      {abierto && (
        <div style={estiloPanel} role="menu">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              borderBottom: "1px solid #eef0f6",
            }}
          >
            <strong>Notificaciones</strong>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                style={{ border: 0, background: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="table-empty" style={{ padding: 16 }}>
              No tienes notificaciones.
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                role="menuitem"
                onClick={() => abrir(n)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  border: 0,
                  borderBottom: "1px solid #eef0f6",
                  background: n.leida ? "transparent" : "#eef3ff",
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: n.leida ? 400 : 600,
                }}
              >
                <div>{n.mensaje}</div>
                <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.65, marginTop: 2 }}>
                  {hace(n.creada_en)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}