--
-- PostgreSQL database dump
--

\restrict DZe9QZnJL7jHWTAtN4cKvlrfw65Eax1B8k7Ih127Hf9VzKmgDldCn87ApgFURoc

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: app_rol(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_rol() RETURNS text
    LANGUAGE sql STABLE
    AS $$ SELECT NULLIF(current_setting('app.user_rol', true), '') $$;


--
-- Name: app_uid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_uid() RETURNS integer
    LANGUAGE sql STABLE
    AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::integer $$;


--
-- Name: fn_generar_numero_llamado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_generar_numero_llamado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: acciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acciones (
    id integer NOT NULL,
    nom_accion character varying(100) NOT NULL
);


--
-- Name: acciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.acciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: acciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.acciones_id_seq OWNED BY public.acciones.id;


--
-- Name: bitacora; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bitacora (
    id integer NOT NULL,
    us_id integer NOT NULL,
    acc_id integer NOT NULL,
    pet_id bigint,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bitacora_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bitacora_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bitacora_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bitacora_id_seq OWNED BY public.bitacora.id;


--
-- Name: carpetas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carpetas (
    id integer NOT NULL,
    numero_carpeta character varying(50) NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: carpetas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carpetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carpetas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carpetas_id_seq OWNED BY public.carpetas.id;


--
-- Name: contador_llamados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contador_llamados (
    llamado_id integer NOT NULL,
    anio character(2) NOT NULL,
    ultimo_numero integer DEFAULT 0 NOT NULL
);


--
-- Name: documento_policial_archivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documento_policial_archivos (
    id integer NOT NULL,
    documento_id integer NOT NULL,
    nombre_original character varying(255),
    ruta character varying(500) NOT NULL
);

ALTER TABLE ONLY public.documento_policial_archivos FORCE ROW LEVEL SECURITY;


--
-- Name: documento_policial_archivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documento_policial_archivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documento_policial_archivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documento_policial_archivos_id_seq OWNED BY public.documento_policial_archivos.id;


--
-- Name: documentos_policiales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_policiales (
    id integer NOT NULL,
    tipo text NOT NULL,
    numero_carpeta text NOT NULL,
    iniciales_victima text NOT NULL,
    creado_por integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documentos_policiales_tipo_check CHECK ((tipo = ANY (ARRAY['ENTREVISTA'::text, 'INFORME_INICIAL'::text])))
);

ALTER TABLE ONLY public.documentos_policiales FORCE ROW LEVEL SECURITY;


--
-- Name: documentos_policiales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_policiales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_policiales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_policiales_id_seq OWNED BY public.documentos_policiales.id;


--
-- Name: entrega_archivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entrega_archivos (
    id integer NOT NULL,
    peticion_id bigint NOT NULL,
    tipo character varying(20) NOT NULL,
    archivo_nombre character varying(255) NOT NULL,
    archivo_ruta character varying(500) NOT NULL,
    subido_por integer,
    subido_en timestamp without time zone DEFAULT now() NOT NULL,
    descripcion character varying(500)
);

ALTER TABLE ONLY public.entrega_archivos FORCE ROW LEVEL SECURITY;


--
-- Name: entrega_archivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entrega_archivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entrega_archivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entrega_archivos_id_seq OWNED BY public.entrega_archivos.id;


--
-- Name: entregas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entregas (
    id integer NOT NULL,
    peticion_id bigint NOT NULL,
    tipo text NOT NULL,
    archivo_nombre text NOT NULL,
    archivo_ruta text NOT NULL,
    subido_por integer NOT NULL,
    subido_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entregas_tipo_check CHECK ((tipo = ANY (ARRAY['dictamen'::text, 'informe'::text, 'requerimiento'::text])))
);

ALTER TABLE ONLY public.entregas FORCE ROW LEVEL SECURITY;


--
-- Name: entregas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entregas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entregas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entregas_id_seq OWNED BY public.entregas.id;


--
-- Name: llamado_materias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llamado_materias (
    llamado_id integer NOT NULL,
    materia_id integer NOT NULL
);


--
-- Name: llamados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llamados (
    id integer NOT NULL,
    codigo character varying(10) NOT NULL,
    es_automatico boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE llamados; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.llamados IS 'Catálogo de tipos de llamado; define el prefijo del numero_llamado';


--
-- Name: llamados_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.llamados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: llamados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.llamados_id_seq OWNED BY public.llamados.id;


--
-- Name: materias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE materias; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.materias IS 'Catálogo de materias/especialidades periciales';


--
-- Name: materias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.materias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: materias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.materias_id_seq OWNED BY public.materias.id;


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones (
    id integer NOT NULL,
    us_id integer NOT NULL,
    pet_id bigint,
    tipo character varying(30) NOT NULL,
    mensaje text NOT NULL,
    leida boolean DEFAULT false NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.notificaciones FORCE ROW LEVEL SECURITY;


--
-- Name: notificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notificaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notificaciones_id_seq OWNED BY public.notificaciones.id;


--
-- Name: orden_investigacion_archivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orden_investigacion_archivos (
    id integer NOT NULL,
    orden_id integer NOT NULL,
    nombre_original character varying(255),
    ruta character varying(500) NOT NULL
);

ALTER TABLE ONLY public.orden_investigacion_archivos FORCE ROW LEVEL SECURITY;


--
-- Name: orden_investigacion_archivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orden_investigacion_archivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orden_investigacion_archivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orden_investigacion_archivos_id_seq OWNED BY public.orden_investigacion_archivos.id;


--
-- Name: ordenes_investigacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_investigacion (
    id integer NOT NULL,
    mp_id integer NOT NULL,
    numero_carpeta text NOT NULL,
    area text NOT NULL,
    breve_resena text NOT NULL,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    atendida_por integer,
    atendida_en timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    peticion_id bigint,
    CONSTRAINT ordenes_investigacion_area_check CHECK ((area = ANY (ARRAY['POLICIAL'::text, 'ANALISIS'::text]))),
    CONSTRAINT ordenes_investigacion_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'ATENDIDA'::text])))
);

ALTER TABLE ONLY public.ordenes_investigacion FORCE ROW LEVEL SECURITY;


--
-- Name: ordenes_investigacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordenes_investigacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordenes_investigacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordenes_investigacion_id_seq OWNED BY public.ordenes_investigacion.id;


--
-- Name: peticiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peticiones (
    id bigint NOT NULL,
    llamado_id integer NOT NULL,
    numero_llamado character varying(30) NOT NULL,
    fecha_recibido date DEFAULT CURRENT_DATE NOT NULL,
    hora_recibido time without time zone DEFAULT CURRENT_TIME NOT NULL,
    receptor_id integer NOT NULL,
    nombre_ministerio_publico character varying(150) NOT NULL,
    con_detenido boolean DEFAULT false NOT NULL,
    materia_id integer NOT NULL,
    numero_carpeta character varying(50) NOT NULL,
    descripcion_solicitud text NOT NULL,
    perito_id integer,
    entrega_dictamen boolean DEFAULT false,
    entrega_informe boolean DEFAULT false,
    entrega_requerimiento boolean DEFAULT false,
    quien_recibe_id integer,
    firmado_en timestamp with time zone,
    jefe_grupo character varying(150)
);

ALTER TABLE ONLY public.peticiones FORCE ROW LEVEL SECURITY;


--
-- Name: peticiones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.peticiones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: peticiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.peticiones_id_seq OWNED BY public.peticiones.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    nom_rol character varying(100) NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: solicitud_mp_archivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitud_mp_archivos (
    id integer NOT NULL,
    solicitud_id integer NOT NULL,
    nombre_original character varying(255),
    ruta character varying(500) NOT NULL
);

ALTER TABLE ONLY public.solicitud_mp_archivos FORCE ROW LEVEL SECURITY;


--
-- Name: solicitud_mp_archivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitud_mp_archivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitud_mp_archivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitud_mp_archivos_id_seq OWNED BY public.solicitud_mp_archivos.id;


--
-- Name: solicitudes_mp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_mp (
    id integer NOT NULL,
    mp_id integer NOT NULL,
    numero_carpeta text NOT NULL,
    materia_id integer NOT NULL,
    breve_resena text NOT NULL,
    archivo_pdf text NOT NULL,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    peticion_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.solicitudes_mp FORCE ROW LEVEL SECURITY;


--
-- Name: solicitudes_mp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_mp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_mp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_mp_id_seq OWNED BY public.solicitudes_mp.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    correo character varying(150) NOT NULL,
    rol_id integer NOT NULL,
    password_hash text,
    verificado boolean DEFAULT false NOT NULL,
    token_hash text,
    token_expira timestamp with time zone,
    materia_id integer,
    password_cifrada text
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: verificaciones_correo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verificaciones_correo (
    id integer NOT NULL,
    correo character varying(150) NOT NULL,
    token_hash text NOT NULL,
    token_expira timestamp with time zone NOT NULL,
    verificado boolean DEFAULT false NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: verificaciones_correo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verificaciones_correo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verificaciones_correo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verificaciones_correo_id_seq OWNED BY public.verificaciones_correo.id;


--
-- Name: vw_ordenes_investigacion; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_ordenes_investigacion AS
 SELECT o.id,
    o.mp_id,
    o.numero_carpeta,
    o.area,
    o.breve_resena,
    o.estado,
    o.atendida_por,
    o.atendida_en,
    o.created_at,
    o.peticion_id,
    u.nombre AS nombre_mp,
    a.nombre AS nombre_aic,
    p.numero_llamado
   FROM (((public.ordenes_investigacion o
     JOIN public.usuarios u ON ((u.id = o.mp_id)))
     LEFT JOIN public.usuarios a ON ((a.id = o.atendida_por)))
     LEFT JOIN public.peticiones p ON ((p.id = o.peticion_id)));


--
-- Name: vw_peticiones; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_peticiones AS
 SELECT p.id,
    p.numero_llamado,
    l.codigo AS tipo_llamado,
    p.fecha_recibido,
    p.hora_recibido,
    p.receptor_id,
    u_rec.nombre AS nombre_receptor,
    p.nombre_ministerio_publico,
    p.con_detenido,
        CASE
            WHEN p.con_detenido THEN 'CON DETENIDO'::text
            ELSE 'SIN DETENIDO'::text
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
   FROM (((((public.peticiones p
     JOIN public.llamados l ON ((l.id = p.llamado_id)))
     JOIN public.materias m ON ((m.id = p.materia_id)))
     JOIN public.usuarios u_rec ON ((u_rec.id = p.receptor_id)))
     LEFT JOIN public.usuarios u_per ON ((u_per.id = p.perito_id)))
     LEFT JOIN public.usuarios u_ent ON ((u_ent.id = p.quien_recibe_id)));


--
-- Name: vw_solicitudes_mp; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_solicitudes_mp AS
 SELECT s.id,
    s.mp_id,
    s.numero_carpeta,
    s.materia_id,
    s.breve_resena,
    s.archivo_pdf,
    s.estado,
    s.peticion_id,
    s.created_at,
    m.nombre AS materia,
    p.numero_llamado,
    u.nombre AS nombre_mp
   FROM (((public.solicitudes_mp s
     JOIN public.materias m ON ((m.id = s.materia_id)))
     JOIN public.usuarios u ON ((u.id = s.mp_id)))
     LEFT JOIN public.peticiones p ON ((p.id = s.peticion_id)));


--
-- Name: acciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acciones ALTER COLUMN id SET DEFAULT nextval('public.acciones_id_seq'::regclass);


--
-- Name: bitacora id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora ALTER COLUMN id SET DEFAULT nextval('public.bitacora_id_seq'::regclass);


--
-- Name: carpetas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carpetas ALTER COLUMN id SET DEFAULT nextval('public.carpetas_id_seq'::regclass);


--
-- Name: documento_policial_archivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_policial_archivos ALTER COLUMN id SET DEFAULT nextval('public.documento_policial_archivos_id_seq'::regclass);


--
-- Name: documentos_policiales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_policiales ALTER COLUMN id SET DEFAULT nextval('public.documentos_policiales_id_seq'::regclass);


--
-- Name: entrega_archivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrega_archivos ALTER COLUMN id SET DEFAULT nextval('public.entrega_archivos_id_seq'::regclass);


--
-- Name: entregas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas ALTER COLUMN id SET DEFAULT nextval('public.entregas_id_seq'::regclass);


--
-- Name: llamados id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamados ALTER COLUMN id SET DEFAULT nextval('public.llamados_id_seq'::regclass);


--
-- Name: materias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materias ALTER COLUMN id SET DEFAULT nextval('public.materias_id_seq'::regclass);


--
-- Name: notificaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_id_seq'::regclass);


--
-- Name: orden_investigacion_archivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_investigacion_archivos ALTER COLUMN id SET DEFAULT nextval('public.orden_investigacion_archivos_id_seq'::regclass);


--
-- Name: ordenes_investigacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_investigacion ALTER COLUMN id SET DEFAULT nextval('public.ordenes_investigacion_id_seq'::regclass);


--
-- Name: peticiones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones ALTER COLUMN id SET DEFAULT nextval('public.peticiones_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: solicitud_mp_archivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_mp_archivos ALTER COLUMN id SET DEFAULT nextval('public.solicitud_mp_archivos_id_seq'::regclass);


--
-- Name: solicitudes_mp id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_mp ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_mp_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: verificaciones_correo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verificaciones_correo ALTER COLUMN id SET DEFAULT nextval('public.verificaciones_correo_id_seq'::regclass);


--
-- Name: acciones acciones_nom_accion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acciones
    ADD CONSTRAINT acciones_nom_accion_key UNIQUE (nom_accion);


--
-- Name: acciones acciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acciones
    ADD CONSTRAINT acciones_pkey PRIMARY KEY (id);


--
-- Name: bitacora bitacora_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_pkey PRIMARY KEY (id);


--
-- Name: carpetas carpetas_numero_carpeta_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carpetas
    ADD CONSTRAINT carpetas_numero_carpeta_key UNIQUE (numero_carpeta);


--
-- Name: carpetas carpetas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carpetas
    ADD CONSTRAINT carpetas_pkey PRIMARY KEY (id);


--
-- Name: contador_llamados contador_llamados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contador_llamados
    ADD CONSTRAINT contador_llamados_pkey PRIMARY KEY (llamado_id, anio);


--
-- Name: documento_policial_archivos documento_policial_archivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_policial_archivos
    ADD CONSTRAINT documento_policial_archivos_pkey PRIMARY KEY (id);


--
-- Name: documentos_policiales documentos_policiales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_policiales
    ADD CONSTRAINT documentos_policiales_pkey PRIMARY KEY (id);


--
-- Name: entrega_archivos entrega_archivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrega_archivos
    ADD CONSTRAINT entrega_archivos_pkey PRIMARY KEY (id);


--
-- Name: entregas entregas_peticion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas
    ADD CONSTRAINT entregas_peticion_id_key UNIQUE (peticion_id);


--
-- Name: entregas entregas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas
    ADD CONSTRAINT entregas_pkey PRIMARY KEY (id);


--
-- Name: llamado_materias llamado_materias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamado_materias
    ADD CONSTRAINT llamado_materias_pkey PRIMARY KEY (llamado_id, materia_id);


--
-- Name: llamados llamados_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamados
    ADD CONSTRAINT llamados_codigo_key UNIQUE (codigo);


--
-- Name: llamados llamados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamados
    ADD CONSTRAINT llamados_pkey PRIMARY KEY (id);


--
-- Name: materias materias_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materias
    ADD CONSTRAINT materias_nombre_key UNIQUE (nombre);


--
-- Name: materias materias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materias
    ADD CONSTRAINT materias_pkey PRIMARY KEY (id);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);


--
-- Name: orden_investigacion_archivos orden_investigacion_archivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_investigacion_archivos
    ADD CONSTRAINT orden_investigacion_archivos_pkey PRIMARY KEY (id);


--
-- Name: ordenes_investigacion ordenes_investigacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_investigacion
    ADD CONSTRAINT ordenes_investigacion_pkey PRIMARY KEY (id);


--
-- Name: peticiones peticiones_numero_llamado_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones
    ADD CONSTRAINT peticiones_numero_llamado_key UNIQUE (numero_llamado);


--
-- Name: peticiones peticiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones
    ADD CONSTRAINT peticiones_pkey PRIMARY KEY (id);


--
-- Name: roles roles_nom_rol_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nom_rol_key UNIQUE (nom_rol);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: solicitud_mp_archivos solicitud_mp_archivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_mp_archivos
    ADD CONSTRAINT solicitud_mp_archivos_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_mp solicitudes_mp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_mp
    ADD CONSTRAINT solicitudes_mp_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: verificaciones_correo verificaciones_correo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verificaciones_correo
    ADD CONSTRAINT verificaciones_correo_pkey PRIMARY KEY (id);


--
-- Name: idx_bitacora_usuario_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bitacora_usuario_fecha ON public.bitacora USING btree (us_id, fecha_hora DESC);


--
-- Name: idx_documento_policial_archivos_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documento_policial_archivos_doc ON public.documento_policial_archivos USING btree (documento_id);


--
-- Name: idx_documentos_policiales_creador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_policiales_creador ON public.documentos_policiales USING btree (creado_por);


--
-- Name: idx_documentos_policiales_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_policiales_tipo ON public.documentos_policiales USING btree (tipo, created_at DESC);


--
-- Name: idx_entrega_archivos_peticion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entrega_archivos_peticion ON public.entrega_archivos USING btree (peticion_id);


--
-- Name: idx_notificaciones_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificaciones_usuario ON public.notificaciones USING btree (us_id, leida, creada_en DESC);


--
-- Name: idx_orden_inv_archivos_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orden_inv_archivos_orden ON public.orden_investigacion_archivos USING btree (orden_id);


--
-- Name: idx_ordenes_investigacion_mp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ordenes_investigacion_mp ON public.ordenes_investigacion USING btree (mp_id, created_at DESC);


--
-- Name: idx_peticiones_carpeta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peticiones_carpeta ON public.peticiones USING btree (numero_carpeta);


--
-- Name: idx_peticiones_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peticiones_fecha ON public.peticiones USING btree (fecha_recibido);


--
-- Name: idx_peticiones_llamado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peticiones_llamado ON public.peticiones USING btree (llamado_id);


--
-- Name: idx_peticiones_materia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_peticiones_materia ON public.peticiones USING btree (materia_id);


--
-- Name: idx_solicitud_mp_archivos_solicitud; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitud_mp_archivos_solicitud ON public.solicitud_mp_archivos USING btree (solicitud_id);


--
-- Name: peticiones trg_generar_numero_llamado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generar_numero_llamado BEFORE INSERT ON public.peticiones FOR EACH ROW EXECUTE FUNCTION public.fn_generar_numero_llamado();


--
-- Name: bitacora bitacora_acc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_acc_id_fkey FOREIGN KEY (acc_id) REFERENCES public.acciones(id) ON DELETE RESTRICT;


--
-- Name: bitacora bitacora_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.peticiones(id) ON DELETE SET NULL;


--
-- Name: bitacora bitacora_us_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bitacora
    ADD CONSTRAINT bitacora_us_id_fkey FOREIGN KEY (us_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: contador_llamados contador_llamados_llamado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contador_llamados
    ADD CONSTRAINT contador_llamados_llamado_id_fkey FOREIGN KEY (llamado_id) REFERENCES public.llamados(id);


--
-- Name: documento_policial_archivos documento_policial_archivos_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_policial_archivos
    ADD CONSTRAINT documento_policial_archivos_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.documentos_policiales(id) ON DELETE CASCADE;


--
-- Name: documentos_policiales documentos_policiales_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_policiales
    ADD CONSTRAINT documentos_policiales_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id);


--
-- Name: entrega_archivos entrega_archivos_peticion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrega_archivos
    ADD CONSTRAINT entrega_archivos_peticion_id_fkey FOREIGN KEY (peticion_id) REFERENCES public.peticiones(id) ON DELETE CASCADE;


--
-- Name: entrega_archivos entrega_archivos_subido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entrega_archivos
    ADD CONSTRAINT entrega_archivos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.usuarios(id);


--
-- Name: entregas entregas_peticion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas
    ADD CONSTRAINT entregas_peticion_id_fkey FOREIGN KEY (peticion_id) REFERENCES public.peticiones(id) ON DELETE CASCADE;


--
-- Name: entregas entregas_subido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas
    ADD CONSTRAINT entregas_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.usuarios(id);


--
-- Name: usuarios fk_usuarios_rol; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: llamado_materias llamado_materias_llamado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamado_materias
    ADD CONSTRAINT llamado_materias_llamado_id_fkey FOREIGN KEY (llamado_id) REFERENCES public.llamados(id) ON DELETE CASCADE;


--
-- Name: llamado_materias llamado_materias_materia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llamado_materias
    ADD CONSTRAINT llamado_materias_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE;


--
-- Name: notificaciones notificaciones_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.peticiones(id) ON DELETE CASCADE;


--
-- Name: notificaciones notificaciones_us_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_us_id_fkey FOREIGN KEY (us_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: orden_investigacion_archivos orden_investigacion_archivos_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orden_investigacion_archivos
    ADD CONSTRAINT orden_investigacion_archivos_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_investigacion(id) ON DELETE CASCADE;


--
-- Name: ordenes_investigacion ordenes_investigacion_atendida_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_investigacion
    ADD CONSTRAINT ordenes_investigacion_atendida_por_fkey FOREIGN KEY (atendida_por) REFERENCES public.usuarios(id);


--
-- Name: ordenes_investigacion ordenes_investigacion_mp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_investigacion
    ADD CONSTRAINT ordenes_investigacion_mp_id_fkey FOREIGN KEY (mp_id) REFERENCES public.usuarios(id);


--
-- Name: ordenes_investigacion ordenes_investigacion_peticion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_investigacion
    ADD CONSTRAINT ordenes_investigacion_peticion_id_fkey FOREIGN KEY (peticion_id) REFERENCES public.peticiones(id);


--
-- Name: peticiones peticiones_llamado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones
    ADD CONSTRAINT peticiones_llamado_id_fkey FOREIGN KEY (llamado_id) REFERENCES public.llamados(id);


--
-- Name: peticiones peticiones_materia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones
    ADD CONSTRAINT peticiones_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id);


--
-- Name: peticiones peticiones_perito_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones
    ADD CONSTRAINT peticiones_perito_id_fkey FOREIGN KEY (perito_id) REFERENCES public.usuarios(id);


--
-- Name: peticiones peticiones_quien_recibe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones
    ADD CONSTRAINT peticiones_quien_recibe_id_fkey FOREIGN KEY (quien_recibe_id) REFERENCES public.usuarios(id);


--
-- Name: peticiones peticiones_receptor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peticiones
    ADD CONSTRAINT peticiones_receptor_id_fkey FOREIGN KEY (receptor_id) REFERENCES public.usuarios(id);


--
-- Name: solicitud_mp_archivos solicitud_mp_archivos_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_mp_archivos
    ADD CONSTRAINT solicitud_mp_archivos_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes_mp(id) ON DELETE CASCADE;


--
-- Name: solicitudes_mp solicitudes_mp_materia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_mp
    ADD CONSTRAINT solicitudes_mp_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id);


--
-- Name: solicitudes_mp solicitudes_mp_mp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_mp
    ADD CONSTRAINT solicitudes_mp_mp_id_fkey FOREIGN KEY (mp_id) REFERENCES public.usuarios(id);


--
-- Name: solicitudes_mp solicitudes_mp_peticion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_mp
    ADD CONSTRAINT solicitudes_mp_peticion_id_fkey FOREIGN KEY (peticion_id) REFERENCES public.peticiones(id);


--
-- Name: usuarios usuarios_materia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_materia_id_fkey FOREIGN KEY (materia_id) REFERENCES public.materias(id);


--
-- Name: documento_policial_archivos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documento_policial_archivos ENABLE ROW LEVEL SECURITY;

--
-- Name: documentos_policiales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documentos_policiales ENABLE ROW LEVEL SECURITY;

--
-- Name: entrega_archivos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entrega_archivos ENABLE ROW LEVEL SECURITY;

--
-- Name: entregas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

--
-- Name: notificaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: orden_investigacion_archivos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orden_investigacion_archivos ENABLE ROW LEVEL SECURITY;

--
-- Name: ordenes_investigacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ordenes_investigacion ENABLE ROW LEVEL SECURITY;

--
-- Name: peticiones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.peticiones ENABLE ROW LEVEL SECURITY;

--
-- Name: documento_policial_archivos rls_docpol_arch_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_docpol_arch_borrar ON public.documento_policial_archivos FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.documentos_policiales d
  WHERE (d.id = documento_policial_archivos.documento_id))));


--
-- Name: documento_policial_archivos rls_docpol_arch_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_docpol_arch_crear ON public.documento_policial_archivos FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.documentos_policiales d
  WHERE ((d.id = documento_policial_archivos.documento_id) AND (d.creado_por = public.app_uid())))));


--
-- Name: documento_policial_archivos rls_docpol_arch_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_docpol_arch_leer ON public.documento_policial_archivos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.documentos_policiales d
  WHERE (d.id = documento_policial_archivos.documento_id))));


--
-- Name: documentos_policiales rls_docpol_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_docpol_borrar ON public.documentos_policiales FOR DELETE USING (((public.app_uid() IS NOT NULL) AND ((public.app_rol() = 'Administrador'::text) OR (creado_por = public.app_uid()))));


--
-- Name: documentos_policiales rls_docpol_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_docpol_crear ON public.documentos_policiales FOR INSERT WITH CHECK (((public.app_uid() IS NOT NULL) AND (creado_por = public.app_uid())));


--
-- Name: documentos_policiales rls_docpol_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_docpol_leer ON public.documentos_policiales FOR SELECT USING (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> 'Policia'::text) OR (creado_por = public.app_uid()))));


--
-- Name: entrega_archivos rls_entrega_arch_todo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_entrega_arch_todo ON public.entrega_archivos USING (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> ALL (ARRAY['Perito'::text, 'Policia'::text])) OR (EXISTS ( SELECT 1
   FROM public.peticiones p
  WHERE (p.id = entrega_archivos.peticion_id)))))) WITH CHECK (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> ALL (ARRAY['Perito'::text, 'Policia'::text])) OR (EXISTS ( SELECT 1
   FROM public.peticiones p
  WHERE (p.id = entrega_archivos.peticion_id))))));


--
-- Name: entregas rls_entregas_todo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_entregas_todo ON public.entregas USING (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> ALL (ARRAY['Perito'::text, 'Policia'::text])) OR (EXISTS ( SELECT 1
   FROM public.peticiones p
  WHERE (p.id = entregas.peticion_id)))))) WITH CHECK (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> ALL (ARRAY['Perito'::text, 'Policia'::text])) OR (EXISTS ( SELECT 1
   FROM public.peticiones p
  WHERE (p.id = entregas.peticion_id))))));


--
-- Name: notificaciones rls_notificaciones_actualizar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_notificaciones_actualizar ON public.notificaciones FOR UPDATE USING ((us_id = public.app_uid())) WITH CHECK ((us_id = public.app_uid()));


--
-- Name: notificaciones rls_notificaciones_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_notificaciones_borrar ON public.notificaciones FOR DELETE USING ((us_id = public.app_uid()));


--
-- Name: notificaciones rls_notificaciones_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_notificaciones_crear ON public.notificaciones FOR INSERT WITH CHECK ((public.app_uid() IS NOT NULL));


--
-- Name: notificaciones rls_notificaciones_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_notificaciones_leer ON public.notificaciones FOR SELECT USING ((us_id = public.app_uid()));


--
-- Name: ordenes_investigacion rls_ordinv_actualizar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ordinv_actualizar ON public.ordenes_investigacion FOR UPDATE USING (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> 'Ministerio Publico'::text) OR (mp_id = public.app_uid())))) WITH CHECK (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> 'Ministerio Publico'::text) OR (mp_id = public.app_uid()))));


--
-- Name: orden_investigacion_archivos rls_ordinv_arch_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ordinv_arch_crear ON public.orden_investigacion_archivos FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ordenes_investigacion o
  WHERE ((o.id = orden_investigacion_archivos.orden_id) AND (o.mp_id = public.app_uid())))));


--
-- Name: orden_investigacion_archivos rls_ordinv_arch_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ordinv_arch_leer ON public.orden_investigacion_archivos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ordenes_investigacion o
  WHERE (o.id = orden_investigacion_archivos.orden_id))));


--
-- Name: ordenes_investigacion rls_ordinv_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ordinv_crear ON public.ordenes_investigacion FOR INSERT WITH CHECK (((public.app_uid() IS NOT NULL) AND (mp_id = public.app_uid())));


--
-- Name: ordenes_investigacion rls_ordinv_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ordinv_leer ON public.ordenes_investigacion FOR SELECT USING (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> 'Ministerio Publico'::text) OR (mp_id = public.app_uid()))));


--
-- Name: peticiones rls_peticiones_actualizar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_peticiones_actualizar ON public.peticiones FOR UPDATE USING (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> ALL (ARRAY['Perito'::text, 'Policia'::text])) OR (perito_id = public.app_uid())))) WITH CHECK (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> ALL (ARRAY['Perito'::text, 'Policia'::text])) OR (perito_id = public.app_uid()))));


--
-- Name: peticiones rls_peticiones_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_peticiones_crear ON public.peticiones FOR INSERT WITH CHECK (((public.app_uid() IS NOT NULL) AND (COALESCE(public.app_rol(), ''::text) <> ALL (ARRAY['Perito'::text, 'Policia'::text]))));


--
-- Name: peticiones rls_peticiones_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_peticiones_leer ON public.peticiones FOR SELECT USING (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> ALL (ARRAY['Perito'::text, 'Policia'::text])) OR (perito_id = public.app_uid()))));


--
-- Name: solicitudes_mp rls_solmp_actualizar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_solmp_actualizar ON public.solicitudes_mp FOR UPDATE USING (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> 'Ministerio Publico'::text) OR (mp_id = public.app_uid())))) WITH CHECK (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> 'Ministerio Publico'::text) OR (mp_id = public.app_uid()))));


--
-- Name: solicitud_mp_archivos rls_solmp_arch_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_solmp_arch_crear ON public.solicitud_mp_archivos FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.solicitudes_mp s
  WHERE ((s.id = solicitud_mp_archivos.solicitud_id) AND (s.mp_id = public.app_uid())))));


--
-- Name: solicitud_mp_archivos rls_solmp_arch_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_solmp_arch_leer ON public.solicitud_mp_archivos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.solicitudes_mp s
  WHERE (s.id = solicitud_mp_archivos.solicitud_id))));


--
-- Name: solicitudes_mp rls_solmp_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_solmp_crear ON public.solicitudes_mp FOR INSERT WITH CHECK (((public.app_uid() IS NOT NULL) AND (mp_id = public.app_uid())));


--
-- Name: solicitudes_mp rls_solmp_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_solmp_leer ON public.solicitudes_mp FOR SELECT USING (((public.app_uid() IS NOT NULL) AND ((COALESCE(public.app_rol(), ''::text) <> 'Ministerio Publico'::text) OR (mp_id = public.app_uid()))));


--
-- Name: solicitud_mp_archivos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitud_mp_archivos ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitudes_mp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitudes_mp ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict DZe9QZnJL7jHWTAtN4cKvlrfw65Eax1B8k7Ih127Hf9VzKmgDldCn87ApgFURoc

