--
-- PostgreSQL database dump
--

\restrict kskXDbHm0f75gnIapAjlAxqb1hhvWCEfKzYjrXFrlsqUU2nKrjOrka2aAcUnhsc

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
-- Data for Name: acciones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.acciones (id, nom_accion) FROM stdin;
1	Inicio de sesión
2	Cierre de sesión
3	Crear petición
4	Actualizar petición
5	Crear usuario
6	Actualizar usuario
7	Firma de recepción
8	Ver contraseña
\.


--
-- Data for Name: llamados; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.llamados (id, codigo, es_automatico) FROM stdin;
6	SP	t
\.


--
-- Data for Name: contador_llamados; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contador_llamados (llamado_id, anio, ultimo_numero) FROM stdin;
\.


--
-- Data for Name: materias; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.materias (id, nombre, activo) FROM stdin;
8	Psicología	t
25	Criminalistica	t
26	Informatica	t
27	Medicina legal	t
28	Acústica forense	t
\.


--
-- Data for Name: llamado_materias; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.llamado_materias (llamado_id, materia_id) FROM stdin;
6	8
6	25
6	26
6	27
6	28
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, nom_rol) FROM stdin;
1	Administrador
2	Receptor
3	Perito
4	Consulta
5	Ministerio Publico
6	AIC
7	Policia
8	Creador de Cuentas
\.


--
-- Name: acciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.acciones_id_seq', 8, true);


--
-- Name: llamados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.llamados_id_seq', 9, true);


--
-- Name: materias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.materias_id_seq', 39, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 8, true);


--
-- PostgreSQL database dump complete
--

\unrestrict kskXDbHm0f75gnIapAjlAxqb1hhvWCEfKzYjrXFrlsqUU2nKrjOrka2aAcUnhsc

