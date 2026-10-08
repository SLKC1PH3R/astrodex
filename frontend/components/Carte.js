/* Rendu React d'une carte à partir des données de l'API (card_out).
   C → UR : cadre métal par rareté. L : holo pleine illustration. Styles : app/astrodex.css (.ax-card). */

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

export default function Carte({ c, revealed = true, hint = false, nouvelle = false, qty = 0 }) {
  const [, tkey, icon] = typeOf(c.type);
  const globe = c.cadrage === "globe" || c.cadrage === "globe-large";
  // eslint-disable-next-line @next/next/no-img-element
  const art = <img className={globe ? "ax-art globe" : "ax-art"} src={c.image_url} alt={c.nom} draggable={false} loading="lazy" />;
  const isL = c.rarete === "L";

  return (
    <div className="ax-card" data-r={c.rarete} data-t={tkey} data-down={revealed ? undefined : ""} data-hint={hint ? "" : undefined}>
      <div className="ax-flip">
        {isL ? (
          <div className="ax-face holo">
            {art}
            <div className="ax-foil" /><div className="ax-glitter" /><div className="ax-shade" /><div className="ax-inner-ring" />
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
            <div className="ax-in">
              <Head c={c} icon={icon} />
              <div className="ax-window">{art}{nouvelle && <span className="ax-new">NOUVELLE</span>}</div>
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
