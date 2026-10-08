"use client";
import { usePlayer } from "@/components/PlayerProvider";

export default function Topbar({ title, sub, onOdds }) {
  const { stats } = usePlayer();
  return (
    <header className="ax-topbar">
      <div>
        <h3>{title}</h3>
        {sub && <small>{sub}</small>}
      </div>
      <div className="ax-chips">
        {stats?.boosters_restants != null && (
          <span className="tag tag-neutral"><i className="ph ph-package" />Boosters <b>{stats.boosters_restants}</b></span>
        )}
        {stats && (
          <span className="tag tag-neutral"><i className="ph ph-cards" />Collection <b>{stats.cartes_uniques}/{stats.catalogue}</b></span>
        )}
        {onOdds && <button className="btn btn-secondary" type="button" onClick={onOdds}><i className="ph ph-percent" />Taux</button>}
      </div>
    </header>
  );
}
