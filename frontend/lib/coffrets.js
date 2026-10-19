/* Un coffret par série. Ajoute une entrée quand tu crées une série dans catalog/series/.
   couleur : teinte du cadre, du halo et des rayons.
   image   : illustration du hublot (sinon image_url du booster renvoyée par l'API).
   cadrage : "globe" (planète détourée), "large" (planète à anneaux), "photo" (image pleine). */
export const SERIES_THEMES = {
  S1: { titre: "Système solaire", couleur: "#9184d9", image: "/media/saturne.webp", cadrage: "photo" },
  S2: { titre: "Astéroïdes", couleur: "#c9a66b", image: "/media/ast-vesta.webp", cadrage: "globe" },
  S3: { titre: "Nébuleuses", couleur: "#ff6b9d", image: "/media/neb-pillars_m16.webp", cadrage: "photo" },
  S4: { titre: "Catalogue NGC", couleur: "#6aa8ff", image: "/media/neb-pillars_m16.webp", cadrage: "photo" },
};

/* Un thème par booster à thème (catalog/boosters.yaml) : prioritaire sur le thème de la série.
   Couleurs et illustrations reprises des maquettes de paquets. */
export const BOOSTER_THEMES = {
  S1A: { titre: "Tempête Solaire", couleur: "#ff7a1a", image: "/media/soleil_eruption.webp", cadrage: "photo" },
  S1B: { titre: "Anneaux Royaux", couleur: "#f2c14e", image: "/media/saturne.webp", cadrage: "photo" },
  S1C: { titre: "Océans Gelés", couleur: "#3fd0f5", image: "/media/europe.webp", cadrage: "globe" },
  S2A: { titre: "Roches Errantes", couleur: "#d99a4e", image: "/media/ast-vesta.webp", cadrage: "globe" },
  S3A: { titre: "Piliers Cosmiques", couleur: "#f0479f", image: "/media/neb-pillars_m16.webp", cadrage: "photo" },
  S3B: { titre: "Éclat Supernova", couleur: "#ff4458", image: "/media/neb-crab_m1.webp", cadrage: "photo" },
  S4A: { titre: "Spirales Lointaines", couleur: "#7b7dff", image: "/media/dso-m83.webp", cadrage: "photo" },
};

/* Teinte de secours pour une série sans entrée : dérivée du code, stable d'une visite à l'autre. */
const FALLBACK = ["#9184d9", "#6aa8ff", "#5ee0c0", "#c58bff", "#ffcf6b", "oklch(0.74 0.12 345)"];
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function coffretTheme(booster) {
  const code = booster?.serie || "";
  const t = BOOSTER_THEMES[booster?.code] || SERIES_THEMES[code];
  return {
    serie: code,
    titre: t?.titre || booster?.nom?.replace(/^Booster\s*/i, "") || code,
    couleur: t?.couleur || FALLBACK[hash(booster?.code || code) % FALLBACK.length],
    image: t?.image || booster?.image_url || null,
    cadrage: t?.cadrage || "photo",
  };
}
