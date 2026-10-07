# Astrodex

Jeu de cartes à collectionner sur l'univers. Les joueurs ouvrent des boosters, le serveur tire les cartes, la collection est stockée dans Postgres. Le catalogue (objets célestes, séries, cartes, taux) est écrit en YAML dans ce dépôt et importé en base à chaque déploiement.

## Architecture

```
navigateur ──▶ frontend (Next.js, :3000) ──/api, /media──▶ backend (FastAPI, :8000) ──▶ postgres
```

Le navigateur ne parle qu'au frontend : Next.js relaie `/api` et `/media` vers le backend par le réseau Docker interne. Un seul domaine, pas de CORS.

```
catalog/
  objects.yaml              objets célestes (un objet = une entrée, réutilisable dans plusieurs séries)
  series/s1-ciel-profond.yaml   une série : infos, boosters et taux, cartes
  images/                   illustrations (crédits dans CREDITS.md)
backend/
  app/main.py               API
  app/catalog_import.py     validation et import du catalogue
  app/draw.py               tirage des boosters (fonction pure, testée)
  migrations/               schéma SQL versionné, appliqué au démarrage
  tests/
frontend/
  app/page.js               ouverture de booster
  app/collection/page.js    collection du joueur
  components/engine.js      animations (booster, pile, retournement)
  components/card.js        rendu d'une carte
tools/                      génération du catalogue de 50 000 objets et des globes
```

## Ajouter du contenu

### Une nouvelle carte dans une série existante

1. Dépose l'image dans `catalog/images/` (WebP, environ 512 px de large).
2. Si l'objet céleste n'existe pas encore, ajoute-le dans `catalog/objects.yaml` :
   ```yaml
   - slug: galaxie-sombrero
     nom: Galaxie du Sombrero
     type: Galaxie spirale
     constellation: Vierge
     description: Galaxie vue presque par la tranche, barrée d'une large bande de poussière.
     faits: ~31 millions al
   ```
3. Ajoute la carte dans le fichier de la série, avec le numéro suivant :
   ```yaml
   - numero: 48
     objet: galaxie-sombrero
     rarete: UR
     stats: { attaque: 86, defense: 80, vitesse: 22 }
     image: sombrero.webp
     credit: NASA · ESA/Hubble
     licence: CC BY 4.0
   ```
4. `git push`. Au redémarrage, le backend valide puis importe le catalogue.

### Une nouvelle série

Crée `catalog/series/s2-<nom>.yaml` sur le modèle de la série I : un bloc `serie` (code unique, par exemple `S2`), un ou plusieurs `boosters` avec leurs taux par emplacement, et la liste des `cartes`. Une même planète peut avoir une carte dans chaque série : l'objet reste unique dans `objects.yaml`, chaque série lui donne sa rareté, ses stats et son illustration (champ `variante` pour une version alternative).

### Modifier ou retirer

- Modifier une carte ou un objet dans le YAML met à jour la base au prochain déploiement.
- Supprimer une carte du YAML la marque « retirée » : elle ne sort plus des boosters mais reste dans les collections des joueurs qui l'ont.
- Passer `active: false` sur une série ou un booster le retire du jeu sans rien effacer.

### Vérifier avant de pousser

```bash
cd backend && pip install -r requirements-dev.txt
python -m app.catalog_import --check
```

La validation refuse : des taux qui ne totalisent pas 1, un objet ou une image introuvable, un numéro en double, un emplacement de booster qui demande une rareté absente de la série. La même vérification tourne dans GitHub Actions (`.github/workflows/ci.yml`) à chaque push.

## Lancer en local

```bash
cp .env.example .env            # puis choisir un mot de passe
docker compose up --build
```

Le frontend n'expose son port qu'au réseau Docker. Pour y accéder depuis ta machine, ajoute temporairement `ports: ["3000:3000"]` au service `frontend`.

Sans Docker :

```bash
# backend (Postgres local requis)
cd backend && pip install -r requirements-dev.txt
DATABASE_URL=postgresql://astrodex:astrodex@localhost:5432/astrodex uvicorn app.main:app --reload
# frontend
cd frontend && npm install && BACKEND_URL=http://localhost:8000 npm run dev
```

## Déployer sur le VPS (Dokploy)

1. Pousse le dépôt sur GitHub (`SLKC1PH3R/Astrodex`).
2. DNS : enregistrement `A` `astrodex.digitalstack.cloud` vers l'IP du VPS (inutile avec un wildcard).
3. Dans Dokploy : **Create Service → Compose**, source GitHub, branche `main`, fichier `./docker-compose.yml`.
4. Onglet **Environment** : définis `POSTGRES_PASSWORD` (long et aléatoire) et, si tu veux limiter, `PACKS_PER_DAY`.
5. Onglet **Domains** : service `frontend`, hôte `astrodex.digitalstack.cloud`, port `3000`, HTTPS avec Let's Encrypt.
6. **Deploy**, puis active **Auto Deploy**.

Vérification : `curl https://astrodex.digitalstack.cloud/api/health` doit répondre `{"status":"ok"}`.

### Sauvegardes

Les collections des joueurs vivent dans le volume `postgres_data`. Programme une sauvegarde de la base (sauvegardes de base de données de Dokploy, ou `pg_dump` planifié) avant d'ouvrir le jeu à d'autres personnes. Le catalogue, lui, est déjà sauvegardé dans Git.

## API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` | état du service et de la base |
| GET | `/api/series` | séries actives |
| GET | `/api/series/{code}` | cartes et boosters d'une série |
| GET | `/api/boosters` | boosters actifs et leurs taux |
| POST | `/api/players` | crée un joueur, renvoie son jeton |
| GET | `/api/me` | statistiques du joueur |
| GET | `/api/me/collection?serie=S1` | cartes possédées et quantités |
| POST | `/api/boosters/{code}/open` | ouvre un booster (tirage serveur) |

Les routes `/api/me*` et l'ouverture demandent l'en-tête `Authorization: Bearer <jeton>`. Le jeton est créé automatiquement par le frontend et gardé dans le navigateur ; seul son empreinte SHA-256 est stockée en base. Pour des comptes durables (plusieurs appareils), branche plus tard Authentik ou NextAuth et associe l'identité à `players.id`.

Documentation interactive : `/api/docs` n'est pas relayée par le frontend ; en local, ouvre `http://localhost:8000/docs`.
