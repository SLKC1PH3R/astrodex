-- Vrais comptes : e-mail + mot de passe, sessions par appareil, rôle administrateur.
ALTER TABLE players
    ADD COLUMN email         TEXT,
    ADD COLUMN password_hash TEXT,
    ADD COLUMN is_admin      BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX players_email_idx ON players (lower(email)) WHERE email IS NOT NULL;

-- Une session par appareil connecté : se connecter sur un nouvel ordinateur ne déconnecte pas les autres.
-- (players.token_hash reste valable : c'est la clé historique des comptes créés avant les e-mails.)
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used  TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_agent TEXT
);
CREATE INDEX sessions_player_idx ON sessions (player_id);
