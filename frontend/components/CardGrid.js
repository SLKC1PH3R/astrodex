"use client";
import { useMemo, useState } from "react";
import Carte, { ORDER, RAR } from "@/components/Carte";

/* Grille filtrable. owned = Map(id → quantité) pour la collection ; null pour le catalogue complet. */
export default function CardGrid({ cards, owned = null }) {
  const [filter, setFilter] = useState("all");
  const isColl = owned !== null;

  const shown = useMemo(() => cards.filter(c =>
    filter === "all" ? true
      : filter === "owned" ? owned?.has(c.id)
      : filter === "missing" ? !owned?.has(c.id)
      : c.rarete === filter), [cards, owned, filter]);

  const nOwned = isColl ? cards.filter(c => owned.has(c.id)).length : 0;
  const pct = cards.length ? Math.round(nOwned / cards.length * 100) : 0;
  const filters = [["all", "Toutes"], ...(isColl ? [["owned", "Possédées"], ["missing", "Manquantes"]] : []), ...ORDER.map(r => [r, RAR[r].label])];

  return (
    <section className="ax-grid-page">
      <div className="ax-grid-head">
        <div className="ax-filters">
          {filters.map(([k, label]) => (
            <button key={k} className="btn btn-secondary" type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {RAR[k] && <i className="ax-dot" style={{ background: RAR[k].color }} />}{label}
            </button>
          ))}
        </div>
        {isColl && (
          <div className="ax-progress">
            <div><span>Série complétée</span><b>{nOwned}/{cards.length} · {pct} %</b></div>
            <div className="ax-track"><i style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </div>
      <div className="ax-grid">
        {shown.map(c => (!isColl || owned.has(c.id)) ? (
          <div key={c.id} className="ax-lift"><Carte c={c} qty={isColl ? owned.get(c.id) : 0} /></div>
        ) : (
          <div key={c.id} className="ax-missing" title="Carte pas encore obtenue">
            <i className="ax-dot" style={{ background: RAR[c.rarete].color }} />{String(c.numero).padStart(3, "0")}
          </div>
        ))}
      </div>
    </section>
  );
}
