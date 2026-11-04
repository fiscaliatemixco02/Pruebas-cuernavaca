import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import fiscaliaLogo from "../../assets/FISCALIA_LOGO.png";
import "./Auth.css";

// Protección contra bots (opcional): si defines VITE_TURNSTILE_SITE_KEY en frontend/.env aparece el
// CAPTCHA de Cloudflare Turnstile y el servidor lo verifica (TURNSTILE_SECRET_KEY en backend/.env).
// Sin esa variable no se muestra nada y el login funciona igual que siempre.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

function Turnstile({ onToken }) {
  const contenedor = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;
    let widgetId;
    let cancelado = false;

    function pintar() {
      if (cancelado || !window.turnstile || !contenedor.current) return;
      widgetId = window.turnstile.render(contenedor.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    }

    let script = document.querySelector("script[data-turnstile]");
    if (window.turnstile) {
      pintar();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.turnstile = "1";
        document.head.appendChild(script);
      }
      script.addEventListener("load", pintar);
    }

    return () => {
      cancelado = true;
      script?.removeEventListener("load", pintar);
      if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={contenedor} />;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [recordar, setRecordar] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [trampa, setTrampa] = useState(""); // campo oculto: una persona nunca lo llena
  const [turnstileToken, setTurnstileToken] = useState("");
  const [reinicioCaptcha, setReinicioCaptcha] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Completa la verificación de seguridad.");
      return;
    }
    setLoading(true);
    try {
      await login(usuario, contrasena, { sitio_web: trampa, turnstileToken });
      navigate("/");
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
      // El token del CAPTCHA es de un solo uso: se pide uno nuevo
      setTurnstileToken("");
      setReinicioCaptcha((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-badge">
          <img src={fiscaliaLogo} alt="Escudo Fiscalía General del Estado de Morelos" />
        </div>
        <div className="auth-heading">
          <h1>Fiscalía General</h1>
          <p>ESTADO DE MORELOS</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <div className="status-banner error">{error}</div> : null}

          <label className="auth-field">
            <span className="auth-field-label">Correo electrónico o placa</span>
            <input
              className="auth-field-input"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="usuario@fiscalia.gob.mx o placa"
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-field-label">Contraseña</span>
            <input
              className="auth-field-input"
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
            />
          </label>

          {/* Trampa para bots: fuera de pantalla y sin foco; si llega con texto, el servidor rechaza el login */}
          <input
            type="text"
            name="sitio_web"
            value={trampa}
            onChange={(e) => setTrampa(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0 }}
          />

          <Turnstile key={reinicioCaptcha} onToken={setTurnstileToken} />

          <label className="auth-remember">
            <input
              type="checkbox"
              checked={recordar}
              onChange={(e) => setRecordar(e.target.checked)}
            />
            Recordarme en este dispositivo
          </label>

          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar al sistema"}
          </button>

          <p className="auth-alt">
            <button type="button" onClick={() => setError("Contacta al administrador del sistema para restablecer tu contraseña.")}>
              ¿Olvidó su contraseña?
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
