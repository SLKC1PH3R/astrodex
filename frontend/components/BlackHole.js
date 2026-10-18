"use client";

/* Transition « trou noir » entre le choix de série et la spirale de paquets.
   Calque purement décoratif, indépendant du state "stage" : il continue son
   animation d'apparition/disparition pendant que le contenu change dessous
   (voir app/jeu/page.js, qui pilote sa durée de vie via setTimeout).
   Styles : app/blackhole.css (.bh-*). */
export default function BlackHole() {
  return (
    <div className="bh-overlay" aria-hidden="true">
      <div className="bh-vortex" />
      <div className="bh-flash" />
    </div>
  );
}
