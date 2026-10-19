"use client";
import PackRing from "@/components/PackRing";
import { coffretTheme } from "@/lib/coffrets";

const N = 20;
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const toRoman = code => ROMAN[Number(String(code || "").replace(/\D/g, ""))] || code || "I";

/* Étape « choisir un paquet » de /jeu, après le trou noir : 20 paquets identiques de la série
   sur un anneau qui tourne en boucle (components/PackRing.js). Toucher le paquet de devant lance
   l'ouverture (SachetOpening, inchangée). intro : les paquets jaillissent du centre en spirale.
   Styles : app/packpicker.css (.pk-*), app/packring.css (.pr-*), app/coverflow.css (.cv-hint, .pka-*). */
export default function PackPicker({ booster, onPick, onBack, intro = true }) {
  const theme = coffretTheme(booster);
  return (
    <div className="pk-picker" style={{ "--cc": theme.couleur }}>
      <button className="btn btn-ghost pk-back" type="button" onClick={onBack}>
        <i className="ph ph-arrow-left" aria-hidden="true" />Changer de série
      </button>
      <span className="cv-hint">Fais tourner l'anneau, puis touche le paquet de devant</span>
      <PackRing count={N} theme={theme} roman={toRoman(booster.serie)} nbCartes={booster.nb_cartes}
        onPick={onPick} intro={intro} />
    </div>
  );
}
