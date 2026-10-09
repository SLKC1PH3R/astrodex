"use client";
import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import CardGrid from "@/components/CardGrid";
import SeriesTabs from "@/components/SeriesTabs";
import { api } from "@/lib/api";

export default function ToutesLesCartesPage() {
  const [series, setSeries] = useState([]);
  const [serie, setSerie] = useState(null);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    api.series()
      .then(list => { setSeries(list); if (list[0]) setSerie(list[0]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!serie) return;
    api.seriesDetail(serie.code).then(d => setCards(d.cartes)).catch(() => {});
  }, [serie]);

  const changeSerie = code => setSerie(series.find(s => s.code === code) || null);

  return (
    <>
      <Topbar title="Toutes les cartes" sub={serie ? `${serie.nb_cartes} cartes · ${serie.nom}` : ""} />
      <SeriesTabs series={series} value={serie?.code} onChange={changeSerie} />
      <CardGrid cards={cards} />
    </>
  );
}
