/* Petits utilitaires d'affichage partagés par les onglets sociaux. */

const AVATAR_COLORS = ["#423a6a", "#1c5f7a", "#7a3a1c", "#2f5a35", "#5a2f55", "#3a4a7a", "#6a5a1c", "#1c6a5e"];

/* Couleur d'avatar stable, dérivée de l'identifiant du joueur. */
export function avatarColor(id = "") {
  let h = 7;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const initial = pseudo => (String(pseudo || "?").trim()[0] || "?").toUpperCase();
export const fr = n => Number(n || 0).toLocaleString("fr-FR");

/* « à l'instant », « il y a 5 min », « hier »… */
export function ago(date) {
  if (!date) return "";
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "hier";
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function Avatar({ id, pseudo, size = 40, style }) {
  return <span className="sx-av" aria-hidden="true" style={{ "--s": `${size}px`, background: avatarColor(id), ...style }}>{initial(pseudo)}</span>;
}
