"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import PackArt from "@/components/PackArt";
import OddsDialog from "@/components/OddsDialog";
import { coffretTheme } from "@/lib/coffrets";
import { api } from "@/lib/api";

/* Onglet « Boosters » (maquette B « Rayonnage »), tenu dans la hauteur de l'écran :
   en haut, la présentation du booster sélectionné (au départ, le booster du jour) ; en bas, tous
   les boosters en vignettes, filtrables par série — seule cette liste défile si elle déborde.
   Toucher une vignette présente ce booster en haut ; « Ouvrir » mène à /jeu?booster=CODE, qui
   ouvre directement ce booster. Styles : app/boosters.css (.bx-*). */

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const tagOf = code => (/^S\d+[A-Z]$/.test(code || "") ? code.slice(0, -1) + code.slice(-1).toLowerCase() : code);
const romanOf = serie => ROMAN[Number(String(serie || "").replace(/\D/g, ""))] || serie;
const fr = n => Number(n || 0).toLocaleString("fr-FR");
const openHref = code => `/jeu?booster=${encodeURIComponent(code)}`;

export default function BoostersPage() {
  const [boosters, setBoosters] = useState(null);
  const [series, setSeries] = useState({});
  const [prog, setProg] = useState({});
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState(null);
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
    return boosters[Math.floor(Date.now() / 86400000) % boosters.length];
  }, [boosters]);
  const current = boosters?.find(b => b.code === picked) || featured;

  const seriesCodes = useMemo(() => [...new Set((boosters || []).map(b => b.serie))], [boosters]);
  const shown = (boosters || []).filter(b => !filter || b.serie === filter);

  return (
    <>
      <Topbar title="Boosters" sub={boosters ? `${boosters.length} boosters à thème` : ""} />
      <section className="bx-page">
        {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}

        {current && (
          <Showcase key={current.code} b={current} p={prog[current.code]} daily={current.code === featured?.code}
            serieName={series[current.serie]} onOdds={() => setOdds(current)} />
        )}

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
            <div className="bx-list">
              <div className="bx-grid">
                {shown.map(b => (
                  <Tile key={b.code} b={b} p={prog[b.code]} daily={b.code === featured?.code}
                    selected={b.code === current?.code} onPick={() => setPicked(b.code)} />
                ))}
              </div>
            </div>
          </section>
        )}
      </section>
      {odds && <OddsDialog booster={odds} onClose={() => setOdds(null)} />}
    </>
  );
}

/* Présentation du booster sélectionné : photo en fond, paquet, nom, description, chiffres, progression. */
function Showcase({ b, p, daily, serieName, onOdds }) {
  const t = coffretTheme(b);
  const total = p?.total || b.nb_cartes_contenu || 0;
  const pct = p && total ? Math.round((p.possedees / total) * 100) : 0;
  return (
    <section className="bx-hero" style={{ "--cc": t.couleur }} aria-live="polite" aria-label={`Booster ${t.titre}`}>
      {t.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="bx-hero-bg" src={t.image} alt="" />
      )}
      <div className="bx-hero-text">
        <span className="bx-kicker">{daily ? "BOOSTER DU JOUR · " : ""}{tagOf(b.code)} · SÉRIE {romanOf(b.serie)}{serieName ? ` · ${serieName.toUpperCase()}` : ""}</span>
        <h1>{t.titre}</h1>
        {b.description && <p>{b.description}</p>}
        <div className="bx-facts">
          {total ? <span><b>{fr(total)}</b> cartes</span> : null}
          <span><b>{b.nb_cartes}</b> par paquet</span>
          {p && <span><b>{fr(p.possedees)}</b> déjà obtenue{p.possedees > 1 ? "s" : ""}</span>}
        </div>
        {p && (
          <div className="bx-hero-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={p.possedees}
            aria-label={`Progression sur ${t.titre}`}><i style={{ width: `${pct}%` }} /></div>
        )}
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

/* Vignette : la toucher présente le booster en haut de la page. */
function Tile({ b, p, daily, selected, onPick }) {
  const t = coffretTheme(b);
  const total = p?.total || b.nb_cartes_contenu || 0;
  const pct = p && total ? Math.round((p.possedees / total) * 100) : 0;
  return (
    <button type="button" className="bx-tile" style={{ "--cc": t.couleur }} aria-pressed={selected} onClick={onPick}
      aria-label={`Présenter le booster ${t.titre}`}>
      {daily && <span className="bx-daily">Du jour</span>}
      <span className="bx-pack"><PackArt theme={t} /></span>
      <span className="bx-tile-text">
        <b>{t.titre}</b>
        <span>{tagOf(b.code)} · {fr(total)} cartes</span>
      </span>
      <span className="bx-progress">
        <span className="bx-bar"><i style={{ width: `${pct}%` }} /></span>
        <small>{p ? `${fr(p.possedees)} / ${fr(total)}` : "—"}</small>
      </span>
    </button>
  );
}
