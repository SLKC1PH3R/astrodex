"use client";

/* Transition « trou noir » entre le choix de série et l'anneau de paquets (1,7 s).
   Calque plein écran indépendant du state "stage" : il continue son animation pendant que le
   contenu change dessous (app/jeu/page.js pilote sa durée de vie et change d'étape sous l'éclair).
   Chronologie, centrée sur (x, y) = le paquet choisi :
     0 → 0,6 s    le ciel s'assombrit, le disque d'accrétion s'ouvre, des traînées d'étoiles
                  sont aspirées ; le paquet tourne et disparaît dedans (app/coverflow.css, .cv-suck)
     0,6 → 1 s    le trou noir se referme sur un point
     1 s          éclair : la page passe à l'étape « paquets » dessous
     1 → 1,7 s    le voile se lève, les 20 paquets jaillissent en spirale (components/PackRing.js)
   Styles : app/blackhole.css (.bh-*). */
export const BLACK_HOLE = { swapAt: 1000, total: 1700 };

export default function BlackHole({ x, y }) {
  return (
    <div className="bh-overlay" aria-hidden="true"
      style={{ "--x": x != null ? `${x}px` : "50%", "--y": y != null ? `${y}px` : "50%" }}>
      <div className="bh-dim" />
      <div className="bh-streaks" />
      <div className="bh-hole">
        <div className="bh-lens" />
        <div className="bh-disk back" />
        <div className="bh-core" />
        <div className="bh-disk front" />
      </div>
      <div className="bh-flash" />
    </div>
  );
}
