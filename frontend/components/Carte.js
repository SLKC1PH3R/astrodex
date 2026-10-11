"use client";
/* Carte Astrodex avec filigranes validés.
   C → UR (3f) : gravure sur la photo, cadre en microtexte, numéro en filigrane.
   L (1f)      : holo pleine illustration, gravure taille-douce, cadre intérieur en microtexte doré, logo en relief.
   La lumière suit le pointeur (variables --mx/--my/--lit) ; au repos elle balaie lentement la carte.
   Prop onDive : appelée au clic sur une Légendaire révélée (voir PhotoDive.js).
   Styles : app/astrodex.css (.ax-card, existant) + app/filigrane.css. */
import { useEffect, useRef } from "react";
import { installFiligrane, numeroMask } from "@/lib/filigrane";

export const RAR = {
  C:  { label: "Commune",     color: "#9aa1b9", n: 1 },
  PC: { label: "Peu commune", color: "#5ee0c0", n: 2 },
  R:  { label: "Rare",        color: "#6aa8ff", n: 3 },
  UR: { label: "Ultra rare",  color: "#c58bff", n: 4 },
  L:  { label: "Légendaire",  color: "#ffcf6b", n: 5 },
};
export const ORDER = ["C", "PC", "R", "UR", "L"];

const TYPES = [
  [/plan|géante|satellite|naine/i, "planete", "ph-planet"],
  [/nébuleuse|région/i, "nebuleuse", "ph-cloud"],
  [/galaxie/i, "galaxie", "ph-spiral"],
  [/amas/i, "amas", "ph-sparkle"],
];
const typeOf = t => TYPES.find(([re]) => re.test(t || "")) || TYPES[0];
const pad = n => String(n).padStart(3, "0");

function Head({ c, icon }) {
  return (
    <div className="ax-head">
      <span className="ax-ticon"><i className={`ph-fill ${icon}`} /></span>
      <div className="ax-title">
        <div className="ax-name">{c.nom}</div>
        <div className="ax-type">{c.type}</div>
      </div>
      <span className="ax-pow">PUI<b>{c.attaque + c.defense + c.vitesse}</b></span>
    </div>
  );
}

function Moves({ c }) {
  const n = RAR[c.rarete]?.n || 1;
  return (
    <>
      <div className="ax-move"><i className="ph-fill ph-lightning" /><span>Attaque</span><b>{c.attaque}</b></div>
      <div className="ax-rule" />
      <div className="ax-move"><i className="ph-fill ph-shield" /><span>Défense</span><b>{c.defense}</b></div>
      <div className="ax-info">
        <div>Vitesse<b>{c.vitesse}</b></div>
        <div>Rareté<div className="ax-gems">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? "on" : undefined} />)}</div></div>
        <div>Constellation<em>{c.constellation}</em></div>
      </div>
    </>
  );
}

const Foot = ({ c }) => (
  <div className="ax-foot"><span>© {c.credit}</span><span>{c.serie} · {pad(c.numero)}/{pad(c.total)}</span></div>
);

/* Lumière et inclinaison au pointeur. Désactivées si prefers-reduced-motion. */
function useLight(ref) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, tgt = null;
    const s = { x: .5, y: .4 };
    const tick = () => {
      if (!tgt) { el.removeAttribute("data-lit"); raf = 0; return; }
      s.x += (tgt.x - s.x) * .22; s.y += (tgt.y - s.y) * .22;
      const dx = s.x - .5, dy = s.y - .5;
      el.style.setProperty("--mx", (s.x * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (s.y * 100).toFixed(1) + "%");
      el.style.setProperty("--rx", (-dy * 18).toFixed(2) + "deg");
      el.style.setProperty("--ry", (dx * 22).toFixed(2) + "deg");
      el.style.setProperty("--lit", Math.min(1, Math.hypot(dx, dy) * 2.4).toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    const move = e => {
      const r = el.getBoundingClientRect();
      tgt = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
      el.setAttribute("data-lit", "");
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const leave = () => {
      tgt = null;
      ["--mx", "--my", "--rx", "--ry", "--lit"].forEach(p => el.style.removeProperty(p));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); cancelAnimationFrame(raf); };
  }, [ref]);
}

export default function Carte({ c, revealed = true, hint = false, nouvelle = false, qty = 0, onDive }) {
  const ref = useRef(null);
  useEffect(installFiligrane, []);
  useLight(ref);
  const [, tkey, icon] = typeOf(c.type);
  const globe = c.cadrage === "globe" || c.cadrage === "globe-large";
  // eslint-disable-next-line @next/next/no-img-element
  const art = <img className={globe ? "ax-art globe" : "ax-art"} src={c.image_url} alt={c.nom} draggable={false} loading="lazy" />;
  const isL = c.rarete === "L";
  const canDive = isL && revealed && typeof onDive === "function";
  const dive = e => {
    const face = e.currentTarget.querySelector(".ax-face") || e.currentTarget;
    onDive(c, face.getBoundingClientRect());
  };
  const diveProps = canDive ? {
    role: "button", tabIndex: 0, "aria-label": `Plonger dans la photo de ${c.nom}`, onClick: dive,
    onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dive(e); } },
  } : {};

  return (
    <div ref={ref} className="ax-card ax-fili" data-r={c.rarete} data-t={tkey} data-down={revealed ? undefined : ""} data-hint={hint ? "" : undefined}
      data-dive={canDive ? "" : undefined} style={{ "--ax-num": numeroMask(c.numero) }} {...diveProps}>
      <div className="ax-flip">
        {isL ? (
          <div className="ax-face holo">
            {art}
            <div className="fx-engrave" /><div className="fx-engrave-lit" />
            <div className="ax-foil" />
            <div className="fx-logo" />
            <div className="ax-glitter" /><div className="ax-shade" />
            <div className="fx-micro-ring" />
            <div className="ax-inner-ring" />
            <Head c={c} icon={icon} />
            {nouvelle && <span className="ax-new">NOUVELLE</span>}
            <div className="ax-holo-bottom">
              {c.description && <div className="ax-desc ax-glass">{c.description}</div>}
              <div className="ax-moves"><Moves c={c} /></div>
              <Foot c={c} />
            </div>
          </div>
        ) : (
          <div className="ax-face classic">
            <div className="fx-micro-frame"><i /></div>
            <div className="ax-in">
              <div className="fx-num" />
              <Head c={c} icon={icon} />
              <div className="ax-window">
                {art}
                <div className="fx-engrave" /><div className="fx-engrave-lit" />
                {nouvelle && <span className="ax-new">NOUVELLE</span>}
              </div>
              {c.description && <div className="ax-desc">{c.description}</div>}
              <Moves c={c} />
              <Foot c={c} />
            </div>
          </div>
        )}
        <div className="ax-back">
          <div className="ax-back-in">
            <span className="ax-mark ax-emblem" />
            <span className="ax-word">ASTRODEX</span>
          </div>
        </div>
      </div>
      {qty > 1 && <span className="ax-qty">×{qty}</span>}
    </div>
  );
}
