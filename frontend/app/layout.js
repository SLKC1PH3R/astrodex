import "./nocturne.css";
import "./astrodex.css";
import "./coffret.css";

export const metadata = {
  title: "Astrodex",
  description: "Jeu de cartes à collectionner sur l'univers, avec de vraies images NASA, ESA et ESO.",
};
export const viewport = { themeColor: "#161826", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
