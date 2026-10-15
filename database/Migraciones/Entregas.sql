CREATE TABLE IF NOT EXISTS entrega_archivos (
    id SERIAL PRIMARY KEY,
    peticion_id BIGINT NOT NULL REFERENCES peticiones(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL,
    archivo_nombre VARCHAR(255) NOT NULL,
    archivo_ruta VARCHAR(500) NOT NULL,
    subido_por INTEGER REFERENCES usuarios(id),
    subido_en TIMESTAMP NOT NULL DEFAULT NOW()
);


INSERT INTO roles (nom_rol) VALUES ('AIC'), ('Policia');

  -- Nombre del jefe de grupo (lo captura el AIC al registrar una petición)
ALTER TABLE peticiones ADD COLUMN IF NOT EXISTS jefe_grupo VARCHAR(150);
ALTER TABLE entrega_archivos ADD COLUMN IF NOT EXISTS descripcion VARCHAR(500);