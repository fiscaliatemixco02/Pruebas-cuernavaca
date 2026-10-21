// frontend/src/paginas/perito/InformeInicial.jsx
// El Policía sube el informe inicial (carpeta + iniciales de las víctimas + PDFs).
// El Policía ve solo los suyos.

import AppLayout from "../../reutilizables/AppLayout";
import DocumentosPoliciales from "../../reutilizables/documentosPoliciales";
import { informesInicialesApi } from "../../api/documentosPoliciales";
import { useAuth } from "../../context/AuthContext";

export default function InformeInicial() {
  const { user } = useAuth();
  const puedeSubir = user?.rol === "Policia";

  return (
    <AppLayout title="Informe inicial">
      <DocumentosPoliciales
        api={informesInicialesApi}
        puedeSubir={puedeSubir}
        etiquetaIniciales="Iniciales de las víctimas"
        ayudaIniciales="Si son varias, sepáralas con coma. Ejemplo: A.B.C., D.E.F."
        mensajeGuardado="Informe inicial guardado correctamente."
      />
    </AppLayout>
  );
}