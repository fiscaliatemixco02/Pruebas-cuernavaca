import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../reutilizables/AppLayout";
import { usuariosApi } from "../../api/usuarios";

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [editandoId, setEditandoId] = useState(null);
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [avisoEsError, setAvisoEsError] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  function cargar() {
    setLoading(true);
    usuariosApi
      .listar()
      .then(setUsuarios)
      .catch((err) => setError(err.message || "No se pudo cargar la lista de usuarios."))
      .finally(() => setLoading(false));
  }

  function mostrarAviso(texto, esError = false) {
    setAviso(texto);
    setAvisoEsError(esError);
  }

  function iniciarCambioContrasena(id) {
    setAviso("");
    setEditandoId(id);
    setNuevaContrasena("");
  }

  function cancelarCambioContrasena() {
    setEditandoId(null);
    setNuevaContrasena("");
  }

async function guardarContrasena(id) {
  if (!nuevaContrasena || nuevaContrasena.length < 8) {
    mostrarAviso("La nueva contraseña debe tener al menos 8 caracteres.", true);
    return;
  }
  setGuardando(true);
  setAviso("");
  try {
    // Se envía como OBJETO { id, nuevaContrasena }
    await usuariosApi.cambiarContrasena({ id, nuevaContrasena });
    mostrarAviso("Contraseña actualizada correctamente.");
    cancelarCambioContrasena();
  } catch (err) {
    mostrarAviso(err.message || "No se pudo actualizar la contraseña.", true);
  } finally {
    setGuardando(false);
  }
}

  return (
    <AppLayout title="Personal">
      <div className="btn-row" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
        <Link className="btn btn-primary" to="/crear-cuenta">
          Crear cuenta
        </Link>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}
      {aviso ? (
        <div className={"status-banner " + (avisoEsError ? "error" : "success")}>{aviso}</div>
      ) : null}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Materia</th>
              <th>Correo</th>
              <th>Contraseña</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="table-empty" colSpan={5}>Cargando...</td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={5}>No hay usuarios registrados.</td>
              </tr>
            ) : (
              usuarios.map((u, i) => (
                <tr key={u.id ?? i}>
                  <td>{[u.nombre, u.apellidos].filter(Boolean).join(" ")}</td>
                  <td>{u.rol}</td>
                  <td>{u.materia || "—"}</td>
                  <td>{u.correo || "—"}</td>
                  <td>
                    {editandoId === u.id ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="password"
                          className="field-input"
                          placeholder="Nueva contraseña"
                          value={nuevaContrasena}
                          onChange={(e) => setNuevaContrasena(e.target.value)}
                          style={{ minWidth: 150 }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={guardando}
                          onClick={() => guardarContrasena(u.id)}
                        >
                          {guardando ? "Guardando..." : "Guardar"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={cancelarCambioContrasena}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span>••••••••</span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => iniciarCambioContrasena(u.id)}
                        >
                          Cambiar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}