"use client";
import { useRef, useState } from "react";

/* Carrousel 3D façon "cover flow" : un index actif, les autres éléments reculent et s'inclinent
   de part et d'autre. Navigation au glisser (seuil de 40px) ou via prev()/next(). */
export function useCoverflow(length, { initial = 0 } = {}) {
  const [active, setActiveRaw] = useState(() => Math.max(0, Math.min(length - 1, initial)));
  const drag = useRef(null);
  const clamp = i => Math.max(0, Math.min(length - 1, i));
  const setActive = i => setActiveRaw(clamp(i));
  const prev = () => setActive(active - 1);
  const next = () => setActive(active + 1);
  const pointer = {
    // Pas de setPointerCapture ici : ça redirigerait le "click" qui suit vers .cv-stage au lieu
    // du bouton réellement sous le doigt, et aucun paquet ne deviendrait jamais cliquable.
    onPointerDown: e => { drag.current = { x: e.clientX }; },
    onPointerUp: e => {
      const d = drag.current; drag.current = null;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 40) (dx > 0 ? prev() : next());
    },
    onPointerCancel: () => { drag.current = null; },
  };
  return { active, setActive, prev, next, pointer };
}

/* Transform inline d'un élément du carrousel selon son décalage à l'actif (-N..+N). */
export function cfStyle(offset) {
  const sign = Math.sign(offset), abs = Math.min(Math.abs(offset), 5);
  const tx = offset * 108;
  const tz = -abs * 90;
  const ry = sign * Math.min(abs, 1) * 32;
  const scale = Math.max(0.55, 1 - abs * 0.1);
  const opacity = abs > 3.4 ? 0 : Math.max(0, 1 - abs * 0.24);
  return {
    transform: `translateX(${tx}px) translateZ(${tz}px) rotateY(${-ry}deg) scale(${scale})`,
    opacity, zIndex: 100 - Math.round(abs * 10),
    pointerEvents: abs > 3.4 ? "none" : "auto",
  };
}
