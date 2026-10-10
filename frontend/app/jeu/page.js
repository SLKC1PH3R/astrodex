"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER, RAR } from "@/components/Carte";
import CoffretOpening from "@/components/CoffretOpening";
import BoosterCarousel from "@/components/BoosterCarousel";
import Topbar from "@/components/Topbar";
import OddsDialog from "@/components/OddsDialog";
import { usePlayer } from "@/components/PlayerProvider";
import { api } from "@/lib/api";

export default function PaquetsPage() {
  const router = useRouter();
  const { stats, refresh } = usePlayer();
  const [boosters, setBoosters] = useState([]);
  const [booster, setBooster] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [odds, setOdds] = useState(false);
  const [run, setRun] = useState(0); // remonte la scène pour rouvrir

  useEffect(() => {
    api.boosters()
      .then(list => { setBoosters(list); list.length ? setBooster(list[0]) : setError("Aucun booster actif dans le catalogue."); })
      .catch(() => setError("Le serveur de jeu ne répond pas. Réessaie dans un instant."));
  }, []);

  const left = stats?.boosters_restants;
  const noPacks = left === 0;
  const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

  const open = async () => {
    setError(null); setResult(null);
    const r = await api.open(booster.code);
    refresh();
    return r.cartes;
  };
  const done = cards => {
    const best = cards.reduce((b, c) => (!b || ORDER.indexOf(c.rarete) > ORDER.indexOf(b.rarete) ? c : b), null);
    setResult({ news: cards.filter(c => c.nouvelle).length, best });
  };

  return (
    <>
      <Topbar title="Paquets" sub={booster ? `${booster.nom} · ${booster.nb_cartes} cartes` : ""} onOdds={booster ? () => setOdds(true) : null} />
      <section className="ax-stage">
        <BoosterCarousel boosters={boosters} selected={booster}
          onSelect={b => { if (b.code !== booster?.code) { setBooster(b); setResult(null); setRun(n => n + 1); } }} />
        {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
        {booster && (
          <CoffretOpening key={`${booster.code}-${run}`} booster={booster} disabled={noPacks}
            onOpen={open} onDone={done} onError={e => setError(e.message)} />
        )}
        <div className="ax-draw-foot">
          <div>
            {result
              ? `${result.news ? plural(result.news, "nouvelle carte").replace("nouvelle cartes", "nouvelles cartes") : "Aucune nouvelle carte"} · meilleure carte : ${result.best.nom} (${RAR[result.best.rarete].label})`
              : left == null ? "" : noPacks ? "Reviens demain pour de nouveaux boosters" : `${plural(left, "booster")} disponible${left > 1 ? "s" : ""} aujourd'hui`}
          </div>
          {result && (
            <div className="ax-actions" style={{ justifyContent: "center" }}>
              <button className="btn btn-primary" type="button" disabled={noPacks} onClick={() => { setResult(null); setRun(n => n + 1); }}><i className="ph ph-package" />Ouvrir un autre coffret</button>
              <button className="btn btn-secondary" type="button" onClick={() => router.push("/jeu/collection")}>Voir la collection</button>
            </div>
          )}
        </div>
      </section>
      {odds && <OddsDialog booster={booster} onClose={() => setOdds(false)} />}
    </>
  );
}
