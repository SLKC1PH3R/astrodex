"use client";
import { useEffect, useRef, useState } from "react";

/* Éléments de progression partagés : emblème de rang, barre d'XP, compte à rebours de la réserve de boosters.
   Les données viennent de l'API (progression : niveau, xp, rang, emblème ; reserve : stock, max, prochain_dans).
   Styles : app/observatoire.css (.pg-*). */

/* Ornements dessinés (public/ornements/, découpés de la planche fournie par Jeremy) :
   niveau-5 … niveau-40 : emblème de chaque palier de niveau (un par rang à partir de la Comète) ;
   titre-5 … titre-40 : bannière du titre de niveau ; ranked-1 … ranked-8 et ranked-plaque-* : rangs classés de bataille. */
export const LEVEL_TITLES = [[5, "Rêveur d'étoiles"], [10, "Chasseur de comètes"], [15, "Arpenteur lunaire"], [20, "Pilote interplanétaire"],
  [25, "Dompteur de soleils"], [30, "Voyageur interstellaire"], [35, "Architecte des nébuleuses"], [40, "Légende de la galaxie"]];
export const ornementSrc = niveau => (niveau >= 5 ? `/ornements/niveau-${Math.min(40, Math.floor(niveau / 5) * 5)}.webp` : null);
const RATIO = 180 / 116; // proportions des emblèmes découpés

/* Emblème d'un rang : l'ornement dessiné du palier (à partir du niveau 5), sinon une pastille colorée. */
export function Embleme({ e, size = 44, title, off = false }) {
  if (!e) return null;
  const src = ornementSrc(e.niveau);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={`pg-orn${off ? " off" : ""}`} src={src} alt={title || ""} title={title || `Emblème ${e.nom}`}
        style={{ height: size, width: Math.round(size * RATIO) }} aria-hidden={title ? undefined : "true"} />
    );
  }
  return (
    <span className={`pg-emb${off ? " off" : ""}`} style={{ "--ec": e.couleur, "--es": `${size}px` }} title={title || `Emblème ${e.nom}`} aria-hidden={title ? undefined : "true"}>
      <i className={`ph-fill ${e.icone}`} />
    </span>
  );
}

export function LevelBar({ prog, compact = false }) {
  if (!prog) return null;
  const max = prog.xp_suivant == null;
  const pct = max ? 100 : Math.round((100 * (prog.xp - prog.xp_niveau)) / (prog.xp_suivant - prog.xp_niveau));
  return (
    <div className={`pg-bar${compact ? " sm" : ""}`}>
      <div className="pg-bar-head">
        <span>Niveau <b>{prog.niveau}</b>{!compact && <> · {prog.rang.nom}</>}</span>
        <span>{max ? "Niveau maximal" : `${(prog.xp - prog.xp_niveau).toLocaleString("fr-FR")} / ${(prog.xp_suivant - prog.xp_niveau).toLocaleString("fr-FR")} XP`}</span>
      </div>
      <div className="sx-bar" role="progressbar" aria-label={`Progression vers le niveau ${prog.niveau + 1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <i style={{ width: `${pct}%`, "--bc": prog.rang.couleur }} />
      </div>
    </div>
  );
}

export const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/* Secondes restantes avant le prochain booster, décomptées en direct ; onZero quand la recharge tombe. */
export function useCountdown(seconds, onZero) {
  const [left, setLeft] = useState(seconds);
  const cb = useRef(onZero);
  cb.current = onZero;
  useEffect(() => {
    setLeft(seconds);
    if (seconds == null) return undefined;
    const end = Date.now() + seconds * 1000;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) { clearInterval(t); setTimeout(() => cb.current?.(), 800); }
    }, 1000);
    return () => clearInterval(t);
  }, [seconds]);
  return left;
}

/* Titre affiché : bannière dessinée pour les titres de niveau, pastille pour les titres de succès. */
export function TitreAffiche({ titre, height = 58 }) {
  if (!titre) return null;
  const lvl = LEVEL_TITLES.find(([, t]) => t === titre)?.[0];
  if (lvl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="pg-banner" src={`/ornements/titre-${lvl}.webp`} alt={`Titre : ${titre}`} style={{ height, width: Math.round(height * 636 / 116) }} />;
  }
  return <span className="sx-tag">TITRE · {titre.toUpperCase()}</span>;
}

/* Rang classé de bataille (palier 1 à 8) : blason seul, ou blason avec sa plaque (nom et devise dessinés). */
export function BlasonClasse({ rang, size = 48, plaque = false }) {
  if (!rang?.palier) return null;
  if (plaque) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="pg-banner" src={`/ornements/ranked-plaque-${rang.palier}.webp`} alt={`Rang ${rang.nom} · ${rang.devise}`} style={{ height: size, width: Math.round(size * 630 / 112) }} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="pg-orn" src={`/ornements/ranked-${rang.palier}.webp`} alt="" title={`Rang ${rang.nom}`} style={{ height: size, width: Math.round(size * 230 / 112) }} aria-hidden="true" />;
}
