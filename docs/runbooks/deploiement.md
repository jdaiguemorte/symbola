# Runbook — Déploiement (SOC-09)

Ce runbook couvre le premier déploiement, les mises à jour et le retour
arrière de l'app `symbola` (ADR 0011 : une seule app pour le MVP) sur le
VPS Contabo, en staging et en production.

**Rappel impératif** : Claude Code ne touche jamais au serveur réel, au
DNS ni aux secrets — Julien exécute chaque commande marquée « sur le
VPS » ou « sur ton poste ».

## Vue d'ensemble

- Un seul VPS héberge **staging** et **production**, strictement isolés
  (bases, secrets, réseaux Docker distincts — CLAUDE.md §3).
- Un seul **Traefik partagé** (`docker-compose.socle.yml`) écoute les
  ports 80/443 de la machine : staging et production ne peuvent pas
  chacune avoir leur propre Traefik sur ces ports. Il route par nom
  d'hôte vers le bon environnement.
- Chaque environnement (`docker-compose.prod.yml`, un fichier réutilisé
  pour les deux, ADR 0009) a ses propres PostgreSQL, Garage, ClamAV et
  son propre conteneur `symbola`, reliés au réseau partagé `symbola-edge`
  créé par le socle.
- L'image `symbola` est construite et publiée par la CI
  (`.github/workflows/ci.yml`, job `publish-image`) sur
  `ghcr.io/<owner>/<repo>` à chaque fusion sur `main`, taguée par le SHA
  du commit et `latest`. Déployer = changer `APP_IMAGE_TAG` puis tirer
  l'image. Revenir en arrière = remettre l'ancien tag.

## Domaine et DNS

`symbola.fr` est enregistré chez **Ionos** (pas chez Contabo, qui ne
vend pas de `.fr`). Avant le premier déploiement, Julien choisit, depuis
l'interface Ionos :

- **soit** déléguer les serveurs de noms (NS) du domaine vers Contabo,
  qui gère alors tous les enregistrements DNS depuis son panneau ;
- **soit** garder la gestion DNS chez Ionos et y ajouter directement les
  enregistrements A/AAAA pointant vers l'IP du VPS, pour `symbola.fr` et
  `staging.symbola.fr`.

Les deux options sont valables ; seule la suite du runbook diffère par
l'endroit où Julien ajoute les enregistrements. Dans tous les cas, il
faut au moins :

| Type | Nom | Valeur |
| --- | --- | --- |
| A (+ AAAA si IPv6) | `symbola.fr` | IP du VPS |
| A (+ AAAA si IPv6) | `staging.symbola.fr` | IP du VPS |

## Prérequis (une fois)

Sur le VPS (Julien) :

1. Docker et Docker Compose installés, durcissement serveur déjà fait
   (`docs/runbooks/durcissement-serveur.md`, SOC-12).
2. Cloner le dépôt (ou n'y copier que `infra/compose/`) à un emplacement
   stable, p. ex. `/opt/symbola/`.
3. Préparer les fichiers d'environnement, jamais committés :
   ```bash
   cp infra/compose/.env.socle.example infra/compose/.env.socle
   cp infra/compose/.env.staging.example infra/compose/.env.staging
   cp infra/compose/.env.production.example infra/compose/.env.production
   cp infra/compose/garage.toml.example infra/compose/garage.staging.toml
   cp infra/compose/garage.toml.example infra/compose/garage.production.toml
   ```
   Remplir chaque `.env.*` (mots de passe, clés S3 — jamais les mêmes
   entre staging et production) et chaque `garage.*.toml` (secrets
   générés avec `openssl rand -hex 32` / `openssl rand -base64 32`,
   jamais les valeurs de dev du dépôt).
4. Démarrer le socle partagé (une fois, ou après modification) :
   ```bash
   docker compose -f infra/compose/docker-compose.socle.yml \
     --env-file infra/compose/.env.socle -p symbola-socle up -d
   ```

## Premier déploiement d'un environnement

Exemple pour staging (remplacer `staging` par `production` pour l'autre) :

1. Démarrer l'environnement :
   ```bash
   docker compose -f infra/compose/docker-compose.prod.yml \
     --env-file infra/compose/.env.staging -p symbola-staging up -d
   ```
2. Créer le rôle applicatif PostgreSQL et appliquer les migrations
   **depuis le poste de Julien**, via un tunnel SSH vers le port
   PostgreSQL en boucle locale du VPS (jamais exposé publiquement) :
   ```bash
   ssh -L 5433:localhost:5433 <utilisateur>@<vps>   # staging, port 5433
   # ssh -L 5432:localhost:5432 <utilisateur>@<vps> # production, port 5432
   ```
   Puis, dans un autre terminal sur le poste de Julien, avec les mêmes
   valeurs que `.env.staging` (`POSTGRES_HOST=localhost`,
   `POSTGRES_PORT=5433`, identifiants admin et applicatif) :
   ```bash
   pnpm --filter @symbola/db bootstrap
   pnpm --filter @symbola/db migrate
   ```
3. Vérifier `https://staging.symbola.fr/` (certificat Let's Encrypt émis
   automatiquement par Traefik au premier accès ; peut prendre une
   minute).
4. Vérifier les en-têtes de sécurité (SOC-09) :
   ```bash
   curl -sI https://staging.symbola.fr/ | grep -Ei "content-security-policy|strict-transport-security|x-frame-options|referrer-policy"
   ```

## Mise à jour (nouvelle version)

1. La CI a publié une nouvelle image taguée par le SHA du commit fusionné
   sur `main` — noter ce SHA (ou utiliser `latest`).
2. Sur le VPS, modifier `APP_IMAGE_TAG` dans le `.env.<environnement>`
   concerné (SHA précis recommandé plutôt que `latest`, pour un retour
   arrière fiable).
3. Si la version ajoute une migration de base : lancer
   `pnpm --filter @symbola/db migrate` comme ci-dessus (tunnel SSH)
   **avant** de redémarrer l'app, les migrations étant conçues pour
   rester compatibles avec la version précédente le temps du
   déploiement.
4. Redémarrer seulement le service `symbola` :
   ```bash
   docker compose -f infra/compose/docker-compose.prod.yml \
     --env-file infra/compose/.env.staging -p symbola-staging \
     pull symbola
   docker compose -f infra/compose/docker-compose.prod.yml \
     --env-file infra/compose/.env.staging -p symbola-staging \
     up -d symbola
   ```
5. Vérifier `/` répond, puis promouvoir la même procédure en production.

## Retour arrière

Remettre l'ancien tag d'image dans `.env.<environnement>`
(`APP_IMAGE_TAG=<sha précédent>`), puis répéter les étapes 4 et 5
ci-dessus (`pull` puis `up -d symbola`) — en moins d'une minute
(cahier des charges §3). Si la version déployée avait une migration de
base non rétrocompatible, la corriger par une nouvelle migration plutôt
que revenir en arrière sur le schéma (CLAUDE.md §5 : migrations
réversibles, jamais de perte de données).

## Trajectoire (ADR 0011)

Si un module est un jour extrait en app autonome, il reçoit son propre
compose d'environnement et son propre sous-domaine à ce moment-là — le
socle partagé (Traefik) reste commun à toutes les apps du VPS, il
suffit d'ajouter un routeur Traefik (mêmes labels `traefik.*`) sur le
nouveau service.
