/* Rendu HTML d'une carte à partir des données de l'API. Partagé par le booster et la collection. */

export const RAR = {
  C:  { label: "Commune",     color: "#9aa1b9" },
  PC: { label: "Peu commune", color: "#5ee0c0" },
  R:  { label: "Rare",        color: "#6aa8ff" },
  UR: { label: "Ultra rare",  color: "#c58bff" },
  L:  { label: "Légendaire",  color: "#ffcf6b" },
};
export const ORDER = ["C", "PC", "R", "UR", "L"];

export const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

export function renderCard(c) {
  const r = c.rarete || c.r;
  const globe = c.cadrage === "globe" || c.cadrage === "globe-large";
  const stat = (k, v) => `<div class="stat"><div>${k}<b>${v}</b></div><div class="bar"><i style="width:${v}%"></i></div></div>`;
  const pad = n => String(n).padStart(3, "0");
  return `<div class="card" data-r="${r}">
    <div class="card-in">
      <div class="art${globe ? " globe" : ""}"><img class="photo${c.cadrage === "globe-large" ? " wide" : ""}" src="${esc(c.image_url)}" alt="${esc(c.nom)}" draggable="false"></div>
      <div class="scrim"></div>
      <div class="c-top">
        <span class="gem"><i></i>${esc(c.serie)} · ${pad(c.numero)}/${pad(c.total)}</span>
        ${c.nouvelle ? `<span class="pow new">NOUVELLE</span>` : `<span class="pow">PUI <b>${c.attaque + c.defense + c.vitesse}</b></span>`}
      </div>
      <div class="c-bottom">
        <div class="c-type">${esc(c.type)}</div>
        <div class="c-name">${esc(c.nom)}</div>
        <div class="c-meta">${[c.constellation, c.faits].filter(Boolean).map(esc).join(" · ")}</div>
        <div class="stats">${stat("ATQ", c.attaque)}${stat("DÉF", c.defense)}${stat("VIT", c.vitesse)}</div>
        <div class="c-foot"><span>© ${esc(c.credit)} · ${esc(c.licence)}</span><span>${RAR[r].label}</span></div>
      </div>
      <div class="holo"></div><div class="glitter"></div><div class="shine"></div>
    </div>
  </div>`;
}
