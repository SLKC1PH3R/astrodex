-- Astrodex : schéma initial
-- Catalogue (alimenté par l'import YAML) et données des joueurs (écrites par l'API).

-- ---------- Catalogue ----------

CREATE TABLE celestial_objects (
    id            SERIAL PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    nom           TEXT NOT NULL,
    type          TEXT NOT NULL,
    constellation TEXT,
    description   TEXT NOT NULL DEFAULT '',
    faits         TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE series (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    nom         TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date_sortie DATE,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Une carte = un objet céleste dans une série, avec sa rareté, ses stats et son illustration.
-- Une carte retirée du YAML n'est jamais supprimée (des joueurs la possèdent) : elle passe en retired.
CREATE TABLE cards (
    id         SERIAL PRIMARY KEY,
    series_id  INTEGER NOT NULL REFERENCES series(id),
    object_id  INTEGER NOT NULL REFERENCES celestial_objects(id),
    numero     INTEGER NOT NULL,
    rarete     TEXT NOT NULL CHECK (rarete IN ('C', 'PC', 'R', 'UR', 'L')),
    attaque    SMALLINT NOT NULL CHECK (attaque BETWEEN 0 AND 100),
    defense    SMALLINT NOT NULL CHECK (defense BETWEEN 0 AND 100),
    vitesse    SMALLINT NOT NULL CHECK (vitesse BETWEEN 0 AND 100),
    image      TEXT NOT NULL,
    credit     TEXT NOT NULL,
    licence    TEXT NOT NULL,
    variante   TEXT NOT NULL DEFAULT 'standard',
    cadrage    TEXT NOT NULL DEFAULT 'photo' CHECK (cadrage IN ('photo', 'globe', 'globe-large')),
    retired    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (series_id, numero)
);
CREATE INDEX cards_draw_idx ON cards (series_id, rarete) WHERE NOT retired;

CREATE TABLE pack_types (
    id        SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES series(id),
    code      TEXT NOT NULL UNIQUE,
    nom       TEXT NOT NULL,
    nb_cartes INTEGER NOT NULL CHECK (nb_cartes > 0),
    image     TEXT,
    active    BOOLEAN NOT NULL DEFAULT TRUE
);

-- Taux par emplacement : pour une position donnée, les probabilités totalisent 1.
CREATE TABLE pack_slots (
    pack_type_id INTEGER NOT NULL REFERENCES pack_types(id) ON DELETE CASCADE,
    position     INTEGER NOT NULL,
    rarete       TEXT NOT NULL CHECK (rarete IN ('C', 'PC', 'R', 'UR', 'L')),
    probabilite  NUMERIC(6, 5) NOT NULL CHECK (probabilite > 0 AND probabilite <= 1),
    PRIMARY KEY (pack_type_id, position, rarete)
);

-- ---------- Joueurs ----------

CREATE TABLE players (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,          -- SHA-256 du jeton ; le jeton lui-même n'est jamais stocké
    pseudo     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE player_cards (
    player_id         UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    card_id           INTEGER NOT NULL REFERENCES cards(id),
    quantite          INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
    first_obtained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (player_id, card_id)
);

-- Historique complet des ouvertures : sert aussi à vérifier les taux réels.
CREATE TABLE pack_openings (
    id           BIGSERIAL PRIMARY KEY,
    player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    pack_type_id INTEGER NOT NULL REFERENCES pack_types(id),
    card_ids     INTEGER[] NOT NULL,
    opened_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pack_openings_player_idx ON pack_openings (player_id, opened_at DESC);
