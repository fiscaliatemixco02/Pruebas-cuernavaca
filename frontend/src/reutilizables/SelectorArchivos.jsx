// frontend/src/reutilizables/SelectorArchivos.jsx
//
// Reemplaza al <input type="file"> normal. El texto "Choose file / No file chosen" que muestra
// el navegador depende del idioma del navegador y no se puede cambiar; este componente lo
// sustituye por un botón y mensajes en español.
//
// Se usa igual que el input:
//   <SelectorArchivos accept="application/pdf" multiple onChange={(e) => ...} />

import { useRef, useState } from "react";

// Oculto a la vista pero sigue en el formulario (así funcionan `required` y el teclado)
const ocultar = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export default function SelectorArchivos({ onChange, multiple, texto, ...resto }) {
  const [elegidos, setElegidos] = useState("");
  const entrada = useRef(null);

  function alCambiar(e) {
    const nombres = Array.from(e.target.files || []).map((f) => f.name);
    onChange?.(e);
    // Si la pantalla ya tomó los archivos y vació el campo (los muestra ella en su lista),
    // no repetimos el nombre aquí
    const consumidos = (e.target.files?.length || 0) === 0;
    setElegidos(consumidos ? "" : nombres.length === 1 ? nombres[0] : `${nombres.length} archivos seleccionados`);
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <label className="btn btn-secondary" style={{ cursor: "pointer", margin: 0, position: "relative" }}>
        {texto || (multiple ? "Seleccionar archivos" : "Seleccionar archivo")}
        <input ref={entrada} type="file" multiple={multiple} onChange={alCambiar} style={ocultar} {...resto} />
      </label>
      {elegidos ? <span className="field-hint" style={{ margin: 0 }}>{elegidos}</span> : null}
    </span>
  );
}