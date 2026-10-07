"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header({ stats, onOdds }) {
  const path = usePathname();
  return (
    <header className="topbar">
      <div className="brand"><div className="brand-mark" /><b>ASTRODEX</b></div>
      <nav className="nav">
        <Link href="/" aria-current={path === "/" ? "page" : undefined}>Booster</Link>
        <Link href="/collection" aria-current={path === "/collection" ? "page" : undefined}>Collection</Link>
      </nav>
      <div className="chips">
        {stats && <span className="chip packs">Boosters <strong>{stats.boosters_ouverts}</strong></span>}
        {stats && <span className="chip">Cartes <strong>{stats.cartes_uniques}</strong>/<strong>{stats.catalogue}</strong></span>}
        {stats && stats.boosters_restants != null && <span className="chip">Restants <strong>{stats.boosters_restants}</strong></span>}
        {onOdds && <button className="chip" type="button" onClick={onOdds}>Taux</button>}
      </div>
    </header>
  );
}
