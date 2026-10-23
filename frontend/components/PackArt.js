import { PACK_DESIGNS, SERIES_DESIGNS, fallbackDesign } from "@/lib/packDesigns";

/* Visuel d'un paquet scellé, au design des maquettes « booster à thème » : bandeaux sertis à motif,
   logo, code du booster, grande illustration composée, « BOOSTER À THÈME » et titre biseauté.
   Toutes les tailles sont relatives à la largeur du paquet (unités cqw) : le même visuel sert au
   carrousel et à l'écran d'ouverture. Format 1 × 2.
   Données : lib/packDesigns.js · styles : app/packart.css (.pka-*). */

const tag = theme => (/^S\d+[A-Z]$/.test(theme.code || "") ? theme.code.slice(0, -1) + theme.code.slice(-1).toLowerCase() : theme.serie);

export default function PackArt({ theme }) {
  const d = PACK_DESIGNS[theme.code] || SERIES_DESIGNS[theme.serie] || fallbackDesign(theme);
  const [l1, ...rest] = String(theme.titre || "").toUpperCase().split(" ");
  const band = `linear-gradient(180deg, ${d.band[0]}, ${d.band[1]})`;
  const stripe = `linear-gradient(90deg, ${d.stripe[0]}, ${d.stripe[1]}, ${d.stripe[0]})`;
  return (
    <span className="pka-pack" style={{ "--cc": theme.couleur, "--pk-bg": d.bg, "--pk-glow": d.glow }}>
      <span className="pka-window" style={{ background: d.art }}>
        {d.stars > 0 && <span className="pka-stars" style={{ opacity: d.stars }} />}
        {d.layers.map((l, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} className="pka-layer" src={l.src} alt="" draggable={false} decoding="async"
            style={{
              left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%`,
              objectFit: l.fit || "contain", objectPosition: l.pos, mixBlendMode: l.blend,
              opacity: l.opacity, filter: l.filter, borderRadius: l.round ? "50%" : undefined, clipPath: l.clip,
              transform: l.rotate ? `rotate(${l.rotate}deg)` : undefined,
            }} />
        ))}
        {d.tint && <span className="pka-fill" style={{ background: d.tint }} />}
        <span className="pka-fill" style={{ background: `linear-gradient(180deg, ${d.shade[0]}, transparent 16%, transparent 54%, ${d.shade[1]} 88%)` }} />
      </span>

      <span className="pka-band top" style={{ background: band }}><span className="pka-motif" /></span>
      <span className="pka-stripe top" style={{ background: stripe }} />
      <span className="pka-band bottom" style={{ background: `linear-gradient(0deg, ${d.band[0]}, ${d.band[1]})` }}><span className="pka-motif" /></span>
      <span className="pka-stripe bottom" style={{ background: stripe }} />
      <span className="pka-crimp top" />
      <span className="pka-crimp bottom" />

      <span className="pka-logo">
        <span className="pka-word">
          <svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="7.5" fill="#ffd23f" /><ellipse cx="15" cy="15" rx="13.5" ry="4.5" fill="none" stroke="#fff6cf" strokeWidth="2.2" transform="rotate(-22 15 15)" /></svg>
          <b>ASTRODEX</b>
        </span>
        <small>CARTES À COLLECTIONNER</small>
      </span>
      <span className="pka-code">{tag(theme)}</span>

      <span className="pka-label" style={{ "--d": d.label }}>BOOSTER À THÈME</span>
      <span className="pka-plate" style={{ background: `linear-gradient(180deg, ${d.plate[0]}, ${d.plate[1]})`, "--ring": d.ring, "--ring-out": d.ringOut }}>
        <span className="pka-rim" style={{ "--rim": d.rim, "--d": d.dark }}>
          <b className="pka-title" style={{ backgroundImage: d.fill, "--d": d.dark, "--ts": d.size || 44 }}>
            {l1}{rest.length > 0 && <><br />{rest.join(" ")}</>}
          </b>
        </span>
      </span>

      <span className="pka-sheen" />
      <span className="pka-edge" />
    </span>
  );
}
