-- Expérience, niveaux 1 → 40, emblème affiché, et réserve de boosters qui se recharge (1 toutes les 10 min).
ALTER TABLE players
    ADD COLUMN xp          INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    ADD COLUMN succes_xp   TEXT[]  NOT NULL DEFAULT '{}',   -- succès dont l'XP a déjà été versée
    ADD COLUMN embleme     TEXT,
    ADD COLUMN packs_stock INTEGER NOT NULL DEFAULT 10 CHECK (packs_stock >= 0),
    ADD COLUMN packs_at    TIMESTAMPTZ NOT NULL DEFAULT now();  -- départ du compte à rebours de recharge

-- XP rétroactive des joueurs existants : 10 par booster ouvert + XP de découverte de chaque carte possédée
-- (les succès sont versés au prochain passage, voir app/progression.py).
UPDATE players p SET xp = 10 * (SELECT count(*) FROM pack_openings po WHERE po.player_id = p.id)
    + coalesce((SELECT sum(CASE c.rarete WHEN 'C' THEN 5 WHEN 'PC' THEN 8 WHEN 'R' THEN 15 WHEN 'UR' THEN 40 ELSE 100 END)
                FROM player_cards pc JOIN cards c ON c.id = pc.card_id WHERE pc.player_id = p.id), 0);
CREATE INDEX players_xp_idx ON players (xp DESC);
