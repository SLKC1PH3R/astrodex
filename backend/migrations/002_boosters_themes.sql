-- Boosters à thème : chaque booster peut avoir son propre contenu (catalog/boosters.yaml).
-- Une carte peut appartenir à plusieurs boosters. Un booster sans contenu pioche dans toute sa série.

ALTER TABLE pack_types ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

CREATE TABLE pack_cards (
    pack_type_id INTEGER NOT NULL REFERENCES pack_types(id) ON DELETE CASCADE,
    card_id      INTEGER NOT NULL REFERENCES cards(id),
    PRIMARY KEY (pack_type_id, card_id)
);
CREATE INDEX pack_cards_card_idx ON pack_cards (card_id);
