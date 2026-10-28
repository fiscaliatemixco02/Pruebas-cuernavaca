import { Navigate } from "react-router-dom";
import AppLayout from "../../reutilizables/AppLayout";
import { useAuth } from "../../context/AuthContext";
import "./Home.css";

export default function Home() {
  const { user } = useAuth();

  // El Creador de Cuentas solo tiene la vista de crear cuenta
  if (user?.rol === "Creador de Cuentas") {
    return <Navigate to="/crear-cuenta" replace />;
  }

  return (
    <AppLayout>
      <div className="home-hero">
        <h2>
          Hola {user?.nombre || "[Nombre]"}, rol: {user?.rol || "[el que tenga]"}.
          <br />
          ¡Nos alegra verte de nuevo!
        </h2>
      </div>
    </AppLayout>
  );
}