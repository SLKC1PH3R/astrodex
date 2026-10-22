/* Client de l'API. Les appels passent par /api (proxifié vers le backend par Next.js). */

const TOKEN_KEY = "astrodex-token";

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* navigation privée : le jeton vit le temps de la session */ }
}

let memoryToken = null;
const LOGIN_URL = "/inscription?mode=connexion";

/* Pas de session valide : on n'invente plus de profil en silence (c'était la source des comptes en double),
   on renvoie vers la page de connexion. */
function needLogin() {
  memoryToken = null; writeToken("");
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/inscription")) window.location.assign(LOGIN_URL);
  return new Error("Connecte-toi pour continuer");
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = currentKey();
    if (!token) throw needLogin();
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  if (res.status === 401 && auth) throw needLogin();
  return handle(res);
}

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Erreur ${res.status}`);
  return data;
}

function keep(token) { memoryToken = token; writeToken(token); }

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  return handle(await fetch(path, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" }));
}

/* Inscription par e-mail. Si cet appareil joue déjà en invité, sa collection est rattachée au nouveau compte. */
export async function signup({ pseudo, email, motDePasse }) {
  const r = await post("/api/auth/inscription", { pseudo, email, mot_de_passe: motDePasse }, currentKey() || null);
  keep(r.token);
  return r;
}

/* Connexion par e-mail : ouvre une session pour cet appareil, sur n'importe quel ordinateur. */
export async function login({ email, motDePasse }) {
  const r = await post("/api/auth/connexion", { email, mot_de_passe: motDePasse });
  keep(r.token);
  return r;
}

/* Jouer sans compte (profil invité lié à ce navigateur). Réutilise le profil invité existant s'il y en a un. */
export async function playAsGuest() {
  if (currentKey()) return currentKey();
  const p = await post("/api/players", {});
  keep(p.token);
  return p.token;
}

export function logout() {
  const token = currentKey();
  if (token) fetch("/api/auth/deconnexion", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  memoryToken = null; writeToken("");
}
export const hasPlayer = () => !!currentKey();

/* Clé de connexion (le jeton de cet appareil). */
export function currentKey() { return memoryToken || readToken() || ""; }

/* Se connecter avec une clé : vérifiée auprès du serveur avant de remplacer la clé actuelle. */
export async function loginWithKey(key) {
  const k = key.trim();
  const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${k}` }, cache: "no-store" });
  if (res.status === 401) throw new Error("Cette clé ne correspond à aucun compte");
  const me = await handle(res);
  keep(k);
  return me;
}

/* Nouvelle clé : l'ancienne cesse de fonctionner partout. */
export async function rotateKey() {
  const { token } = await request("/api/me/cle", { method: "POST", auth: true });
  keep(token);
  return token;
}

export async function deleteAccount(confirmation) {
  await request("/api/me", { method: "DELETE", body: { confirmation }, auth: true });
  memoryToken = null; writeToken("");
}

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
  profilJoueur: id => request(`/api/joueurs/${encodeURIComponent(id)}/profil`, { auth: true }),
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
  bataille: () => request("/api/me/bataille", { auth: true }),
  historiqueBatailles: () => request("/api/me/bataille/historique", { auth: true }),
  mainBataille: cartes => request("/api/me/bataille/main", { method: "PUT", body: { cartes }, auth: true }),
  combattre: (mode, ami) => request("/api/me/bataille", { method: "POST", body: { mode, ami }, auth: true }),
  guildes: q => request(`/api/guildes${q ? `?q=${encodeURIComponent(q)}` : ""}`, { auth: true }),
  creerGuilde: (nom, description) => request("/api/guildes", { method: "POST", body: { nom, description }, auth: true }),
  rejoindreGuilde: id => request(`/api/guildes/${id}/rejoindre`, { method: "POST", auth: true }),
  maGuilde: () => request("/api/me/guilde", { auth: true }),
  majGuilde: patch => request("/api/me/guilde", { method: "PATCH", body: patch, auth: true }),
  quitterGuilde: () => request("/api/me/guilde/quitter", { method: "POST", auth: true }),
  roleMembre: (id, role) => request(`/api/me/guilde/membres/${encodeURIComponent(id)}/role`, { method: "POST", body: { role }, auth: true }),
  exclureMembre: id => request(`/api/me/guilde/membres/${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),
  inviterGuilde: ami => request("/api/me/guilde/inviter", { method: "POST", body: { ami }, auth: true }),
  messagesGuilde: apres => request(`/api/me/guilde/messages${apres ? `?apres=${apres}` : ""}`, { auth: true }),
  ecrireGuilde: texte => request("/api/me/guilde/messages", { method: "POST", body: { texte }, auth: true }),
  recompenseObjectif: id => request(`/api/me/guilde/objectifs/${id}/recompense`, { method: "POST", auth: true }),
  parametres: () => request("/api/me/parametres", { auth: true }),
  majParametres: patch => request("/api/me/parametres", { method: "PATCH", body: patch, auth: true }),
  changerMotDePasse: (actuel, nouveau) => request("/api/me/mot-de-passe", { method: "POST", body: { actuel, nouveau }, auth: true }),
  sessions: () => request("/api/me/sessions", { auth: true }),
  adminStats: () => request("/api/admin/stats", { auth: true }),
  adminJoueurs: (f = {}) => request(`/api/admin/joueurs?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`, { auth: true }),
  adminSupprimer: id => request(`/api/admin/joueurs/${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),
  adminSupprimerPlusieurs: ids => request("/api/admin/joueurs/supprimer", { method: "POST", body: { ids }, auth: true }),
  adminMotDePasse: (id, nouveau) => request(`/api/admin/joueurs/${encodeURIComponent(id)}/mot-de-passe`, { method: "POST", body: { nouveau }, auth: true }),
  adminPurge: (jours, videsSeulement, confirmer) => request("/api/admin/purge-invites", { method: "POST", body: { jours, vides_seulement: videsSeulement, confirmer }, auth: true }),
  notifications: () => request("/api/me/notifications", { auth: true }),
  open: code => request(`/api/boosters/${encodeURIComponent(code)}/open`, { method: "POST", auth: true }),
};
