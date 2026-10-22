"use client";
import { usePathname } from "next/navigation";
import { usePlayer } from "@/components/PlayerProvider";
import { groupOf, sectionForPath } from "@/lib/menu";

/* Barre du haut de chaque page du jeu : fil d'Ariane en mono (groupe / entrée), titre en serif, relevés à droite.
   Styles : app/observatoire.css (.ax-topbar, .ob-*). */
export default function Topbar({ title, sub, onOdds }) {
  const { stats } = usePlayer();
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
        {stats?.boosters_restants != null && (
          <div className="ob-readout"><span>Boosters du jour</span><b>{stats.boosters_restants}</b></div>
        )}
        {stats && (
          <div className="ob-readout"><span>Collection</span><b>{fr(stats.cartes_uniques)}<small> / {fr(stats.catalogue)}</small></b></div>
        )}
        {onOdds && <button className="ob-link" type="button" onClick={onOdds}>Voir les taux</button>}
      </div>
    </header>
  );
}
