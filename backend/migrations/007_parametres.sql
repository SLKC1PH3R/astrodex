-- Réglages de confidentialité du joueur (clés absentes = valeur par défaut, voir app/settings.py).
ALTER TABLE players ADD COLUMN preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
