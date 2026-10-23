import "@fontsource/russo-one/400.css";
import "@fontsource/exo-2/800.css";
import "./nocturne.css";
import "./astrodex.css";
import "./filigrane.css";
import "./cartes.css";
import "./coffret.css";
import "./sachet.css";
import "./coverflow.css";
import "./packart.css";
import "./boosterpanel.css";
import "./boosters.css";
import "./social.css";
import "./commerce.css";
import "./arene.css";
import "./observatoire.css";
import "./landing.css";

export const metadata = {
  title: "Astrodex",
  description: "Jeu de cartes à collectionner sur l'univers, avec de vraies images NASA, ESA et ESO.",
};
export const viewport = { themeColor: "#161826", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* préférence d'animation (Paramètres) appliquée avant le premier rendu : voir lib/motion.js */}
        <script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.motion=localStorage.getItem('astrodex-animations')||'systeme'}catch(e){}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* polices de la landing et du jeu (thème Observatoire) */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
