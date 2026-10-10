"use client";
import Coffret from "@/components/Coffret";
import { coffretTheme } from "@/lib/coffrets";

/* Carrousel horizontal des coffrets disponibles (un par série active).
   Le joueur fait défiler et clique celui qu'il veut ouvrir ; la scène d'ouverture
   prend ensuite le relais sur le coffret sélectionné. Styles : app/coffret.css (.co-carousel*). */
export default function BoosterCarousel({ boosters, selected, onSelect }) {
  if (!boosters || boosters.length < 2) return null;
  return (
    <div className="co-carousel" role="radiogroup" aria-label="Choisir un coffret">
      {boosters.map(b => {
        const theme = coffretTheme(b);
        const isSel = selected?.code === b.code;
        return (
          <div key={b.code} className="co-carousel-item" data-selected={isSel || undefined}>
            <button
              type="button"
              className="co-carousel-btn"
              role="radio"
              aria-checked={isSel}
              aria-label={`${b.nom} — ${b.nb_cartes} cartes`}
              onClick={() => onSelect(b)}
            >
              <Coffret theme={theme} nbCartes={b.nb_cartes} roman={b.serie} />
            </button>
            <span className="co-carousel-label">{theme.titre}</span>
          </div>
        );
      })}
    </div>
  );
}
