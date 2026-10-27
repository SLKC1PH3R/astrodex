-- Fond de bannière choisi sur le profil (id d'un cliché de planète, cf. profil.BANNIERES)
ALTER TABLE players ADD COLUMN IF NOT EXISTS banniere TEXT,
  ADD COLUMN IF NOT EXISTS avatar TEXT;  -- id de cliché (profil.AVATARS), NULL = initiale
