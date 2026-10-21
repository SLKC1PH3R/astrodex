/* Vignette légère d'une carte (image, rareté, nom, puissance) pour les listes longues :
   sélecteurs d'échange, annonces du marché. La carte complète reste <Carte>. Styles : app/commerce.css (.mc-*). */
import { RAR } from "@/components/Carte";

export default function MiniCarte({ c, qty = 0, flag = null, small = false }) {
  const r = RAR[c.rarete] || RAR.C;
  return (
    <span className={`mc${small ? " sm" : ""}`} style={{ "--rc": r.color }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image_url} alt="" draggable={false} className={c.cadrage?.startsWith("globe") ? "globe" : undefined} />
      <span className="mc-r" title={r.label}>{c.rarete}</span>
      {qty > 1 && <span className="mc-q">×{qty}</span>}
      {flag && <span className="mc-f">{flag}</span>}
      <span className="mc-n"><b>{c.nom}</b><i>{c.serie} · {c.puissance ?? c.attaque + c.defense + c.vitesse} pts</i></span>
    </span>
  );
}
