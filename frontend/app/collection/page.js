"use client";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { renderCard, RAR, ORDER } from "@/components/card";
import { api } from "@/lib/api";

export default function CollectionPage() {
  const [series, setSeries] = useState([]);
  const [current, setCurrent] = useState(null);
  const [cards, setCards] = useState([]);
  const [owned, setOwned] = useState(new Map());
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);

  useEffect(() => {
    api.series().then(list => { setSeries(list); if (list[0]) setCurrent(list[0].code); }).catch(() => setError("Le serveur de jeu ne répond pas."));
    api.me().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (!current) return;
    Promise.all([api.seriesDetail(current), api.collection(current)])
      .then(([detail, mine]) => { setCards(detail.cartes); setOwned(new Map(mine.map(c => [c.id, c.quantite]))); })
      .catch(() => setError("Impossible de charger la collection."));
  }, [current]);

  const shown = useMemo(() => cards.filter(c =>
    filter === "all" ? true : filter === "owned" ? owned.has(c.id) : filter === "missing" ? !owned.has(c.id) : c.rarete === filter), [cards, owned, filter]);
  const nOwned = cards.filter(c => owned.has(c.id)).length;
  const pct = cards.length ? Math.round(nOwned / cards.length * 100) : 0;
  const serie = series.find(s => s.code === current);

  return (
    <div className="page">
      <div className="vignette" />
      <div className="page-in">
        <Header stats={stats} />
        {error && <p className="notice">{error}</p>}
        {serie && (
          <div className="coll-head">
            <div>
              <h1>{serie.nom}</h1>
              <p>Série {serie.code} · {serie.nb_cartes} cartes</p>
            </div>
            <div className="progress">
              <div><span>Complétée</span><span><b>{nOwned}</b> / {cards.length} · {pct} %</span></div>
              <div className="track"><i style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
        )}
        <div className="filters">
          {series.length > 1 && series.map(s => (
            <button key={s.code} type="button" aria-pressed={current === s.code} onClick={() => setCurrent(s.code)}>{s.nom}</button>
          ))}
          {[["all", "Toutes"], ["owned", "Possédées"], ["missing", "Manquantes"]].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
          {ORDER.map(r => (
            <button key={r} type="button" aria-pressed={filter === r} onClick={() => setFilter(r)}>
              <i className="dot" style={{ background: RAR[r].color }} />{RAR[r].label}
            </button>
          ))}
        </div>
        <div className="grid">
          {shown.map(c => owned.has(c.id) ? (
            <div key={c.id} className="slot-card">
              <div dangerouslySetInnerHTML={{ __html: renderCard(c) }} />
              {owned.get(c.id) > 1 && <span className="qty">×{owned.get(c.id)}</span>}
            </div>
          ) : (
            <div key={c.id} className="missing" title="Carte pas encore obtenue">
              <span><i style={{ background: RAR[c.rarete].color }} />{String(c.numero).padStart(3, "0")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
