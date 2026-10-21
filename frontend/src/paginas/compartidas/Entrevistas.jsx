// frontend/src/paginas/compartidas/Entrevistas.jsx
// AIC y Policía suben entrevistas (carpeta + iniciales de la víctima + PDFs).
// El AIC ve todas; el Policía solo las suyas.

import AppLayout from "../../reutilizables/AppLayout";
import DocumentosPoliciales from "../../reutilizables/documentosPoliciales";
import { entrevistasApi } from "../../api/documentosPoliciales";
import { useAuth } from "../../context/AuthContext";

export default function Entrevistas() {
  const { user } = useAuth();
  const puedeSubir = user?.rol === "AIC" || user?.rol === "Policia";

  return (
    <AppLayout title="Entrevistas">
      <DocumentosPoliciales
        api={entrevistasApi}
        puedeSubir={puedeSubir}
        etiquetaIniciales="Iniciales de la víctima"
        ayudaIniciales="Ejemplo: J.L.M."
        mensajeGuardado="Entrevista guardada correctamente."
      />
    </AppLayout>
  );
}