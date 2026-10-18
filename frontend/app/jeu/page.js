"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER, RAR } from "@/components/Carte";
import SachetOpening from "@/components/SachetOpening";
import BoosterCarousel from "@/components/BoosterCarousel";
import PackPicker from "@/components/PackPicker";
import BlackHole from "@/components/BlackHole";
import Topbar from "@/components/Topbar";
import OddsDialog from "@/components/OddsDialog";
import { usePlayer } from "@/components/PlayerProvider";
import { api } from "@/lib/api";

/* Parcours : choisir une série → trou noir → spirale de 20 paquets identiques → on en touche un
   → ouverture (SachetOpening, inchangée). "stage" piloté ici ; "warp" est un calque indépendant
   qui continue son animation pendant que le contenu change dessous (voir onMid/onDone). */
export default function PaquetsPage() {
  const router = useRouter();
  const { stats, refresh } = usePlayer();
  const [boosters, setBoosters] = useState([]);
  const [booster, setBooster] = useState(null);
  const [stage, setStage] = useState("series"); // series | picker | opening
  const [warp, setWarp] = useState(false);
  const [chosen, setChosen] = useState(null);
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

  const openSeries = () => {
    if (!booster || noPacks) return;
    setChosen(booster); setResult(null); setWarp(true);
    setTimeout(() => setStage("picker"), 550);
    setTimeout(() => setWarp(false), 1200);
  };
  const backToSeries = () => { setStage("series"); setResult(null); };
  const pickPack = () => { setStage("opening"); setRun(n => n + 1); };

  const open = async () => {
    setError(null); setResult(null);
    const r = await api.open(chosen.code);
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
        {stage === "series" && (
          <>
            <BoosterCarousel boosters={boosters} selected={booster}
              onSelect={b => { if (b.code !== booster?.code) setBooster(b); }} />
            {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
            {booster && (
              <button className="btn btn-primary pk-open-series" type="button" disabled={noPacks} onClick={openSeries}>
                <i className="ph ph-door-open" />Ouvrir cette série
              </button>
            )}
            <div className="ax-draw-foot">
              <div>{left == null ? "" : noPacks ? "Reviens demain pour de nouveaux boosters" : `${plural(left, "booster")} disponible${left > 1 ? "s" : ""} aujourd'hui`}</div>
            </div>
          </>
        )}

        {stage === "picker" && chosen && (
          <PackPicker booster={chosen} onPick={pickPack} onBack={backToSeries} />
        )}

        {stage === "opening" && chosen && (
          <>
            {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
            <SachetOpening key={`${chosen.code}-${run}`} booster={chosen} disabled={noPacks}
              onOpen={open} onDone={done} onError={e => setError(e.message)} />
            <div className="ax-draw-foot">
              <div>
                {result
                  ? `${result.news ? plural(result.news, "nouvelle carte").replace("nouvelle cartes", "nouvelles cartes") : "Aucune nouvelle carte"} · meilleure carte : ${result.best.nom} (${RAR[result.best.rarete].label})`
                  : ""}
              </div>
              {result && (
                <div className="ax-actions" style={{ justifyContent: "center" }}>
                  <button className="btn btn-primary" type="button" disabled={noPacks} onClick={() => setStage("picker")}><i className="ph ph-package" />Choisir un autre paquet</button>
                  <button className="btn btn-secondary" type="button" onClick={backToSeries}>Changer de série</button>
                  <button className="btn btn-secondary" type="button" onClick={() => router.push("/jeu/collection")}>Voir la collection</button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
      {warp && <BlackHole />}
      {odds && <OddsDialog booster={booster} onClose={() => setOdds(false)} />}
    </>
  );
}
