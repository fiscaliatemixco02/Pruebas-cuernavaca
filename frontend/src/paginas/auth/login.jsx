import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import fiscaliaLogo from "../../assets/FISCALIA_LOGO.png";
import "./Auth.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [recordar, setRecordar] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(usuario, contrasena, recordar);
      navigate("/");
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
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
