/* Préférence d'animation : « systeme » (suit le réglage de l'appareil), « reduit » ou « complet ».
   Enregistrée sur l'appareil ; l'onglet Paramètres la modifie. Toutes les animations la consultent via prefersReduced(). */
const KEY = "astrodex-animations";

export function getMotion() {
  try { return localStorage.getItem(KEY) || "systeme"; } catch { return "systeme"; }
}

export function prefersReduced() {
  const m = getMotion();
  if (m === "reduit") return true;
  if (m === "complet") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Reporte la préférence sur <html data-motion="…"> pour les règles CSS. */
export function applyMotion() {
  if (typeof document !== "undefined") document.documentElement.dataset.motion = getMotion();
}

export function setMotion(value) {
  try { localStorage.setItem(KEY, value); } catch { /* stockage indisponible : réglage limité à la page */ }
  applyMotion();
}
