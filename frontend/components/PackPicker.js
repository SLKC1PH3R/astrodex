"use client";
import PackArt from "@/components/PackArt";
import { coffretTheme } from "@/lib/coffrets";
import { useCoverflow, cfStyle } from "@/lib/coverflow";

const N = 20;
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const toRoman = code => ROMAN[Number(String(code || "").replace(/\D/g, ""))] || code || "I";

/* Carrousel 3D de 20 paquets identiques d'une série, affiché après le trou noir. Glisser amène
   un paquet latéral au centre ; toucher le paquet déjà centré lance l'ouverture (SachetOpening,
   inchangée). Styles : app/coverflow.css (.cv-*, .pka-*) + app/packpicker.css (.pk-*). */
export default function PackPicker({ booster, onPick, onBack }) {
  const theme = coffretTheme(booster);
  const roman = toRoman(booster.serie);
  const cf = useCoverflow(N, { initial: Math.floor(N / 2) });

  return (
    <div className="pk-picker" style={{ "--cc": theme.couleur }}>
      <button className="btn btn-ghost pk-back" type="button" onClick={onBack}>
        <i className="ph ph-arrow-left" aria-hidden="true" />Changer de série
      </button>
      <div className="cv-wrap">
        <span className="cv-hint">Touche le paquet que tu veux ouvrir</span>
        <div className="cv-stage" {...cf.pointer}>
          {Array.from({ length: N }, (_, i) => (
            <button key={i} type="button" className="cv-item" style={cfStyle(i - cf.active)}
              aria-label={i === cf.active ? `Ouvrir un paquet ${theme.titre}` : `Amener ce paquet au centre`}
              onClick={() => (i === cf.active ? onPick() : cf.setActive(i))}>
              <PackArt theme={theme} roman={roman} nbCartes={booster.nb_cartes} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
