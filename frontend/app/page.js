"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import { mountBooster } from "@/components/engine";
import { api } from "@/lib/api";

export default function BoosterPage() {
  const game = useRef(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const refreshStats = useCallback(() => { api.me().then(setStats).catch(() => {}); }, []);

  useEffect(() => {
    let cancelled = false;
    api.boosters()
      .then(list => {
        if (cancelled) return;
        if (!list.length) { setError("Aucun booster actif dans le catalogue."); return; }
        game.current = mountBooster({ api, booster: list[0], onOpened: refreshStats });
      })
      .catch(() => !cancelled && setError("Le serveur de jeu ne répond pas. Réessaie dans un instant."));
    refreshStats();
    return () => { cancelled = true; game.current?.destroy(); game.current = null; };
  }, [refreshStats]);

  return (
    <>
      <canvas id="sky" />
      <div className="vignette" />
      <div className="app">
        <Header stats={stats} onOdds={() => game.current?.showOdds()} />
        <main className="stage" id="stage">
          {error && <p className="notice"><strong>Oups.</strong> {error}</p>}
        </main>
        <footer className="dock" id="dock" />
      </div>
      <div className="flash" id="flash" />
      <canvas id="fx" />
    </>
  );
}
