"use client";

/* Sélecteur de série, même style visuel que les filtres de CardGrid (.ax-filters / btn btn-secondary). */
export default function SeriesTabs({ series, value, onChange }) {
  if (!series || series.length < 2) return null;
  return (
    <div className="ax-filters" role="tablist" aria-label="Série" style={{ padding: "0 32px" }}>
      {series.map(s => (
        <button
          key={s.code}
          type="button"
          role="tab"
          className="btn btn-secondary"
          aria-pressed={value === s.code}
          aria-selected={value === s.code}
          onClick={() => onChange(s.code)}
        >
          {s.nom}
        </button>
      ))}
    </div>
  );
}
