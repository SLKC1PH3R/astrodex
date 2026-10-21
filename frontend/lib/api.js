/* Client de l'API. Les appels passent par /api (proxifié vers le backend par Next.js). */

const TOKEN_KEY = "astrodex-token";

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* navigation privée : le jeton vit le temps de la session */ }
}

let memoryToken = null;

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${await ensurePlayer()}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  if (res.status === 401 && auth) {
    // jeton perdu ou base réinitialisée : on recrée un joueur une fois
    memoryToken = null; writeToken("");
    headers.Authorization = `Bearer ${await ensurePlayer()}`;
    const retry = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    return handle(retry);
  }
  return handle(res);
}

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Erreur ${res.status}`);
  return data;
}

async function createPlayer(pseudo) {
  const res = await fetch("/api/players", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pseudo ? { pseudo } : {}),
  });
  const p = await handle(res);
  writeToken(p.token);
  memoryToken = p.token;
  return p;
}

export async function ensurePlayer() {
  if (memoryToken) return memoryToken;
  const saved = readToken();
  if (saved) return (memoryToken = saved);
  return (await createPlayer()).token;
}

/* Inscription : crée un joueur avec son pseudo. E-mail et mot de passe ne sont pas encore gérés par le backend
   (voir README : brancher Authentik / NextAuth et associer l'identité à players.id). */
export const signup = pseudo => createPlayer(pseudo?.trim() || null);
export function logout() { memoryToken = null; writeToken(""); }
export const hasPlayer = () => !!(memoryToken || readToken());

export const api = {
  boosters: () => request("/api/boosters"),
  series: () => request("/api/series"),
  seriesDetail: code => request(`/api/series/${encodeURIComponent(code)}`),
  me: () => request("/api/me", { auth: true }),
  progression: () => request("/api/me/progression", { auth: true }),
  collection: serie => request(`/api/me/collection${serie ? `?serie=${encodeURIComponent(serie)}` : ""}`, { auth: true }),
  boosterCards: code => request(`/api/boosters/${encodeURIComponent(code)}/cartes`),
  profil: () => request("/api/me/profil", { auth: true }),
  majProfil: patch => request("/api/me/profil", { method: "PATCH", body: patch, auth: true }),
  profilJoueur: id => request(`/api/joueurs/${encodeURIComponent(id)}/profil`),
  succes: () => request("/api/me/succes", { auth: true }),
  classement: type => request(`/api/classement?type=${encodeURIComponent(type)}`, { auth: true }),
  amis: () => request("/api/me/amis", { auth: true }),
  ajouterAmi: cible => request("/api/me/amis", { method: "POST", body: { cible }, auth: true }),
  accepterAmi: id => request(`/api/me/amis/${encodeURIComponent(id)}/accepter`, { method: "POST", auth: true }),
  retirerAmi: id => request(`/api/me/amis/${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),
  activiteAmis: () => request("/api/me/amis/activite", { auth: true }),
  conversations: () => request("/api/me/messages", { auth: true }),
  conversation: id => request(`/api/me/messages/${encodeURIComponent(id)}`, { auth: true }),
  envoyerMessage: (id, texte) => request(`/api/me/messages/${encodeURIComponent(id)}`, { method: "POST", body: { texte }, auth: true }),
  echanges: () => request("/api/me/echanges", { auth: true }),
  collectionJoueur: id => request(`/api/joueurs/${encodeURIComponent(id)}/collection`, { auth: true }),
  proposerEchange: (avec, donne, demande) => request("/api/me/echanges", { method: "POST", body: { avec, donne, demande }, auth: true }),
  accepterEchange: id => request(`/api/me/echanges/${id}/accepter`, { method: "POST", auth: true }),
  refuserEchange: id => request(`/api/me/echanges/${id}/refuser`, { method: "POST", auth: true }),
  annulerEchange: id => request(`/api/me/echanges/${id}`, { method: "DELETE", auth: true }),
  eclats: () => request("/api/me/eclats", { auth: true }),
  recompense: () => request("/api/me/eclats/recompense", { method: "POST", auth: true }),
  recycler: (carte, quantite = 1) => request("/api/me/eclats/recycler", { method: "POST", body: { carte, quantite }, auth: true }),
  marche: (f = {}) => request(`/api/marche?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`, { auth: true }),
  mesAnnonces: () => request("/api/me/marche", { auth: true }),
  vendre: (carte, prix) => request("/api/marche", { method: "POST", body: { carte, prix }, auth: true }),
  acheter: id => request(`/api/marche/${id}/acheter`, { method: "POST", auth: true }),
  retirerAnnonce: id => request(`/api/marche/${id}`, { method: "DELETE", auth: true }),
  notifications: () => request("/api/me/notifications", { auth: true }),
  open: code => request(`/api/boosters/${encodeURIComponent(code)}/open`, { method: "POST", auth: true }),
};
