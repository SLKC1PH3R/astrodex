"use client";
import { useEffect, useRef, useState } from "react";

/* Éléments de progression partagés : emblème de rang, barre d'XP, compte à rebours de la réserve de boosters.
   Les données viennent de l'API (progression : niveau, xp, rang, emblème ; reserve : stock, max, prochain_dans).
   Styles : app/observatoire.css (.pg-*). */

export function Embleme({ e, size = 44, title, off = false }) {
  if (!e) return null;
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
