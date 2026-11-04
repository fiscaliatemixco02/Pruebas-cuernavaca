import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../api/auth";

const AuthContext = createContext(null);

// El modo demo salta el login SOLO en el navegador (no da acceso a datos reales), pero en una
// versión publicada (build de producción) se ignora para que nadie vea pantallas de administrador sin sesión.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true" && !import.meta.env.PROD;
const DEMO_USER = {
  id: 0,
  usuario: "demo",
  nombre: "Usuario",
  apellidos: "Demo",
  rol: "Administrador",
  materia: null,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEMO_MODE ? DEMO_USER : null);
  const [loading, setLoading] = useState(!DEMO_MODE);

  useEffect(() => {
    if (DEMO_MODE) return; // sin backend: nos quedamos con el usuario demo
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // `extra` lleva los datos anti-bots del formulario ({ turnstileToken, sitio_web })
  async function login(usuario, contrasena, extra) {
    if (DEMO_MODE) {
      setUser(DEMO_USER);
      return DEMO_USER;
    }
    const u = await authApi.login(usuario, contrasena, extra);
    setUser(u);
    return u;
  }

  async function logout() {
    if (DEMO_MODE) {
      setUser(null);
      return;
    }
    await authApi.logout().catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function iniciales(user) {
  if (!user) return "--";
  const n = (user.nombre || "").trim().charAt(0);
  const a = (user.apellidos || "").trim().charAt(0);
  return `${n}${a}`.toUpperCase() || "--";
}
