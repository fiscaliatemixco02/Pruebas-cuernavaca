import { useNavigate } from "react-router-dom";
import AppLayout from "../../reutilizables/AppLayout";
import { useAuth } from "../../context/AuthContext";
import PeticionWizard from "./PeticionWizard";

export default function NuevaPeticion() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const texto =
    user?.rol === "AIC"
      ? "Captura los datos del llamado y asigna al policía."
      : user?.rol === "Administrador"
        ? "Captura los datos del llamado y asigna al perito o policía."
        : "Captura los datos del llamado y asigna al perito.";

  return (
    <AppLayout title="Registro de petición">
      <div className="page-heading">
        <p>{texto}</p>
      </div>
      <PeticionWizard mode="nueva" onSaved={() => navigate("/peticiones/buscar")} />
    </AppLayout>
  );
}