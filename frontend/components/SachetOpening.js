"use client";
import { useEffect, useRef, useState } from "react";
import Carte, { ORDER, RAR } from "@/components/Carte";
import PhotoDive from "@/components/PhotoDive";
import { coffretTheme } from "@/lib/coffrets";

/* Ouverture « Déchirure » : on déchire la bande du sachet → les cartes sortent en pile, faces visibles,
   de la moins rare à la plus rare → on touche (ou on fait glisser) la carte du dessus pour passer à la suivante
   → récapitulatif. Même interface que CoffretOpening : onOpen() renvoie une promesse de la liste de cartes (api.open).
   Styles : app/sachet.css (.sa-*). */

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const BIG_TIERS = new Set(["R", "UR", "L"]);
const SWIPE = 70; // px à parcourir pour envoyer la carte

/* Tri stable par rareté croissante : la meilleure carte arrive en dernier. */
const byRarity = cards => cards
  .map((c, k) => ({ c, k }))
  .sort((a, b) => ORDER.indexOf(a.c.rarete) - ORDER.indexOf(b.c.rarete) || a.k - b.k)
  .map(x => x.c);

export default function SachetOpening({ booster, onOpen, onDone, onError, disabled = false }) {
  const [phase, setPhase] = useState("idle"); // idle → tear → stack → done
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [dirs, setDirs] = useState([]);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dive, setDive] = useState(null);
  const alive = useRef(true);
  const reduced = useRef(false);
  const ptr = useRef(null);
  const finished = useRef(false);
  useEffect(() => () => { alive.current = false; }, []);

  const theme = coffretTheme(booster);
  const roman = ROMAN[Number(String(booster?.serie || "").replace(/\D/g, ""))] || booster?.serie || "I";
  const n = cards.length;
  const top = cards[Math.min(idx, n - 1)];
  const best = cards[n - 1];

  const tear = async () => {
    if (disabled || phase !== "idle") return;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    finished.current = false;
    setPhase("tear");
    let drawn;
    try {
      [drawn] = await Promise.all([onOpen(), reduced.current ? null : sleep(950)]);
    } catch (e) {
      if (alive.current) { setPhase("idle"); onError?.(e); }
      return;
    }
    if (!alive.current) return;
    const sorted = byRarity(drawn);
    setCards(sorted); setDirs(sorted.map(() => -1)); setIdx(0); setDrag(0);
    setPhase("stack");
  };

  const finish = list => {
    if (finished.current) return;
    finished.current = true;
    setPhase("done");
    onDone?.(list);
  };

  const next = (dir = -1) => {
    if (phase !== "stack" || idx >= n) return;
    setDirs(d => { const c = d.slice(); c[idx] = dir; return c; });
    const k = idx + 1;
    setIdx(k); setDrag(0);
    if (k >= n) setTimeout(() => { if (alive.current) finish(cards); }, reduced.current ? 0 : 420);
  };

  /* Toucher = carte suivante ; glisser = la carte part du côté du geste. */
  const pointer = {
    onPointerDown: e => {
      if (e.button !== undefined && e.button !== 0) return;
      ptr.current = { x: e.clientX, moved: false };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(true);
    },
    onPointerMove: e => {
      const p = ptr.current; if (!p) return;
      const dx = e.clientX - p.x;
      if (Math.abs(dx) > 6) p.moved = true;
      setDrag(dx);
    },
    onPointerUp: e => {
      const p = ptr.current; ptr.current = null; setDragging(false);
      if (!p) return;
      const dx = e.clientX - p.x;
      if (!p.moved || Math.abs(dx) > SWIPE) next(dx > 0 ? 1 : -1);
      else setDrag(0);
    },
    onPointerCancel: () => { ptr.current = null; setDragging(false); setDrag(0); },
    onClick: e => { if (e.detail === 0) next(-1); }, // clavier (Entrée / Espace)
  };

  const showRays = phase === "stack" && idx < n && BIG_TIERS.has(top?.rarete);

  return (
    <div className="sa-stage" style={{ "--cc": theme.couleur }} data-phase={phase} data-dragging={dragging || undefined}>
      {(phase === "idle" || phase === "tear") && (
        <>
          <button className="sa-pack" type="button" onClick={tear} disabled={disabled || phase !== "idle"}
            data-phase={phase} aria-label={`Déchirer ${booster?.nom || "le booster"}`}>
            <span className="sa-strip"><i className="ph ph-scissors" aria-hidden="true" />Déchirer ici</span>
            <span className="sa-body">
              <span className="sa-foil" />
              <span className="sa-brand">ASTRODEX</span>
              <span className="sa-port">
                {theme.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={`sa-art ${theme.cadrage}`} src={theme.image} alt="" draggable={false} />
                )}
              </span>
              <span className="sa-title"><small>BOOSTER</small><b>{theme.titre}</b></span>
              <span className="sa-foot"><span>SÉRIE {roman}</span><span>{booster?.nb_cartes || 5} CARTES</span></span>
              <span className="sa-seal" />
            </span>
            <span className="sa-leak" />
          </button>
          {phase === "idle" && (
            <span className="sa-hint">{disabled ? "Plus de booster disponible aujourd'hui" : "Touche le haut du sachet pour le déchirer"}</span>
          )}
        </>
      )}

      {phase === "stack" && (
        <>
          <div className="sa-stack">
            {showRays && <div key={idx} className="sa-rays" style={{ "--rc": RAR[top.rarete].color }} />}
            {cards.map((c, k) => {
              const d = k - idx;
              let tf, op = 1;
              if (d < 0) { tf = `translate(${dirs[k] * 150}%, -4%) rotate(${dirs[k] * 26}deg)`; op = 0; }
              else if (d === 0) tf = `translateX(${drag}px) rotate(${drag * 0.05}deg)`;
              else { const s = Math.min(d, 3); tf = `translateY(${s * 12}px) scale(${1 - s * 0.05})`; if (d > 2) op = 0; }
              return (
                <div key={`${c.id}-${k}`} className="sa-card" data-top={d === 0 || undefined}
                  data-rare={d === 0 && BIG_TIERS.has(c.rarete) ? "" : undefined}
                  style={{ transform: tf, opacity: op, zIndex: d < 0 ? 20 : 10 - d, "--rc": RAR[c.rarete]?.color }}>
                  <Carte c={c} revealed nouvelle={c.nouvelle} />
                </div>
              );
            })}
            <button className="sa-hit" type="button" {...pointer}
              aria-label={`Carte suivante — ${top?.nom}, ${RAR[top?.rarete]?.label} (${Math.min(idx + 1, n)} sur ${n})`} />
          </div>
          <div className="sa-count" aria-live="polite">
            <b>Carte {Math.min(idx + 1, n)} / {n}</b>
            <span>Touche ou fais glisser la carte</span>
          </div>
          <button className="btn btn-secondary sa-skip" type="button" onClick={() => finish(cards)}>Tout révéler</button>
        </>
      )}

      {phase === "done" && (
        <div className="sa-recap">
          {cards.map((c, k) => (
            <div key={`${c.id}-${k}`} className="sa-mini" data-best={c === best && BIG_TIERS.has(c.rarete) ? "" : undefined}
              style={{ animationDelay: `${k * 70}ms`, "--rc": RAR[c.rarete]?.color }}>
              <Carte c={c} revealed nouvelle={c.nouvelle} onDive={(carte, rect) => setDive({ carte, rect })} />
            </div>
          ))}
        </div>
      )}

      {dive && <PhotoDive {...dive} onClose={() => setDive(null)} />}
    </div>
  );
}
