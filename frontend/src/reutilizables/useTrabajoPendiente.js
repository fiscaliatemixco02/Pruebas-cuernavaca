import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { peticionesApi } from "../api/peticiones";
import { useAuth } from "../context/AuthContext";

// Roles que pueden consultar /api/peticiones/pendientes (igual que en el backend)
const ROLES_CON_PENDIENTES = ["Administrador", "Receptor", "Perito"];

export default function useTrabajoPendiente() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const aplica = ROLES_CON_PENDIENTES.includes(user?.rol);
  const [conteo, setConteo] = useState({ por_firmar: 0, por_entregar: 0 });

  const recargar = useCallback(async () => {
    if (!aplica) return; // MP y Consulta no tienen permiso: evita el 403
    try {
      const res = await peticionesApi.pendientes();
      const d = res?.data ?? res;
      setConteo({
        por_firmar: Number(d?.por_firmar) || 0,
        por_entregar: Number(d?.por_entregar) || 0,
      });
    } catch (e) {
      console.error(e);
    }
  }, [aplica]);

  // Se actualiza al cambiar de pantalla (por ejemplo, después de firmar)
  useEffect(() => {
    recargar();
  }, [pathname, recargar]);

  // Y cada 30 segundos
  useEffect(() => {
    const t = setInterval(recargar, 30000);
    return () => clearInterval(t);
  }, [recargar]);

  return conteo;
}