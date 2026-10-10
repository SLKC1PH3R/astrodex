"use client";
/* Champ d'étoiles en canvas : parallaxe au pointeur, scintillement lent, figé si prefers-reduced-motion. */
import { useEffect, useRef } from "react";

export default function StarField({ pointer }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, stars = [], raf = 0, last = 0;
    const p = { x: .5, y: .5 };
    const draw = t => {
      const ptr = pointer.current || { x: .5, y: .5 };
      p.x += (ptr.x - p.x) * .05; p.y += (ptr.y - p.y) * .05;
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        const x = s.x - (p.x - .5) * 36 * s.z, y = s.y - (p.y - .5) * 24 * s.z;
        const a = (.25 + .75 * s.z) * (reduced ? 1 : .65 + .35 * Math.sin(t / 1000 * s.sp + s.ph));
        ctx.fillStyle = s.warm ? `rgba(255,226,180,${a})` : `rgba(226,228,240,${a})`;
        if (s.r > 1.3) {
          ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.283); ctx.fill();
          ctx.fillStyle = `rgba(181,171,252,${a * .18})`; ctx.beginPath(); ctx.arc(x, y, s.r * 3.4, 0, 6.283); ctx.fill();
        } else ctx.fillRect(x, y, s.r, s.r);
      }
    };
    const size = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(1.5, devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(320, W * H / 4200));
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H, z: .15 + Math.random() * .85,
        r: Math.random() < .08 ? 1.4 + Math.random() : .4 + Math.random() * .8,
        ph: Math.random() * 6.28, sp: .4 + Math.random() * 1.2, warm: Math.random() < .12,
      }));
      draw(performance.now());
    };
    size(); addEventListener("resize", size);
    if (!reduced) {
      const loop = t => { raf = requestAnimationFrame(loop); if (document.hidden || t - last < 33) return; last = t; draw(t); };
      raf = requestAnimationFrame(loop);
    }
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, [pointer]);
  return <canvas ref={ref} className="lx-stars" aria-hidden="true" />;
}
