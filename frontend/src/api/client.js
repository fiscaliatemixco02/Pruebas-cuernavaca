// ---------------------------------------------------------------------------
// Cliente API central. Todas las funciones de src/api/*.js llaman a tu backend
// Express, que es el que ejecuta las queries contra Postgres.
//
// URL de la API en `.env`:  VITE_API_URL=https://tu-servidor/api
//
// La sesión ya NO se guarda en localStorage: el servidor la entrega en una cookie HttpOnly que el
// navegador manda solo (por eso todas las peticiones llevan credentials: "include").
// ---------------------------------------------------------------------------

export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// En producción la API debe ir por HTTPS (la cookie de sesión es Secure y no viaja por http)
if (import.meta.env.PROD && BASE_URL.startsWith("http://") && !/localhost|127\.0\.0\.1/.test(BASE_URL)) {
  console.warn("VITE_API_URL usa http:// en producción. Cámbiala a https://");
}

// Cabecera que exige el servidor en las peticiones que modifican datos (defensa contra CSRF).
// Una página ajena no puede añadirla sin que el CORS del servidor se lo permita.
function authHeaders() {
  return { "X-Requested-With": "XMLHttpRequest" };
}

// El backend responde { error: "..." }; se acepta también { message: "..." }.
function mensajeDeError(res, data, path) {
  return data?.error || data?.message || `Error ${res.status} al llamar ${path}`;
}

async function request(path, { method = "GET", body, params } = {}) {
  let url = `${BASE_URL}${path}`;

  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    ).toString();
    if (query) url += `?${query}`;
  }

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new Error(mensajeDeError(res, data, path));
  }

  return data;
}

// Para subir archivos (multipart/form-data). No se pone Content-Type a mano:
// el navegador arma el boundary correcto solo.
async function requestForm(path, { method = "POST", formData } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: authHeaders(),
    credentials: "include",
    body: formData,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new Error(mensajeDeError(res, data, path));
  }

  return data;
}

// Para descargar archivos (PDF) con el token; un <a href> no manda el header.
async function requestBlob(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authHeaders(),
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(mensajeDeError(res, data, path));
  }

  return res.blob();
}

export const api = {
  get: (path, params) => request(path, { method: "GET", params }),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
  postForm: (path, formData) => requestForm(path, { method: "POST", formData }),
  getBlob: (path) => requestBlob(path),
};