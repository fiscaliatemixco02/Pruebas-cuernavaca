import { useState } from "react";
import AppLayout from "../../reutilizables/AppLayout";
import { api } from "../../api/client";

export default function Respaldo() {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function descargar() {
    setError("");
    setAviso("");
    setDescargando(true);
    try {
      const blob = await api.getBlob("/respaldo");
      const fecha = new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD en hora local
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `respaldo-${fecha}.zip`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      setAviso("Respaldo generado. Revisa tu carpeta de descargas.");
    } catch (err) {
      setError(err.message || "No se pudo generar el respaldo.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <AppLayout title="Respaldo">
      <div className="page-heading">
        <p>Descarga una copia de toda la información del sistema en un solo archivo .zip.</p>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}
      {aviso ? <div className="status-banner success">{aviso}</div> : null}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Respaldo completo</h3>
        <p style={{ marginTop: 0 }}>El archivo incluye:</p>
        <ul>
          <li>Los datos de todas las tablas: peticiones, usuarios, carpetas, bitácora, notificaciones y demás.</li>
          <li>Los PDF de entrega cargados por los peritos.</li>
        </ul>
        <p>
          <strong>Guárdalo en un lugar seguro:</strong> contiene las contraseñas cifradas de los usuarios.
          Según la cantidad de PDF, puede tardar unos momentos en generarse.
        </p>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={descargar} disabled={descargando}>
            {descargando ? "Generando respaldo..." : "Descargar respaldo (.zip)"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}