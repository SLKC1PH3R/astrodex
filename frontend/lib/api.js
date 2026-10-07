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

export async function ensurePlayer() {
  if (memoryToken) return memoryToken;
  const saved = readToken();
  if (saved) return (memoryToken = saved);
  const res = await fetch("/api/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const p = await handle(res);
  writeToken(p.token);
  return (memoryToken = p.token);
}

export const api = {
  boosters: () => request("/api/boosters"),
  series: () => request("/api/series"),
  seriesDetail: code => request(`/api/series/${encodeURIComponent(code)}`),
  me: () => request("/api/me", { auth: true }),
  collection: serie => request(`/api/me/collection${serie ? `?serie=${encodeURIComponent(serie)}` : ""}`, { auth: true }),
  open: code => request(`/api/boosters/${encodeURIComponent(code)}/open`, { method: "POST", auth: true }),
};
