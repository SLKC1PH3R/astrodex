"use client";
import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import CardGrid from "@/components/CardGrid";
import SeriesTabs from "@/components/SeriesTabs";
import { api } from "@/lib/api";

export default function CollectionPage() {
  const [series, setSeries] = useState([]);
  const [serie, setSerie] = useState(null);
  const [cards, setCards] = useState([]);
  const [owned, setOwned] = useState(new Map());
  const [error, setError] = useState(null);

  useEffect(() => {
    api.series()
      .then(list => { setSeries(list); if (list[0]) setSerie(list[0]); else setError("Aucune série disponible."); })
      .catch(() => setError("Impossible de charger la collection."));
  }, []);

  useEffect(() => {
    if (!serie) return;
    Promise.all([api.seriesDetail(serie.code), api.collection(serie.code)])
      .then(([detail, mine]) => {
        setCards(detail.cartes);
        setOwned(new Map(mine.map(c => [c.id, c.quantite])));
      })
      .catch(() => setError("Impossible de charger la collection."));
  }, [serie]);

  const changeSerie = code => setSerie(series.find(s => s.code === code) || null);

  return (
    <>
      <Topbar title="Collection" sub={serie ? `${serie.nom} · série ${serie.code}` : ""} />
      {error && <p className="ax-notice" style={{ padding: "0 32px" }}>{error}</p>}
      <SeriesTabs series={series} value={serie?.code} onChange={changeSerie} />
      <CardGrid cards={cards} owned={owned} />
    </>
  );
}
