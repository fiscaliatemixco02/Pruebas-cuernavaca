# Seguridad del sistema

## Antes de subir esta versión (importante)
1. **Frontend**: `cd frontend && npm uninstall bcrypt cors nodemailer` (son del backend y no se usan en el frontend) y `npm install`.
2. **Backend**: copia `backend/.env.example` a `backend/.env` (conserva tus valores actuales) y revisa `FRONTEND_URL`, `NODE_ENV` y `TRUST_PROXY`.
3. Ejecuta `cd backend && npm test` y `npm run audit:deps` (con internet) y atiende lo que marque.
4. Todos los usuarios tendrán que volver a iniciar sesión una vez (la sesión ahora es una cookie, no `localStorage`).

## Qué se hizo
| Medida | Dónde |
|---|---|
| API keys / secretos | Sin llaves en el código. `.env.example` en backend y frontend, `.gitignore` raíz, validación al arrancar (`config/entorno.js`). |
| Row-Level Security | `database/Migraciones/RLS.sql` + `RLS_ENABLED` en `db.js`. **Opcional y apagado por defecto.** |
| Bloquear manipulación de campos | Lista blanca de campos y tipos (`utils/validar.js`) en crear/editar petición, atender orden/solicitud, carpetas, etc. PDF verificado por contenido (`%PDF-`). |
| Cookies de sesión | Cookie `HttpOnly`, `Secure`, `SameSite=Lax` (`__Host-sesion` en producción), JWT fijado a HS256, defensa CSRF (cabecera + Origin). |
| Rate limiting | `middleware/limitadores.js`: general, login (por fallos), códigos de correo, firmas, subidas, reportes, respaldo. |
| Bots | Campo trampa, bloqueo de User-Agents de herramientas (producción), Turnstile opcional. |
| Queries parametrizadas | Ya lo estaban casi todas; se corrigieron `/api/peritos` y el tipo de entrega. Una prueba automática impide agregar SQL interpolado. |
| HTTPS | Redirección 308 + HSTS en producción, cookie `Secure`, `upgrade-insecure-requests` en el build. |
| Dependencias | Dependabot semanal + workflow `npm audit` (`.github/`). |
| Otros | Cabeceras de seguridad, CORS por lista, `no-store` en la API, errores sin detalles internos, tope de 200 KB en JSON. |

## Corregido de paso
- **Escritura de archivos fuera de carpeta**: el nombre del PDF de entrega usaba `req.params.id` sin validar.
- `tipo` de entrega aceptaba `constructor`/`__proto__` en la lista de columnas.
- Mensajes de error que mostraban `error.message` al cliente.

## No se tocó (como pediste)
Contraseñas (hash, cifrado, "ver contraseña" del Administrador, cambio, longitud) y quién ve qué.

## Pendiente / a considerar
- La sesión no se puede revocar en el servidor (el JWT vale hasta 8 h aunque cierres sesión).
- Los límites están en memoria: se reinician con el servidor y no se comparten entre varias instancias.
- `jefe_grupo` se envía al crear una petición del AIC pero el backend no lo guarda (ya era así).
- El respaldo incluye `password_hash` y `password_cifrada`: protégelo.
