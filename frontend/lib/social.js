/* Petits utilitaires d'affichage partagés par les onglets sociaux. */
import Link from "next/link";

const AVATAR_COLORS = ["#423a6a", "#1c5f7a", "#7a3a1c", "#2f5a35", "#5a2f55", "#3a4a7a", "#6a5a1c", "#1c6a5e"];

/* Demande au menu de relire ses compteurs (message lu, demande d'ami traitée…). */
export const notifyBadges = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("astrodex:notifications")); };

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

/* Temps restant : « 3 j 14 h », « 5 h 20 min », « 12 min ». */
export function until(date) {
  const s = Math.max(0, (new Date(date).getTime() - Date.now()) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

/* Couleur d'emblème vive pour une guilde. */
const CREST_COLORS = ["#ffcf6b", "#5ee0c0", "#6aa8ff", "#c58bff", "#ff8fb1", "#ffa86a", "#8fe36a"];
export const crestColor = id => CREST_COLORS[Number(String(id).replace(/\D/g, "") || 0) % CREST_COLORS.length];

/* Texte de message où les chemins du jeu (/jeu/…) deviennent des liens (invitations de guilde…). */
export function Linkify({ text }) {
  return String(text).split(/(\/jeu\/[\w\-/?=&%.]+)/g).map((part, i) =>
    i % 2 ? <Link key={i} href={part} style={{ color: "inherit", textDecoration: "underline" }}>{part}</Link> : part);
}
