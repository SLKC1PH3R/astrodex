"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER, RAR } from "@/components/Carte";
import SachetOpening from "@/components/SachetOpening";
import BoosterCarousel from "@/components/BoosterCarousel";
import BoosterPanel from "@/components/BoosterPanel";
import Topbar from "@/components/Topbar";
import OddsDialog from "@/components/OddsDialog";
import { usePlayer } from "@/components/PlayerProvider";
import { api } from "@/lib/api";

/* Parcours : choisir une série dans le carrousel → le booster s'ouvre aussitôt (SachetOpening en autoStart :
   déchirure, puis les cartes de la moins rare à la plus rare) → récapitulatif. "stage" piloté ici. */
export default function PaquetsPage() {
  const router = useRouter();
  const { stats, refresh } = usePlayer();
  const [boosters, setBoosters] = useState([]);
  const [booster, setBooster] = useState(null);
  const [stage, setStage] = useState("series"); // series | opening
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [odds, setOdds] = useState(false);
  const [run, setRun] = useState(0); // remonte la scène pour rouvrir
  const [owned, setOwned] = useState(null); // ids des cartes possédées (progression par booster)

  useEffect(() => {
    api.boosters()
      .then(list => {
        setBoosters(list);
        if (!list.length) return setError("Aucun booster actif dans le catalogue.");
        // /jeu?booster=CODE (onglet Boosters) : on ouvre directement ce booster
        const wanted = new URLSearchParams(window.location.search).get("booster");
        const b = list.find(x => x.code === wanted);
        setBooster(b || list[0]);
        if (b) { setChosen(b); setStage("opening"); setRun(n => n + 1); window.history.replaceState(null, "", "/jeu"); }
      })
      .catch(() => setError("Le serveur de jeu ne répond pas. Réessaie dans un instant."));
  }, []);

  // collection du joueur : rechargée en revenant au choix du booster (après une ouverture)
  useEffect(() => {
    if (stage !== "series") return;
    api.collection().then(list => setOwned(new Set(list.map(c => c.id)))).catch(() => {});
  }, [stage, stats?.cartes_total]);

  const left = stats?.boosters_restants;
  const noPacks = left === 0;
  const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

  const openSeries = () => {
    if (!booster || noPacks) return;
    setChosen(booster); setResult(null); setError(null);
    setStage("opening"); setRun(n => n + 1);
  };
  const again = () => { setResult(null); setError(null); setRun(n => n + 1); };
  const backToSeries = () => { setStage("series"); setResult(null); };

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
            {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
            <div className="pv-layout">
              <div className="pv-carousel">
                <BoosterCarousel boosters={boosters} selected={booster}
                  onSelect={b => { if (b.code !== booster?.code) setBooster(b); }} onChoose={openSeries} />
              </div>
              {booster && (
                <BoosterPanel booster={booster} owned={owned}>
                  {left != null && <span>{noPacks ? "Reviens demain pour de nouveaux boosters" : `${plural(left, "booster")} disponible${left > 1 ? "s" : ""} aujourd'hui`}</span>}
                </BoosterPanel>
              )}
            </div>
          </>
        )}

        {stage === "opening" && chosen && (
          <>
            {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
            <SachetOpening key={`${chosen.code}-${run}`} booster={chosen} disabled={noPacks}
              autoStart onOpen={open} onDone={done} onError={e => setError(e.message)} />
            <div className="ax-draw-foot">
              <div>
                {result
                  ? `${result.news ? plural(result.news, "nouvelle carte").replace("nouvelle cartes", "nouvelles cartes") : "Aucune nouvelle carte"} · meilleure carte : ${result.best.nom} (${RAR[result.best.rarete].label})`
                  : ""}
              </div>
              {result && (
                <div className="ax-actions" style={{ justifyContent: "center" }}>
                  <button className="btn btn-secondary" type="button" onClick={backToSeries}><i className="ph ph-arrow-left" />Retour aux séries</button>
                  <button className="btn btn-primary" type="button" disabled={noPacks} onClick={again}><i className="ph ph-package" />Ouvrir un autre booster</button>
                  <button className="btn btn-secondary" type="button" onClick={() => router.push("/jeu/collection")}>Voir la collection</button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
      {odds && <OddsDialog booster={booster} onClose={() => setOdds(false)} />}
    </>
  );
}
