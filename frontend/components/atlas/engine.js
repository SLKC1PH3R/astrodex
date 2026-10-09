/* Moteur 3D de l'atlas (Three.js, DOM impératif).
   L'interface (échelles, fiche, liste, mesure) est rendue par React : app/jeu/atlas/page.js.
   Toutes les positions sont en années-lumière dans le repère galactique centré sur le Soleil,
   sauf le Système solaire, dessiné dans le plan de l'écliptique (unités astronomiques). */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RAR } from "@/components/Carte";

export const LY_AU = 63241.077;
export const LY_KM = 9.4607e12;
const YEAR_S = 31557600;
const D2R = Math.PI / 180;

/* ---------- Formats ---------- */
const nf = (v, d = 0) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(v);
const sig = v => nf(v, v < 10 ? 1 : 0);
export function fmtDist(ly, short = false) {
  const al = short ? "al" : ly < 2 ? "année-lumière" : "années-lumière";
  if (ly < 0.0158) { const au = ly * LY_AU; return au < 0.02 ? `${nf(ly * LY_KM)} km` : `${sig(au)} UA`; }
  if (ly < 1e6) return `${sig(ly)} ${al}`;
  if (ly < 1e9) return `${sig(ly / 1e6)} ${short ? "M al" : "millions d'" + al}`;
  return `${sig(ly / 1e9)} ${short ? "G al" : "milliards d'" + al}`;
}
export function fmtLight(ly) {
  const s = ly * YEAR_S;
  if (s < 60) return `${nf(s, 1)} seconde${s >= 2 ? "s" : ""}`;
  if (s < 3600) return `${nf(s / 60)} minutes`;
  if (s < 86400) { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return m ? `${h} h ${m} min` : `${h} h`; }
  if (s < YEAR_S) return `${nf(s / 86400)} jours`;
  if (ly < 1e6) return `${sig(ly)} an${ly >= 2 ? "s" : ""}`;
  if (ly < 1e9) return `${sig(ly / 1e6)} millions d'années`;
  return `${sig(ly / 1e9)} milliards d'années`;
}
const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

/* ---------- Repères astronomiques ---------- */
const EQ2GAL = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];
const OBL = 23.43928 * D2R;
const mul = (M, v) => [0, 1, 2].map(i => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);
const mulT = (M, v) => [0, 1, 2].map(i => M[0][i] * v[0] + M[1][i] * v[1] + M[2][i] * v[2]);
const ecl2eq = ([x, y, z]) => [x, y * Math.cos(OBL) - z * Math.sin(OBL), y * Math.sin(OBL) + z * Math.cos(OBL)];
const eq2ecl = ([x, y, z]) => [x, y * Math.cos(OBL) + z * Math.sin(OBL), -y * Math.sin(OBL) + z * Math.cos(OBL)];
const eclAU2galLY = v => mul(EQ2GAL, ecl2eq(v)).map(c => c / LY_AU);
const gal2ecl = v => eq2ecl(mulT(EQ2GAL, v));
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ---------- Orbites : éléments képlériens (Standish/JPL, 1800–2050) ---------- */
const ELEM = {
  mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  venus:   [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  earth:   [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  mars:    [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturn:  [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
  uranus:  [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589],
  neptune: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664],
  pluto:   [39.48211675, -0.00031596, 0.24882730, 0.00005170, 17.14001206, 0.00004818, 238.92903833, 145.20780515, 224.06891629, -0.04062942, 110.30393684, -0.01183482],
};
const jd = date => date.getTime() / 86400000 + 2440587.5;
function planetOrbit(key, date) {
  const T = (jd(date) - 2451545) / 36525, e0 = ELEM[key], v = i => e0[i] + e0[i + 1] * T;
  return { a: v(0), e: v(2), I: v(4) * D2R, w: v(8), O: v(10), M: v(6) - v(8) };
}
function smallBodyOrbit(el, date) {
  const n = 0.9856076686 / Math.pow(el.a, 1.5);
  return { a: el.a, e: el.e, I: el.i * D2R, w: el.peri + el.node, O: el.node, M: el.M0 + n * (jd(date) - el.epoch) };
}
function orbitPos(o, Mdeg) {
  const Mr = ((((Mdeg % 360) + 540) % 360) - 180) * D2R;
  let E = Mr + o.e * Math.sin(Mr);
  for (let i = 0; i < 12; i++) E -= (E - o.e * Math.sin(E) - Mr) / (1 - o.e * Math.cos(E));
  const xp = o.a * (Math.cos(E) - o.e), yp = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
  const w = (o.w - o.O) * D2R, O = o.O * D2R, I = o.I;
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
          (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
          (sw * sI) * xp + (cw * sI) * yp];
}

/* ---------- Échelles ---------- */
const AU_UNIT = 0.5; // UA par unité de scène au niveau 0
export const LEVELS = [
  { nom: "Système solaire", echelle: "50 UA", unit: AU_UNIT / LY_AU, min: 1.2, max: 260, dist: 150, elev: .62,
    rings: [[10 / LY_AU, "10 UA"], [30 / LY_AU, "30 UA"], [50 / LY_AU, "50 UA"]] },
  { nom: "Voisinage du Soleil", echelle: "65 al", unit: 0.65, min: 3, max: 260, dist: 160, elev: .5,
    rings: [[10, "10 al"], [25, "25 al"], [50, "50 al"]],
    hint: "Les 1 862 étoiles connues à moins de 65 années-lumière, avec leur couleur réelle" },
  { nom: "Voie lactée", echelle: "120 000 al", unit: 600, min: 4, max: 300, dist: 200, elev: .75, target: [44.5, 0, 0],
    rings: [[10000, "10 000 al"], [25000, "25 000 al"], [50000, "50 000 al"]],
    hint: "La bulle dorée autour du Soleil : les étoiles du catalogue HYG · forme de la galaxie illustrative" },
  { nom: "Groupe local", echelle: "25 M al", unit: 250000, min: 2, max: 260, dist: 170, elev: .55,
    rings: [[1e6, "1 M al"], [5e6, "5 M al"], [10e6, "10 M al"], [20e6, "20 M al"]],
    hint: "La Voie lactée et ses voisines" },
  { nom: "Univers proche", echelle: "500 M al", unit: 5e6, min: 2, max: 260, dist: 170, elev: .55,
    rings: [[50e6, "50 M al"], [100e6, "100 M al"], [250e6, "250 M al"], [500e6, "500 M al"]],
    hint: "La lumière de la galaxie du Têtard est partie il y a 420 millions d'années" },
];
export const levelOf = o => (o.planete || o.hote || o.orbite) ? 0 : o.dist <= 60000 ? 2 : o.dist <= 25e6 ? 3 : 4;

/* ---------- Petits outils de rendu ---------- */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function canvasTex(size, draw) {
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function bvColor(bv) {
  const t = Math.max(-0.4, Math.min(2, bv));
  const stops = [[-0.4, [155, 176, 255]], [0, [202, 216, 255]], [0.4, [248, 247, 255]], [0.8, [255, 236, 205]], [1.2, [255, 210, 160]], [2, [255, 170, 110]]];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], k = (t - a) / (b - a);
    return ca.map((v, j) => (v + (cb[j] - v) * k) / 255);
  }
  return stops.at(-1)[1].map(v => v / 255);
}
const loadImg = (() => {
  const cache = {};
  return src => cache[src] ??= new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
})();

/* ================================================================
   Montage
   ================================================================ */
export function mountAtlas(container, { data, onSelect, onLevel, onMeasure }) {
  const NOW = new Date();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const objects = data.objets;
  const bySlug = Object.fromEntries(objects.map(o => [o.slug, o]));

  /* Positions et distances depuis la Terre */
  const earthAU = orbitPos(planetOrbit("earth", NOW), planetOrbit("earth", NOW).M);
  for (const o of objects) {
    if (o.planete || o.orbite) {
      const orb = o.planete ? planetOrbit(o.planete, NOW) : smallBodyOrbit(o.orbite, NOW);
      o.orb = orb; o.au = orbitPos(orb, orb.M);
      o.posG = eclAU2galLY(o.au);
      o.distSoleil = Math.hypot(...o.au) / LY_AU;
      o.dist = o.planete === "earth" ? 0 : dist3(o.au, earthAU) / LY_AU;
    } else if (!o.hote) {
      o.posG = o.pos;
    }
  }
  for (const o of objects.filter(o => o.hote)) {
    const host = bySlug[o.hote];
    o.posG = [host.posG[0] + o.dist_km / LY_KM, host.posG[1], host.posG[2]];
    o.dist = o.hote === "terre" ? o.dist_km / LY_KM : host.dist;
  }
  for (const o of objects) o.level = levelOf(o);

  /* Rendu */
  const canvas = document.createElement("canvas");
  canvas.className = "atlas-gl";
  canvas.setAttribute("aria-label", "Carte 3D de l'univers");
  const labelsEl = document.createElement("div");
  labelsEl.className = "atlas-labels";
  container.append(canvas, labelsEl);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0b0c14, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 8000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false;
  controls.rotateSpeed = .6; controls.zoomSpeed = .9;

  let W = 1, H = 1, pxToScale = .001;
  const resize = () => {
    W = Math.max(1, container.clientWidth); H = Math.max(1, container.clientHeight);
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    pxToScale = 2 * Math.tan(camera.fov * D2R / 2) / H;
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const dotTex = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, "rgba(255,255,255,.75)"); gr.addColorStop(.6, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  const sunTex = canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "#fffbe8"); gr.addColorStop(.18, "#ffe39a"); gr.addColorStop(.42, "rgba(255,170,60,.35)"); gr.addColorStop(1, "rgba(255,140,40,0)");
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  const selTex = canvasTex(128, (g, s) => { g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 5; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 6, 0, 7); g.stroke(); });
  const mwTex = canvasTex(128, g => {
    const rng = mulberry(9);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,235,200,.95)"); gr.addColorStop(.25, "rgba(200,190,255,.35)"); gr.addColorStop(1, "rgba(120,140,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { const arm = i % 2 * Math.PI, r = 6 + rng() * 52, th = arm + Math.log(r / 6) / .3 + (rng() - .5) * .5; g.fillStyle = `rgba(210,220,255,${.25 + rng() * .4})`; g.fillRect(64 + Math.cos(th) * r, 64 + Math.sin(th) * r, 1.4, 1.4); }
  });

  const mat = m => { m.transparent = true; m.depthWrite = false; m.userData.base = m.opacity; return m; };
  const pointsMat = (px, opacity = 1, attenuate = false) =>
    mat(new THREE.PointsMaterial({ size: px, sizeAttenuation: attenuate, map: dotTex, vertexColors: true, opacity, blending: THREE.AdditiveBlending }));
  const lineMat = (color, opacity) => mat(new THREE.LineBasicMaterial({ color, opacity }));
  function makePoints(pos, col, material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return new THREE.Points(geo, material);
  }
  function glowSprite(tex, px, color = 0xffffff, opacity = 1) {
    const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: tex, color, sizeAttenuation: false, opacity, blending: THREE.AdditiveBlending })));
    s.userData.px = px; return s;
  }
  const galToScene = (g, unit) => new THREE.Vector3(g[0] / unit, g[2] / unit, -g[1] / unit);
  const eclToScene = (v, unit) => new THREE.Vector3(v[0] / unit, v[2] / unit, -v[1] / unit);

  const pickables = []; // { level, obj, kind, ref, el, prio }
  const rings = [];
  const addLabel = (cls, html) => { const el = document.createElement("div"); el.className = "atlas-lbl " + cls; el.innerHTML = html; el.style.opacity = 0; labelsEl.appendChild(el); return el; };
  for (const L of LEVELS) { L.group = new THREE.Group(); L.group.visible = false; scene.add(L.group); }

  function addRings(li) {
    const L = LEVELS[li];
    for (const [r, txt] of L.rings) {
      const rs = li === 0 ? r * LY_AU / AU_UNIT : r / L.unit, pts = [];
      for (let i = 0; i <= 192; i++) { const a = i / 192 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rs, 0, Math.sin(a) * rs)); }
      L.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0xb5abfc, .18)));
      rings.push({ level: li, r: rs, el: addLabel("ring", txt) });
    }
    if (li >= 3) {
      const pos = [], R = L.rings.at(-1)[0] / L.unit;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pos.push(0, 0, 0, Math.cos(a) * R, 0, Math.sin(a) * R); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      L.group.add(new THREE.LineSegments(g, lineMat(0xb5abfc, .06)));
    }
  }
  function dropLine(group, p) {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, new THREE.Vector3(p.x, 0, p.z)]), lineMat(0xb5abfc, .22)));
    const foot = glowSprite(dotTex, 6, 0xb5abfc, .5); foot.position.set(p.x, 0, p.z); group.add(foot);
  }

  /* Marqueur d'un objet : rareté si une carte existe, pointillés gris si elle n'est pas possédée */
  function drawMarker(o, img) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 160; const g = cv.getContext("2d");
    const state = o.cards?.length ? (o.owned ? "owned" : "locked") : "none";
    const col = state === "owned" ? RAR[o.bestRarete].color : state === "locked" ? "#5b6283" : "#8b8fb0";
    if (state === "owned") {
      const gr = g.createRadialGradient(80, 80, 40, 80, 80, 80); gr.addColorStop(0, col + "66"); gr.addColorStop(1, col + "00");
      g.fillStyle = gr; g.fillRect(0, 0, 160, 160);
    }
    g.save(); g.beginPath(); g.arc(80, 80, 50, 0, 7); g.clip();
    g.fillStyle = "#0a0b16"; g.fillRect(0, 0, 160, 160);
    if (img) {
      if (o.cadrage === "photo") { const s = Math.max(100 / img.width, 100 / img.height); g.drawImage(img, 80 - img.width * s / 2, 80 - img.height * s / 2, img.width * s, img.height * s); }
      else { const k = o.cadrage === "globe-large" ? 1.5 : 1.06; g.drawImage(img, 80 - 50 * k, 80 - 50 * k, 100 * k, 100 * k); }
    }
    if (state === "locked") {
      g.globalCompositeOperation = "saturation"; g.fillStyle = "#000"; g.fillRect(0, 0, 160, 160);
      g.globalCompositeOperation = "source-over"; g.fillStyle = "rgba(10,11,22,.6)"; g.fillRect(0, 0, 160, 160);
    }
    g.restore();
    g.lineWidth = state === "owned" ? 5 : 3; g.strokeStyle = col; g.setLineDash(state === "locked" ? [8, 7] : []);
    g.beginPath(); g.arc(80, 80, 53, 0, 7); g.stroke();
    return cv;
  }
  function markerSprite(o, px) {
    const m = mat(new THREE.SpriteMaterial({ sizeAttenuation: false, opacity: 1 }));
    const s = new THREE.Sprite(m); s.userData.px = px; s.renderOrder = 5;
    s.userData.refresh = () => loadImg(o.imageUrl).then(img => {
      const t = new THREE.CanvasTexture(drawMarker(o, img)); t.colorSpace = THREE.SRGBColorSpace;
      m.map?.dispose(); m.map = t; m.needsUpdate = true;
    });
    s.userData.refresh();
    return s;
  }
  function addObject(o, p) {
    const L = LEVELS[o.level], s = markerSprite(o, o.level === 0 && !o.hote ? 34 : o.hote ? 24 : 30);
    s.position.copy(p); L.group.add(s);
    if (o.level >= 2 && Math.abs(p.y) > .4) dropLine(L.group, p);
    const el = addLabel("", "");
    const item = { level: o.level, obj: s, kind: "objet", ref: o, el, prio: 10 };
    item.updateLabel = () => {
      el.classList.toggle("dim", !o.owned);
      el.innerHTML = `${esc(o.nom)}<small>${o.planete === "earth" ? "vous êtes ici" : fmtDist(o.dist, true)}</small>`;
      item.prio = o.owned ? 12 + ["C", "PC", "R", "UR", "L"].indexOf(o.bestRarete) : o.cards?.length ? 9 : 7;
      item.w = 0;
    };
    item.updateLabel(); pickables.push(item); o.item = item;
  }
  function addMark(li, obj, html, ref, kind = "repere", prio = 5) {
    const item = { level: li, obj, kind, ref, el: addLabel(kind === "etoile" ? "star" : "mark", html), prio };
    pickables.push(item); return item;
  }

  /* ---------- Niveau 0 : Système solaire ---------- */
  {
    const G = LEVELS[0].group, toS = v => eclToScene(v, AU_UNIT);
    const sun = glowSprite(sunTex, 70); G.add(sun);
    addMark(0, sun, "Soleil", { nom: "Soleil", detail: "Notre étoile", posG: [0, 0, 0], dist: 1 / LY_AU }, "repere", 30);
    addRings(0);
    for (const o of objects.filter(o => o.planete || o.orbite)) {
      const pts = [];
      for (let i = 0; i <= 360; i++) pts.push(toS(orbitPos(o.orb, i)));
      G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(o.planete ? 0x9a90d8 : 0x6a6f99, o.planete ? .42 : .3)));
      addObject(o, toS(o.au));
    }
    // lunes : orbites agrandies, mais rangées dans l'ordre réel des distances
    const hosts = {};
    for (const o of objects.filter(o => o.hote)) (hosts[o.hote] ??= []).push(o);
    for (const [hostSlug, moons] of Object.entries(hosts)) {
      const host = bySlug[hostSlug]; if (!host?.item) continue;
      const hp = host.item.obj.position;
      moons.sort((a, b) => a.dist_km - b.dist_km).forEach((o, k) => {
        const r = .9 + .42 * k, a = 2.1 + k * 2.4;
        const pts = []; for (let i = 0; i <= 64; i++) { const t = i / 64 * Math.PI * 2; pts.push(hp.clone().add(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r))); }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0x9a90d8, .22));
        G.add(line);
        addObject(o, hp.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)));
        o.item.moon = { host: host.item.obj, line };
      });
    }
  }

  /* ---------- Ciel de fond : vraies étoiles (magnitude ≤ 6) pour les niveaux 0 et 1 ---------- */
  function buildSky(frameFn) {
    const group = new THREE.Group();
    for (const [lo, hi, px, op] of [[-2, 2, 4.2, 1], [2, 4, 2.8, .9], [4, 6.1, 1.8, .65]]) {
      const pos = [], col = [], S = data.ciel;
      for (let i = 0; i < S.length; i += 5) {
        const mag = S[i + 3]; if (mag < lo || mag >= hi) continue;
        const v = frameFn([S[i], S[i + 1], S[i + 2]]); pos.push(v.x * 3000, v.y * 3000, v.z * 3000);
        const c = bvColor(S[i + 4]), k = Math.min(1, 1.25 - mag * .12); col.push(c[0] * k, c[1] * k, c[2] * k);
      }
      group.add(makePoints(pos, col, pointsMat(px, op)));
    }
    scene.add(group); return group;
  }
  const sky0 = buildSky(g => eclToScene(gal2ecl(g), 1));
  const sky1 = buildSky(g => galToScene(g, 1));

  /* ---------- Niveau 1 : voisinage du Soleil ---------- */
  {
    const L = LEVELS[1], G = L.group, N = data.voisinage, names = data.voisinage_noms;
    addRings(1);
    for (const [lo, hi, px] of [[-10, 2, 7], [2, 6, 4.5], [6, 11, 3], [11, 30, 2]]) {
      const pos = [], col = [];
      for (let i = 0; i < N.length; i += 5) {
        const am = N[i + 3]; if (am < lo || am >= hi) continue;
        const p = galToScene([N[i], N[i + 1], N[i + 2]], L.unit); pos.push(p.x, p.y, p.z); col.push(...bvColor(N[i + 4]));
      }
      G.add(makePoints(pos, col, pointsMat(px)));
    }
    const sun = glowSprite(sunTex, 30); G.add(sun);
    addMark(1, sun, "Soleil", { nom: "Soleil", detail: "Notre étoile, au centre de cette carte", posG: [0, 0, 0], dist: 0 }, "repere", 30);
    for (let i = 0, k = 0; i < N.length; i += 5, k++) {
      if (!names[k]) continue;
      const pg = [N[i], N[i + 1], N[i + 2]], d = Math.hypot(...pg), o = new THREE.Object3D();
      o.position.copy(galToScene(pg, L.unit)); G.add(o);
      const app = N[i + 3] - 5 * Math.log10(10 / (d / 3.26156));
      addMark(1, o, esc(names[k]), { nom: names[k], posG: pg, dist: d, absmag: N[i + 3] }, "etoile", 2 - app * .2);
    }
  }

  /* ---------- Niveau 2 : Voie lactée (forme illustrative) ---------- */
  {
    const L = LEVELS[2], G = L.group, rng = mulberry(42), pos = [], col = [];
    const put = (x, y, z, c) => { const p = galToScene([26700 + x, y, z], L.unit); pos.push(p.x, p.y, p.z); col.push(...c); };
    const gauss = () => (rng() + rng() + rng() + rng() - 2) / 1.2;
    for (let i = 0; i < 9000; i++) { const a = .47, x = gauss() * 9000, y = gauss() * 3200; put(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), gauss() * 2200, [1, .82 + rng() * .1, .58 + rng() * .1]); }
    const pitch = Math.tan(12.5 * D2R);
    for (let i = 0; i < 34000; i++) {
      const arm = (i % 4) * Math.PI / 2, r = 6500 + Math.pow(rng(), .85) * 45000;
      const th = arm + Math.log(r / 6500) / pitch + gauss() * .32 + 2.6, sc = 1200 + r * .035;
      put(Math.cos(th) * r + gauss() * sc, Math.sin(th) * r + gauss() * sc, gauss() * 380,
        rng() < .05 ? [1, .45, .62] : r < 12000 ? [1, .86, .66] : [.62 + rng() * .2, .72 + rng() * .15, 1]);
    }
    for (let i = 0; i < 9000; i++) { const r = Math.sqrt(rng()) * 52000, th = rng() * Math.PI * 2; put(Math.cos(th) * r, Math.sin(th) * r, gauss() * 600, [.55, .6, .78]); }
    G.add(makePoints(pos, col, pointsMat(.9, .55, true)));
    const B = data.bulle, bp = [], bc = [];
    for (let i = 0; i < B.length; i += 3) { const p = galToScene([B[i], B[i + 1], B[i + 2]], L.unit); bp.push(p.x, p.y, p.z); bc.push(1, .93, .8); }
    G.add(makePoints(bp, bc, pointsMat(.55, .4, true)));
    addRings(2);
    const sun = glowSprite(sunTex, 22); G.add(sun);
    addMark(2, sun, "Soleil · vous êtes ici", { nom: "Soleil", detail: "Notre étoile, à 26 700 années-lumière du centre galactique", posG: [0, 0, 0], dist: 0 }, "repere", 30);
  }

  /* ---------- Niveaux 3 et 4 ---------- */
  addRings(3);
  { const mw = glowSprite(mwTex, 46); LEVELS[3].group.add(mw);
    addMark(3, mw, "Voie lactée · vous êtes ici", { nom: "Voie lactée", detail: "Notre galaxie : 100 000 années-lumière de diamètre", posG: [26700, 0, 0], dist: 26700 }, "repere", 30); }
  addRings(4);
  { const lg = glowSprite(mwTex, 30); LEVELS[4].group.add(lg);
    addMark(4, lg, "Groupe local", { nom: "Groupe local", detail: "Une cinquantaine de galaxies, dont la Voie lactée et Andromède", posG: [0, 0, 0], dist: 0 }, "repere", 30); }
  for (const r of data.reperes) {
    const L = LEVELS[r.niveau], p = galToScene(r.pos, L.unit), s = glowSprite(dotTex, 16, 0xdfe4ff, .9);
    s.position.copy(p); L.group.add(s); if (Math.abs(p.y) > .4) dropLine(L.group, p);
    addMark(r.niveau, s, `${esc(r.nom)}<small>${fmtDist(r.dist, true)}</small>`, { ...r, posG: r.pos }, "repere", 6);
  }
  for (const o of objects) if (o.level >= 2) addObject(o, galToScene(o.posG, LEVELS[o.level].unit));

  /* Sélection et ligne de mesure */
  const selRing = glowSprite(selTex, 52); selRing.material.blending = THREE.NormalBlending; selRing.visible = false; scene.add(selRing);
  const measureLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    mat(new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 1, gapSize: .7, opacity: .9 })));
  measureLine.visible = false; measureLine.renderOrder = 6; scene.add(measureLine);

  /* ================================================================
     Navigation entre échelles
     ================================================================ */
  let cur = 0, anim = null, fly = null, selected = null, hovered = null, measureA = null, measureDraw = null;
  const setAlpha = (obj, a) => obj.traverse(o => { const m = o.material; if (m && m.userData.base !== undefined) m.opacity = m.userData.base * a; });
  const levelTarget = i => (LEVELS[i].target ? new THREE.Vector3(...LEVELS[i].target) : new THREE.Vector3());
  const placeCamera = (target, dist, dir) => { controls.target.copy(target); camera.position.copy(target).addScaledVector(dir, dist); };
  const viewDir = i => { const e = LEVELS[i].elev, a = .9; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize(); };
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const applyLimits = () => { controls.minDistance = LEVELS[cur].min; controls.maxDistance = LEVELS[cur].max; };
  function skyAlpha(from, af, to, at) {
    const s0 = (from === 0 ? af : 0) + (to === 0 ? at : 0), s1 = (from === 1 ? af : 0) + (to === 1 ? at : 0);
    setAlpha(sky0, s0); setAlpha(sky1, s1); sky0.visible = s0 > .01; sky1.visible = s1 > .01;
  }

  function goLevel(n, focus = null) {
    if (anim || n < 0 || n >= LEVELS.length) return;
    if (n === cur) { if (focus) select(focus); else flyTo(null); return; }
    const out = n > cur, A = LEVELS[cur].group, B = LEVELS[n].group;
    B.visible = true;
    const dir = camera.position.clone().sub(controls.target).normalize();
    anim = { t0: performance.now(), dur: reduced ? 1 : 1300, from: cur, to: n, out, A, B, dir,
      tgtDir: dir.clone().lerp(viewDir(n), .6).normalize(), fromT: controls.target.clone(),
      toT: focus ? focus.obj.position.clone() : levelTarget(n), fromD: camera.position.distanceTo(controls.target),
      toD: focus ? 18 : LEVELS[n].dist, focus };
    controls.enabled = false;
    setSelected(null);
    if (!focus) onSelect?.(null);
    onLevel?.(n);
  }
  function stepAnim(now) {
    const a = anim, k = Math.min(1, (now - a.t0) / a.dur), e = ease(k);
    a.A.scale.setScalar(Math.pow(a.out ? 1 / 30 : 30, e));
    a.B.scale.setScalar(Math.pow(a.out ? 30 : 1 / 30, 1 - e));
    setAlpha(a.A, Math.pow(1 - e, 1.6)); setAlpha(a.B, Math.pow(e, .8));
    skyAlpha(a.from, 1 - e, a.to, e);
    const d = Math.exp(Math.log(a.fromD) + (Math.log(a.toD) - Math.log(a.fromD)) * e);
    placeCamera(a.fromT.clone().lerp(a.toT, e), d, a.dir.clone().lerp(a.tgtDir, e).normalize());
    if (k >= 1) {
      a.A.visible = false; a.A.scale.setScalar(1); a.B.scale.setScalar(1); setAlpha(a.A, 1); setAlpha(a.B, 1);
      cur = a.to; anim = null; controls.enabled = true; applyLimits(); cooldownUntil = performance.now() + 900;
      if (a.focus) select(a.focus);
    }
  }

  /* Changement d'échelle à la molette, au bout du zoom */
  let pressure = 0, pressureT = 0, cooldownUntil = 0;
  const onWheel = e => {
    if (anim || performance.now() < cooldownUntil) { pressure = 0; return; }
    const d = camera.position.distanceTo(controls.target), now = performance.now();
    if (now - pressureT > 600) pressure = 0;
    pressureT = now;
    if (e.deltaY > 0 && d >= controls.maxDistance * .97) { pressure += e.deltaY; if (pressure > 260) { pressure = 0; goLevel(cur + 1); } }
    else if (e.deltaY < 0 && d <= controls.minDistance * 1.08 && cur > 0) { pressure -= e.deltaY; if (pressure > 260) { pressure = 0; goLevel(cur - 1); } }
    else pressure = 0;
  };
  canvas.addEventListener("wheel", onWheel, { passive: true });

  function flyTo(item) {
    const toT = item ? item.obj.getWorldPosition(new THREE.Vector3()) : levelTarget(cur);
    const toD = item ? Math.max(LEVELS[cur].min * 3, Math.min(item.moon ? 10 : 30, camera.position.distanceTo(controls.target))) : LEVELS[cur].dist;
    fly = { t0: performance.now(), dur: reduced ? 1 : 900, fromT: controls.target.clone(), toT, fromD: camera.position.distanceTo(controls.target), toD };
  }
  function stepFly(now) {
    const f = fly, e = ease(Math.min(1, (now - f.t0) / f.dur));
    placeCamera(f.fromT.clone().lerp(f.toT, e), f.fromD + (f.toD - f.fromD) * e, camera.position.clone().sub(controls.target).normalize());
    if (e >= 1) fly = null;
  }

  /* ================================================================
     Étiquettes, survol, sélection
     ================================================================ */
  const tmp = new THREE.Vector3();
  function screenOf(obj) {
    obj.getWorldPosition(tmp); tmp.project(camera);
    if (tmp.z > 1 || tmp.z < -1) return null;
    return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H };
  }
  const visible = p => !p.moon || p.alpha > .3;
  function updateLabels() {
    const showLevel = anim ? (performance.now() - anim.t0 > anim.dur * .7 ? anim.to : -1) : cur;
    const placed = [];
    for (const p of pickables) if (p.level !== showLevel) p.el.style.opacity = 0;
    const items = pickables.filter(p => p.level === showLevel).sort((a, b) => (b === selected) - (a === selected) || b.prio - a.prio);
    for (const p of items) {
      const s = visible(p) ? screenOf(p.obj) : null;
      if (!s || s.x < -50 || s.x > W + 50 || s.y < -20 || s.y > H + 20) { p.el.style.opacity = 0; continue; }
      if (!p.w) { p.w = p.el.offsetWidth || 60; p.h = p.el.offsetHeight || 14; }
      const off = p.kind === "objet" ? (p.moon ? 16 : 20) : p.kind === "etoile" ? 6 : 12;
      const box = { x: s.x - p.w / 2, y: s.y + off, w: p.w, h: p.h };
      const hit = placed.some(b => box.x < b.x + b.w + 4 && box.x + box.w + 4 > b.x && box.y < b.y + b.h && box.y + box.h > b.y);
      const show = p === selected || p === hovered || !hit;
      p.el.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
      p.el.style.opacity = show ? (p.moon ? p.alpha : 1) : 0;
      p.el.classList.toggle("sel", p === selected);
      if (show) placed.push(box);
    }
    const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) + .55;
    for (const r of rings) {
      if (r.level !== showLevel) { r.el.style.opacity = 0; continue; }
      tmp.set(Math.sin(az) * r.r, 0, Math.cos(az) * r.r).multiplyScalar(LEVELS[r.level].group.scale.x).project(camera);
      if (tmp.z > 1) { r.el.style.opacity = 0; continue; }
      r.el.style.transform = `translate(${((tmp.x + 1) / 2 * W + 4).toFixed(1)}px, ${((1 - tmp.y) / 2 * H - 6).toFixed(1)}px)`;
      r.el.style.opacity = .9;
    }
  }
  function pickAt(x, y, radius) {
    let best = null, bd = radius;
    for (const p of pickables) {
      if (p.level !== cur || !visible(p)) continue;
      const s = screenOf(p.obj); if (!s) continue;
      const d = Math.hypot(s.x - x, s.y - y) - (p.kind === "objet" ? 6 : 0);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let down = null;
  const onMove = e => {
    if (anim || e.buttons) return;
    hovered = pickAt(...local(e), e.pointerType === "mouse" ? 18 : 26);
    canvas.classList.toggle("hover", !!hovered);
  };
  const onDown = e => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = e => {
    if (!down || anim) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 6) return;
    const p = pickAt(...local(e), e.pointerType === "mouse" ? 20 : 30);
    if (p) select(p);
    else if (!measureA) { setSelected(null); onSelect?.(null); }
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);

  function setSelected(p) { selected = p; }
  function select(p) {
    if (measureA && measureA !== p) {
      const d = dist3(measureA.ref.posG, p.ref.posG);
      measureDraw = [measureA, p];
      onMeasure?.({ a: measureA.ref.nom, b: p.ref.nom, distance: fmtDist(d), lumiere: fmtLight(d) });
      measureA = null; setSelected(p); return;
    }
    setSelected(p); flyTo(p); onSelect?.(p);
  }

  /* ================================================================
     Boucle
     ================================================================ */
  const camHost = new THREE.Vector3();
  let raf = 0, alive = true;
  function frame(now) {
    if (!alive) return;
    if (anim) stepAnim(now); else if (fly) stepFly(now);
    controls.update();
    sky0.position.copy(camera.position); sky1.position.copy(camera.position);
    for (const L of LEVELS) if (L.group.visible) L.group.traverse(o => { if (o.isSprite && o.userData.px) o.scale.setScalar(o.userData.px * pxToScale); });
    // les lunes apparaissent quand on s'approche de leur planète
    if (cur === 0 && !anim) for (const p of pickables) if (p.moon) {
      p.moon.host.getWorldPosition(camHost);
      p.alpha = Math.max(0, Math.min(1, (70 - camera.position.distanceTo(camHost)) / 40));
      p.obj.material.opacity = p.alpha;
      p.moon.line.material.opacity = .22 * p.alpha;
    }
    selRing.scale.setScalar(52 * pxToScale * (1 + .06 * Math.sin(now / 260)));
    if (selected) { selected.obj.getWorldPosition(selRing.position); selRing.visible = selected.level === cur && !anim && visible(selected); } else selRing.visible = false;
    if (measureDraw && !anim && measureDraw.every(p => p.level === cur)) {
      const [a, b] = measureDraw.map(p => p.obj.getWorldPosition(new THREE.Vector3()));
      measureLine.geometry.setFromPoints([a, b]); measureLine.computeLineDistances();
      measureLine.material.dashSize = a.distanceTo(b) / 40; measureLine.material.gapSize = a.distanceTo(b) / 60;
      measureLine.visible = true;
    } else measureLine.visible = false;
    renderer.render(scene, camera);
    updateLabels();
    raf = requestAnimationFrame(frame);
  }

  LEVELS[0].group.visible = true; skyAlpha(0, 1, -1, 0);
  placeCamera(new THREE.Vector3(), LEVELS[0].dist * .55, viewDir(0));
  applyLimits();
  raf = requestAnimationFrame(frame);

  return {
    date: NOW,
    goLevel: (n, slug) => goLevel(n, slug ? bySlug[slug]?.item : null),
    focus(slug) { const o = bySlug[slug]; if (o?.item) (o.level === cur ? select(o.item) : goLevel(o.level, o.item)); },
    startMeasure(item) { measureA = item; measureDraw = null; },
    clearMeasure() { measureA = null; measureDraw = null; },
    refreshMarkers() { for (const o of objects) if (o.item) { o.item.obj.userData.refresh(); o.item.updateLabel(); } },
    deselect() { setSelected(null); },
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      canvas.removeEventListener("wheel", onWheel);
      scene.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
      renderer.dispose(); canvas.remove(); labelsEl.remove();
      for (const L of LEVELS) delete L.group;
    },
  };
}
