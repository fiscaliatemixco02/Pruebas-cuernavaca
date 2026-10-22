// frontend/src/reutilizables/SelectorArchivos.jsx
import { useRef, useState } from "react";

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