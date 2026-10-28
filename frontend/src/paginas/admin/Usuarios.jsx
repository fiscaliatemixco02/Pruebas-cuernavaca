import { useEffect, useRef, useState } from "react";
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

  // Ver contraseña: pide la contraseña del propio administrador
  const [verId, setVerId] = useState(null);
  const [contrasenaAdmin, setContrasenaAdmin] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [visibles, setVisibles] = useState({}); // { [idUsuario]: contraseña en texto }
  const temporizadores = useRef({});

  useEffect(() => {
    const t = temporizadores.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

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

  function iniciarVerContrasena(id) {
    setAviso("");
    setEditandoId(null);
    setVerId(id);
    setContrasenaAdmin("");
  }

  function cancelarVerContrasena() {
    setVerId(null);
    setContrasenaAdmin("");
  }

  function ocultarContrasena(id) {
    clearTimeout(temporizadores.current[id]);
    setVisibles((v) => {
      const copia = { ...v };
      delete copia[id];
      return copia;
    });
  }

  async function confirmarVerContrasena(id) {
    if (!contrasenaAdmin) {
      mostrarAviso("Escribe tu contraseña de administrador.", true);
      return;
    }
    setVerificando(true);
    setAviso("");
    try {
      const { contrasena } = await usuariosApi.verContrasena({ id, contrasenaAdmin });
      setVisibles((v) => ({ ...v, [id]: contrasena }));
      // Se vuelve a ocultar sola a los 30 segundos
      clearTimeout(temporizadores.current[id]);
      temporizadores.current[id] = setTimeout(() => ocultarContrasena(id), 30000);
      cancelarVerContrasena();
    } catch (err) {
      mostrarAviso(err.message || "No se pudo obtener la contraseña.", true);
      setContrasenaAdmin("");
    } finally {
      setVerificando(false);
    }
  }

  function iniciarCambioContrasena(id) {
    setAviso("");
    cancelarVerContrasena();
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
      ocultarContrasena(id);
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
                    ) : verId === u.id ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="password"
                          className="field-input"
                          placeholder="Tu contraseña de administrador"
                          autoFocus
                          value={contrasenaAdmin}
                          onChange={(e) => setContrasenaAdmin(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && confirmarVerContrasena(u.id)}
                          style={{ minWidth: 190 }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={verificando}
                          onClick={() => confirmarVerContrasena(u.id)}
                        >
                          {verificando ? "Verificando..." : "Confirmar"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={cancelarVerContrasena}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {visibles[u.id] !== undefined ? (
                          <>
                            <code style={{ userSelect: "all" }}>{visibles[u.id]}</code>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => ocultarContrasena(u.id)}
                            >
                              Ocultar
                            </button>
                          </>
                        ) : (
                          <>
                            <span>••••••••</span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => iniciarVerContrasena(u.id)}
                            >
                              Ver
                            </button>
                          </>
                        )}
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