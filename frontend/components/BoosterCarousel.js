"use client";
import { useEffect } from "react";
import PackArt from "@/components/PackArt";
import { coffretTheme } from "@/lib/coffrets";
import { useCoverflow, cfStyle } from "@/lib/coverflow";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const toRoman = code => ROMAN[Number(String(code || "").replace(/\D/g, ""))] || code || "I";

/* Carrousel 3D des séries disponibles (un paquet par série active). Glisser ou toucher un paquet
   latéral le ramène au centre ; le paquet centré est celui transmis à onSelect.
   Styles : app/coverflow.css (.cv-*, .pka-*). */
export default function BoosterCarousel({ boosters, selected, onSelect }) {
  const initial = Math.max(0, boosters?.findIndex(b => b.code === selected?.code) ?? 0);
  const cf = useCoverflow(boosters?.length || 0, { initial });

  useEffect(() => {
    if (boosters?.[cf.active]) onSelect(boosters[cf.active]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf.active, boosters]);

  if (!boosters || boosters.length < 2) return null;
  return (
    <div className="cv-wrap">
      <span className="cv-hint">Choisis une série</span>
      <div className="cv-stage" {...cf.pointer}>
        {boosters.map((b, i) => {
          const theme = coffretTheme(b);
          return (
            <button key={b.code} type="button" className="cv-item" style={cfStyle(i - cf.active)}
              aria-label={`${b.nom} — ${b.nb_cartes} cartes`} aria-current={i === cf.active || undefined}
              onClick={() => cf.setActive(i)}>
              <PackArt theme={theme} roman={toRoman(b.serie)} nbCartes={b.nb_cartes} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
