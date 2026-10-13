-- ============================================================
-- BASE DE DATOS - SISTEMA DE PETICIONES
-- PostgreSQL
-- ============================================================


-- ============================================================
-- 1. CATÁLOGO DE ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nom_rol VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO roles (nom_rol)
VALUES
    ('Administrador'),
    ('Receptor'),
    ('Perito'),
    ('Consulta'),
    ('Ministerio Publico')
ON CONFLICT (nom_rol) DO NOTHING;


-- ============================================================
-- 2. CATÁLOGO DE ACCIONES
-- ============================================================

CREATE TABLE IF NOT EXISTS acciones (
    id SERIAL PRIMARY KEY,
    nom_accion VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO acciones (nom_accion)
VALUES
    ('Inicio de sesión'),
    ('Cierre de sesión'),
    ('Crear petición'),
    ('Actualizar petición'),
    ('Crear usuario'),
    ('Actualizar usuario'),
    ('Firma de recepción')
ON CONFLICT (nom_accion) DO NOTHING;


-- ============================================================
-- 3. CATÁLOGO DE MATERIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS materias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE materias IS
'Catálogo de materias/especialidades periciales';

INSERT INTO materias (nombre)
VALUES
    ('Odontología forense y social'),
    ('Antropología'),
    ('Incendios y explosivos'),
    ('Traducción'),
    ('Química'),
    ('Genética'),
    ('Balística'),
    ('Psicología'),
    ('Valuación'),
    ('Arquitectura'),
    ('Mecánica identificativa'),
    ('Tránsito terrestre'),
    ('Criminalística (diversos y homicidios)'),
    ('Lofoscopía'),
    ('Fotografía'),
    ('Informática'),
    ('Grafoscopía'),
    ('Criminalística de laboratorio'),
    ('Zootecnia y Agronomía'),
    ('Contabilidad'),
    ('Identificación humana'),
    ('Antropología social'),
    ('Retrato hablado'),
    ('Mecánica identificativa de bienes asegurados'),
    ('Criminalistica'),
    ('Informatica'),
    ('Medicina legal'),
    ('Acústica')
ON CONFLICT (nombre) DO NOTHING;


-- ============================================================
-- 4. TABLA DE USUARIOS
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    rol_id INTEGER NOT NULL,

    password_hash TEXT,
    verificado BOOLEAN NOT NULL DEFAULT FALSE,
    token_hash TEXT,
    token_expira TIMESTAMPTZ,

    materia_id INTEGER REFERENCES materias(id),

    CONSTRAINT fk_usuarios_rol
        FOREIGN KEY (rol_id)
        REFERENCES roles(id)
        ON DELETE RESTRICT
);


-- ============================================================
-- 5. TABLA DE VERIFICACIÓN DE CORREO
-- ============================================================

CREATE TABLE IF NOT EXISTS verificaciones_correo (
    id SERIAL PRIMARY KEY,
    correo VARCHAR(150) NOT NULL,
    token_hash TEXT NOT NULL,
    token_expira TIMESTAMPTZ NOT NULL,
    verificado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 6. USUARIO ADMINISTRADOR DE PRUEBA
-- ============================================================

INSERT INTO usuarios (
    nombre,
    correo,
    rol_id,
    verificado
)
SELECT
    'Prueba Admin',
    'admin@test.com',
    r.id,
    TRUE
FROM roles r
WHERE r.nom_rol = 'Administrador'
AND NOT EXISTS (
    SELECT 1
    FROM usuarios
    WHERE correo = 'admin@test.com'
);


-- ============================================================
-- 7. EXTENSIÓN PARA CONTRASEÑAS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE usuarios
SET
    password_hash = crypt('1234', gen_salt('bf', 10)),
    verificado = TRUE
WHERE correo = 'admin@test.com';


-- ============================================================
-- 8. CARPETAS
-- ============================================================

CREATE TABLE IF NOT EXISTS carpetas (
    id SERIAL PRIMARY KEY,
    numero_carpeta VARCHAR(50) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);


-- ============================================================
-- 9. CATÁLOGO DE LLAMADOS
-- ============================================================

CREATE TABLE IF NOT EXISTS llamados (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    es_automatico BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE llamados IS
'Catálogo de tipos de llamado; define el prefijo del numero_llamado';

INSERT INTO llamados (codigo, es_automatico)
VALUES
    ('FM', TRUE),
    ('FMT', TRUE),
    ('FMM', TRUE),
    ('FMBA', TRUE),
    ('FMG', FALSE),
    ('SUIP', TRUE),
    ('FMAP', FALSE)
ON CONFLICT (codigo) DO NOTHING;


-- ============================================================
-- 10. CONTADOR DE LLAMADOS
-- ============================================================

CREATE TABLE IF NOT EXISTS contador_llamados (
    llamado_id INTEGER NOT NULL REFERENCES llamados(id),
    anio CHAR(2) NOT NULL,
    ultimo_numero INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (llamado_id, anio)
);


-- ============================================================
-- 11. RELACIÓN LLAMADO - MATERIA
-- ============================================================

CREATE TABLE IF NOT EXISTS llamado_materias (
    llamado_id INTEGER NOT NULL
        REFERENCES llamados(id)
        ON DELETE CASCADE,

    materia_id INTEGER NOT NULL
        REFERENCES materias(id)
        ON DELETE CASCADE,

    PRIMARY KEY (llamado_id, materia_id)
);


INSERT INTO llamado_materias (llamado_id, materia_id)
SELECT
    l.id,
    m.id
FROM (
    VALUES
        ('FM',   'Criminalística (diversos y homicidios)'),
        ('FM',   'Química'),
        ('FM',   'Odontología forense y social'),
        ('FM',   'Incendios y explosivos'),
        ('FM',   'Antropología'),
        ('FM',   'Traducción'),
        ('FM',   'Valuación'),
        ('FM',   'Arquitectura'),
        ('FM',   'Psicología'),
        ('FM',   'Lofoscopía'),
        ('FM',   'Fotografía'),
        ('FM',   'Informática'),
        ('FM',   'Contabilidad'),
        ('FM',   'Grafoscopía'),
        ('FM',   'Balística'),
        ('FM',   'Criminalística de laboratorio'),
        ('FM',   'Identificación humana'),
        ('FM',   'Antropología social'),
        ('FM',   'Retrato hablado'),
        ('FMG',  'Genética'),
        ('FMM',  'Mecánica identificativa'),
        ('FMT',  'Tránsito terrestre'),
        ('FMBA', 'Mecánica identificativa de bienes asegurados')
) AS v(codigo, materia)
JOIN llamados l
    ON l.codigo = v.codigo
JOIN materias m
    ON m.nombre = v.materia
ON CONFLICT DO NOTHING;


-- ============================================================
-- 12. TABLA DE PETICIONES
-- ============================================================

CREATE TABLE IF NOT EXISTS peticiones (
    id BIGSERIAL PRIMARY KEY,

    llamado_id INTEGER NOT NULL
        REFERENCES llamados(id),

    numero_llamado VARCHAR(30) NOT NULL UNIQUE,

    fecha_recibido DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_recibido TIME NOT NULL DEFAULT CURRENT_TIME,

    receptor_id INTEGER NOT NULL
        REFERENCES usuarios(id),

    nombre_ministerio_publico VARCHAR(150) NOT NULL,

    con_detenido BOOLEAN NOT NULL DEFAULT FALSE,

    materia_id INTEGER NOT NULL
        REFERENCES materias(id),

    numero_carpeta VARCHAR(50) NOT NULL,

    descripcion_solicitud TEXT NOT NULL,

    perito_id INTEGER
        REFERENCES usuarios(id),

    entrega_dictamen BOOLEAN DEFAULT FALSE,
    entrega_informe BOOLEAN DEFAULT FALSE,
    entrega_requerimiento BOOLEAN DEFAULT FALSE,

    quien_recibe_id INTEGER
        REFERENCES usuarios(id),

    firmado_en TIMESTAMPTZ
);


-- ============================================================
-- 13. ÍNDICES DE PETICIONES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_peticiones_materia
    ON peticiones(materia_id);

CREATE INDEX IF NOT EXISTS idx_peticiones_llamado
    ON peticiones(llamado_id);

CREATE INDEX IF NOT EXISTS idx_peticiones_fecha
    ON peticiones(fecha_recibido);

CREATE INDEX IF NOT EXISTS idx_peticiones_carpeta
    ON peticiones(numero_carpeta);


-- ============================================================
-- 14. FUNCIÓN PARA GENERAR NÚMERO DE LLAMADO
-- ============================================================

CREATE OR REPLACE FUNCTION fn_generar_numero_llamado()
RETURNS TRIGGER AS $$
DECLARE
    v_codigo VARCHAR(10);
    v_automatico BOOLEAN;
    v_anio CHAR(2);
    v_siguiente INTEGER;
BEGIN

    SELECT
        codigo,
        es_automatico
    INTO
        v_codigo,
        v_automatico
    FROM llamados
    WHERE id = NEW.llamado_id;

    IF v_codigo IS NULL THEN
        RAISE EXCEPTION
            'llamado_id % no existe en el catálogo de llamados',
            NEW.llamado_id;
    END IF;

    v_anio := TO_CHAR(CURRENT_DATE, 'YY');

    IF v_automatico THEN

        INSERT INTO contador_llamados (
            llamado_id,
            anio,
            ultimo_numero
        )
        VALUES (
            NEW.llamado_id,
            v_anio,
            1
        )
        ON CONFLICT (llamado_id, anio)
        DO UPDATE SET
            ultimo_numero =
                contador_llamados.ultimo_numero + 1
        RETURNING ultimo_numero
        INTO v_siguiente;

        NEW.numero_llamado :=
            v_codigo
            || LPAD(v_siguiente::TEXT, 3, '0')
            || '/'
            || v_anio;

    ELSE

        IF NEW.numero_llamado IS NULL
           OR BTRIM(NEW.numero_llamado) = '' THEN

            RAISE EXCEPTION
                'Para el llamado %, numero_llamado debe capturarse manualmente',
                v_codigo;

        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 15. TRIGGER PARA GENERAR NÚMERO DE LLAMADO
-- ============================================================

DROP TRIGGER IF EXISTS trg_generar_numero_llamado
ON peticiones;

CREATE TRIGGER trg_generar_numero_llamado
BEFORE INSERT ON peticiones
FOR EACH ROW
EXECUTE FUNCTION fn_generar_numero_llamado();


-- ============================================================
-- 16. VISTA DE PETICIONES
-- ============================================================

DROP VIEW IF EXISTS vw_peticiones;

CREATE VIEW vw_peticiones AS
SELECT
    p.id,
    p.numero_llamado,

    l.codigo AS tipo_llamado,

    p.fecha_recibido,
    p.hora_recibido,

    p.receptor_id,
    u_rec.nombre AS nombre_receptor,

    p.nombre_ministerio_publico,

    p.con_detenido,

    CASE
        WHEN p.con_detenido
            THEN 'CON DETENIDO'
        ELSE 'SIN DETENIDO'
    END AS estatus_detenido,

    p.materia_id,
    m.nombre AS materia,

    p.numero_carpeta,
    p.descripcion_solicitud,

    p.llamado_id,

    p.perito_id,
    u_per.nombre AS nombre_perito,

    p.entrega_dictamen,
    p.entrega_informe,
    p.entrega_requerimiento,

    p.quien_recibe_id,
    u_ent.nombre AS nombre_quien_recibe,

    p.firmado_en

FROM peticiones p

JOIN llamados l
    ON l.id = p.llamado_id

JOIN materias m
    ON m.id = p.materia_id

JOIN usuarios u_rec
    ON u_rec.id = p.receptor_id

LEFT JOIN usuarios u_per
    ON u_per.id = p.perito_id

LEFT JOIN usuarios u_ent
    ON u_ent.id = p.quien_recibe_id;


-- ============================================================
-- 17. BITÁCORA
-- ============================================================

CREATE TABLE IF NOT EXISTS bitacora (
    id SERIAL PRIMARY KEY,

    us_id INTEGER NOT NULL
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    acc_id INTEGER NOT NULL
        REFERENCES acciones(id)
        ON DELETE RESTRICT,

    pet_id BIGINT
        REFERENCES peticiones(id)
        ON DELETE SET NULL,

    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_bitacora_usuario_fecha
    ON bitacora(us_id, fecha_hora DESC);


-- ============================================================
-- 18. ENTREGAS
-- ============================================================

CREATE TABLE IF NOT EXISTS entregas (
    id SERIAL PRIMARY KEY,

    peticion_id BIGINT NOT NULL UNIQUE
        REFERENCES peticiones(id)
        ON DELETE CASCADE,

    tipo TEXT NOT NULL
        CHECK (
            tipo IN (
                'dictamen',
                'informe',
                'requerimiento'
            )
        ),

    archivo_nombre TEXT NOT NULL,
    archivo_ruta TEXT NOT NULL,

    subido_por INTEGER NOT NULL
        REFERENCES usuarios(id),

    subido_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 19. ENTREGAS DE ARCHIVOS
-- Permite varios PDF por petición
-- ============================================================

CREATE TABLE IF NOT EXISTS entrega_archivos (
    id SERIAL PRIMARY KEY,

    peticion_id BIGINT NOT NULL
        REFERENCES peticiones(id)
        ON DELETE CASCADE,

    tipo VARCHAR(20) NOT NULL,

    archivo_nombre VARCHAR(255) NOT NULL,

    archivo_ruta VARCHAR(500) NOT NULL,

    subido_por INTEGER
        REFERENCES usuarios(id),

    subido_en TIMESTAMP NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_entrega_archivos_peticion
    ON entrega_archivos(peticion_id);


-- Copiar entregas anteriores a la nueva tabla

INSERT INTO entrega_archivos (
    peticion_id,
    tipo,
    archivo_nombre,
    archivo_ruta,
    subido_por,
    subido_en
)
SELECT
    e.peticion_id,
    e.tipo,
    e.archivo_nombre,
    e.archivo_ruta,
    e.subido_por,
    e.subido_en
FROM entregas e
WHERE NOT EXISTS (
    SELECT 1
    FROM entrega_archivos a
    WHERE a.peticion_id = e.peticion_id
);


-- ============================================================
-- 20. NOTIFICACIONES
-- ============================================================

CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,

    us_id INTEGER NOT NULL
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    pet_id BIGINT
        REFERENCES peticiones(id)
        ON DELETE CASCADE,

    tipo VARCHAR(30) NOT NULL,

    mensaje TEXT NOT NULL,

    leida BOOLEAN NOT NULL DEFAULT FALSE,

    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
    ON notificaciones(us_id, leida, creada_en DESC);


-- ============================================================
-- 21. SOLICITUDES DEL MINISTERIO PÚBLICO
-- ============================================================

CREATE TABLE IF NOT EXISTS solicitudes_mp (
    id SERIAL PRIMARY KEY,

    mp_id INTEGER NOT NULL
        REFERENCES usuarios(id),

    numero_carpeta TEXT NOT NULL,

    materia_id INTEGER NOT NULL
        REFERENCES materias(id),

    breve_resena TEXT NOT NULL,

    archivo_pdf TEXT NOT NULL,

    estado TEXT NOT NULL DEFAULT 'PENDIENTE',

    peticion_id BIGINT
        REFERENCES peticiones(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 22. VISTA DE SOLICITUDES DEL MINISTERIO PÚBLICO
-- ============================================================

DROP VIEW IF EXISTS vw_solicitudes_mp;

CREATE VIEW vw_solicitudes_mp AS
SELECT
    s.*,
    m.nombre AS materia,
    p.numero_llamado,
    u.nombre AS nombre_mp

FROM solicitudes_mp s

JOIN materias m
    ON m.id = s.materia_id

JOIN usuarios u
    ON u.id = s.mp_id

LEFT JOIN peticiones p
    ON p.id = s.peticion_id;


-- ============================================================
-- 23. ARCHIVOS DE SOLICITUDES DEL MINISTERIO PÚBLICO
-- ============================================================

CREATE TABLE IF NOT EXISTS solicitud_mp_archivos (
    id SERIAL PRIMARY KEY,

    solicitud_id INTEGER NOT NULL
        REFERENCES solicitudes_mp(id)
        ON DELETE CASCADE,

    nombre_original VARCHAR(255),

    ruta VARCHAR(500) NOT NULL
);


CREATE INDEX IF NOT EXISTS idx_solicitud_mp_archivos_solicitud
    ON solicitud_mp_archivos(solicitud_id);


-- Copiar archivos existentes

INSERT INTO solicitud_mp_archivos (
    solicitud_id,
    nombre_original,
    ruta
)
SELECT
    s.id,
    REGEXP_REPLACE(
        s.archivo_pdf,
        '^.*[\\/]',
        ''
    ),
    s.archivo_pdf
FROM solicitudes_mp s
WHERE s.archivo_pdf IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM solicitud_mp_archivos a
    WHERE a.solicitud_id = s.id
);


-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
