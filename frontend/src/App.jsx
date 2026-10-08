import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./reutilizables/ProtectedRoute";

import Estadisticas from "./paginas/Estadisticas";
import Notificaciones from "./paginas/Notificaciones";
import PeticionPerito from "./paginas/PeticionPerito";
import Login from "./paginas/login";
import CrearCuenta from "./paginas/CrearCuenta";
import Home from "./paginas/Home";
import NuevaPeticion from "./paginas/NuevaPeticion";
import BuscarPeticion from "./paginas/BuscarPeticion";
import EditarPeticion from "./paginas/EditarPeticion";
import Bitacora from "./paginas/Bitacora";
import Usuarios from "./paginas/Usuarios";
import Carpetas from "./paginas/Carpetas";
import { VISTAS } from "./paginas/permisos";
import PorFirmar from "./paginas/PorFirmar";
import Respaldo from "./paginas/Respaldo";
import SolicitudMP from "./paginas/SolicitudMP";
import SolicitudesRecibidas from "./paginas/SolicitudesRecibidas";

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
          path="/solicitudes-recibidas"
          element={<ProtectedRoute roles={VISTAS.solicitudesRecibidas}><SolicitudesRecibidas /></ProtectedRoute>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}