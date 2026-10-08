"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Carte, { ORDER, RAR } from "@/components/Carte";
import Topbar from "@/components/Topbar";
import OddsDialog from "@/components/OddsDialog";
import { usePlayer } from "@/components/PlayerProvider";
import { api } from "@/lib/api";

export default function PaquetsPage() {
  const router = useRouter();
  const { stats, refresh } = usePlayer();
  const [booster, setBooster] = useState(null);
  const [drawn, setDrawn] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [odds, setOdds] = useState(false);

  useEffect(() => {
    api.boosters()
      .then(list => (list.length ? setBooster(list[0]) : setError("Aucun booster actif dans le catalogue.")))
      .catch(() => setError("Le serveur de jeu ne répond pas. Réessaie dans un instant."));
  }, []);

  const left = stats?.boosters_restants;
  const noPacks = left === 0;

  const open = async () => {
    if (!booster || busy || noPacks) return;
    setBusy(true); setError(null);
    try {
      const r = await api.open(booster.code);
      setDrawn(r.cartes.map(c => ({ c, revealed: false })));
      refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const reveal = i => setDrawn(d => d.map((x, j) => (j === i ? { ...x, revealed: true } : x)));
  const revealAll = () => setDrawn(d => d.map(x => ({ ...x, revealed: true })));

  const hidden = drawn.filter(d => !d.revealed).length;
  const news = drawn.filter(d => d.c.nouvelle).length;
  const best = drawn.reduce((b, d) => (!b || ORDER.indexOf(d.c.rarete) > ORDER.indexOf(b.c.rarete) ? d : b), null);
  const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

  return (
    <>
      <Topbar title="Paquets" sub={booster ? `${booster.nom} · ${booster.nb_cartes} cartes` : ""} onOdds={booster ? () => setOdds(true) : null} />
      <section className="ax-stage">
        {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}

        {drawn.length === 0 && booster && (
          <div className="ax-pack-zone">
            <button className="ax-pack" type="button" onClick={open} disabled={busy || noPacks} aria-label={`Ouvrir ${booster.nom}`}>
              <span className="ax-seal t" />
              <span className="ax-cut" />
              <span className="ax-pack-head"><b>ASTRODEX</b><span>{booster.nom.replace(/^Booster\s*/i, "")}</span></span>
              {booster.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <span className="lighten"><img src={booster.image_url} alt="" draggable={false} /></span>
              )}
              <span className="ax-pack-foot">
                <span><b>{booster.serie}</b>SÉRIE</span>
                <span><b>{booster.nb_cartes}</b>CARTES</span>
              </span>
              <span className="ax-seal b" />
            </button>
            <div className="ax-pack-zone" style={{ gap: 10 }}>
              <button className="btn btn-primary btn-lg" type="button" onClick={open} disabled={busy || noPacks}>
                <i className="ph ph-package" style={{ fontSize: 18 }} />{busy ? "Ouverture…" : "Ouvrir le booster"}
              </button>
              <span className="ax-hint">
                {left == null ? "Boosters illimités" : noPacks ? "Reviens demain pour de nouveaux boosters" : `${plural(left, "booster")} disponible${left > 1 ? "s" : ""} aujourd'hui`}
              </span>
            </div>
          </div>
        )}

        {drawn.length > 0 && (
          <div className="ax-draw">
            <div className="ax-draw-row">
              {drawn.map((d, i) => (
                <div key={`${d.c.id}-${i}`} className="ax-lift" onClick={() => reveal(i)} style={{ cursor: d.revealed ? "default" : "pointer" }}>
                  <Carte c={d.c} revealed={d.revealed} nouvelle={d.c.nouvelle} hint />
                </div>
              ))}
            </div>
            <div className="ax-draw-foot">
              <div>
                {hidden
                  ? `Touche une carte pour la retourner · ${hidden} restante${hidden > 1 ? "s" : ""}`
                  : `${news ? plural(news, "nouvelle carte").replace("nouvelle cartes", "nouvelles cartes") : "Aucune nouvelle carte"} · meilleure carte : ${best.c.nom} (${RAR[best.c.rarete].label})`}
              </div>
              <div className="ax-actions" style={{ justifyContent: "center" }}>
                {hidden > 0 ? (
                  <button className="btn btn-primary" type="button" onClick={revealAll}>Tout révéler</button>
                ) : (
                  <>
                    <button className="btn btn-primary" type="button" onClick={() => setDrawn([])} disabled={noPacks}><i className="ph ph-package" />Ouvrir un autre booster</button>
                    <button className="btn btn-secondary" type="button" onClick={() => router.push("/jeu/collection")}>Voir la collection</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      {odds && <OddsDialog booster={booster} onClose={() => setOdds(false)} />}
    </>
  );
}
