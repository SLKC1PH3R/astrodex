/* Menu de l'interface joueur. href relatif à /jeu ; "empty" = texte de la page tant que la fonctionnalité n'existe pas. */
export const MENU = [
  { slug: "",           label: "Paquets",           icon: "ph-package" },
  { slug: "collection", label: "Collection",        icon: "ph-cards" },
  { slug: "echanges",   label: "Échanges",          icon: "ph-arrows-left-right", empty: "Propose tes doubles à d'autres joueurs. Tes échanges en cours apparaîtront ici." },
  { slug: "marche",     label: "Marché",            icon: "ph-storefront",        empty: "Achète et vends des cartes. Aucune annonce pour le moment." },
  { slug: "profil",     label: "Profil",            icon: "ph-user-circle",       empty: "Ton pseudo, ton avatar et tes cartes favorites." },
  { slug: "cartes",     label: "Toutes les cartes", icon: "ph-squares-four" },
  { slug: "guilde",     label: "Guilde",            icon: "ph-shield",            empty: "Tu n'as pas encore rejoint de guilde." },
  { slug: "amis",       label: "Amis",              icon: "ph-users",             empty: "Ajoute des amis pour échanger et t'affronter." },
  { slug: "messages",   label: "Messages",          icon: "ph-chat-circle",       empty: "Aucun message pour le moment." },
  { slug: "bataille",   label: "Bataille",          icon: "ph-sword",             empty: "Compose une main de cartes et affronte un autre joueur." },
  { slug: "succes",     label: "Succès",            icon: "ph-trophy",            empty: "Complète des séries et ouvre des boosters pour débloquer des succès." },
  { slug: "classement", label: "Classement",        icon: "ph-ranking",           empty: "Le classement des collectionneurs de la semaine." },
];
export const SETTINGS = { slug: "parametres", label: "Paramètres", icon: "ph-gear", empty: "Compte, notifications et préférences d'animation." };
export const findSection = slug => [...MENU, SETTINGS].find(m => m.slug === slug);
