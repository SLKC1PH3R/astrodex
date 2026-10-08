"use client";
import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import CardGrid from "@/components/CardGrid";
import { api } from "@/lib/api";

export default function ToutesLesCartesPage() {
  const [serie, setSerie] = useState(null);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    api.series()
      .then(list => { if (list[0]) { setSerie(list[0]); return api.seriesDetail(list[0].code); } })
      .then(d => d && setCards(d.cartes))
      .catch(() => {});
  }, []);

  return (
    <>
      <Topbar title="Toutes les cartes" sub={serie ? `${serie.nb_cartes} cartes · ${serie.nom}` : ""} />
      <CardGrid cards={cards} />
    </>
  );
}
