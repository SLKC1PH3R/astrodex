/* Un coffret par série. Ajoute une entrée quand tu crées une série dans catalog/series/.
   couleur : teinte du cadre, du halo et des rayons.
   image   : illustration du hublot (sinon image_url du booster renvoyée par l'API).
   cadrage : "globe" (planète détourée), "large" (planète à anneaux), "photo" (image pleine). */
export const SERIES_THEMES = {
  S1: { titre: "Système solaire", couleur: "#9184d9", image: "/media/saturne.webp", cadrage: "photo" },
  S2: { titre: "Astéroïdes", couleur: "#c9a66b", image: "/media/ast-vesta.webp", cadrage: "globe" },
  S3: { titre: "Nébuleuses", couleur: "#ff6b9d", image: "/media/neb-pillars_m16.webp", cadrage: "photo" },
};

/* Teinte de secours pour une série sans entrée : dérivée du code, stable d'une visite à l'autre. */
const FALLBACK = ["#9184d9", "#6aa8ff", "#5ee0c0", "#c58bff", "#ffcf6b", "oklch(0.74 0.12 345)"];
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function coffretTheme(booster) {
  const code = booster?.serie || "";
  const t = SERIES_THEMES[code];
  return {
    serie: code,
    titre: t?.titre || booster?.nom?.replace(/^Booster\s*/i, "") || code,
    couleur: t?.couleur || FALLBACK[hash(code) % FALLBACK.length],
    image: t?.image || booster?.image_url || null,
    cadrage: t?.cadrage || "photo",
  };
}
