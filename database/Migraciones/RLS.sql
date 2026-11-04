-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)  —  OPCIONAL, se aplica por separado
-- ============================================================================
--
-- Qué hace: aunque alguien lograra ejecutar una consulta que el código no esperaba (un bug,
-- una ruta olvidada), PostgreSQL mismo filtra las filas según quién es el usuario de la sesión.
--
--   * Policia / Perito       -> solo ven lo que tienen asignado (peticiones, entregas) y lo que subieron
--   * Policia                -> solo ve sus entrevistas e informes iniciales
--   * Ministerio Publico     -> solo ve sus solicitudes y órdenes de investigación
--   * Cualquiera             -> solo ve y marca como leídas SUS notificaciones
--   * Administrador, Receptor, AIC, Consulta -> sin restricción adicional (igual que hoy en el código)
--
-- Estas reglas son las MISMAS que ya aplica el backend; esto es una segunda capa.
-- No toca usuarios, roles ni contraseñas, y no cambia quién puede ver qué.
--
-- ----------------------------------------------------------------------------
-- CÓMO ACTIVARLO (3 pasos; mientras no los hagas, la aplicación funciona como siempre)
-- ----------------------------------------------------------------------------
--  1) La aplicación debe conectarse con un rol de PostgreSQL que NO sea superusuario y NO tenga
--     BYPASSRLS (un superusuario se salta RLS siempre). Ver "ROL DE LA APLICACIÓN" más abajo.
--  2) Ejecuta ESTE archivo (con el dueño de las tablas o un superusuario):
--         psql -U postgres -d TU_BASE -f database/Migraciones/RLS.sql
--  3) En backend/.env pon  RLS_ENABLED=true  y reinicia el backend.
--     (Con RLS_ENABLED=true el backend le dice a PostgreSQL quién es el usuario en cada petición.)
--
--  Pruébalo primero en una copia de la base. Para volver atrás: sección "DESACTIVAR" al final
--  y quita RLS_ENABLED del .env.
--
-- ----------------------------------------------------------------------------
-- A TENER EN CUENTA
-- ----------------------------------------------------------------------------
--  * Con FORCE ROW LEVEL SECURITY, hasta el dueño de las tablas queda sujeto a las políticas.
--    Las migraciones futuras y pg_dump deben ejecutarse con un superusuario (o un rol BYPASSRLS).
--  * Una consulta sin sesión (sin app.user_id) no ve filas de estas tablas. El login no las usa.
--  * Las vistas (vw_peticiones, vw_solicitudes_mp, vw_ordenes_investigacion) también quedan filtradas,
--    porque las políticas leen la sesión actual y no al dueño de la vista.
--  * /api/peticiones/pendientes: para Perito/Policia, "por_firmar" pasa a contar solo lo suyo
--    (ellos no firman; la pantalla usa "por_entregar").
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Aviso si la conexión actual se salta RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  SELECT rolsuper, rolbypassrls INTO r FROM pg_roles WHERE rolname = current_user;
  IF r.rolsuper OR r.rolbypassrls THEN
    RAISE NOTICE 'Estás ejecutando como superusuario/BYPASSRLS: está bien para aplicar este script, pero la APLICACIÓN debe conectarse con otro rol o RLS no tendrá efecto.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Datos de la sesión (los pone el backend con RLS_ENABLED=true)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_uid() RETURNS integer
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.user_id', true), '')::integer $$;

CREATE OR REPLACE FUNCTION app_rol() RETURNS text
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.user_rol', true), '') $$;

-- ---------------------------------------------------------------------------
-- Activar RLS (FORCE: también aplica al dueño de la tabla)
-- ---------------------------------------------------------------------------
ALTER TABLE notificaciones                ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones                FORCE  ROW LEVEL SECURITY;
ALTER TABLE documentos_policiales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_policiales         FORCE  ROW LEVEL SECURITY;
ALTER TABLE documento_policial_archivos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_policial_archivos   FORCE  ROW LEVEL SECURITY;
ALTER TABLE solicitudes_mp                ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_mp                FORCE  ROW LEVEL SECURITY;
ALTER TABLE solicitud_mp_archivos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_mp_archivos         FORCE  ROW LEVEL SECURITY;
ALTER TABLE ordenes_investigacion         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_investigacion         FORCE  ROW LEVEL SECURITY;
ALTER TABLE orden_investigacion_archivos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_investigacion_archivos  FORCE  ROW LEVEL SECURITY;
ALTER TABLE peticiones                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE peticiones                    FORCE  ROW LEVEL SECURITY;
ALTER TABLE entrega_archivos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrega_archivos              FORCE  ROW LEVEL SECURITY;
ALTER TABLE entregas                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas                      FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Limpieza para poder volver a ejecutar este archivo
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
      FROM pg_policies
     WHERE schemaname = 'public' AND policyname LIKE 'rls\_%'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- NOTIFICACIONES: cada quien solo las suyas (cualquier sesión puede CREAR avisos para otros)
-- ---------------------------------------------------------------------------
CREATE POLICY rls_notificaciones_leer ON notificaciones FOR SELECT
  USING (us_id = app_uid());
CREATE POLICY rls_notificaciones_actualizar ON notificaciones FOR UPDATE
  USING (us_id = app_uid()) WITH CHECK (us_id = app_uid());
CREATE POLICY rls_notificaciones_borrar ON notificaciones FOR DELETE
  USING (us_id = app_uid());
CREATE POLICY rls_notificaciones_crear ON notificaciones FOR INSERT
  WITH CHECK (app_uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- ENTREVISTAS E INFORMES INICIALES: el Policía solo ve (y borra) lo suyo
-- ---------------------------------------------------------------------------
CREATE POLICY rls_docpol_leer ON documentos_policiales FOR SELECT
  USING (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') <> 'Policia' OR creado_por = app_uid()));
CREATE POLICY rls_docpol_crear ON documentos_policiales FOR INSERT
  WITH CHECK (app_uid() IS NOT NULL AND creado_por = app_uid());
CREATE POLICY rls_docpol_borrar ON documentos_policiales FOR DELETE
  USING (app_uid() IS NOT NULL AND (app_rol() = 'Administrador' OR creado_por = app_uid()));

CREATE POLICY rls_docpol_arch_leer ON documento_policial_archivos FOR SELECT
  USING (EXISTS (SELECT 1 FROM documentos_policiales d WHERE d.id = documento_id));
CREATE POLICY rls_docpol_arch_crear ON documento_policial_archivos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM documentos_policiales d WHERE d.id = documento_id AND d.creado_por = app_uid()));
CREATE POLICY rls_docpol_arch_borrar ON documento_policial_archivos FOR DELETE
  USING (EXISTS (SELECT 1 FROM documentos_policiales d WHERE d.id = documento_id));

-- ---------------------------------------------------------------------------
-- SOLICITUDES DEL MINISTERIO PÚBLICO: el MP solo ve las suyas
-- ---------------------------------------------------------------------------
CREATE POLICY rls_solmp_leer ON solicitudes_mp FOR SELECT
  USING (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') <> 'Ministerio Publico' OR mp_id = app_uid()));
CREATE POLICY rls_solmp_crear ON solicitudes_mp FOR INSERT
  WITH CHECK (app_uid() IS NOT NULL AND mp_id = app_uid());
CREATE POLICY rls_solmp_actualizar ON solicitudes_mp FOR UPDATE
  USING (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') <> 'Ministerio Publico' OR mp_id = app_uid()))
  WITH CHECK (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') <> 'Ministerio Publico' OR mp_id = app_uid()));

CREATE POLICY rls_solmp_arch_leer ON solicitud_mp_archivos FOR SELECT
  USING (EXISTS (SELECT 1 FROM solicitudes_mp s WHERE s.id = solicitud_id));
CREATE POLICY rls_solmp_arch_crear ON solicitud_mp_archivos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM solicitudes_mp s WHERE s.id = solicitud_id AND s.mp_id = app_uid()));

-- ---------------------------------------------------------------------------
-- ÓRDENES DE INVESTIGACIÓN: el MP solo ve las suyas; el AIC las atiende
-- ---------------------------------------------------------------------------
CREATE POLICY rls_ordinv_leer ON ordenes_investigacion FOR SELECT
  USING (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') <> 'Ministerio Publico' OR mp_id = app_uid()));
CREATE POLICY rls_ordinv_crear ON ordenes_investigacion FOR INSERT
  WITH CHECK (app_uid() IS NOT NULL AND mp_id = app_uid());
CREATE POLICY rls_ordinv_actualizar ON ordenes_investigacion FOR UPDATE
  USING (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') <> 'Ministerio Publico' OR mp_id = app_uid()))
  WITH CHECK (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') <> 'Ministerio Publico' OR mp_id = app_uid()));

CREATE POLICY rls_ordinv_arch_leer ON orden_investigacion_archivos FOR SELECT
  USING (EXISTS (SELECT 1 FROM ordenes_investigacion o WHERE o.id = orden_id));
CREATE POLICY rls_ordinv_arch_crear ON orden_investigacion_archivos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM ordenes_investigacion o WHERE o.id = orden_id AND o.mp_id = app_uid()));

-- ---------------------------------------------------------------------------
-- PETICIONES: Perito y Policía solo ven (y actualizan) las que tienen asignadas
-- ---------------------------------------------------------------------------
CREATE POLICY rls_peticiones_leer ON peticiones FOR SELECT
  USING (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') NOT IN ('Perito', 'Policia') OR perito_id = app_uid()));
CREATE POLICY rls_peticiones_crear ON peticiones FOR INSERT
  WITH CHECK (app_uid() IS NOT NULL AND COALESCE(app_rol(), '') NOT IN ('Perito', 'Policia'));
CREATE POLICY rls_peticiones_actualizar ON peticiones FOR UPDATE
  USING (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') NOT IN ('Perito', 'Policia') OR perito_id = app_uid()))
  WITH CHECK (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') NOT IN ('Perito', 'Policia') OR perito_id = app_uid()));

-- ---------------------------------------------------------------------------
-- ENTREGAS (PDF): siguen a la petición; Perito y Policía solo las de sus peticiones
-- (el EXISTS sobre "peticiones" ya viene filtrado por la política de arriba)
-- ---------------------------------------------------------------------------
CREATE POLICY rls_entrega_arch_todo ON entrega_archivos FOR ALL
  USING (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') NOT IN ('Perito', 'Policia')
         OR EXISTS (SELECT 1 FROM peticiones p WHERE p.id = peticion_id)))
  WITH CHECK (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') NOT IN ('Perito', 'Policia')
         OR EXISTS (SELECT 1 FROM peticiones p WHERE p.id = peticion_id)));

CREATE POLICY rls_entregas_todo ON entregas FOR ALL
  USING (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') NOT IN ('Perito', 'Policia')
         OR EXISTS (SELECT 1 FROM peticiones p WHERE p.id = peticion_id)))
  WITH CHECK (app_uid() IS NOT NULL AND (COALESCE(app_rol(), '') NOT IN ('Perito', 'Policia')
         OR EXISTS (SELECT 1 FROM peticiones p WHERE p.id = peticion_id)));

COMMIT;

-- ============================================================================
-- ROL DE LA APLICACIÓN (paso 1). Ejemplo; cambia el nombre y la contraseña, y ejecútalo como superusuario.
-- Después pon DB_USER=app_user y DB_PASSWORD=... en backend/.env
-- ============================================================================
-- CREATE ROLE app_user LOGIN PASSWORD 'CAMBIA-ESTA-CONTRASEÑA' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
-- GRANT CONNECT ON DATABASE TU_BASE TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- ============================================================================
-- PRUEBA RÁPIDA (como app_user, en psql)
-- ============================================================================
-- SELECT set_config('app.user_id', '', false), set_config('app.user_rol', '', false);
-- SELECT count(*) FROM peticiones;                      -- 0: sin sesión no se ve nada
-- SELECT set_config('app.user_id', '<ID de un Policia>', false), set_config('app.user_rol', 'Policia', false);
-- SELECT count(*) FROM peticiones;                      -- solo las asignadas a ese policía
-- SELECT set_config('app.user_id', '<ID del Administrador>', false), set_config('app.user_rol', 'Administrador', false);
-- SELECT count(*) FROM peticiones;                      -- todas

-- ============================================================================
-- DESACTIVAR (volver a como estaba)
-- ============================================================================
-- BEGIN;
-- ALTER TABLE notificaciones               NO FORCE ROW LEVEL SECURITY; ALTER TABLE notificaciones               DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE documentos_policiales        NO FORCE ROW LEVEL SECURITY; ALTER TABLE documentos_policiales        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE documento_policial_archivos  NO FORCE ROW LEVEL SECURITY; ALTER TABLE documento_policial_archivos  DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE solicitudes_mp               NO FORCE ROW LEVEL SECURITY; ALTER TABLE solicitudes_mp               DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE solicitud_mp_archivos        NO FORCE ROW LEVEL SECURITY; ALTER TABLE solicitud_mp_archivos        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE ordenes_investigacion        NO FORCE ROW LEVEL SECURITY; ALTER TABLE ordenes_investigacion        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE orden_investigacion_archivos NO FORCE ROW LEVEL SECURITY; ALTER TABLE orden_investigacion_archivos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE peticiones                   NO FORCE ROW LEVEL SECURITY; ALTER TABLE peticiones                   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE entrega_archivos             NO FORCE ROW LEVEL SECURITY; ALTER TABLE entrega_archivos             DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE entregas                     NO FORCE ROW LEVEL SECURITY; ALTER TABLE entregas                     DISABLE ROW LEVEL SECURITY;
-- COMMIT;
