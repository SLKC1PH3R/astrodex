"use client";
import { useEffect, useRef, useState } from "react";
import PackArt from "@/components/PackArt";

const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* Anneau 3D de paquets identiques, tous tournés vers l'écran (« de face »), qui tourne en boucle.
   Glisser (avec inertie), molette ou flèches du clavier font tourner l'anneau ; il s'aimante
   toujours sur un paquet. Toucher un paquet latéral l'amène devant ; toucher celui de devant
   appelle onPick. intro : les paquets jaillissent du centre en spirale (après le trou noir).
   Positions calculées à chaque image (requestAnimationFrame), sans bibliothèque.
   Styles : app/packring.css (.pr-*) ; visuel du paquet : components/PackArt.js. */
export default function PackRing({ count = 20, theme, onPick, intro = true }) {
  const stageRef = useRef(null);
  const itemsRef = useRef([]);
  const [front, setFront] = useState(0);
  const sim = useRef(null);
  const step = TAU / count;

  useEffect(() => {
    const stage = stageRef.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = sim.current = {
      rot: 0, vel: 0, target: null, drag: null, justDragged: false, wheelTimer: 0,
      R: 400, tilt: 64, t0: performance.now(), intro: intro && !reduced, last: null, front: 0, raf: 0,
    };

    const measure = () => {
      const w = stage.clientWidth;
      s.R = Math.max(150, Math.min(w * 0.48, 640));
      s.tilt = s.R * 0.5; // écart vertical entre l'avant et le fond de l'anneau : on le voit d'en haut
      s.last = null; // force un nouveau rendu
    };
    const ro = new ResizeObserver(measure); ro.observe(stage); measure();

    const snapTarget = rot => Math.round(rot / step) * step;

    let prev = performance.now();
    const frame = now => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;

      // Mouvement : glisser > inertie > aimantation sur le paquet le plus proche
      if (!s.drag) {
        if (s.target != null) {
          const diff = s.target - s.rot;
          s.rot += diff * (reduced ? 1 : 1 - Math.exp(-dt * 11));
          if (Math.abs(diff) < 1e-4) { s.rot = s.target; s.target = null; }
        } else if (Math.abs(s.vel) > 0) {
          s.rot += s.vel * dt;
          s.vel *= Math.exp(-dt * 3.2);
          if (Math.abs(s.vel) < 0.9) { s.vel = 0; s.target = snapTarget(s.rot); }
        }
      }

      // Rendu (seulement si quelque chose a bougé)
      const introT = s.intro ? now - s.t0 : Infinity;
      const key = `${s.rot.toFixed(5)}|${s.R}`;
      if (key !== s.last || introT < 2200) {
        s.last = key;
        for (let i = 0; i < count; i++) {
          const el = itemsRef.current[i]; if (!el) continue;
          // jaillissement en spirale : les paquets sortent du centre les uns après les autres
          const p = Math.min(1, Math.max(0, (introT - i * 32) / 760));
          const e = easeOut(p);
          const a = i * step + s.rot + (1 - e) * TAU * 0.7;
          const d = (Math.cos(a) + 1) / 2;               // 1 = devant, 0 = au fond
          const x = Math.sin(a) * s.R * e;
          const y = (d - 0.5) * s.tilt * e;              // l'avant descend, le fond remonte : l'anneau est vu d'en haut
          const scale = (0.3 + 0.7 * Math.pow(d, 2.2)) * (0.15 + 0.85 * e); // décroît vite : les voisins se chevauchent moins
          el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(4)})`;
          el.style.zIndex = String(Math.round(d * 1000));
          el.style.opacity = String(Math.min(1, p * 2.5)); // opaques ; seuls les paquets du fond sont assombris
          el.style.setProperty("--dim", (0.78 * Math.pow(1 - d, 0.8)).toFixed(3)); // voile sombre (app/packring.css)
        }
        const f = mod(Math.round(-s.rot / step), count);
        if (f !== s.front) { s.front = f; setFront(f); }
      }
      s.raf = requestAnimationFrame(frame);
    };
    s.raf = requestAnimationFrame(frame);

    /* Glisser : listeners sur window pendant le geste (pas de setPointerCapture, qui
       détournerait le clic du paquet visé — voir lib/coverflow.js). */
    const onDown = e => {
      if (e.button !== 0) return;
      s.drag = { x: e.clientX, lastX: e.clientX, lastT: performance.now(), moved: 0 };
      s.target = null; s.vel = 0;
      addEventListener("pointermove", onMove);
      addEventListener("pointerup", onUp);
      addEventListener("pointercancel", onUp);
    };
    const onMove = e => {
      const g = s.drag; if (!g) return;
      const now = performance.now(), dx = e.clientX - g.lastX;
      g.moved += Math.abs(dx);
      s.rot += dx / s.R;
      const v = (dx / s.R) / Math.max(0.008, (now - g.lastT) / 1000);
      s.vel = s.vel * 0.6 + v * 0.4;
      g.lastX = e.clientX; g.lastT = now;
    };
    const onUp = () => {
      const g = s.drag; s.drag = null;
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
      if (!g) return;
      if (g.moved > 6) {
        s.justDragged = true; setTimeout(() => { s.justDragged = false; }, 0);
        if (performance.now() - g.lastT > 90) s.vel = 0; // relâché à l'arrêt : pas d'élan
        if (reduced || Math.abs(s.vel) < 0.9) { s.vel = 0; s.target = snapTarget(s.rot); }
      } else {
        s.vel = 0;
        if (s.target == null) s.target = snapTarget(s.rot);
      }
    };
    const onWheel = e => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      s.target = null; s.vel = 0;
      s.rot -= (delta * (e.deltaMode === 1 ? 16 : 1)) / s.R * 0.7;
      clearTimeout(s.wheelTimer);
      s.wheelTimer = setTimeout(() => { s.target = snapTarget(s.rot); }, 120);
    };
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(s.raf); ro.disconnect(); clearTimeout(s.wheelTimer);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("wheel", onWheel);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
    };
  }, [count, step, intro]);

  /* Amène le paquet i devant, par le chemin le plus court autour de l'anneau. */
  const goTo = i => {
    const s = sim.current; if (!s) return;
    const r0 = -i * step, base = s.target ?? s.rot;
    s.vel = 0; s.target = r0 + Math.round((base - r0) / TAU) * TAU;
  };
  const turn = dir => {
    const s = sim.current; if (!s) return;
    s.vel = 0; s.target = Math.round((s.target ?? s.rot) / step) * step - dir * step;
  };
  const onKey = e => {
    if (e.key === "ArrowRight") { e.preventDefault(); turn(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); turn(-1); }
    else if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onPick?.(front); }
  };

  return (
    <div className="pr-wrap" style={{ "--cc": theme.couleur }}>
      <div className="pr-stage" ref={stageRef} tabIndex={0} onKeyDown={onKey}
        role="group" aria-roledescription="carrousel" aria-label={`${count} paquets ${theme.titre}`}>
        <div className="pr-floor" aria-hidden="true" />
        {Array.from({ length: count }, (_, i) => (
          <button key={i} ref={el => { itemsRef.current[i] = el; }} type="button" tabIndex={-1}
            className={`pr-item${i === front ? " is-front" : ""}`}
            aria-label={i === front ? `Ouvrir ce paquet ${theme.titre}` : `Amener le paquet ${i + 1} devant`}
            onClick={() => {
              if (sim.current?.justDragged) return;
              if (i === front) onPick?.(i); else goTo(i);
            }}>
            <span className="pr-lift"><PackArt theme={theme} /></span>
          </button>
        ))}
      </div>
      <div className="pr-controls">
        <button className="btn btn-ghost btn-icon" type="button" aria-label="Paquet précédent" onClick={() => turn(-1)}>
          <i className="ph ph-caret-left" aria-hidden="true" />
        </button>
        <span className="pr-count" aria-live="polite">Paquet {front + 1} / {count}</span>
        <button className="btn btn-ghost btn-icon" type="button" aria-label="Paquet suivant" onClick={() => turn(1)}>
          <i className="ph ph-caret-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
