/* Motifs de filigrane générés en SVG (gravure taille-douce, microtexte, numéro, logo).
   installFiligrane() les pose une fois en variables CSS sur :root ; numeroMask(n) sert au numéro en filigrane. */

const svgUrl = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const f = n => n.toFixed(1);

function waves(color, sw, w, h, lines, amp) {
  let d = "";
  for (let i = 0; i < lines; i++) {
    const y0 = (i + .5) * h / lines;
    for (let k = 0; k <= 24; k++) { const x = k / 24 * w; d += (k ? "L" : "M") + f(x) + " " + f(y0 + amp * Math.sin(2 * Math.PI * x / w + i * 1.3)); }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}"/></svg>`;
}

function micro(color, txt = "ASTRODEX · SÉRIE I · AUTHENTIQUE · ") {
  const w = txt.length * 3.05;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="6" viewBox="0 0 ${f(w)} 6"><text x="0" y="4.7" font-family="ui-monospace, Menlo, monospace" font-size="4.6" textLength="${f(w)}" fill="${color}">${txt}</text></svg>`;
}

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="28" fill="none" stroke="#000" stroke-width="5"/><circle cx="50" cy="50" r="11"/><path d="M4 64 L96 36" stroke="#000" stroke-width="5" stroke-linecap="round"/></svg>`;

export const PATTERNS = {
  "--ax-engrave-dark": svgUrl(waves("rgba(8,8,16,.55)", .35, 60, 5, 2, 1.1)),
  "--ax-engrave-mask": svgUrl(waves("#000", .45, 60, 5, 2, 1.1)),
  "--ax-micro-mask": svgUrl(micro("#000")),
  "--ax-micro-gold": svgUrl(micro("rgba(255,207,107,.85)")),
  "--ax-logo-mask": svgUrl(LOGO),
};

let installed = false;
export function installFiligrane() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(PATTERNS)) root.setProperty(k, v);
}

const cache = new Map();
export function numeroMask(numero) {
  const key = String(numero).padStart(3, "0");
  if (!cache.has(key)) cache.set(key, svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120"><text x="150" y="104" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="128" letter-spacing="-6">${key}</text></svg>`));
  return cache.get(key);
}
