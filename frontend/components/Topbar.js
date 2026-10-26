"use client";
import { usePathname } from "next/navigation";
import { usePlayer } from "@/components/PlayerProvider";
import { groupOf, sectionForPath } from "@/lib/menu";
import { mmss, useCountdown } from "@/components/Progression";

/* Barre du haut de chaque page du jeu : fil d'Ariane en mono (groupe / entrée), titre en serif, relevés à droite.
   Styles : app/observatoire.css (.ax-topbar, .ob-*). */
export default function Topbar({ title, sub, onOdds }) {
  const { stats, refresh } = usePlayer();
  const res = stats?.reserve;
  const left = useCountdown(res?.prochain_dans ?? null, refresh);
  const path = usePathname();
  const section = sectionForPath(path);
  const group = groupOf(section);
  const fr = n => Number(n || 0).toLocaleString("fr-FR");
  return (
    <header className="ax-topbar">
      <div>
        {group && <span className="ob-crumb">{group.label} / <b>{section.label}</b></span>}
        <h1>{title}</h1>
        {sub && <small>{sub}</small>}
      </div>
      <div className="ob-readouts">
        {res && (
          <div className="ob-readout" title="Un booster de plus toutes les 10 minutes, jusqu'à la capacité de ta réserve (elle grandit avec ton niveau)">
            <span>Réserve de boosters</span>
            <b>{res.stock}<small> / {res.max}</small></b>
            <span className="pg-next">{left == null ? "Réserve pleine" : `+1 dans ${mmss(left)}`}</span>
          </div>
        )}
        {stats?.progression && (
          <div className="ob-readout"><span>Niveau</span><b>{stats.progression.niveau}<small> · {stats.progression.rang.nom}</small></b></div>
        )}
        {stats && (
          <div className="ob-readout"><span>Collection</span><b>{fr(stats.cartes_uniques)}<small> / {fr(stats.catalogue)}</small></b></div>
        )}
        {onOdds && <button className="ob-link" type="button" onClick={onOdds}>Voir les taux</button>}
      </div>
    </header>
  );
}
