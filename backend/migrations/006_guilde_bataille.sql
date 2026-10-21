-- Guildes (membres, rôles, discussion, récompenses d'objectifs hebdomadaires) et batailles.

CREATE TABLE guilds (
    id          BIGSERIAL PRIMARY KEY,
    nom         TEXT NOT NULL CHECK (char_length(nom) BETWEEN 3 AND 30),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 280),
    recrutement BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX guilds_nom_idx ON guilds (lower(nom));

-- Un joueur appartient à une guilde au plus.
CREATE TABLE guild_members (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    guild_id  BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('chef', 'officier', 'membre')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX guild_members_guild_idx ON guild_members (guild_id);

CREATE TABLE guild_messages (
    id         BIGSERIAL PRIMARY KEY,
    guild_id   BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    sender     UUID REFERENCES players(id) ON DELETE SET NULL,  -- NULL : message du jeu (arrivée, départ…)
    body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX guild_messages_guild_idx ON guild_messages (guild_id, id DESC);

-- Récompense d'un objectif de la semaine, récupérée une fois par membre.
CREATE TABLE guild_rewards (
    guild_id   BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    semaine    DATE NOT NULL,
    objectif   TEXT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (guild_id, player_id, semaine, objectif)
);

-- Bataille : main de 5 cartes enregistrée, points de rang.
ALTER TABLE players
    ADD COLUMN main_bataille INTEGER[] NOT NULL DEFAULT '{}',
    ADD COLUMN points_rang   INTEGER NOT NULL DEFAULT 0 CHECK (points_rang >= 0);

CREATE TABLE battles (
    id            BIGSERIAL PRIMARY KEY,
    player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    opponent_id   UUID REFERENCES players(id) ON DELETE SET NULL,  -- NULL : adversaire du jeu
    opponent_name TEXT NOT NULL,
    mode          TEXT NOT NULL CHECK (mode IN ('rapide', 'classee', 'ami')),
    won           BOOLEAN NOT NULL,
    score_me      SMALLINT NOT NULL,
    score_them    SMALLINT NOT NULL,
    points_delta  INTEGER NOT NULL DEFAULT 0,
    manches       JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX battles_player_idx ON battles (player_id, created_at DESC);
