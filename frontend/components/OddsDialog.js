"use client";
import { ORDER, RAR } from "@/components/Carte";

export default function OddsDialog({ booster, onClose }) {
  if (!booster) return null;
  return (
    <div className="dialog-backdrop" style={{ zIndex: 20, backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="dialog" style={{ width: "min(520px, 100%)" }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dialog-title">Taux · {booster.nom}</div>
        <table className="table" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              <th>Emplacement</th>
              {ORDER.map(r => <th key={r} style={{ textAlign: "right", color: RAR[r].color }}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {booster.emplacements.map(s => (
              <tr key={s.position}>
                <td style={{ color: "var(--color-neutral-400)" }}>Carte {s.position}</td>
                {ORDER.map(r => <td key={r} style={{ textAlign: "right" }}>{s.taux[r] ? `${Math.round(s.taux[r] * 100)} %` : "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dialog-body" style={{ fontSize: 12, color: "var(--color-neutral-400)" }}>
          Le tirage est fait côté serveur avec un aléa cryptographique. Pas de doublon dans un même booster tant que la rareté le permet.
        </div>
        <div className="dialog-actions"><button className="btn btn-secondary" type="button" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  );
}
