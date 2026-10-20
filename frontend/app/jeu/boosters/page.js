"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import PackArt from "@/components/PackArt";
import OddsDialog from "@/components/OddsDialog";
import { coffretTheme } from "@/lib/coffrets";
import { api } from "@/lib/api";

/* Onglet « Boosters » (maquette B « Rayonnage ») : le booster du jour mis en avant, puis tous les
   boosters en grille, filtrables par série, avec la progression du joueur sur chacun.
   « Ouvrir » mène à /jeu?booster=CODE, qui affiche directement l'anneau de paquets de ce booster.
   Styles : app/boosters.css (.bx-*). */

const tagOf = code => (/^S\d+[A-Z]$/.test(code || "") ? code.slice(0, -1) + code.slice(-1).toLowerCase() : code);
const fr = n => Number(n || 0).toLocaleString("fr-FR");
const openHref = code => `/jeu?booster=${encodeURIComponent(code)}`;

export default function BoostersPage() {
  const [boosters, setBoosters] = useState(null);
  const [series, setSeries] = useState({});
  const [prog, setProg] = useState({});
  const [filter, setFilter] = useState("");
  const [odds, setOdds] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.boosters().then(setBoosters).catch(() => setError("Le serveur de jeu ne répond pas. Réessaie dans un instant."));
    api.series().then(list => setSeries(Object.fromEntries(list.map(s => [s.code, s.nom])))).catch(() => {});
    api.progression().then(list => setProg(Object.fromEntries(list.map(p => [p.code, p])))).catch(() => {});
  }, []);

  // booster du jour : change chaque jour, le même pour tous les joueurs
  const featured = useMemo(() => {
    if (!boosters?.length) return null;
    const day = Math.floor(Date.now() / 86400000);
    return boosters[day % boosters.length];
  }, [boosters]);

  const seriesCodes = useMemo(() => [...new Set((boosters || []).map(b => b.serie))], [boosters]);
  const shown = (boosters || []).filter(b => !filter || b.serie === filter);

  return (
    <>
      <Topbar title="Boosters" sub={boosters ? `${boosters.length} boosters à thème` : ""} />
      <section className="bx-page">
        {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}

        {featured && <Featured b={featured} p={prog[featured.code]} onOdds={() => setOdds(featured)} />}

        {boosters && (
          <section className="bx-section" aria-labelledby="bx-all">
            <div className="bx-section-head">
              <h2 id="bx-all">Tous les boosters</h2>
              <div className="bx-filters" role="group" aria-label="Filtrer par série">
                <button type="button" className="bx-filter" aria-pressed={!filter} onClick={() => setFilter("")}>Tous · {boosters.length}</button>
                {seriesCodes.map(code => (
                  <button key={code} type="button" className="bx-filter" aria-pressed={filter === code} onClick={() => setFilter(code)}>
                    {series[code] || code}
                  </button>
                ))}
              </div>
            </div>
            <div className="bx-grid">
              {shown.map(b => <Tile key={b.code} b={b} p={prog[b.code]} featured={b.code === featured?.code} />)}
            </div>
            <p className="bx-note">La barre sous chaque booster montre la part de son contenu déjà dans ta collection.</p>
          </section>
        )}
      </section>
      {odds && <OddsDialog booster={odds} onClose={() => setOdds(null)} />}
    </>
  );
}

function Featured({ b, p, onOdds }) {
  const t = coffretTheme(b);
  const total = b.nb_cartes_contenu || p?.total;
  return (
    <section className="bx-hero" style={{ "--cc": t.couleur }} aria-label={`Booster du jour : ${t.titre}`}>
      {t.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="bx-hero-bg" src={t.image} alt="" />
      )}
      <div className="bx-hero-text">
        <span className="bx-kicker">BOOSTER DU JOUR · {tagOf(b.code)}</span>
        <h1>{t.titre}</h1>
        {b.description && <p>{b.description}</p>}
        <div className="bx-facts">
          {total ? <span><b>{fr(total)}</b> cartes</span> : null}
          <span><b>{b.nb_cartes}</b> par paquet</span>
          {p && <span><b>{fr(p.possedees)}</b> déjà obtenues</span>}
        </div>
        <div className="bx-hero-actions">
          <Link className="bx-cta" href={openHref(b.code)}>Ouvrir ce booster</Link>
          <button type="button" className="bx-ghost" onClick={onOdds}>Voir les taux</button>
        </div>
      </div>
      <Link className="bx-hero-pack" href={openHref(b.code)} aria-label={`Ouvrir le booster ${t.titre}`}>
        <PackArt theme={t} />
      </Link>
    </section>
  );
}

function Tile({ b, p, featured }) {
  const t = coffretTheme(b);
  const total = p?.total || b.nb_cartes_contenu || 0;
  const pct = p && total ? Math.round((p.possedees / total) * 100) : 0;
  return (
    <article className={`bx-tile${featured ? " is-featured" : ""}`} style={{ "--cc": t.couleur }}>
      <Link className="bx-tile-pack" href={openHref(b.code)} aria-label={`Ouvrir le booster ${t.titre}`}>
        <span className="bx-pack"><PackArt theme={t} /></span>
      </Link>
      <div className="bx-tile-text">
        <b>{t.titre}</b>
        <span>{tagOf(b.code)} · {fr(total)} cartes</span>
      </div>
      <div className="bx-progress">
        <div className="bx-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={p?.possedees || 0}
          aria-label={`Progression sur ${t.titre}`}><i style={{ width: `${pct}%` }} /></div>
        <small>{p ? `${fr(p.possedees)} / ${fr(total)}` : "—"}</small>
      </div>
      <Link className="bx-open" href={openHref(b.code)}>Ouvrir</Link>
    </article>
  );
}
