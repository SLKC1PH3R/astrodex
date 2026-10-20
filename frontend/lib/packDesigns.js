/* Designs des paquets « booster à thème » (maquettes validées), un par booster (catalog/boosters.yaml).
   Rendu : components/PackArt.js + app/packart.css. Le paquet fait 1 × 2 (largeur × hauteur).

   art      : fond de la fenêtre d'illustration (sous les images)
   stars    : opacité du champ d'étoiles (0 = aucun)
   layers   : images empilées dans la fenêtre d'illustration ; x, y, w, h en % de cette fenêtre
              fit "cover" | "contain", blend "screen" pour les images sur fond noir, round = découpe ronde,
              clip = découpe libre (clip-path) pour isoler un astre d'une photo à fond gris
   tint     : voile coloré au-dessus des images (facultatif)
   shade    : assombrissement haut / bas de l'illustration (lisibilité du titre)
   band     : dégradé du bandeau haut et bas ; stripe : liseré clair sous le bandeau
   fill     : dégradé du titre ; dark : contour foncé ; rim : contour clair ; size : taille du titre
   plate    : fond de la plaque du titre ; ring : liseré de la plaque ; label : contour de « BOOSTER À THÈME »
   bg, glow : fond du paquet et halo autour */

const M = "/media/";

export const PACK_DESIGNS = {
  S1A: {
    art: "#2a0800", stars: 0,
    layers: [
      { src: "soleil_eruption.webp", x: -40, y: -6, w: 180, h: 112, fit: "cover", pos: "18% 60%" },
      { src: "venus.webp", x: 6.84, y: 41.2, w: 16.84, h: 10.63, blend: "screen", opacity: 0.9 },
      { src: "mercure.webp", x: 66.84, y: 5.65, w: 27.37, h: 17.28, blend: "screen" },
    ],
    shade: ["rgba(42,8,0,.4)", "rgba(46,8,0,.92)"],
    band: ["#ec8a2e", "#b8480c"], stripe: ["#eec08a", "#f8e6c8"],
    fill: "linear-gradient(180deg, #fff1c9 8%, #f2c443 44%, #d75e0a 56%, #ec9d40 96%)",
    dark: "#3a0900", rim: "#fff1c4", label: "#2a0800",
    plate: ["rgba(122,28,5,.82)", "rgba(46,8,0,.94)"], ring: "#ffd36b", ringOut: "#4a1500",
    bg: "#2a0800", glow: "rgba(200,95,25,.4)",
  },
  S1B: {
    art: "radial-gradient(80% 50% at 70% 30%, rgba(214,150,60,.45), transparent 70%), radial-gradient(70% 45% at 15% 75%, rgba(90,70,200,.45), transparent 70%), #0b0d2a",
    stars: 0.8,
    layers: [
      { src: "saturne.webp", x: -25, y: 6.64, w: 150, h: 94.68, blend: "screen", rotate: -14 },
      { src: "titan.webp", x: 7.37, y: 4.98, w: 19.47, h: 12.29, blend: "screen" },
      { src: "encelade.webp", x: 80, y: 54.82, w: 12.1, h: 7.64, blend: "screen", opacity: 0.9, clip: "circle(36% at 54% 38%)" },
    ],
    shade: ["rgba(11,13,42,.35)", "rgba(8,9,30,.92)"],
    band: ["#ddb14c", "#9c6c10"], stripe: ["#e8d09a", "#f6ecd2"],
    fill: "linear-gradient(180deg, #fff6dc 8%, #eccd7a 44%, #a87210 56%, #dcae4a 96%)",
    dark: "#2b1700", rim: "#fff4d0", label: "#1a1530",
    plate: ["rgba(30,30,80,.85)", "rgba(8,9,30,.95)"], ring: "#ffd36b", ringOut: "#2b1700",
    bg: "#0b0d2a", glow: "rgba(200,150,50,.4)",
  },
  S1C: {
    art: "radial-gradient(90% 55% at 50% 100%, rgba(80,200,255,.5), transparent 70%), radial-gradient(60% 40% at 85% 15%, rgba(120,90,255,.35), transparent 70%), linear-gradient(180deg, #061a3a, #0a3d66)",
    stars: 0.85,
    layers: [
      { src: "neptune.webp", x: 6.32, y: 4.32, w: 32.1, h: 20.27, blend: "screen" },
      { src: "triton.webp", x: 75.26, y: 15.28, w: 15.26, h: 9.63, blend: "screen", opacity: 0.9 },
      { src: "encelade.webp", x: 60.53, y: 4.98, w: 10.53, h: 6.64, blend: "screen", opacity: 0.85, clip: "circle(36% at 54% 38%)" },
      { src: "europe.webp", x: -21.05, y: 28.24, w: 142.1, h: 89.7, blend: "screen" },
    ],
    shade: ["rgba(6,26,58,.35)", "rgba(4,26,52,.9)"],
    band: ["#3aa4cf", "#0c5f8c"], stripe: ["#a8d8ea", "#e6f4fa"],
    fill: "linear-gradient(180deg, #eef9fd 8%, #9cd8ec 44%, #13729f 56%, #58b8dc 96%)",
    dark: "#062a45", rim: "#e6fbff", label: "#062a45",
    plate: ["rgba(10,70,120,.84)", "rgba(4,26,52,.95)"], ring: "#94d2e6", ringOut: "#062a45",
    bg: "#04203a", glow: "rgba(40,140,190,.4)",
  },
  S2A: {
    art: "radial-gradient(70% 50% at 95% 0%, rgba(255,200,120,.55), transparent 70%), radial-gradient(70% 45% at 0% 80%, rgba(150,70,30,.45), transparent 70%), linear-gradient(180deg, #1a0d08, #2a1508)",
    stars: 0.7,
    layers: [
      { src: "ast-eros.webp", x: 1.58, y: 3.65, w: 39.47, h: 24.92, blend: "screen", rotate: -18, filter: "sepia(.45) saturate(1.5) brightness(1.05)" },
      { src: "ast-ida_dactyl.webp", x: 66.32, y: 10.3, w: 28.95, h: 18.27, blend: "screen", filter: "sepia(.4) saturate(1.4)" },
      { src: "ast-vesta.webp", x: -2.63, y: 24.92, w: 105.26, h: 66.45, blend: "screen", filter: "sepia(.5) saturate(1.6) brightness(1.1) contrast(1.1)" },
    ],
    shade: ["rgba(26,13,8,.35)", "rgba(30,14,4,.92)"],
    band: ["#c88c4a", "#734418"], stripe: ["#e2c597", "#f4e7d2"],
    fill: "linear-gradient(180deg, #fff6e6 8%, #f3c98a 44%, #9a5a1a 56%, #e0a65c 96%)",
    dark: "#2a1406", rim: "#fbe8c8", label: "#2a1406",
    plate: ["rgba(90,48,16,.86)", "rgba(30,14,4,.95)"], ring: "#f3c98a", ringOut: "#2a1406",
    bg: "#1e0f06", glow: "rgba(180,120,60,.4)",
  },
  S3A: {
    art: "#1a0a20", stars: 0,
    layers: [
      { src: "neb-pillars_m16.webp", x: -15.79, y: -1.66, w: 131.58, h: 103, fit: "cover", pos: "50% 40%", filter: "saturate(1.25) contrast(1.05)" },
      { src: "neb-orion_m42.webp", x: 55.26, y: -3.32, w: 52.63, h: 33.22, fit: "cover", round: true, blend: "screen", opacity: 0.55, filter: "saturate(1.4)" },
    ],
    tint: "radial-gradient(80% 40% at 50% 0%, rgba(190,50,100,.22), transparent 70%)",
    shade: ["rgba(40,4,26,.35)", "rgba(40,4,26,.92)"],
    band: ["#d4477c", "#8c1440"], stripe: ["#eeb2c7", "#fae4ec"],
    fill: "linear-gradient(180deg, #fff0f5 8%, #f0a2bf 44%, #a9134b 56%, #dc5f8d 96%)",
    dark: "#3a0626", rim: "#ffe3f2", label: "#3a0626",
    plate: ["rgba(110,16,70,.86)", "rgba(40,4,26,.95)"], ring: "#eba6c0", ringOut: "#3a0620",
    bg: "#28041a", glow: "rgba(180,50,95,.4)",
  },
  S3B: {
    art: "radial-gradient(70% 45% at 50% 42%, rgba(255,90,60,.45), transparent 70%), radial-gradient(60% 40% at 100% 0%, rgba(140,60,255,.4), transparent 70%), linear-gradient(180deg, #160416, #2a0410)",
    stars: 0.8,
    layers: [
      { src: "neb-casA.webp", x: 60.53, y: 1, w: 44.74, h: 28.24, fit: "cover", round: true, blend: "screen", opacity: 0.85 },
      { src: "neb-crab_m1.webp", x: -18.42, y: 18.27, w: 136.84, h: 86.38, fit: "cover", blend: "screen", rotate: -10, filter: "saturate(1.35) brightness(1.1)" },
    ],
    shade: ["rgba(22,4,22,.35)", "rgba(40,2,12,.92)"],
    band: ["#d2313b", "#850b16"], stripe: ["#eeb0b3", "#fae3e4"],
    fill: "linear-gradient(180deg, #fff0ee 8%, #f2a59b 44%, #ad0f1e 56%, #e0574d 96%)",
    dark: "#3a0610", rim: "#ffe0e3", label: "#3a0610",
    plate: ["rgba(120,10,30,.86)", "rgba(40,2,12,.95)"], ring: "#eca2a8", ringOut: "#3a0610",
    bg: "#22030c", glow: "rgba(185,35,45,.4)",
  },
  S4A: {
    art: "radial-gradient(70% 45% at 55% 45%, rgba(110,90,255,.45), transparent 70%), radial-gradient(60% 40% at 0% 100%, rgba(40,140,255,.35), transparent 70%), linear-gradient(180deg, #07061e, #120c3a)",
    stars: 0.9,
    layers: [
      { src: "dso-n5128.webp", x: -4.74, y: 1.33, w: 44.74, h: 28.24, fit: "cover", round: true, blend: "screen", opacity: 0.9 },
      { src: "dso-m83.webp", x: -23.68, y: 14.95, w: 147.37, h: 93.02, fit: "cover", blend: "screen", rotate: 24, filter: "saturate(1.5) brightness(1.35) contrast(1.1)" },
    ],
    shade: ["rgba(7,6,30,.35)", "rgba(10,8,40,.92)"],
    band: ["#6b6ed9", "#2d278c"], stripe: ["#c0c1ee", "#ebeafb"],
    fill: "linear-gradient(180deg, #f1f0ff 8%, #b3b1f2 44%, #3b32b8 56%, #8a80e6 96%)",
    dark: "#120a40", rim: "#ecebff", label: "#120a40", size: 42,
    plate: ["rgba(40,30,120,.86)", "rgba(10,8,40,.95)"], ring: "#bdb9f0", ringOut: "#120a40",
    bg: "#0a0828", glow: "rgba(90,90,210,.4)",
  },
};
for (const d of Object.values(PACK_DESIGNS)) for (const l of d.layers) l.src = M + l.src;

/* Boosters « un par série » (S1-STD…) : on leur prête le design du thème le plus proche
   plutôt qu'un design généré. */
export const SERIES_DESIGNS = { S1: PACK_DESIGNS.S1B, S2: PACK_DESIGNS.S2A, S3: PACK_DESIGNS.S3A, S4: PACK_DESIGNS.S4A };

/* Design de secours pour un booster sans maquette : bandeau à sa couleur, son image en plein cadre. */
export function fallbackDesign(theme) {
  const c = theme.couleur || "#9184d9";
  return {
    art: "#0b0d2a", stars: 0.7,
    layers: theme.image ? [{ src: theme.image, x: -10, y: 0, w: 120, h: 100, fit: theme.cadrage === "photo" ? "cover" : "contain", blend: "screen" }] : [],
    shade: ["rgba(8,9,30,.35)", "rgba(8,9,30,.92)"],
    band: [`color-mix(in srgb, ${c} 88%, black)`, `color-mix(in srgb, ${c} 50%, black)`],
    stripe: [`color-mix(in srgb, ${c} 40%, white)`, "#ffffff"],
    fill: `linear-gradient(180deg, #ffffff 8%, color-mix(in srgb, ${c} 45%, white) 44%, ${c} 56%, color-mix(in srgb, ${c} 60%, white) 96%)`,
    dark: "#0c0d24", rim: "#ffffff", label: "#0c0d24",
    plate: ["rgba(30,30,80,.85)", "rgba(8,9,30,.95)"], ring: `color-mix(in srgb, ${c} 60%, white)`, ringOut: "#0c0d24",
    bg: "#0b0d2a", glow: `color-mix(in srgb, ${c} 40%, transparent)`,
  };
}
