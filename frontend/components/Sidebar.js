"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MENU, SETTINGS } from "@/lib/menu";
import { logout } from "@/lib/api";
import { usePlayer } from "@/components/PlayerProvider";

const href = slug => (slug ? `/jeu/${slug}` : "/jeu");

function Item({ m, path }) {
  const h = href(m.slug);
  return (
    <Link className="ax-menu-item" href={h} aria-current={path === h ? "page" : undefined}>
      <i className={`ph ${m.icon}`} />{m.label}
    </Link>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { stats } = usePlayer();
  const pseudo = stats?.pseudo || "Joueur";

  return (
    <aside className="ax-side">
      <Link className="ax-brand" href="/"><span className="ax-mark" /><b>ASTRODEX</b></Link>
      <nav className="ax-menu">
        {MENU.map(m => <Item key={m.slug || "paquets"} m={m} path={path} />)}
      </nav>
      <div>
        <Item m={SETTINGS} path={path} />
        <div className="ax-user">
          <span className="ax-avatar">{pseudo[0].toUpperCase()}</span>
          <div>
            <b>{pseudo}</b>
            {stats && <small>{stats.cartes_uniques}/{stats.catalogue} cartes</small>}
          </div>
          <button className="btn btn-ghost btn-icon" type="button" title="Se déconnecter"
            onClick={() => { logout(); router.push("/"); }}>
            <i className="ph ph-sign-out" style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>
    </aside>
  );
}
