/* Données de repli de la landing (format card_out de l'API). Remplacées par /api/series/S1 dès qu'elle répond. */

const mk = (numero, slug, nom, type, description, rarete, attaque, defense, vitesse, image, credit, cadrage, licence = "Domaine public") => ({
  id: `s1-${numero}`, numero, total: 39, serie: "S1", slug, nom, type, constellation: "Système solaire",
  description, rarete, attaque, defense, vitesse, image_url: `/media/${image}.webp`, credit, licence, cadrage,
});

export const DEMO = [
  mk(1, "terre", "Terre", "Planète tellurique", "Seule planète connue abritant la vie.", "L", 74, 79, 62, "terre", "NASA · Apollo 17 (1972)", "globe"),
  mk(2, "saturne", "Saturne", "Géante gazeuse", "Planète aux anneaux spectaculaires.", "L", 84, 83, 41, "saturne", "NASA/JPL/SSI · Cassini (2004)", "globe-large"),
  mk(3, "jupiter", "Jupiter", "Géante gazeuse", "Plus grande planète du Système solaire.", "L", 84, 86, 42, "jupiter", "NASA/ESA · Hubble (2023)", "globe"),
  mk(5, "mars", "Mars", "Planète tellurique", "La planète rouge, cible des missions d'exploration.", "UR", 70, 75, 48, "mars", "NASA/ESA · Hubble (2001)", "globe"),
  mk(8, "io", "Io", "Satellite de Jupiter", "Monde le plus volcanique du Système solaire.", "UR", 57, 61, 78, "io", "NASA/JPL · Galileo (1999)", "globe"),
  mk(15, "encelade", "Encelade", "Satellite de Saturne", "Geysers de glace jaillissant d'un océan souterrain.", "UR", 46, 58, 52, "encelade", "NASA/JPL/SSI · Cassini", "photo"),
  mk(26, "titania", "Titania", "Satellite d'Uranus", "Plus grande lune d'Uranus, traversée par un immense canyon.", "R", 43, 56, 33, "titania", "NASA/JPL · Voyager 2 (1986)", "globe"),
  mk(21, "phoebe", "Phoebé", "Satellite de Saturne", "Lune irrégulière capturée depuis la ceinture de Kuiper.", "C", 36, 45, 30, "phoebe", "NASA/JPL/SSI · Cassini (2004)", "globe"),
  mk(10, "charon", "Charon", "Satellite de Pluton", "Compagne de Pluton, presque aussi grande qu'elle.", "PC", 38, 40, 85, "charon", "NASA/JHUAPL/SwRI · New Horizons (2015)", "globe"),
];

export const RC = { C: "#9aa1b9", PC: "#5ee0c0", R: "#6aa8ff", UR: "#c58bff", L: "#ffcf6b" };
export const SLOTS = [{ C: .75, PC: .25 }, { C: .75, PC: .25 }, { C: .6, PC: .4 }, { PC: .55, R: .38, UR: .07 }, { R: .72, UR: .22, L: .06 }];
export const COUNT = { C: 10, PC: 1, R: 8, UR: 14, L: 6 };
export const NOTES = {
  C: "Les trois premiers emplacements en contiennent presque toujours.",
  PC: "Charon est l'unique Peu commune de la série.",
  R: "Le 5e emplacement est toujours au moins Rare.",
  UR: "Quatorze cartes, dont Mars, Io et la comète de Halley.",
  L: "Six Légendaires, toutes en holo pleine illustration.",
};
export const SOURCES = [
  ["NASA", "APOLLO 17 · VOYAGER 2 · NEW HORIZONS"],
  ["NASA/JPL/SSI", "CASSINI · 2004–2017"],
  ["NASA/ESA · Hubble", "JUPITER · MARS"],
  ["ESA", "ROSETTA · GIOTTO"],
];
