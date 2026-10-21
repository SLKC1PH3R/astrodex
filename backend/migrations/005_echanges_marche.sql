-- Échanges de cartes entre amis, monnaie « éclats » et marché.

-- Propositions d'échange : chaque ligne de trade_items dit qui cède quelle carte.
CREATE TABLE trades (
    id          BIGSERIAL PRIMARY KEY,
    proposer    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    recipient   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CHECK (proposer <> recipient)
);
CREATE INDEX trades_recipient_idx ON trades (recipient, status);
CREATE INDEX trades_proposer_idx ON trades (proposer, status);

CREATE TABLE trade_items (
    trade_id BIGINT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    giver    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    card_id  INTEGER NOT NULL REFERENCES cards(id),
    quantite INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
    PRIMARY KEY (trade_id, giver, card_id)
);

-- Éclats : gagnés chaque jour, en recyclant des doubles ou en vendant au marché.
ALTER TABLE players ADD COLUMN IF NOT EXISTS eclats INTEGER NOT NULL DEFAULT 0 CHECK (eclats >= 0);
ALTER TABLE players ADD COLUMN IF NOT EXISTS daily_claimed_at TIMESTAMPTZ;

-- Annonces : la carte mise en vente quitte la collection du vendeur jusqu'à la vente ou l'annulation.
CREATE TABLE market_listings (
    id         BIGSERIAL PRIMARY KEY,
    seller     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    card_id    INTEGER NOT NULL REFERENCES cards(id),
    prix       INTEGER NOT NULL CHECK (prix BETWEEN 1 AND 100000),
    status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
    buyer      UUID REFERENCES players(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sold_at    TIMESTAMPTZ
);
CREATE INDEX market_active_idx ON market_listings (status, created_at DESC);
CREATE INDEX market_seller_idx ON market_listings (seller, status);
CREATE INDEX market_sold_idx ON market_listings (sold_at) WHERE status = 'sold';
