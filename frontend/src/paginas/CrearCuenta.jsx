import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../reutilizables/AppLayout";
import { authApi } from "../api/auth";
import { peticionesApi } from "../api/peticiones";
import { SelectField, TextField } from "../reutilizables/Field";
import "./Auth.css";

const ROLES = ["Administrador", "Receptor", "Perito", "Consulta", "Ministerio Publico"];

export default function CrearCuenta() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    usuario: "",
    contrasena: "",
    nombre: "",
    apellidos: "",
    rol: "",
    materia: "",
  });

   // Catálogo de materias para el combo
  const [materias, setMaterias] = useState([]);
  const [cargandoMaterias, setCargandoMaterias] = useState(true);

  // Estado del correo verificado: "" -> nada enviado, "enviado" -> esperando
  // código, "verificado" -> ya se confirmó y se puede crear la cuenta.
  const [estadoVerificacion, setEstadoVerificacion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [correoVerificado, setCorreoVerificado] = useState(""); // el correo que quedó verificado
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [confirmandoCodigo, setConfirmandoCodigo] = useState(false);
  const [avisoVerificacion, setAvisoVerificacion] = useState("");
 
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
 
  useEffect(() => {
    peticionesApi
      .listarMaterias()
      .then(setMaterias)
      .catch(() => setMaterias([]))
      .finally(() => setCargandoMaterias(false));
  }, []);
 
  // value = nombre para que el backend siga recibiendo `materia` como texto.
  // Si prefieres mandar el id, cambia value a m.id y ajusta el backend.
  const opcionesMaterias = materias.map((m) => ({ value: m.nombre, label: m.nombre }));
 
  const esPerito = form.rol === "Perito";
 
  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "usuario" && value !== correoVerificado) {
      setEstadoVerificacion("");
      setCorreoVerificado("");
      setCodigo("");
    }
  }
 
  function handleRolChange(value) {
    setForm((f) => ({
      ...f,
      rol: value,
      // Si deja de ser perito, se limpia la materia
      materia: value === "Perito" ? f.materia : "",
    }));
  }
 
  async function handleEnviarCodigo() {
    setAvisoVerificacion("");
    setError("");
    if (!form.usuario.trim()) {
      setAvisoVerificacion("Captura el correo antes de enviar el código.");
      return;
    }
    setEnviandoCodigo(true);
    try {
      await authApi.enviarCodigoVerificacion(form.usuario.trim());
      setEstadoVerificacion("enviado");
      setAvisoVerificacion(`Enviamos un código de verificación a ${form.usuario.trim()}.`);
    } catch (err) {
      setAvisoVerificacion(err.message || "No se pudo enviar el código de verificación.");
    } finally {
      setEnviandoCodigo(false);
    }
  }
 
  async function handleConfirmarCodigo() {
    setAvisoVerificacion("");
    if (!codigo.trim()) {
      setAvisoVerificacion("Captura el código que llegó al correo.");
      return;
    }
    setConfirmandoCodigo(true);
    try {
      await authApi.confirmarCodigoVerificacion(form.usuario.trim(), codigo.trim());
      setEstadoVerificacion("verificado");
      setCorreoVerificado(form.usuario.trim());
      setAvisoVerificacion("Correo verificado correctamente.");
    } catch (err) {
      setAvisoVerificacion(err.message || "El código no es correcto.");
    } finally {
      setConfirmandoCodigo(false);
    }
  }
 
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.usuario || !form.contrasena || !form.nombre || !form.apellidos || !form.rol) {
      setError("Usuario, contraseña, nombre, apellidos y rol son obligatorios.");
      return;
    }
    if (esPerito && !form.materia) {
      setError("La materia es obligatoria para el rol de perito.");
      return;
    }
    if (estadoVerificacion !== "verificado" || correoVerificado !== form.usuario.trim()) {
      setError("Verifica el correo (envía y confirma el código) antes de crear la cuenta.");
      return;
    }
    setLoading(true);
    try {
      await authApi.registrar(form);
      navigate("/usuarios");
    } catch (err) {
      setError(err.message || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  }
 
  return (
    <AppLayout title="Crear cuenta">
      <div className="auth-card auth-card-wide" style={{ margin: "0 auto" }}>
        <div className="auth-heading">
          <h1>Crear cuenta</h1>
          <p>REGISTRA LOS DATOS DEL NUEVO USUARIO</p>
        </div>
 
        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <div className="status-banner error">{error}</div> : null}
 
          <div>
            <TextField
              label="Usuario (correo)"
              hint="Correo con el que la persona iniciará sesión"
              type="email"
              value={form.usuario}
              onChange={(e) => update("usuario", e.target.value)}
              required
            />
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleEnviarCodigo}
                disabled={enviandoCodigo || !form.usuario.trim()}
              >
                {enviandoCodigo
                  ? "Enviando..."
                  : estadoVerificacion === "enviado" || estadoVerificacion === "verificado"
                  ? "Reenviar código"
                  : "Enviar código de verificación"}
              </button>
              {estadoVerificacion === "verificado" && correoVerificado === form.usuario.trim() ? (
                <span className="status-banner success" style={{ margin: 0 }}>
                  Correo verificado ✓
                </span>
              ) : null}
            </div>
 
            {estadoVerificacion === "enviado" ? (
              <div className="form-grid two-col" style={{ marginTop: 12, alignItems: "end" }}>
                <TextField
                  label="Código de verificación"
                  hint="Revisa la bandeja de entrada de ese correo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  maxLength={6}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmarCodigo}
                  disabled={confirmandoCodigo || !codigo.trim()}
                  style={{ height: 44 }}
                >
                  {confirmandoCodigo ? "Confirmando..." : "Confirmar código"}
                </button>
              </div>
            ) : null}
 
            {avisoVerificacion ? (
              <p className="field-hint" style={{ marginTop: 8 }}>
                {avisoVerificacion}
              </p>
            ) : null}
          </div>
 
          <TextField
            label="Contraseña"
            type="password"
            value={form.contrasena}
            onChange={(e) => update("contrasena", e.target.value)}
            required
          />
          <TextField
            label="Nombre(s)"
            value={form.nombre}
            onChange={(e) => update("nombre", e.target.value)}
            required
          />
          <TextField
            label="Apellidos"
            value={form.apellidos}
            onChange={(e) => update("apellidos", e.target.value)}
            required
          />
          <SelectField
            label="Rol"
            options={ROLES}
            value={form.rol}
            onChange={(e) => handleRolChange(e.target.value)}
            required
          />
          <SelectField
            label="Materia"
            hint="Llenar solo en caso de ser perito"
            options={opcionesMaterias}
            placeholder={
              cargandoMaterias ? "Cargando materias..." : "Selecciona una materia..."
            }
            value={form.materia}
            onChange={(e) => update("materia", e.target.value)}
            disabled={!esPerito || cargandoMaterias}
            required={esPerito}
          />
 
          <div className="btn-row">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || estadoVerificacion !== "verificado"}
            >
              {loading ? "Creando..." : "Crear cuenta"}
            </button>
          </div>
          <span className="field-hint">*Campo obligatorio*</span>
          <p className="auth-alt">
            <Link to="/usuarios">Cancelar y volver a Personal</Link>
          </p>
        </form>
      </div>
    </AppLayout>
  );
}

