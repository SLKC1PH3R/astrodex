"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN, GROUPS, SETTINGS, groupOf, hrefOf, itemsOf, sectionForPath } from "@/lib/menu";
import { api, logout } from "@/lib/api";
import { usePlayer } from "@/components/PlayerProvider";
import { Embleme } from "@/components/Progression";

/* Rail d'observatoire : le menu du jeu rangé en 5 groupes (lib/menu.js, GROUPS).
   Sur mobile (≤ 860 px), il devient une barre d'onglets en bas (les groupes) et une rangée de sous-onglets en haut
   (les entrées du groupe courant). Styles : app/observatoire.css (.ob-*). */

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

function Item({ m, path, badge }) {
  const h = hrefOf(m.slug);
  return (
    <Link className="ob-item" href={h} aria-current={path === h ? "page" : undefined}>
      <span>{m.label}</span>
      {badge > 0 && <b className="ob-badge" aria-label={`${badge} nouveau${badge > 1 ? "x" : ""}`}>{badge > 99 ? "99+" : badge}</b>}
    </Link>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { stats } = usePlayer();
  const pseudo = stats?.pseudo || "Joueur";
  const badges = useBadges(path);
  const current = groupOf(sectionForPath(path)) || GROUPS[0];
  const groupBadge = g => g.slugs.reduce((s, slug) => s + (badges[slug] || 0), 0);

  return (
    <aside className="ob-side">
      <Link className="ob-brand" href="/"><span className="ax-mark" /><b>ASTRODEX</b></Link>

      <nav className="ob-menu" aria-label="Menu du jeu">
        {GROUPS.map(g => (
          <div key={g.id} className="ob-group" role="group" aria-labelledby={`ob-g-${g.id}`}>
            <span id={`ob-g-${g.id}`}>{g.label}</span>
            {itemsOf(g).filter(m => m.slug !== SETTINGS.slug).map(m => <Item key={m.slug || "paquets"} m={m} path={path} badge={badges[m.slug]} />)}
            {g.id === ADMIN.group && stats?.is_admin && <Item m={ADMIN} path={path} />}
          </div>
        ))}
      </nav>

      <div className="ob-user">
        {stats?.progression
          ? <Link href="/jeu/profil" aria-label={`Ton profil, ${pseudo}`}><Embleme e={stats.progression.embleme} size={26} /></Link>
          : <Link className="ob-avatar" href="/jeu/profil" aria-label={`Ton profil, ${pseudo}`}>{pseudo[0].toUpperCase()}</Link>}
        <div>
          <b>{pseudo}</b>
          {stats && <small>{stats.progression ? `NIV. ${stats.progression.niveau} · ` : ""}{stats.cartes_uniques.toLocaleString("fr-FR")} CARTES</small>}
        </div>
        <Link className="ob-icon" href={hrefOf(SETTINGS.slug)} aria-label="Paramètres" aria-current={path === hrefOf(SETTINGS.slug) ? "page" : undefined}>
          <i className="ph ph-gear" aria-hidden="true" />
        </Link>
        <button className="ob-icon" type="button" aria-label="Se déconnecter" title="Se déconnecter" onClick={() => { logout(); router.push("/"); }}>
          <i className="ph ph-sign-out" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile : sous-onglets du groupe courant, puis barre d'onglets des groupes */}
      <nav className="ob-subnav" aria-label={current.label}>
        {[...itemsOf(current), ...(current.id === ADMIN.group && stats?.is_admin ? [ADMIN] : [])].map(m => {
          const h = hrefOf(m.slug);
          return (
            <Link key={m.slug || "paquets"} href={h} aria-current={path === h ? "page" : undefined}>
              {m.label}{badges[m.slug] > 0 && <span className="ob-badge">{badges[m.slug]}</span>}
            </Link>
          );
        })}
      </nav>
      <nav className="ob-tabbar" aria-label="Groupes du menu">
        {GROUPS.map(g => {
          const n = groupBadge(g);
          return (
            <Link key={g.id} href={hrefOf(g.slugs[0])} aria-current={g.id === current.id ? "true" : undefined}>
              <i className={`ph ${g.icon}`} aria-hidden="true" />{g.label}
              {n > 0 && <b aria-label={`${n} nouveau${n > 1 ? "x" : ""}`}>{n > 99 ? "99+" : n}</b>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
