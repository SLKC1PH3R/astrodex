"use client";
import { coffretTheme } from "@/lib/coffrets";

const N = 20;

/* Spirale de paquets identiques d'une série, affichée après le trou noir. Le joueur en touche un
   au hasard (visuellement interchangeables) pour passer à l'ouverture (SachetOpening, inchangée).
   Styles : app/packpicker.css (.pk-*). */
export default function PackPicker({ booster, onPick, onBack }) {
  const theme = coffretTheme(booster);
  return (
    <div className="pk-picker" style={{ "--cc": theme.couleur }}>
      <button className="btn btn-ghost pk-back" type="button" onClick={onBack}>
        <i className="ph ph-arrow-left" aria-hidden="true" />Changer de série
      </button>
      <h2 className="pk-title">Choisis un paquet</h2>
      <p className="pk-sub">{theme.titre} · {N} paquets identiques, à toi de choisir</p>
      <div className="pk-grid" role="list">
        {Array.from({ length: N }, (_, i) => (
          <button key={i} type="button" className="pk-item" role="listitem"
            style={{ animationDelay: `${(i % 7) * 120}ms` }}
            aria-label={`Ouvrir un paquet ${theme.titre}`} onClick={onPick}>
            <span className="pk-port">
              {theme.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={`pk-art ${theme.cadrage}`} src={theme.image} alt="" draggable={false} />
              )}
            </span>
            <span className="pk-glow" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
