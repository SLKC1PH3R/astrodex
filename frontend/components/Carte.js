/* Rendu React d'une carte à partir des données de l'API (card_out). Remplace renderCard() de card.js. */

export const RAR = {
  C:  { label: "Commune",     color: "#9aa1b9" },
  PC: { label: "Peu commune", color: "#5ee0c0" },
  R:  { label: "Rare",        color: "#6aa8ff" },
  UR: { label: "Ultra rare",  color: "#c58bff" },
  L:  { label: "Légendaire",  color: "#ffcf6b" },
};
export const ORDER = ["C", "PC", "R", "UR", "L"];

const pad = n => String(n).padStart(3, "0");

export default function Carte({ c, revealed = true, hint = false, nouvelle = false, qty = 0 }) {
  const art = c.cadrage === "globe" ? "ax-art globe" : c.cadrage === "globe-large" ? "ax-art wide" : "ax-art";
  return (
    <div className="ax-card" data-r={c.rarete} data-down={revealed ? undefined : ""} data-hint={hint ? "" : undefined}>
      <div className="ax-flip">
        <div className="ax-face">
          <div className="ax-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={art} src={c.image_url} alt={c.nom} draggable={false} loading="lazy" />
            <div className="ax-scrim" />
            <div className="ax-top">
              <span className="ax-gem"><i />{c.serie} · {pad(c.numero)}/{pad(c.total)}</span>
              {nouvelle
                ? <span className="ax-new">NOUVELLE</span>
                : <span className="ax-pow">PUI <b>{c.attaque + c.defense + c.vitesse}</b></span>}
            </div>
            <div className="ax-bottom">
              <div className="ax-type">{c.type}</div>
              <div className="ax-name">{c.nom}</div>
              <div className="ax-meta">{[c.constellation, c.faits].filter(Boolean).join(" · ")}</div>
              <div className="ax-stats">
                {[["ATQ", c.attaque], ["DÉF", c.defense], ["VIT", c.vitesse]].map(([k, v]) => (
                  <div className="ax-stat" key={k}>
                    <div>{k}<b>{v}</b></div>
                    <div className="ax-bar"><i style={{ width: `${v}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="ax-foot"><span>© {c.credit}</span><span>{RAR[c.rarete]?.label}</span></div>
            </div>
          </div>
        </div>
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
