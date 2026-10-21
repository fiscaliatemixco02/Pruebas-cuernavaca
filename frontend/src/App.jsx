import OrdenInvestigacion from "./paginas/mp/OrdenInvestigacion";
import OrdenesInvestigacionRecibidas from "./paginas/aic/OrdenesInvestigacionRecibidas";

import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./reutilizables/ProtectedRoute";

import Estadisticas from "./paginas/compartidas/Estadisticas";
import Notificaciones from "./paginas/perito/Notificaciones";
import PeticionPerito from "./paginas/perito/PeticionPerito";
import Login from "./paginas/auth/login";
import CrearCuenta from "./paginas/admin/CrearCuenta";
import Home from "./paginas/compartidas/Home";
import NuevaPeticion from "./paginas/compartidas/NuevaPeticion";
import BuscarPeticion from "./paginas/compartidas/BuscarPeticion";
import EditarPeticion from "./paginas/compartidas/EditarPeticion";
import Bitacora from "./paginas/admin/Bitacora";
import Usuarios from "./paginas/admin/Usuarios";
import Carpetas from "./paginas/compartidas/Carpetas";
import { VISTAS } from "./config/permisos";
import PorFirmar from "./paginas/compartidas/PorFirmar";
import Respaldo from "./paginas/admin/Respaldo";
import SolicitudMP from "./paginas/mp/SolicitudMP";
import CarpetasMP from "./paginas/mp/CarpetasMP";
import SolicitudesRecibidas from "./paginas/receptor/SolicitudesRecibidas";
import Entrevistas from "./paginas/compartidas/Entrevistas";
import InformeInicial from "./paginas/perito/InformeInicial";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={<ProtectedRoute roles={VISTAS.inicio}><Home /></ProtectedRoute>}
        />
        <Route
          path="/peticiones/nueva"
          element={<ProtectedRoute roles={VISTAS.nuevoRegistro}><NuevaPeticion /></ProtectedRoute>}
        />
        <Route
          path="/peticiones/buscar"
          element={<ProtectedRoute roles={VISTAS.expedientes}><BuscarPeticion /></ProtectedRoute>}
        />
        <Route
          path="/peticiones/editar"
          element={<ProtectedRoute roles={VISTAS.editarPeticion}><EditarPeticion /></ProtectedRoute>}
        />
        <Route
          path="/peticiones/editar/:id"
          element={<ProtectedRoute roles={VISTAS.verPeticion}><EditarPeticion /></ProtectedRoute>}
        />
        <Route
          path="/carpetas"
          element={<ProtectedRoute roles={VISTAS.carpetas}><Carpetas /></ProtectedRoute>}
        />
        <Route
          path="/estadisticas"
          element={<ProtectedRoute roles={VISTAS.estadisticas}><Estadisticas /></ProtectedRoute>}
        />
        <Route
          path="/notificaciones"
          element={<ProtectedRoute roles={VISTAS.notificaciones}><Notificaciones /></ProtectedRoute>}
        />
        <Route
          path="/peticiones/perito/:id"
          element={<ProtectedRoute roles={VISTAS.notificaciones}><PeticionPerito /></ProtectedRoute>}
        />
        <Route
          path="/usuarios"
          element={<ProtectedRoute roles={VISTAS.usuarios}><Usuarios /></ProtectedRoute>}
        />
        <Route
          path="/crear-cuenta"
          element={<ProtectedRoute roles={VISTAS.crearCuenta}><CrearCuenta /></ProtectedRoute>}
        />
        <Route
          path="/bitacora"
          element={<ProtectedRoute roles={VISTAS.bitacora}><Bitacora /></ProtectedRoute>}
        />
        <Route
          path="/por-firmar"
          element={<ProtectedRoute roles={VISTAS.porFirmar}><PorFirmar /></ProtectedRoute>}
        />
        <Route
          path="/respaldo"
          element={<ProtectedRoute roles={VISTAS.respaldo}><Respaldo /></ProtectedRoute>}
        />

                {/* Ministerio Público */}
        <Route
          path="/solicitud-mp"
          element={<ProtectedRoute roles={VISTAS.solicitudMP}><SolicitudMP /></ProtectedRoute>}
        />
        <Route
          path="/mis-carpetas"
          element={<ProtectedRoute roles={VISTAS.misCarpetas}><CarpetasMP /></ProtectedRoute>}
        />
        <Route
          path="/orden-investigacion"
          element={<ProtectedRoute roles={VISTAS.ordenInvestigacion}><OrdenInvestigacion /></ProtectedRoute>}
        />
        <Route
          path="/ordenes-recibidas"
          element={<ProtectedRoute roles={VISTAS.ordenesRecibidas}><OrdenesInvestigacionRecibidas /></ProtectedRoute>}
        />
        <Route
          path="/solicitudes-recibidas"
          element={<ProtectedRoute roles={VISTAS.solicitudesRecibidas}><SolicitudesRecibidas /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />

        <Route path="/entrevistas" element={<ProtectedRoute roles={VISTAS.entrevistas}><Entrevistas /></ProtectedRoute>} />

        <Route path="/informe-inicial" element={<ProtectedRoute roles={VISTAS.informeInicial}><InformeInicial /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}