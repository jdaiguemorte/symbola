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
  son propre conteneur `symbola`. L'isolation est décrite dans l'ADR 0016 :
  - projet Compose `symbola-<environnement>`, dérivé de
    `ENVIRONMENT_NAME` (un oubli de `-p` ne mélange rien) ;
  - PostgreSQL, Garage et ClamAV sont uniquement sur le réseau interne du
    projet. Le nom `postgres` ne peut désigner que la base du même
    environnement ;
  - seul `symbola` rejoint le réseau frontal de son environnement
    (`symbola-edge-staging` ou `symbola-edge-production`, créés par le
    socle), partagé uniquement avec Traefik ;
  - limites mémoire/CPU par conteneur dans chaque `.env` (staging bridé).
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
   **Note (ADR 0018)** : ce runbook date du choix initial (Traefik,
   socle dédié) ; en réalité le VPS utilise le Caddy déjà en place pour
   les autres projets (ADR 0018), pas `docker-compose.socle.yml`. Reste
   à faire une fois par environnement : connecter ce Caddy existant au
   réseau Docker de l'environnement (sans alias — l'alias
   `symbola-<environnement>` est déjà porté par le conteneur `symbola`
   lui-même, voir `docker-compose.prod.yml`) et ajouter le bloc
   correspondant dans son Caddyfile :
   ```bash
   docker network connect symbola-staging_default <conteneur-caddy>
   ```
   Le reste de ce runbook (sections suivantes) décrit encore l'ancienne
   architecture Traefik/socle partagé — à réviser entièrement pour
   refléter ADR 0018 (noté comme dette documentaire, pas bloquant).
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

## Premiers comptes (Admin, puis titulaire)

Un environnement neuf n'a aucun compte. Julien crée le compte **Admin** (opérateur de la suite)
en ligne de commande, sur le VPS, depuis le dépôt à jour. Le mot de passe est généré et affiché
une seule fois (jamais en argument, donc jamais dans l'historique du shell) ; la double
authentification se configure à la première connexion :

```bash
cd /opt/symbola
sudo docker run --rm --network symbola-staging_default -v "$PWD":/app -w /app \
  --env-file infra/compose/.env.staging -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
  node:22-slim sh -c "corepack enable && pnpm install --frozen-lockfile && \
    pnpm -s --filter @symbola/auth create-account -- --role admin --email <ton-e-mail>"
```

L'Admin crée ensuite les organisations depuis `/admin` (invitation de la titulaire par e-mail).
Pour aider quelqu'un (invitation perdue ou expirée, téléphone de double authentification
perdu), voir `/admin/comptes` ; un mot de passe oublié se règle depuis l'écran de connexion
(ADR 0029).
Tant que les e-mails ne sont pas en service, la même commande crée directement une organisation
et sa titulaire : `-- --role owner --email <e-mail> --organization "<nom>"`.

## Signature en ligne : mise en service de Documenso (DEV-02, ADR 0026)

Tant que ces étapes ne sont pas faites, la signature en ligne s'affiche
« indisponible » (sans erreur) et Documenso ne démarre pas (profil compose
`signature` désactivé). L'essai guidé fonctionne déjà : il utilise le faux
fournisseur. **Actions de Julien sur le VPS**, staging d'abord, depuis
`/opt/symbola` à jour (`sudo git pull`), avec la nouvelle image de l'app.
`$ENV` vaut `staging` (puis `production`) :

```bash
cd /opt/symbola && ENV=staging && F=infra/compose/.env.$ENV
```

1. **DNS** : un enregistrement pour la page publique de signature
   (`signature.staging.symbola.fr`, `signature.symbola.fr` en production)
   vers le VPS ; il est repris dans `DOCUMENSO_DOMAIN`.
2. **Secrets** : ajouter à `$F` (`sudo nano $F`) les variables du modèle
   `infra/compose/.env.$ENV.example`, section « Signature » :
   `DOCUMENSO_DB_PASSWORD`, `DOCUMENSO_NEXTAUTH_SECRET`,
   `DOCUMENSO_ENCRYPTION_KEY`, `DOCUMENSO_ENCRYPTION_SECONDARY_KEY` et
   `SIGNATURE_WEBHOOK_SECRET`, chacune avec sa propre valeur
   `openssl rand -hex 32`, rangées aussi dans le gestionnaire de mots de
   passe. `DOCUMENSO_DISABLE_SIGNUP=false` le temps de l'étape 6.
3. **Certificat de scellement** des PDF signés (une fois par
   environnement), généré dans un dossier temporaire puis supprimé :
   ```bash
   T=$(mktemp -d) && P=$(openssl rand -hex 24)
   openssl req -x509 -newkey rsa:3072 -nodes -days 3650 -subj "/CN=Symbola signature $ENV" \
     -keyout "$T/key.pem" -out "$T/cert.pem"
   openssl pkcs12 -export -inkey "$T/key.pem" -in "$T/cert.pem" -out "$T/cert.p12" -passout "pass:$P"
   printf 'DOCUMENSO_SIGNING_CERT_BASE64=%s\nDOCUMENSO_SIGNING_PASSPHRASE=%s\n' "$(base64 -w0 "$T/cert.p12")" "$P" | sudo tee -a $F >/dev/null
   rm -rf "$T"; unset P
   ```
   Retirer de `$F` les éventuelles lignes vides `DOCUMENSO_SIGNING_*=`
   copiées du modèle (une seule ligne par variable). Copier ces deux
   valeurs dans le gestionnaire de mots de passe : sans elles, une
   restauration sur un autre serveur ne pourrait plus sceller.
4. **Base dédiée** : le bootstrap crée la base `documenso` et son rôle,
   sans aucun droit pour `symbola_app` (sans danger s'il est relancé) :
   ```bash
   sudo docker run --rm --network symbola-${ENV}_default -v "$PWD":/app -w /app \
     --env-file $F -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
     node:22-slim sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm -s --filter @symbola/db bootstrap"
   ```
5. **Démarrer Documenso** : `COMPOSE_PROFILES=signature` dans `$F`, puis
   ```bash
   sudo docker compose -f infra/compose/docker-compose.prod.yml --env-file $F -p symbola-$ENV up -d
   sudo docker compose -f infra/compose/docker-compose.prod.yml --env-file $F -p symbola-$ENV ps documenso
   ```
   et, dans le Caddyfile partagé, le bloc du sous-domaine de signature
   (`reverse_proxy symbola-documenso-$ENV:3000`) ; recharger Caddy
   (`caddy validate` puis `caddy reload`).
6. **Compte et clé d'API** : ouvrir `https://signature.staging.symbola.fr`,
   créer le compte administrateur (adresse `notifications@…`, mot de passe
   dans le gestionnaire), confirmer l'e-mail reçu, puis :
   - renommer l'équipe « Personal Team » en **Symbola** (*Paramètres de
     l'équipe → Général*) : c'est le nom que voient les mariés ;
   - *API Tokens → Create token*, expiration **jamais** : copier la clé dans
     `DOCUMENSO_API_KEY` ;
   - remettre `DOCUMENSO_DISABLE_SIGNUP=true` dans `$F`.
7. **Webhook** : *Webhooks → Create webhook*, URL
   `https://staging.symbola.fr/api/webhooks/signature`, événements
   `document.signed`, `document.completed`, `document.rejected`, champ
   *Secret* = la valeur de `SIGNATURE_WEBHOOK_SECRET`.
8. **Activer** : `SIGNATURE_PROVIDER=documenso` dans `$F`, puis
   ```bash
   sudo docker compose -f infra/compose/docker-compose.prod.yml --env-file $F -p symbola-$ENV up -d
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://staging.symbola.fr/api/webhooks/signature -d '{}'
   ```
   L'app refuse de démarrer si une valeur Documenso manque ; le `curl` doit
   répondre `401` (appel sans secret).
9. **Vérifier** : envoyer un devis de test en signature à sa propre adresse,
   signer par le lien reçu, et vérifier que le devis passe « Signé » et
   l'événement « Confirmé ». Si le webhook n'arrive pas, le rattrapage
   automatique fait passer le devis à « Signé » en dix minutes au plus.
10. **Retirer DocuSeal** (environnements où il avait été démarré), une fois
    l'étape 9 réussie : retirer son bloc du Caddyfile et ses lignes
    `DOCUSEAL_*` de `$F`, puis
    ```bash
    sudo docker rm -f symbola-$ENV-docuseal-1
    sudo docker volume rm symbola-${ENV}_docuseal_data
    sudo docker compose -f infra/compose/docker-compose.prod.yml --env-file $F -p symbola-$ENV exec postgres \
      sh -c 'dropdb --if-exists --force --username="$POSTGRES_USER" docuseal && psql --username="$POSTGRES_USER" --dbname=postgres -c "DROP ROLE IF EXISTS docuseal"'
    ```

La base de Documenso (fichiers compris) entre automatiquement dans la
sauvegarde nocturne dès qu'elle existe (`docs/runbooks/restauration.md`).

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

## Vérifier l'isolation staging ↔ production (après chaque premier déploiement)

Sur le VPS (Julien), une fois les deux environnements démarrés :

```bash
# Chaque nom interne ne résout qu'une seule adresse, celle de son environnement
docker run --rm --network symbola-staging_default alpine:3.20 nslookup postgres
docker run --rm --network symbola-production_default alpine:3.20 nslookup postgres
# Le réseau frontal ne voit aucune base : « can't find postgres » attendu
docker run --rm --network symbola-edge-staging alpine:3.20 nslookup postgres
# Seuls Traefik et l'app de l'environnement sont sur chaque réseau frontal
docker network inspect symbola-edge-staging -f '{{range .Containers}}{{.Name}} {{end}}'
docker network inspect symbola-edge-production -f '{{range .Containers}}{{.Name}} {{end}}'
# Limites appliquées
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
```

### Migration depuis la première version de SOC-09 (réseau `symbola-edge` unique)

Seulement si un environnement a déjà tourné avec l'ancien compose :

```bash
docker compose -f infra/compose/docker-compose.socle.yml \
  --env-file infra/compose/.env.socle -p symbola-socle up -d   # crée les deux réseaux frontaux
docker compose -f infra/compose/docker-compose.prod.yml \
  --env-file infra/compose/.env.staging -p symbola-staging up -d --force-recreate
docker compose -f infra/compose/docker-compose.prod.yml \
  --env-file infra/compose/.env.production -p symbola-production up -d --force-recreate
docker network rm symbola-edge   # une fois plus aucun conteneur dessus
```

Ajouter d'abord les variables `*_MEM_LIMIT` et `*_CPUS` dans chaque
`.env.<environnement>` (voir les `.example`). Les volumes sont conservés
tant que le nom de projet reste le même (`-p symbola-staging`,
`-p symbola-production`).
