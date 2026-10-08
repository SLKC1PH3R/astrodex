"use client";
import { useEffect, useMemo, useRef } from "react";
import Carte from "@/components/Carte";

const SPEEDS = [22, -16, 28, -20, 18]; // px/s, signe = sens
const COLS = SPEEDS.length;

/* Carrousel vertical : 5 colonnes qui défilent en continu, raretés mélangées. */
export default function CardCarousel({ cards }) {
  const tracks = useRef([]);

  const columns = useMemo(() => {
    const order = ["L", "UR", "R", "PC", "C"];
    const by = order.map(r => cards.filter(c => c.rarete === r));
    const mixed = [];
    for (let i = 0; mixed.length < cards.length; i++) by.forEach(l => l[i] && mixed.push(l[i]));
    return Array.from({ length: COLS }, (_, i) => {
      const list = mixed.filter((_, j) => j % COLS === i);
      return [...list, ...list]; // doublé pour une boucle sans couture
    });
  }, [cards]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const off = new Array(COLS).fill(0);
    let last = performance.now(), raf;
    const tick = t => {
      const dt = Math.min(64, t - last) / 1000; last = t;
      tracks.current.forEach((el, i) => {
        if (!el) return;
        const half = el.scrollHeight / 2; if (!half) return;
        off[i] = (off[i] + SPEEDS[i] * dt + half) % half;
        el.style.transform = `translateY(${-off[i]}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [columns]);

  return (
    <div className="ax-carousel-cols" aria-hidden="true">
      {columns.map((col, i) => (
        <div key={i}>
          <div className="ax-carousel-track" ref={el => (tracks.current[i] = el)}>
            {col.map((c, j) => <Carte key={`${c.id}-${j}`} c={c} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
