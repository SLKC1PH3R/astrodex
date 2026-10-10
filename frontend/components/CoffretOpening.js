"use client";
import { useEffect, useRef, useState } from "react";
import Carte from "@/components/Carte";
import Coffret from "@/components/Coffret";
import { coffretTheme } from "@/lib/coffrets";

const PHASES = ["idle", "shake", "lid", "rise", "fan", "done"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/* Ouverture animée : tremblement → couvercle qui s'envole → cartes qui montent → éventail → retournement une à une.
   onOpen() doit renvoyer une promesse de la liste de cartes (api.open). */
export default function CoffretOpening({ booster, onOpen, onDone, onError, disabled = false }) {
  const [phase, setPhase] = useState("idle");
  const [cards, setCards] = useState([]);
  const [shown, setShown] = useState(0);
  const alive = useRef(true);
  const skip = useRef(false);
  useEffect(() => () => { alive.current = false; }, []);

  const theme = coffretTheme(booster);
  const P = PHASES.indexOf(phase);
  const roman = ROMAN[Number(String(booster?.serie || "").replace(/\D/g, ""))] || booster?.serie || "I";

  const wait = async ms => { if (!skip.current) await sleep(ms); return alive.current; };

  const open = async () => {
    if (disabled || (P > 0 && P < 5)) return;
    skip.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCards([]); setShown(0);
    if (P === 5) { setPhase("idle"); await sleep(400); }
    setPhase("shake");
    let drawn;
    try {
      [drawn] = await Promise.all([onOpen(), skip.current ? null : sleep(500)]);
    } catch (e) {
      if (alive.current) { setPhase("idle"); onError?.(e); }
      return;
    }
    if (!alive.current) return;
    setCards(drawn);
    setPhase("lid");
    if (!(await wait(600))) return;
    setPhase("rise");
    if (!(await wait(800))) return;
    setPhase("fan");
    if (!(await wait(800))) return;
    for (let k = 0; k < drawn.length; k++) {
      if (skip.current) break;
      setShown(k + 1);
      if (!(await wait(280))) return;
    }
    setShown(drawn.length);
    setPhase("done");
    onDone?.(drawn);
  };
  const revealAll = () => { skip.current = true; };

  const fanned = P >= 4;
  return (
    <div className="co-stage" style={{ "--cc": theme.couleur }} data-phase={phase}>
      <div className="co-rays" />
      <div className="co-glow" />

      <div className="co-cards" style={{ zIndex: fanned ? 4 : 2 }}>
        {cards.map((c, k) => {
          const o = k - (cards.length - 1) / 2;
          const tf = P < 3 ? "translate(0, 60px) scale(.7)"
            : !fanned ? `translate(${o * 6}px, ${-150 - k * 8}px) scale(.8) rotate(${o * 2}deg)`
            : `translate(calc(var(--step) * ${o}), ${-60 + Math.abs(o) * 22}px) rotate(${o * 6}deg)`;
          return (
            <div key={`${c.id}-${k}`} className="co-card" style={{ transform: tf, opacity: P >= 3 ? 1 : 0, transitionDelay: `${(fanned ? 70 : 90) * k}ms` }}>
              <Carte c={c} revealed={k < shown} nouvelle={c.nouvelle} hint />
            </div>
          );
        })}
      </div>

      <button className="co-box" type="button" onClick={open} disabled={disabled || (P > 0 && P < 5)} aria-label={`Ouvrir ${booster?.nom || "le coffret"}`}>
        <Coffret theme={theme} nbCartes={booster?.nb_cartes || 5} roman={roman} lid={P >= 2 ? "off" : "closed"} shake={P === 1} />
      </button>

      {P >= 1 && P < 5 && (
        <button className="btn btn-secondary co-skip" type="button" onClick={revealAll}>Tout révéler</button>
      )}
      {P === 0 && <span className="co-hint">Touche le coffret pour l'ouvrir</span>}
      {P === 5 && <button className="co-again" type="button" onClick={open} aria-label="Rouvrir un coffret" disabled={disabled} />}
    </div>
  );
}
