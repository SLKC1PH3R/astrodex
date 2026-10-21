"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MENU, SETTINGS } from "@/lib/menu";
import { api, logout } from "@/lib/api";
import { usePlayer } from "@/components/PlayerProvider";

const href = slug => (slug ? `/jeu/${slug}` : "/jeu");

function Item({ m, path, badge }) {
  const h = href(m.slug);
  return (
    <Link className="ax-menu-item" href={h} aria-current={path === h ? "page" : undefined}>
      <i className={`ph ${m.icon}`} />{m.label}
      {badge > 0 && <span className="ax-badge" aria-label={`${badge} nouveau${badge > 1 ? "x" : ""}`}>{badge > 99 ? "99+" : badge}</span>}
    </Link>
  );
}

/* Compteurs du menu (messages non lus, demandes d'ami, propositions d'échange), relus toutes les 30 s et à chaque page. */
function useBadges(path) {
  const [n, setN] = useState({});
  useEffect(() => {
    let alive = true;
    const load = () => api.notifications().then(x => { if (alive) setN(x); }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    addEventListener("astrodex:notifications", load); // une page signale qu'un compteur a changé
    return () => { alive = false; clearInterval(t); removeEventListener("astrodex:notifications", load); };
  }, [path]);
  return { messages: n.messages || 0, amis: n.amis || 0, echanges: n.echanges || 0 };
}

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { stats } = usePlayer();
  const pseudo = stats?.pseudo || "Joueur";
  const badges = useBadges(path);

  return (
    <aside className="ax-side">
      <Link className="ax-brand" href="/"><span className="ax-mark" /><b>ASTRODEX</b></Link>
      <nav className="ax-menu">
        {MENU.map(m => <Item key={m.slug || "paquets"} m={m} path={path} badge={badges[m.slug]} />)}
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
