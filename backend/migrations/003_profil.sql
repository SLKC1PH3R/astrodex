-- Profil joueur : vitrine de cartes favorites, titre choisi parmi les succès débloqués,
-- dernière activité (statut « en ligne » des amis).

ALTER TABLE players ADD COLUMN IF NOT EXISTS favoris INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS titre TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT now();

-- classement « cette semaine » : nouvelles cartes obtenues récemment
CREATE INDEX IF NOT EXISTS player_cards_recent_idx ON player_cards (first_obtained_at);
