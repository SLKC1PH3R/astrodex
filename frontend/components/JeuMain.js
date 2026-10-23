"use client";
import { usePathname } from "next/navigation";

/* Zone de contenu du jeu. Les pages Paquets et Boosters (carrousels, ouverture des boosters) gardent
   leur apparence d'origine : elles reçoivent .ax-legacy, qui rétablit les anciens tokens (app/observatoire.css). */
const LEGACY = ["/jeu", "/jeu/boosters"];

export default function JeuMain({ children }) {
  const path = (usePathname() || "").replace(/\/$/, "");
  return <main className={`ax-main${LEGACY.includes(path) ? " ax-legacy" : ""}`}>{children}</main>;
}
