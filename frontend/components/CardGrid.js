"use client";
import { useEffect, useMemo, useState } from "react";
import Carte, { ORDER, RAR } from "@/components/Carte";
import PhotoDive from "@/components/PhotoDive";

const PAGE_SIZE = 120;

/* Grille filtrable. owned = Map(id → quantité) pour la collection ; null pour le catalogue complet.
   Les Légendaires révélées peuvent être ouvertes en plein écran (PhotoDive).
   Affichage par pages de PAGE_SIZE : au-delà de quelques milliers de cartes (séries comme le
   Catalogue NGC), tout rendre en une fois ralentit sérieusement le montage et le défilement. */
export default function CardGrid({ cards, owned = null }) {
  const [filter, setFilter] = useState("all");
  const [dive, setDive] = useState(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const isColl = owned !== null;

  const shown = useMemo(() => cards.filter(c =>
    filter === "all" ? true
      : filter === "owned" ? owned?.has(c.id)
      : filter === "missing" ? !owned?.has(c.id)
      : c.rarete === filter), [cards, owned, filter]);

  useEffect(() => { setVisible(PAGE_SIZE); }, [filter]);
  const page = shown.slice(0, visible);

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
        {page.map(c => (!isColl || owned.has(c.id)) ? (
          <div key={c.id} className="ax-lift">
            <Carte c={c} qty={isColl ? owned.get(c.id) : 0} onDive={(carte, rect) => setDive({ carte, rect })} />
          </div>
        ) : (
          <div key={c.id} className="ax-missing" title="Carte pas encore obtenue">
            <i className="ax-dot" style={{ background: RAR[c.rarete].color }} />{String(c.numero).padStart(3, "0")}
          </div>
        ))}
      </div>
      {visible < shown.length && (
        <div className="ax-loadmore">
          <button className="btn btn-secondary" type="button" onClick={() => setVisible(v => v + PAGE_SIZE)}>
            Charger plus ({shown.length - visible} restantes)
          </button>
        </div>
      )}
      {dive && <PhotoDive {...dive} onClose={() => setDive(null)} />}
    </section>
  );
}
