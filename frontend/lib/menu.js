/* Menu de l'interface joueur. href relatif à /jeu ; "group" range l'entrée dans le rail (voir GROUPS) ;
   "empty" = texte de la page d'attente générique. */
export const MENU = [
  { slug: "", group: "jouer",           label: "Paquets",           icon: "ph-package" },
  { slug: "boosters", group: "jouer",   label: "Boosters",          icon: "ph-stack" },
  { slug: "collection", group: "collection", label: "Ma collection",     icon: "ph-cards" },
  { slug: "atlas", group: "collection",      label: "Atlas 3D",          icon: "ph-planet" },
  { slug: "echanges", group: "commerce",   label: "Échanges",          icon: "ph-arrows-left-right", empty: "Propose tes doubles à d'autres joueurs. Tes échanges en cours apparaîtront ici." },
  { slug: "marche", group: "commerce",     label: "Marché",            icon: "ph-storefront",        empty: "Achète et vends des cartes. Aucune annonce pour le moment." },
  { slug: "profil", group: "moi",     label: "Profil",            icon: "ph-user-circle",       empty: "Ton pseudo, ton avatar et tes cartes favorites." },
  { slug: "cartes", group: "collection",     label: "Toutes les cartes", icon: "ph-squares-four" },
  { slug: "guilde", group: "communaute",     label: "Guilde",            icon: "ph-shield",            empty: "Tu n'as pas encore rejoint de guilde." },
  { slug: "amis", group: "communaute",       label: "Amis",              icon: "ph-users",             empty: "Ajoute des amis pour échanger et t'affronter." },
  { slug: "messages", group: "communaute",   label: "Messages",          icon: "ph-chat-circle",       empty: "Aucun message pour le moment." },
  { slug: "bataille", group: "jouer",   label: "Bataille",          icon: "ph-sword",             empty: "Compose une main de cartes et affronte un autre joueur." },
  { slug: "succes", group: "moi",     label: "Succès",            icon: "ph-trophy",            empty: "Complète des séries et ouvre des boosters pour débloquer des succès." },
  { slug: "classement", group: "communaute", label: "Classement",        icon: "ph-ranking",           empty: "Le classement des collectionneurs de la semaine." },
];
/* Entrée visible seulement des administrateurs (players.is_admin). */
export const ADMIN = { slug: "admin", group: "moi", label: "Administration", icon: "ph-shield-check" };
export const SETTINGS = { slug: "parametres", group: "moi", label: "Paramètres", icon: "ph-gear", empty: "Compte, notifications et préférences d'animation." };
/* Groupes du rail, dans l'ordre d'affichage ; chaque groupe liste ses entrées dans cet ordre. */
export const GROUPS = [
  { id: "jouer",      label: "Jouer",      icon: "ph-sparkle",            slugs: ["", "boosters", "bataille"] },
  { id: "collection", label: "Collection", icon: "ph-cards",              slugs: ["collection", "cartes", "atlas"] },
  { id: "commerce",   label: "Commerce",   icon: "ph-arrows-left-right",  slugs: ["echanges", "marche"] },
  { id: "communaute", label: "Communauté", icon: "ph-users-three",        slugs: ["guilde", "amis", "messages", "classement"] },
  { id: "moi",        label: "Moi",        icon: "ph-user-circle",        slugs: ["profil", "succes", "parametres"] },
];
export const findSection = slug => [...MENU, SETTINGS].find(m => m.slug === slug);

const ALL = [...MENU, SETTINGS, ADMIN];
export const hrefOf = slug => (slug ? `/jeu/${slug}` : "/jeu");
/* Entrée du menu correspondant à un chemin (/jeu, /jeu/marche, /jeu/profil?id=…). */
export const sectionForPath = path => ALL.find(m => hrefOf(m.slug) === (path || "").split("?")[0].replace(/\/$/, "")) || null;
export const groupOf = section => GROUPS.find(g => g.id === section?.group) || null;
export const itemsOf = group => group.slugs.map(s => ALL.find(m => m.slug === s));
