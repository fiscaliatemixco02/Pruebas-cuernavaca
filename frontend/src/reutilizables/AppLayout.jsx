import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth, iniciales } from "../context/AuthContext";
import { puedeVer } from "../paginas/permisos";
import usePendientes from "../reutilizables/usePendientes";
import useTrabajoPendiente from "../reutilizables/useTrabajoPendiente";
import { notificacionesApi } from "../api/notificaciones";
import fiscaliaLogo from "../assets/FISCALIA_LOGO.png";
import "./AppLayout.css";

const ICONS = {
  inicio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3.5a1 1 0 0 0 1-1v-9" />
    </svg>
  ),
  nuevo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M12 12.5v5M9.5 15h5" />
    </svg>
  ),
  personal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16.5 5.5A3.2 3.2 0 0 1 17 11.9" />
      <path d="M18.5 14.3c2 .6 3.5 2.7 3.5 5.2" />
    </svg>
  ),
  expedientes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13h7M8.5 16.5h7" />
    </svg>
  ),
  estadisticas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12V3.6A8.4 8.4 0 1 1 3.6 12" />
      <path d="M12 12 20.4 9.6A8.4 8.4 0 0 0 12 3.6Z" />
    </svg>
  ),
  notificaciones: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.5 6 1.5 6h-15S6 13.5 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  crearCuenta: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  ),
  editar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
};

// "vista" debe coincidir con las claves de VISTAS en permisos.jsx
const NAV_ITEMS = [
  { to: "/", label: "Inicio", icon: "inicio", end: true, vista: "inicio" },
  { to: "/peticiones/nueva", label: "Nuevo Registro", icon: "nuevo", vista: "nuevoRegistro" },
  { to: "/solicitud-mp", label: "Solicitud MP", icon: "nuevo", vista: "solicitudMP" },
  { to: "/usuarios", label: "Personal", icon: "personal", vista: "usuarios" },
  { to: "/peticiones/buscar", label: "Expedientes", icon: "expedientes", expandable: true, vista: "expedientes" },
  { to: "/por-firmar", label: "Por Firmar", icon: "expedientes", vista: "porFirmar" },
  { to: "/solicitudes-recibidas", label: "Solicitudes MP", icon: "expedientes", vista: "solicitudesRecibidas" },
  { to: "/peticiones/editar", label: "Editar petición", icon: "editar", vista: "editarPeticion" },
  { to: "/bitacora", label: "Bitácora", icon: "personal", vista: "bitacora" },
  { to: "/estadisticas", label: "Estadísticas", icon: "estadisticas", vista: "estadisticas" },
  { to: "/notificaciones", label: "Notificaciones", icon: "notificaciones", vista: "notificaciones" },
  { to: "/crear-cuenta", label: "Crear cuenta", icon: "crearCuenta", vista: "crearCuenta" },
  { to: "/carpetas", label: "Carpetas", icon: "expedientes", vista: "carpetas" },
  { to: "/respaldo", label: "Respaldo", icon: "expedientes", vista: "respaldo" },
];

export default function AppLayout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { pendientes, recargar } = usePendientes();

  // Solo se muestran las vistas permitidas para el rol del usuario
  const visibleItems = NAV_ITEMS.filter((item) => puedeVer(user?.rol, item.vista));

  // Qué items del menú llevan puntito rojo
const conteo = useTrabajoPendiente();
const esPerito = user?.rol === "Perito";
const puedeFirmar = user?.rol === "Administrador" || user?.rol === "Receptor";

// El punto se queda mientras haya trabajo pendiente
const puntos = {
  notificaciones: esPerito && conteo.por_entregar > 0,
  porFirmar: puedeFirmar && conteo.por_firmar > 0,
};


  // Al entrar a la pantalla, se marcan como leídas y el punto se apaga
  useEffect(() => {
    const tipo =
      pathname === "/por-firmar" ? "lista_firma" :
      pathname === "/notificaciones" ? "asignada" : null;
    if (!tipo) return;

    const sinLeer = pendientes.filter((n) => n.tipo === tipo);
    if (!sinLeer.length) return;

    Promise.all(sinLeer.map((n) => notificacionesApi.marcarLeida(n.id)))
      .then(recargar)
      .catch(console.error);
  }, [pathname, pendientes, recargar]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="shell">
      <aside className={"sidebar" + (open ? " is-open" : "")}>
        <div className="sidebar-brand">
          <img src={fiscaliaLogo} alt="Escudo Fiscalía General del Estado de Morelos" className="sidebar-brand-icon" />
          <div className="sidebar-brand-text">
            <strong>Fiscalía General</strong>
            <span>Estado de Morelos</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => "sidebar-link" + (isActive ? " is-active" : "")}
            >
              <span className="sidebar-link-icon">{ICONS[item.icon]}</span>
              <span className="sidebar-link-label">{item.label}</span>
              {puntos[item.vista] ? (
                <span
                  aria-label="Pendiente"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#ef4444",
                    boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.25)",
                    flexShrink: 0,
                  }}
                />
              ) : null}
              {item.expandable ? <span className="sidebar-link-chevron">{ICONS.chevron}</span> : null}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          <span className="sidebar-link-icon">{ICONS.logout}</span>
          Cerrar Sesión
        </button>
      </aside>

      {open ? <div className="sidebar-backdrop" onClick={() => setOpen(false)} /> : null}

      <div className="shell-main">
        <header className="shell-topbar">
          <button
            type="button"
            className="shell-menu-btn"
            aria-label="Abrir menú"
            onClick={() => setOpen((v) => !v)}
          >
            {ICONS.menu}
          </button>
          {title ? <h1 className="shell-title">{title}</h1> : <span />}

          <div className="shell-topbar-actions" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="shell-avatar" title={user ? `${user.nombre} ${user.apellidos}` : ""}>
              {iniciales(user)}
            </div>
          </div>
        </header>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}