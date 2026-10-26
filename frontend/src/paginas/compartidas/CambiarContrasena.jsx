// frontend/src/paginas/compartidas/CambiarContrasena.jsx
// Cualquier usuario con sesión cambia su propia contraseña (usa PUT /api/auth/cambiar-contrasena).

import { useState } from "react";
import AppLayout from "../../reutilizables/AppLayout";
import { TextField } from "../../reutilizables/Field";
import { api } from "../../api/client";

export default function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setAviso("");

    if (!actual || !nueva || !confirmar) return setError("Llena los tres campos.");
    if (nueva.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    if (nueva !== confirmar) return setError("La confirmación no coincide con la nueva contraseña.");
    if (nueva === actual) return setError("La nueva contraseña debe ser distinta a la actual.");

    setGuardando(true);
    try {
      await api.put("/auth/cambiar-contrasena", {
        contrasenaActual: actual,
        nuevaContrasena: nueva,
      });
      setAviso("Contraseña actualizada correctamente.");
      setActual("");
      setNueva("");
      setConfirmar("");
    } catch (err) {
      setError(err.message || "No se pudo cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <AppLayout title="Cambiar contraseña">
      {error ? <div className="status-banner error">{error}</div> : null}
      {aviso ? <div className="status-banner success">{aviso}</div> : null}

      <form className="card" onSubmit={guardar} style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <TextField
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            required
          />
          <TextField
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            hint="Mínimo 8 caracteres"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            required
          />
          <TextField
            label="Confirmar nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
          />
        </div>

        <div className="btn-row end" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" type="submit" disabled={guardando}>
            {guardando ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}