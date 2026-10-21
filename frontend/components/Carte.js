"use client";
/* Carte Astrodex — un design par rareté, plus deux finitions spéciales.
     C / PC : Classique — fond à la couleur du type, photo encadrée.
     R      : Holo Prisme — cadre argent irisé, éclats de cristal sur la photo.
     UR     : Full Art — photo pleine carte, gravure fine, texte sur verre dépoli.
     L      : Illustration spéciale — l'objet (cadrage globe) sort du cadre et bouge en relief.
   Finitions (champ optionnel c.finition) :
     "reverse" : Reverse Carte du ciel — fond en carte céleste, reflet bleu, tampon PARALLÈLE.
     "or"      : Or secrète — version entièrement dorée.
   Filigranes conservés : microtexte du cadre, numéro en filigrane, gravure sur la photo, logo en relief (L).
   La lumière suit le pointeur (variables --mx/--my/--lit) ; au repos elle balaie lentement la carte.
   Champs optionnels lus si présents : faits, attaque_nom, defense_nom, finition.
   Prop onDive : appelée au clic sur une Légendaire révélée (voir PhotoDive.js).
   Styles : app/astrodex.css (.ax-card, dos, en-tête) + app/filigrane.css + app/cartes.css (.cx-*). */
import { useEffect, useRef } from "react";
import { installFiligrane, numeroMask } from "@/lib/filigrane";
import { prefersReduced } from "@/lib/motion";

export const RAR = {
  C:  { label: "Commune",     color: "#9aa1b9", n: 1 },
  PC: { label: "Peu commune", color: "#5ee0c0", n: 2 },
  R:  { label: "Rare",        color: "#6aa8ff", n: 3 },
  UR: { label: "Ultra rare",  color: "#c58bff", n: 4 },
  L:  { label: "Légendaire",  color: "#ffcf6b", n: 5 },
};
export const ORDER = ["C", "PC", "R", "UR", "L"];

/* Design par rareté ; une finition spéciale le remplace. */
const STYLE_BY_RARITY = { C: "classic", PC: "classic", R: "prisme", UR: "full", L: "illus" };
const FINITIONS = { reverse: "reverse", or: "or" };
export const cardStyle = c => FINITIONS[c.finition] || STYLE_BY_RARITY[c.rarete] || "classic";

const TYPES = [
  [/plan|géante|satellite|naine/i, "planete", "ph-planet"],
  [/nébuleuse|région/i, "nebuleuse", "ph-cloud"],
  [/galaxie/i, "galaxie", "ph-spiral"],
  [/amas/i, "amas", "ph-sparkle"],
];
const typeOf = t => TYPES.find(([re]) => re.test(t || "")) || TYPES[0];
const pad = n => String(n).padStart(3, "0");
const GLYPH = { C: "●", PC: "◆", R: "★", UR: "★★", L: "★★★" };

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

const Facts = ({ c }) => c.faits ? <div className="cx-facts"><span>{c.faits}</span></div> : null;

function Moves({ c }) {
  return (
    <>
      <div className="cx-move">
        <span className="cx-pip"><i className="ph-fill ph-lightning" /></span>
        <span className="cx-mn">Attaque{c.attaque_nom && <small>{c.attaque_nom}</small>}</span>
        <b>{c.attaque}</b>
      </div>
      <div className="cx-rule" />
      <div className="cx-move">
        <span className="cx-pip"><i className="ph-fill ph-shield" /></span>
        <span className="cx-mn">Défense{c.defense_nom && <small>{c.defense_nom}</small>}</span>
        <b>{c.defense}</b>
      </div>
    </>
  );
}

function Info({ c }) {
  const n = RAR[c.rarete]?.n || 1;
  return (
    <div className="cx-tri">
      <div>Vitesse<b>{c.vitesse}</b></div>
      <div>Rareté<span className="cx-gems">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? "on" : undefined} />)}</span></div>
      <div>Constellation<b>{c.constellation}</b></div>
    </div>
  );
}

const Foot = ({ c, label }) => (
  <div className="cx-foot">
    <span>© {c.credit}</span>
    <b>{c.serie} · {pad(c.numero)}/{pad(c.total)} {label ?? GLYPH[c.rarete]}</b>
  </div>
);

/* Constellation stylisée du fond « Carte du ciel » (décor commun à toutes les cartes). */
const SKY = [[5, 62, 18, 55], [18, 55, 32, 60], [32, 60, 44, 52], [44, 52, 63, 57], [63, 57, 77, 50], [77, 50, 94, 54], [63, 57, 69, 68], [69, 68, 88, 73], [32, 60, 27, 72], [27, 72, 12, 79]];
const SKY_STARS = [[5, 62, .5], [18, 55, .7], [32, 60, .6], [44, 52, .8], [63, 57, .65], [77, 50, .55], [94, 54, .7], [69, 68, .5], [88, 73, .6], [27, 72, .55], [12, 79, .65], [88, 8, .35], [9, 14, .3], [53, 89, .35], [94, 91, .3]];
function Sky() {
  return (
    <svg className="cx-sky" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {SKY.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
      {SKY_STARS.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />)}
    </svg>
  );
}

/* Lumière et inclinaison au pointeur. Désactivées si animations réduites (lib/motion.js). */
function useLight(ref) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (prefersReduced()) return;
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
  const style = cardStyle(c);
  const globe = c.cadrage === "globe" || c.cadrage === "globe-large";
  const artCls = extra => ["ax-art", globe && "globe", extra].filter(Boolean).join(" ");
  // eslint-disable-next-line @next/next/no-img-element
  const img = extra => <img className={artCls(extra)} src={c.image_url} alt={c.nom} draggable={false} loading="lazy" />;
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
  const badge = nouvelle && <span className="ax-new">NOUVELLE</span>;

  let face;
  if (style === "full") {
    face = (
      <div className="ax-face cx-full">
        <div className="cx-full-in">
          {img("cx-cover")}
          <div className="fx-engrave" /><div className="fx-engrave-lit" />
          <div className="cx-etch" /><div className="cx-sfoil" /><div className="cx-shade" /><div className="cx-ring" />
          <Head c={c} icon={icon} />
          {badge}
          <div className="cx-panel"><Moves c={c} /><Info c={c} /><Foot c={c} /></div>
        </div>
        <div className="cx-glare" />
      </div>
    );
  } else if (style === "illus") {
    face = (
      <div className="ax-face cx-illus">
        <div className="cx-illus-in">
          <div className="cx-stars" />
          <div className="cx-window">{!globe && img("cx-cover")}</div>
          {globe && <><div className="cx-halo" />{img("cx-pop")}</>}
          <div className="fx-logo" /><div className="cx-gfoil" /><div className="fx-micro-ring" />
          <div className="cx-top"><span className="cx-rib">ILLUSTRATION</span><span className="cx-num">{c.serie} · {pad(c.numero)}/{pad(c.total)}</span></div>
          {badge}
          <div className="cx-bottom">
            <div className="cx-bname">{c.nom}</div>
            <div className="cx-bty">{c.type}{c.faits ? ` · ${c.faits}` : ""}</div>
            <div className="cx-chips">
              <div className="cx-chip pui">PUI<b>{c.attaque + c.defense + c.vitesse}</b></div>
              <div className="cx-chip">Attaque<b>{c.attaque}</b></div>
              <div className="cx-chip">Défense<b>{c.defense}</b></div>
              <div className="cx-chip">Vitesse<b>{c.vitesse}</b></div>
            </div>
            <div className="cx-foot"><span>© {c.credit}</span><b>{RAR.L.label} {GLYPH.L}</b></div>
          </div>
        </div>
        <div className="cx-glare" />
      </div>
    );
  } else if (style === "or") {
    face = (
      <div className="ax-face cx-or">
        <div className="cx-or-in">
          <div className="cx-guil" />
          {img("cx-gold")}
          <div className="cx-ofoil" /><div className="cx-oring" />
          <Head c={c} icon={icon} />
          {badge}
          <div className="cx-panel"><Moves c={c} /><Info c={c} /><Foot c={c} label="SECRÈTE" /></div>
        </div>
        <div className="cx-glare" />
      </div>
    );
  } else {
    // classic / prisme / reverse : même structure, finitions différentes
    face = (
      <div className="ax-face cx-std">
        {style === "prisme" && <div className="cx-rim" />}
        <div className="fx-micro-frame"><i /></div>
        <div className="cx-in">
          {style === "reverse" && <><div className="cx-chart" /><Sky /><div className="cx-rfoil" /></>}
          <div className="fx-num" />
          <Head c={c} icon={icon} />
          <div className="cx-win">
            {img()}
            <div className="fx-engrave" /><div className="fx-engrave-lit" />
            {style === "prisme" && <div className="cx-prism" />}
            {style === "reverse" && <span className="cx-stamp">PARALLÈLE</span>}
            {badge}
          </div>
          <Facts c={c} />
          <Moves c={c} />
          <Info c={c} />
          {c.description && <div className="cx-desc">{c.description}</div>}
          <Foot c={c} />
        </div>
        <div className="cx-glare" />
      </div>
    );
  }

  return (
    <div ref={ref} className="ax-card ax-fili" data-r={c.rarete} data-t={tkey} data-style={style} data-down={revealed ? undefined : ""} data-hint={hint ? "" : undefined}
      data-dive={canDive ? "" : undefined} style={{ "--ax-num": numeroMask(c.numero) }} {...diveProps}>
      <div className="ax-flip">
        {face}
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
