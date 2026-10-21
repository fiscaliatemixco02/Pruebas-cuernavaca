
CREATE TABLE IF NOT EXISTS documentos_policiales (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('ENTREVISTA', 'INFORME_INICIAL')),
    numero_carpeta TEXT NOT NULL,
    iniciales_victima TEXT NOT NULL,
    creado_por INTEGER NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_policiales_tipo
    ON documentos_policiales(tipo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documentos_policiales_creador
    ON documentos_policiales(creado_por);

CREATE TABLE IF NOT EXISTS documento_policial_archivos (
    id SERIAL PRIMARY KEY,
    documento_id INTEGER NOT NULL
        REFERENCES documentos_policiales(id) ON DELETE CASCADE,
    nombre_original VARCHAR(255),
    ruta VARCHAR(500) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documento_policial_archivos_doc
    ON documento_policial_archivos(documento_id);