export default function BotonesPdfOrden({ ordenId, pdfs, onVer }) {
  if (!pdfs || pdfs.length === 0) return <span>Sin archivos</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
      {pdfs.map((p) => (
        <li key={p.id} style={{ marginBottom: 4 }}>
          {p.nombre_original}{" "}
          <button type="button" className="btn btn-secondary" onClick={() => onVer(ordenId, p.id)}>
            Ver
          </button>
        </li>
      ))}
    </ul>
  );
}