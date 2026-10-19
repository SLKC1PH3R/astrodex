"use client";
import { useEffect, useRef } from "react";
import PackArt from "@/components/PackArt";
import { coffretTheme } from "@/lib/coffrets";
import { useCoverflow, cfStyle } from "@/lib/coverflow";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const toRoman = code => ROMAN[Number(String(code || "").replace(/\D/g, ""))] || code || "I";

/* Carrousel 3D des séries disponibles (un paquet par série active), qui boucle. Glisser, molette,
   flèches du clavier ou toucher un paquet latéral le ramène au centre ; le paquet centré est
   celui transmis à onSelect. leaving : le paquet choisi est aspiré (trou noir) et les autres
   sont attirés vers lui. Styles : app/coverflow.css (.cv-*, .pka-*). */
export default function BoosterCarousel({ boosters, selected, onSelect, leaving = false }) {
  const n = boosters?.length || 0;
  const initial = Math.max(0, boosters?.findIndex(b => b.code === selected?.code) ?? 0);
  const cf = useCoverflow(n, { initial, loop: true });
  const memo = useRef({ pos: null, shift: 0, prev: {}, cur: {} });

  useEffect(() => {
    if (boosters?.[cf.active]) onSelect(boosters[cf.active]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf.active, boosters]);

  if (!boosters || n < 2) return null;
  const current = boosters[cf.active];
  // décalages à la position précédente : un paquet dont le décalage ne suit pas le déplacement
  // global vient de passer d'un bord à l'autre en bouclant
  if (memo.current.pos !== cf.pos) {
    memo.current = { pos: cf.pos, shift: memo.current.pos == null ? 0 : cf.pos - memo.current.pos, prev: memo.current.cur, cur: {} };
  }
  return (
    <div className={`cv-wrap${leaving ? " cv-leaving" : ""}`}>
      <span className="cv-hint">Choisis un booster</span>
      <div className="cv-stage" tabIndex={0} role="group" aria-roledescription="carrousel"
        aria-label="Séries disponibles" {...cf.pointer}>
        {boosters.map((b, i) => {
          const theme = coffretTheme(b);
          const off = cf.offset(i);
          // en bouclant, un paquet passe d'un bord à l'autre : on le téléporte au lieu de le faire traverser
          const before = memo.current.prev[b.code];
          const jumped = before != null && before - off !== memo.current.shift;
          memo.current.cur[b.code] = off;
          const isActive = off === 0;
          return (
            <button key={b.code} type="button" tabIndex={isActive ? 0 : -1}
              className={`cv-item${isActive ? " is-active" : ""}${isActive && leaving ? " cv-suck" : ""}`}
              style={{ ...cfStyle(off), ...(jumped ? { transition: "none" } : null) }}
              aria-label={`${b.nom} — ${b.nb_cartes} cartes`} aria-current={isActive || undefined}
              onClick={() => cf.setActive(i)}>
              <PackArt theme={theme} />
            </button>
          );
        })}
      </div>
      {current && (
        <div className="cv-caption" aria-live="polite">
          <b>{coffretTheme(current).titre}</b>
          <span>{current.nb_cartes} cartes par paquet · {current.nb_cartes_contenu
            ? `${current.nb_cartes_contenu.toLocaleString("fr-FR")} cartes à découvrir` : `série ${toRoman(current.serie)}`}</span>
          <span className="cv-dots" aria-hidden="true">
            {boosters.map((b, i) => <i key={b.code} className={i === cf.active ? "on" : undefined} />)}
          </span>
        </div>
      )}
    </div>
  );
}
