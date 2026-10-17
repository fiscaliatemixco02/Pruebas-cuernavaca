CREATE TABLE IF NOT EXISTS ordenes_investigacion (
    id SERIAL PRIMARY KEY,
    mp_id INTEGER NOT NULL REFERENCES usuarios(id),
    numero_carpeta TEXT NOT NULL,
    area TEXT NOT NULL CHECK (area IN ('POLICIAL', 'ANALISIS')),
    breve_resena TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'ATENDIDA')),
    atendida_por INTEGER REFERENCES usuarios(id),
    atendida_en TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_investigacion_mp
    ON ordenes_investigacion(mp_id, created_at DESC);

CREATE TABLE IF NOT EXISTS orden_investigacion_archivos (
    id SERIAL PRIMARY KEY,
    orden_id INTEGER NOT NULL
        REFERENCES ordenes_investigacion(id) ON DELETE CASCADE,
    nombre_original VARCHAR(255),
    ruta VARCHAR(500) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orden_inv_archivos_orden
    ON orden_investigacion_archivos(orden_id);

DROP VIEW IF EXISTS vw_ordenes_investigacion;

CREATE VIEW vw_ordenes_investigacion AS
SELECT o.*, u.nombre AS nombre_mp, a.nombre AS nombre_aic
FROM ordenes_investigacion o
JOIN usuarios u ON u.id = o.mp_id
LEFT JOIN usuarios a ON a.id = o.atendida_por;