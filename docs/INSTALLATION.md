# Installer Symbola sur un poste de développement (NFR-23)

Lot 40a (décision D7, ADR 0075). De la machine neuve à l'app qui tourne avec le jeu fictif, en
moins de trente minutes.

Ce guide est rejoué tel quel par la CI (workflow « Installation », `.github/workflows/installation.yml`)
sur une machine neuve, chronomètre en main : à chaque version majeure (étiquette `v*`), à chaque
changement de ce guide ou du socle de dev, et à la demande. Les blocs de commandes placés entre
les repères `rejeu` s'exécutent dans l'ordre, depuis la racine du dépôt (`tools/installation/rejouer.mjs`) :
une commande fausse ou un temps au-delà de trente minutes fait échouer le rejeu.

## Ce qu'il faut

- macOS ou Linux, avec Git et `openssl` (présents sur l'un comme l'autre).
- Docker : Docker Desktop sur le Mac, Docker Engine et Compose sur Linux.
- Node.js 22 (il fournit `corepack`, qui installe la bonne version de pnpm).
- Ces ports libres : 3000 (app), 3001 et 3002 (Logto), 3310 (ClamAV), 3900 et 3903 (Garage),
  5432 (PostgreSQL), 1025 et 8025 (Mailpit), 8080 et 8081 (Traefik).

Sans Node sur le poste : chaque commande `pnpm` a son équivalent Docker dans `CLAUDE.md`, § 9.

## 1. Récupérer le dépôt

```bash
git clone https://github.com/jdaiguemorte/symbola.git
cd symbola
```

Toutes les commandes suivantes se lancent depuis ce dossier.

<!-- rejeu:debut -->

## 2. Installer les dépendances

```bash
corepack enable
pnpm install --frozen-lockfile
```

## 3. Écrire les réglages locaux

`.env` garde les mots de passe et les clés du poste ; il n'est jamais commité. Les secrets sont
tirés au hasard, une fois :

```bash
cp .env.example .env
remplir() { sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak; }
remplir POSTGRES_ADMIN_PASSWORD "$(openssl rand -hex 24)"
remplir POSTGRES_APP_PASSWORD "$(openssl rand -hex 24)"
remplir S3_ACCESS_KEY "GK$(openssl rand -hex 12)"
remplir S3_SECRET_KEY "$(openssl rand -hex 32)"
remplir GARAGE_RPC_SECRET "$(openssl rand -hex 32)"
remplir GARAGE_ADMIN_TOKEN "$(openssl rand -hex 32)"
remplir GARAGE_METRICS_TOKEN "$(openssl rand -hex 32)"
remplir MFA_ENCRYPTION_KEY "$(openssl rand -base64 32)"
remplir DATA_ENCRYPTION_KEY "$(openssl rand -base64 32)"
remplir LOGTO_DB_PASSWORD "$(openssl rand -hex 24)"
remplir LOGTO_M2M_SECRET "$(openssl rand -hex 32)"
```

Les scripts du dépôt ne lisent pas `.env` d'eux-mêmes : chaque bloc ci-dessous commence par
`set -a; . ./.env; set +a`, qui l'exporte dans le terminal. Une fois dans un terminal suffit ; le
rejeu le refait parce que chaque bloc tourne dans son propre shell.

## 4. Démarrer le socle

Base de données d'abord, pour y créer le rôle de l'app et la base de Logto (le fournisseur
d'identité), puis le reste : stockage des fichiers (Garage), antivirus (ClamAV, quelques minutes
le temps de télécharger ses signatures), e-mails de dev (Mailpit), Logto et Traefik.

```bash
set -a; . ./.env; set +a
docker compose -f infra/compose/docker-compose.dev.yml --env-file .env up -d --wait postgres
pnpm --filter @symbola/db bootstrap
docker compose -f infra/compose/docker-compose.dev.yml --env-file .env up -d --wait
```

## 5. Préparer la base, la connexion et le jeu fictif

Les migrations créent les tables ; `configure-identity` règle Logto (application de Symbola,
connexion par lien envoyé par e-mail) ; `seed:recette` charge le jeu fictif de recette
(`docs/runbooks/jeu-fictif.md`). Les comptes créés sont écrits dans un fichier hors du dépôt,
indiqué à la fin de la commande.

```bash
set -a; . ./.env; set +a
pnpm --filter @symbola/db migrate
pnpm --filter @symbola/auth configure-identity
pnpm --filter @symbola/app seed:recette
```

## 6. Lancer l'app

<!-- rejeu:serveur http://localhost:3000/login -->

```bash
set -a; . ./.env; set +a
pnpm --filter @symbola/app dev
```

<!-- rejeu:fin -->

L'app répond sur <http://localhost:3000>. Pour se connecter : « Recevoir un lien de connexion »
avec l'adresse d'un compte du jeu fictif (fichier des comptes, étape 5), puis ouvrir le lien reçu
dans Mailpit, sur <http://localhost:8025>.

## Et ensuite

- Tests, lint, contrôles : `CLAUDE.md`, § 9.
- Arrêter le socle : `docker compose -f infra/compose/docker-compose.dev.yml --env-file .env stop`.
- Repartir d'une base vide (efface toutes les données locales du poste) : arrêter le socle, supprimer
  le volume `symbola-dev_symbola_postgres_data`, puis reprendre à l'étape 4.
