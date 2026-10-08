"use client";
import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import CardGrid from "@/components/CardGrid";
import { api } from "@/lib/api";

export default function CollectionPage() {
  const [serie, setSerie] = useState(null);
  const [cards, setCards] = useState([]);
  const [owned, setOwned] = useState(new Map());
  const [error, setError] = useState(null);

  useEffect(() => {
    api.series()
      .then(list => {
        if (!list[0]) return;
        setSerie(list[0]);
        return Promise.all([api.seriesDetail(list[0].code), api.collection(list[0].code)]);
      })
      .then(res => {
        if (!res) return;
        const [detail, mine] = res;
        setCards(detail.cartes);
        setOwned(new Map(mine.map(c => [c.id, c.quantite])));
      })
      .catch(() => setError("Impossible de charger la collection."));
  }, []);

  return (
    <>
      <Topbar title="Collection" sub={serie ? `${serie.nom} · série ${serie.code}` : ""} />
      {error && <p className="ax-notice" style={{ padding: "0 32px" }}>{error}</p>}
      <CardGrid cards={cards} owned={owned} />
    </>
  );
}
