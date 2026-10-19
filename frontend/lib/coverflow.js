"use client";
import { useRef, useState } from "react";

const mod = (a, n) => ((a % n) + n) % n;

/* Carrousel 3D façon "cover flow" : un élément actif, les autres reculent et s'inclinent de part
   et d'autre. Navigation au glisser (seuil de 40px), à la molette, aux flèches du clavier ou via
   prev()/next(). loop : la liste boucle (à partir de 3 éléments) ; active reste un index 0..n-1
   et offset(i) donne le décalage le plus court entre i et l'actif. */
export function useCoverflow(length, { initial = 0, loop = false } = {}) {
  const looping = loop && length >= 3;
  const [pos, setPos] = useState(() => Math.max(0, Math.min(length - 1, initial)));
  const drag = useRef(null);
  const wheelLock = useRef(0);
  const active = length ? (looping ? mod(pos, length) : pos) : 0;

  const setActive = i => {
    if (!length) return;
    if (!looping) return setPos(Math.max(0, Math.min(length - 1, i)));
    // vers l'équivalent le plus proche, pour que l'animation prenne le chemin court
    setPos(p => p + (((i - mod(p, length)) % length) + length + Math.floor(length / 2)) % length - Math.floor(length / 2));
  };
  const prev = () => (looping ? setPos(p => p - 1) : setActive(active - 1));
  const next = () => (looping ? setPos(p => p + 1) : setActive(active + 1));

  const offset = i => {
    if (!looping) return i - active;
    let o = mod(i - pos, length);
    if (o > length / 2) o -= length;
    return o;
  };

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
    onWheel: e => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = performance.now();
      if (Math.abs(delta) < 8 || now < wheelLock.current) return;
      wheelLock.current = now + 320; // un cran de molette = un élément
      delta > 0 ? next() : prev();
    },
    onKeyDown: e => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    },
  };
  return { active, pos, setActive, prev, next, offset, pointer, looping };
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
    "--pull": `${-offset * 140}px`,
  };
}
