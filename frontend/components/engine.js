/* Moteur d'animation du booster (DOM impératif, sans dépendance).
   Le rendu des cartes vient de ./card.js ; le tirage est fait par le serveur via api.open(). */
import { renderCard, RAR, ORDER, esc } from "./card.js";

export function mountBooster({ api, booster: initialBooster, onOpened }) {
let alive = true;

let SLOTS = [];      // taux par emplacement, fournis par l'API
let booster = null;  // booster actif
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, el = document) => el.querySelector(s);
const stage = $("#stage"), dock = $("#dock");
const wait = ms => new Promise(r => setTimeout(r, reduced ? Math.min(ms, 80) : ms));

/* ---------- Ciel étoilé ---------- */
const sky = $("#sky"), sg = sky.getContext("2d");
let stars = [], par = { x: 0, y: 0, tx: 0, ty: 0 };
function initSky() {
  const d = Math.min(devicePixelRatio, 2);
  sky.width = innerWidth * d; sky.height = innerHeight * d;
  stars = Array.from({ length: Math.round(innerWidth * innerHeight / 2600) }, () => ({
    x: Math.random(), y: Math.random(), z: Math.random(), tw: Math.random() * 6.28,
  }));
}
function drawSky(t) {
  const d = Math.min(devicePixelRatio, 2), W = sky.width, H = sky.height;
  par.x += (par.tx - par.x) * .05; par.y += (par.ty - par.y) * .05;
  sg.clearRect(0, 0, W, H);
  for (const s of stars) {
    const depth = .3 + s.z * .7;
    const x = ((s.x * W + par.x * depth * 30 * d) % W + W) % W;
    const y = ((s.y * H + par.y * depth * 30 * d) % H + H) % H;
    const a = (.25 + .6 * s.z) * (reduced ? 1 : .75 + .25 * Math.sin(t / 900 + s.tw));
    sg.fillStyle = `rgba(225,230,255,${a})`;
    const r = (s.z > .93 ? 1.4 : .7) * d;
    sg.fillRect(x, y, r, r);
  }
  if (alive) requestAnimationFrame(drawSky);
}
const onResize = () => { initSky(); fxResize(); };
const onParallax = e => { par.tx = (e.clientX / innerWidth - .5) * -2; par.ty = (e.clientY / innerHeight - .5) * -2; };
addEventListener("resize", onResize);
addEventListener("pointermove", onParallax);

/* ---------- Particules ---------- */
const fx = $("#fx"), fg = fx.getContext("2d");
let parts = [], fxOn = false;
function fxResize() { const d = Math.min(devicePixelRatio, 2); fx.width = innerWidth * d; fx.height = innerHeight * d; }
function burst(x, y, colors, n, power = 9, spread = Math.PI * 2, dir = 0) {
  if (reduced) return;
  for (let i = 0; i < n; i++) {
    const a = dir - spread / 2 + Math.random() * spread, s = power * (.3 + Math.random() * .9);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: .008 + Math.random() * .014,
      size: .6 + Math.random() * 2.2, col: colors[i % colors.length], streak: Math.random() < .35 });
  }
  if (!fxOn) { fxOn = true; requestAnimationFrame(fxTick); }
}
function fxTick() {
  const d = Math.min(devicePixelRatio, 2);
  fg.clearRect(0, 0, fx.width, fx.height);
  fg.globalCompositeOperation = "lighter";
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vx *= .955; p.vy = p.vy * .955 + .05; p.life -= p.decay;
    fg.globalAlpha = Math.max(0, p.life);
    fg.strokeStyle = fg.fillStyle = p.col;
    if (p.streak) { fg.lineWidth = p.size * d * .7; fg.beginPath(); fg.moveTo(p.x * d, p.y * d); fg.lineTo((p.x - p.vx * 3) * d, (p.y - p.vy * 3) * d); fg.stroke(); }
    else { fg.beginPath(); fg.arc(p.x * d, p.y * d, p.size * d, 0, 6.28); fg.fill(); }
  }
  fg.globalAlpha = 1; fg.globalCompositeOperation = "source-over";
  if (parts.length) requestAnimationFrame(fxTick); else { fxOn = false; fg.clearRect(0, 0, fx.width, fx.height); }
}
function flash(o = .9, ms = 650) { if (reduced) return; $("#flash").animate([{ opacity: o }, { opacity: 0 }], { duration: ms, easing: "ease-out" }); }
function haptic(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }

/* ---------- Gabarit de carte ---------- */
function cardHTML(c) { return renderCard(c); }
const backHTML = c => `<div class="back${ORDER.indexOf(c.r) >= 2 ? " rare" : ""}" style="--ac:${RAR[c.r].color}"><div class="back-in"><div class="emblem"></div><div class="word">ASTRODEX</div></div></div><div class="tap-ring" style="--ac:${RAR[c.r].color}"></div>`;

function setTilt(el, e, strength = 1) {
  const r = el.getBoundingClientRect();
  const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  el.style.setProperty("--mx", px * 100 + "%"); el.style.setProperty("--my", py * 100 + "%");
  el.style.setProperty("--ry", (px - .5) * 26 * strength + "deg"); el.style.setProperty("--rx", (.5 - py) * 22 * strength + "deg");
}
function clearTilt(el) { ["--mx", "--my", "--rx", "--ry"].forEach(p => el.style.removeProperty(p)); }

/* ---------- Dock ---------- */
function setDock(html) { dock.innerHTML = html; }
function caption(text) { let c = $(".caption", stage); if (!c) { c = document.createElement("div"); c.className = "caption"; stage.appendChild(c); } c.innerHTML = text; }

/* ======================================================
   1. Booster
   ====================================================== */
let busy = false, pulled = [];
function packPrint() {
  return `<div class="pack-print">
    <img class="neb" src="/media/dso-rho-a00.webp" alt="" draggable="false">
    <div class="tint"></div>
    <img class="planet" src="${booster.image_url || "/media/saturne.webp"}" alt="" draggable="false">
    <div class="seal t"></div><div class="seal b"></div>
    <div class="head"><b>ASTRODEX</b><span>${esc(booster.nom)}</span></div>
    <div class="foot"><span>BOOSTER<br>${booster.nb_cartes} CARTES</span><b>${esc(booster.serie)}</b></div>
  </div><div class="foil-sheen"></div><div class="foil-grain"></div>`;
}
function showPack() {
  busy = false;
  stage.innerHTML = `<div class="pack-zone" id="zone">
      <div class="light-beam" id="beam"></div>
      <div class="pack idle" id="pack" role="button" tabindex="0" aria-label="Booster Astrodex. Faire glisser horizontalement pour l'ouvrir, ou appuyer sur Entrée.">
        <div class="foil body">${packPrint()}</div>
        <div class="foil top">${packPrint()}</div>
        <div class="cut-guide"></div><div class="cut-glow" id="glow"></div><div class="cut-knob" id="knob"></div><div class="cut-hand"></div>
      </div>
    </div>`;
  caption("Fais glisser la souris le long des pointillés pour déchirer le booster");
  setDock(`<button class="cta" id="openBtn" type="button">Ouvrir le booster</button>`);
  $("#openBtn").onclick = () => autoTear();

  const pack = $("#pack"), glow = $("#glow"), top = $(".foil.top", pack), knob = $("#knob");
  let drag = null, hover = null, prog = 0, lastSpark = 0;
  const set = p => {
    prog = p; glow.style.width = p * 100 + "%";
    top.style.transform = `translateY(${-p * .5}em) rotate(${-p * 3.5}deg)`;
  };
  stage.onpointermove = e => {
    if (busy) return;
    const r = pack.getBoundingClientRect();
    if (!drag) {
      pack.classList.remove("idle");
      // survol de la ligne de découpe à la souris (sans clic) : déchire aussi
      const lineY = r.top + r.height * .13;
      const near = e.pointerType === "mouse" && Math.abs(e.clientY - lineY) < r.height * .1 && e.clientX > r.left - 20 && e.clientX < r.right + 20;
      setTilt(pack, e, near ? .15 : .6);
      if (!near) {
        if (hover) { hover = null; knob.style.opacity = 0; if (prog < 1) animateValue(prog, 0, 260, v => { if (!hover && !drag) set(v); }); }
        return;
      }
      if (!hover) { hover = { min: e.clientX, max: e.clientX }; $(".cut-hand", pack)?.remove(); }
      hover.min = Math.min(hover.min, e.clientX); hover.max = Math.max(hover.max, e.clientX);
      set(Math.min(1, (hover.max - hover.min) / (r.width * .7)));
    } else {
      drag.min = Math.min(drag.min, e.clientX); drag.max = Math.max(drag.max, e.clientX);
      set(Math.min(1, (drag.max - drag.min) / (r.width * .7)));
    }
    knob.style.left = Math.min(r.width, Math.max(0, e.clientX - r.left)) + "px"; knob.style.opacity = 1;
    const now = performance.now();
    if (now - lastSpark > 28) { lastSpark = now; burst(e.clientX, r.top + r.height * .13, ["#fff", "#ffe2a8", "#c58bff"], 3, 3, Math.PI, -Math.PI / 2); }
    if (prog >= 1) { drag = hover = null; pack.classList.remove("dragging"); tearOpen(); }
  };
  stage.onpointerleave = () => {
    if (drag || busy) return;
    clearTilt(pack); pack.classList.add("idle");
    if (hover) { hover = null; knob.style.opacity = 0; if (prog < 1) animateValue(prog, 0, 260, set); }
  };
  pack.onpointerdown = e => {
    if (busy) return;
    e.preventDefault();
    drag = { min: e.clientX, max: e.clientX };
    pack.classList.add("dragging"); pack.setPointerCapture(e.pointerId);
    $(".cut-hand", pack)?.remove();
    haptic(8);
  };
  const up = () => {
    if (!drag) return; drag = null; pack.classList.remove("dragging"); knob.style.opacity = 0;
    if (prog < 1) { const from = prog; animateValue(from, 0, 260, set); }
  };
  pack.onpointerup = up; pack.onpointercancel = up;
  pack.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); autoTear(); } };
  showPack.set = set;
}
function animateValue(a, b, ms, fn) {
  const t0 = performance.now();
  return new Promise(res => { const step = now => { const k = Math.min(1, (now - t0) / (reduced ? 1 : ms)); const e = 1 - Math.pow(1 - k, 3); fn(a + (b - a) * e); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
}
async function autoTear() {
  if (busy || !$("#pack")) return;
  $(".cut-hand")?.remove();
  const pack = $("#pack"); pack.classList.remove("idle");
  const r = pack.getBoundingClientRect(); const t0 = performance.now(); let last = 0;
  await animateValue(0, 1, 700, p => {
    showPack.set(p);
    const now = performance.now();
    if (now - last > 30) { last = now; burst(r.left + r.width * p, r.top + r.height * .13, ["#fff", "#ffe2a8"], 3, 3, Math.PI, -Math.PI / 2); }
  });
  tearOpen();
}
async function tearOpen() {
  if (busy) return; busy = true;
  const request = api.open(booster.code); // le tirage part dès la déchirure, l'animation masque l'attente
  stage.onpointermove = stage.onpointerleave = null;
  $("#openBtn") && ($("#openBtn").disabled = true);
  $(".caption", stage)?.remove();
  const zone = $("#zone"), pack = $("#pack"), top = $(".foil.top", pack), body = $(".foil.body", pack);
  $(".cut-guide", pack)?.remove();
  pack.style.transition = "transform .5s var(--ease-out)"; pack.style.setProperty("--rx", "0deg"); pack.style.setProperty("--ry", "0deg");
  const r = pack.getBoundingClientRect();
  haptic([12, 30, 18]);
  // le rabat s'envole
  top.animate([{ transform: top.style.transform }, { transform: "translate(5em,-16em) rotate(38deg)", opacity: 0 }], { duration: 750, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" });
  $("#glow").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" });
  burst(r.left + r.width / 2, r.top + r.height * .13, ["#ffffff", "#ffe2a8", "#c58bff", "#6aa8ff"], 70, 11, Math.PI * .9, -Math.PI / 2);
  $("#beam").animate([{ opacity: 0, transform: "rotate(0deg) scale(.6)" }, { opacity: 1, transform: "rotate(25deg) scale(1)", offset: .35 }, { opacity: 0, transform: "rotate(60deg) scale(1.1)" }], { duration: 1400, easing: "ease-out" });
  flash(.45, 500);
  await wait(320);

  try {
    const res = await request;
    pulled = res.cartes.map(c => ({ ...c, r: c.rarete }));
  } catch (err) {
    await wait(500);
    showPack();
    caption(`<span style="color:#ff9a9a">${esc(err.message || "Ouverture impossible")}</span>`);
    return;
  }
  onOpened && onOpened(pulled);

  // les cartes sortent du booster
  const deck = document.createElement("div");
  deck.className = "deck pile"; deck.style.position = "absolute"; deck.style.zIndex = "1";
  pulled.forEach((c, i) => {
    const slot = document.createElement("div");
    const down = ORDER.indexOf(c.r) >= 2;
    slot.className = "card-slot"; slot.dataset.i = i; slot.style.zIndex = 10 - i;
    slot.innerHTML = `<div class="tilt"><div class="flipper${down ? " down" : ""}">${cardHTML(c)}${backHTML(c)}</div></div>`;
    deck.appendChild(slot);
  });
  zone.appendChild(deck);
  pack.style.zIndex = "2";
  deck.animate([{ transform: "translateY(4em) scale(.86)" }, { transform: "translateY(-2.5em) scale(.86)", offset: .55 }, { transform: "translateY(0) scale(1)" }], { duration: 900, easing: "cubic-bezier(.3,.8,.3,1)" });
  await wait(380);
  body.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(22em) rotate(4deg)", opacity: 0 }], { duration: 650, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
  await wait(620);
  pack.remove();
  zone.style.width = "auto"; zone.style.height = "auto";
  deck.style.position = "relative";
  stage.replaceChildren(deck);
  busy = false;
  layoutDeck();
}

/* ======================================================
   2. Révélation et glisser
   ====================================================== */
const slotsLeft = () => [...stage.querySelectorAll(".card-slot")];
function pileTransform(k, p = 0, dir = 1) {
  // au repos : cartes empilées (léger relief) ; en glissant, la pile s'étale sur le côté
  if (k === 0) return "translate3d(0,0,0)";
  const e = 1 - Math.pow(1 - p, 2);
  return `translate3d(${(dir * k * (.08 + 2.1 * e)).toFixed(2)}em, ${(k * (.12 - .05 * e)).toFixed(2)}em, ${-k * 4}px) rotate(${(dir * k * 3.4 * e).toFixed(2)}deg)`;
}
function spreadPile(p, dir) {
  slotsLeft().forEach((el, k) => { if (k > 0) el.style.transform = pileTransform(k, p, dir); });
}
function layoutDeck() {
  const s = slotsLeft();
  s.forEach((el, k) => {
    el.classList.toggle("active", k === 0);
    el.style.zIndex = 10 - k;
    const tgt = pileTransform(k);
    if (el.dataset.placed && el.style.transform !== tgt)
      el.animate([{ transform: el.style.transform }, { transform: tgt }], { duration: 460, easing: "cubic-bezier(.34,1.45,.64,1)" });
    el.style.transform = tgt; el.dataset.placed = "1";
  });
  if (!s.length) return showResult();
  let pc = $(".pile-count", stage.querySelector(".deck"));
  if (!pc) { pc = document.createElement("div"); pc.className = "pile-count"; stage.querySelector(".deck").appendChild(pc); }
  pc.innerHTML = `<b>${pulled.length - s.length + 1}</b> / ${pulled.length}`;
  bindCard(s[0]);
  updateDock();
}
function updateDock() {
  const s = slotsLeft()[0]; if (!s) return;
  const down = $(".flipper", s).classList.contains("down");
  const left = slotsLeft().length;
  setDock(`<button class="ghost" id="skipBtn" type="button">Tout révéler</button><button class="cta" id="nextBtn" type="button">${down ? "Retourner la carte" : left > 1 ? "Carte suivante" : "Terminer"}</button>`);
  $("#nextBtn").onclick = () => down ? flipCard(s) : fling(s, -1, 0);
  $("#skipBtn").onclick = revealAll;
  caption(down ? "Touche la carte pour la retourner" : `Glisse la carte · ${left} restante${left > 1 ? "s" : ""}`);
  s.classList.toggle("down-hint", down);
}
function bindCard(slot) {
  const tilt = $(".tilt", slot);
  let st = null;
  slot.onpointerdown = e => {
    if (busy) return;
    slot.setPointerCapture(e.pointerId);
    st = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dy: 0, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: false };
    slot.getAnimations().forEach(a => a.cancel());
  };
  slot.onpointermove = e => {
    if (busy) return;
    setTilt(tilt, e, st ? .35 : 1);
    if (!st) return;
    const now = performance.now(), dt = Math.max(1, now - st.lt);
    st.vx = st.vx * .6 + ((e.clientX - st.lx) / dt) * .4; st.vy = st.vy * .6 + ((e.clientY - st.ly) / dt) * .4;
    st.lx = e.clientX; st.ly = e.clientY; st.lt = now;
    st.dx = e.clientX - st.x; st.dy = e.clientY - st.y;
    if (!st.moved && Math.hypot(st.dx, st.dy) > 6) { st.moved = true; slot.classList.add("dragging"); }
    if (st.moved) {
      const down = $(".flipper", slot).classList.contains("down");
      const k = down ? .35 : 1; // une carte face cachée résiste : on peut juste jeter un œil à la pile
      slot.style.translate = `${st.dx * k}px ${st.dy * .45 * k}px`;
      slot.style.rotate = `${st.dx * .055 * k}deg`;
      spreadPile(Math.min(1, Math.abs(st.dx) / (slot.getBoundingClientRect().width * .45)), st.dx > 0 ? -1 : 1); // la pile s'ouvre du côté opposé
    }
  };
  const end = e => {
    if (!st) return;
    const s = st; st = null; slot.classList.remove("dragging");
    const down = $(".flipper", slot).classList.contains("down");
    if (!s.moved) { return down ? flipCard(slot) : null; }
    const w = slot.getBoundingClientRect().width;
    if (!down && (Math.abs(s.dx) > w * .3 || Math.abs(s.vx) > .55)) return fling(slot, Math.sign(s.vx && Math.abs(s.vx) > .55 ? s.vx : s.dx), s.vy, s.vx);
    // la pile se referme
    slotsLeft().forEach((el, k) => { if (k > 0) { const from = el.style.transform, to = pileTransform(k); el.style.transform = to; el.animate([{ transform: from }, { transform: to }], { duration: 480, easing: "cubic-bezier(.34,1.45,.64,1)" }); } });
    // ressort de rappel
    const from = { translate: slot.style.translate, rotate: slot.style.rotate };
    slot.style.translate = ""; slot.style.rotate = "";
    slot.animate([from, { translate: "0 0", rotate: "0deg" }], { duration: 520, easing: "cubic-bezier(.34,1.56,.64,1)" });
  };
  slot.onpointerup = end; slot.onpointercancel = end;
  slot.onpointerleave = () => { if (!st) clearTilt(tilt); };
}
async function flipCard(slot) {
  if (busy) return; busy = true;
  const c = pulled[+slot.dataset.i], rank = ORDER.indexOf(c.r);
  const back = $(".back", slot), flipper = $(".flipper", slot);
  slot.classList.remove("down-hint");
  setDock(`<button class="ghost" type="button" disabled>Tout révéler</button><button class="cta" type="button" disabled>…</button>`);
  back.classList.add("aura");
  if (!reduced) slot.animate([{ rotate: "0deg" }, { rotate: "-1.6deg" }, { rotate: "1.6deg" }, { rotate: "-1deg" }, { rotate: "1deg" }, { rotate: "0deg" }],
    { duration: rank === 4 ? 900 : 520, iterations: rank === 4 ? 1 : 1 });
  haptic(rank === 4 ? [10, 40, 10, 40, 20] : 15);
  await wait([0, 0, 380, 650, 1050][rank]);
  if (rank === 4) flash(.95, 800); else if (rank === 3) flash(.4, 500);
  flipper.animate([{ transform: "rotateY(180deg) scale(1)" }, { transform: "rotateY(90deg) scale(1.08)", offset: .45 }, { transform: "rotateY(0deg) scale(1)" }],
    { duration: reduced ? 1 : 700, easing: "cubic-bezier(.3,1.3,.5,1)" });
  flipper.classList.remove("down");
  back.classList.remove("aura");
  await wait(300);
  const r = slot.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  if (rank === 4) burst(cx, cy, ["#fff3c4", "#ffcf6b", "#ffffff", "#ffb347"], 220, 13);
  else if (rank === 3) burst(cx, cy, ["#c58bff", "#ffffff", "#6aa8ff", "#ff9ad5"], 120, 11);
  else burst(cx, cy, ["#6aa8ff", "#ffffff"], 40, 7);
  await wait(250);
  busy = false; updateDock();
}
async function fling(slot, dir, vy = 0, vx = 0) {
  if (busy) return; busy = true;
  slot.onpointerdown = slot.onpointermove = slot.onpointerup = null;
  const fromT = slot.style.translate || "0px 0px", fromR = slot.style.rotate || "0deg";
  const speed = Math.max(.9, Math.abs(vx));
  const dist = innerWidth * .75 + 300;
  await slot.animate([{ translate: fromT, rotate: fromR }, { translate: `${dir * dist}px ${vy * 160}px`, rotate: `${dir * 28}deg` }],
    { duration: Math.max(240, 420 / speed), easing: "cubic-bezier(.2,.6,.35,1)", fill: "forwards" }).finished;
  slot.remove(); haptic(6);
  busy = false; layoutDeck();
}
async function revealAll() {
  if (busy) return;
  for (const s of slotsLeft()) if ($(".flipper", s).classList.contains("down")) { $(".flipper", s).classList.remove("down"); }
  showResult();
}

/* ======================================================
   3. Résultat
   ====================================================== */
function showResult() {
  const best = [...pulled].sort((a, b) => ORDER.indexOf(b.r) - ORDER.indexOf(a.r))[0];
  const n = pulled.length;
  stage.innerHTML = `<div class="result">
    <h2>Ton booster</h2>
    <div class="fan">${pulled.map((c, i) => `<div class="mini" tabindex="0" data-i="${i}">${cardHTML(c)}</div>`).join("")}</div>
    <p>Meilleure carte : <strong style="color:${RAR[best.r].color}">${best.nom}</strong> · ${RAR[best.r].label}</p>
  </div>`;
  stage.querySelectorAll(".mini").forEach((m, i) => {
    const t = (i - (n - 1) / 2);
    const base = `translateX(calc(-50% + ${t * 6.2}em)) rotate(${t * 7}deg)`;
    m.style.transform = base;
    m.animate([{ transform: "translateX(-50%) translateY(6em) scale(.8)", opacity: 0 }, { transform: base, opacity: 1 }], { duration: 650, delay: i * 70, easing: "cubic-bezier(.34,1.4,.64,1)", fill: "backwards" });
    m.onmouseenter = m.onfocus = () => m.style.transform = base + " translateY(-1.8em) scale(1.06)";
    m.onmouseleave = m.onblur = () => m.style.transform = base;
    m.onclick = () => inspect(pulled[i]);
    m.onkeydown = e => { if (e.key === "Enter") inspect(pulled[i]); };
  });
  caption("Touche une carte pour l'examiner");
  setDock(`<button class="cta" id="againBtn" type="button">Ouvrir un autre booster</button>`);
  $("#againBtn").onclick = showPack;
}
function inspect(c) {
  const ov = document.createElement("div");
  ov.className = "inspect";
  ov.innerHTML = `<div class="deck"><div class="card-slot"><div class="tilt">${cardHTML(c)}</div></div></div>`;
  document.body.appendChild(ov);
  const tilt = $(".tilt", ov);
  ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  $(".deck", ov).animate([{ transform: "scale(.85) translateY(2em)" }, { transform: "none" }], { duration: 450, easing: "cubic-bezier(.34,1.4,.64,1)" });
  ov.onpointermove = e => setTilt(tilt, e);
  ov.onclick = () => { ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).finished.then(() => ov.remove()); };
}

/* ---------- Taux de tirage ---------- */
function showOdds() {
  const old = $(".sheet"); if (old) return old.remove();
  const sh = document.createElement("div"); sh.className = "sheet";
  sh.innerHTML = `<h3>Taux de tirage · ${esc(booster ? booster.nom : "")}</h3>
    <table class="odds"><thead><tr><th>Carte</th>${ORDER.map(r => `<th style="color:${RAR[r].color}">${r}</th>`).join("")}</tr></thead>
    <tbody>${SLOTS.map((w, i) => `<tr><td>${i + 1}${i === SLOTS.length - 1 ? " · finale" : ""}</td>${ORDER.map(r => `<td>${w[r] ? Math.round(w[r] * 1000) / 10 + " %" : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <p class="note">Le tirage est effectué par le serveur. Photos NASA, ESA/Hubble (CC BY 4.0), ESO (CC BY 4.0) et NOIRLab ; globes reconstitués à partir des mosaïques des sondes NASA.</p>
    <div class="row"><span></span><button class="ghost" id="closeSheet" type="button">Fermer</button></div>`;
  document.body.appendChild(sh);
  $("#closeSheet", sh).onclick = () => sh.remove();
}

const onKey = e => {
  if (e.target.closest("input, button, .pack, .mini")) return;
  if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight" || e.key === "ArrowLeft") {
    const b = $("#nextBtn") || $("#openBtn") || $("#againBtn"); if (b) { e.preventDefault(); b.click(); }
  }
  if (e.key === "Escape") { $(".inspect")?.remove(); $(".sheet")?.remove(); }
};
document.addEventListener("keydown", onKey);

initSky(); fxResize(); requestAnimationFrame(drawSky);

function useBooster(b) {
  booster = b;
  SLOTS = b.emplacements.map(e => e.taux);
  [b.image_url, "/media/dso-rho-a00.webp"].forEach(src => { if (src) { const i = new Image(); i.src = src; } });
  showPack();
}
useBooster(initialBooster);

return {
  showOdds,
  setBooster: useBooster,
  destroy() {
    alive = false;
    removeEventListener("resize", onResize);
    removeEventListener("pointermove", onParallax);
    document.removeEventListener("keydown", onKey);
    document.querySelectorAll(".inspect, .sheet").forEach(n => n.remove());
  },
};

}
