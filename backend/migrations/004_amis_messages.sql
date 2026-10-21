-- Amis (code ami, demandes) et messages privés entre amis.

ALTER TABLE players ADD COLUMN IF NOT EXISTS friend_code TEXT;
UPDATE players SET friend_code = 'ASTRO-' || upper(substr(md5(id::text || random()::text), 1, 6)) WHERE friend_code IS NULL;
ALTER TABLE players ALTER COLUMN friend_code SET DEFAULT 'ASTRO-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
ALTER TABLE players ALTER COLUMN friend_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS players_friend_code_idx ON players (friend_code);
CREATE INDEX IF NOT EXISTS players_pseudo_idx ON players (lower(pseudo));

-- Une ligne par paire : la demande va de requester vers addressee ; acceptée, elle devient une amitié.
CREATE TABLE friendships (
    requester   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    addressee   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    PRIMARY KEY (requester, addressee),
    CHECK (requester <> addressee)
);
CREATE INDEX friendships_addressee_idx ON friendships (addressee);

CREATE TABLE messages (
    id         BIGSERIAL PRIMARY KEY,
    sender     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    recipient  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at    TIMESTAMPTZ
);
CREATE INDEX messages_pair_idx ON messages (least(sender, recipient), greatest(sender, recipient), created_at DESC);
CREATE INDEX messages_unread_idx ON messages (recipient) WHERE read_at IS NULL;
