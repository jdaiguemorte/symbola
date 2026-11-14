# Runbook — Déploiement (SOC-09)

Ce runbook couvre le premier déploiement, les mises à jour et le retour
arrière de l'app `symbola` (ADR 0011 : une seule app pour le MVP) sur le
VPS Contabo, en staging et en production.

**Rappel impératif** : Claude Code ne touche jamais au serveur réel, au
DNS ni aux secrets — Julien exécute chaque commande marquée « sur le
VPS » ou « sur ton poste ».

**Fenêtre de déploiement** (NFR-07, ADR 0058) : aucun déploiement en
production du vendredi 12 h au lundi 8 h, heure de Paris, sauf correctif
urgent, motivé et noté avec sa raison dans le journal d'exploitation. Le
staging n'est pas concerné.

**Accès au VPS** : `ssh symbola` (connexion root par SSH refusée,
SOC-12), puis `sudo -i` pour les commandes root. Le dépôt `/opt/symbola`
appartient à `julien` : `sudo git pull` se lance **depuis ta session
`julien`**, jamais depuis un shell `sudo -i`, où Git refuse le dépôt
(« dubious ownership ») ; n'ajoute pas l'exception que Git propose.

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

Toutes les commandes `docker` de ce runbook passent par `sudo` : l'utilisateur `julien` n'est
volontairement pas dans le groupe `docker`, qui donne en pratique les droits root sur le serveur.
Sans `sudo`, Docker répond « permission denied while trying to connect to the docker API ».

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
   sudo docker compose -f infra/compose/docker-compose.socle.yml \
     --env-file infra/compose/.env.socle -p symbola-socle up -d
   ```

## Premier déploiement d'un environnement

Exemple pour staging (remplacer `staging` par `production` pour l'autre) :

1. Démarrer l'environnement :
   ```bash
   sudo docker compose -f infra/compose/docker-compose.prod.yml \
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
   sudo docker network connect symbola-staging_default <conteneur-caddy>
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

## Fournisseur d'identité : mise en service de Logto (lot 33, ADR 0067)

Depuis le lot 33, la connexion passe par Logto (lien magique, mot de passe, clé d'accès, double
authentification) ; Symbola ne garde plus aucun mot de passe. **Sans Logto, personne ne se
connecte** : ces étapes viennent avant la première mise à jour vers une image du lot 33.
**Actions de Julien**, staging d'abord, depuis `/opt/symbola` à jour (`sudo git pull`, depuis la
session `julien`). `$ENV` vaut `staging` (puis `production`).

1. **DNS** (chez le registraire du domaine) : un enregistrement pour `LOGTO_DOMAIN`
   (`connexion.staging.symbola.fr`, puis `connexion.symbola.fr`) vers l'adresse du VPS, comme
   pour l'app.
2. **Secrets**, propres à l'environnement, rangés aussi dans le gestionnaire de mots de passe :
   ```bash
   openssl rand -hex 32   # LOGTO_DB_PASSWORD
   openssl rand -hex 32   # LOGTO_M2M_SECRET
   ```
   Les écrire dans `infra/compose/.env.$ENV` (les autres valeurs `LOGTO_*` ont leur défaut dans
   le modèle), puis vérifier :
   ```bash
   sudo grep -c '^LOGTO_DB_PASSWORD=.\+\|^LOGTO_M2M_SECRET=.\+' infra/compose/.env.$ENV   # attendu : 2
   ```
3. **Base dédiée** : relancer le bootstrap (il crée la base `logto` et son rôle, comme pour
   Documenso) :
   ```bash
   sudo docker run --rm --network symbola-${ENV}_default -v "$PWD":/app -w /app \
     --env-file infra/compose/.env.$ENV -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
     node:22-slim sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm -s --filter @symbola/db bootstrap"
   ```
4. **Démarrer Logto** (il initialise sa base au premier démarrage) :
   ```bash
   sudo docker compose -f infra/compose/docker-compose.prod.yml --env-file infra/compose/.env.$ENV -p symbola-$ENV up -d logto
   ```
5. **Caddy** : dans le Caddyfile partagé, un bloc pour `LOGTO_DOMAIN` avec
   `reverse_proxy symbola-logto-$ENV:3001` ; recharger Caddy. Vérifier :
   ```bash
   curl -s https://connexion.staging.symbola.fr/oidc/.well-known/openid-configuration | head -c 120
   ```
6. **Régler Logto en une commande** (rejouable) : droit de connexion des rôles de Logto,
   application machine à machine, application web de Symbola, e-mails, expérience de connexion,
   centre de compte :
   ```bash
   sudo docker run --rm --network symbola-${ENV}_default -v "$PWD":/app -w /app \
     --env-file infra/compose/.env.$ENV -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
     -e LOGTO_ENDPOINT="https://$(sudo sed -n 's/^LOGTO_DOMAIN=//p' infra/compose/.env.$ENV)" \
     -e APP_PUBLIC_URL="https://$(sudo sed -n 's/^APP_DOMAIN=//p' infra/compose/.env.$ENV)" \
     node:22-slim sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm -s --filter @symbola/auth configure-identity"
   ```
7. **Mettre à jour l'app** vers l'image du lot 33 (« Mise à jour » ci-dessous ; migrations 0129
   et 0130 comprises : 0130 retire définitivement les mots de passe).
8. **Reprise des comptes** (une fois, rejouable ; n'affiche que des nombres) : chaque compte est
   relié à Logto, et la double authentification y devient obligatoire pour les titulaires et
   l'Exploitation :
   ```bash
   sudo docker run --rm --network symbola-${ENV}_default -v "$PWD":/app -w /app \
     --env-file infra/compose/.env.$ENV -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
     -e LOGTO_ENDPOINT="https://$(sudo sed -n 's/^LOGTO_DOMAIN=//p' infra/compose/.env.$ENV)" \
     node:22-slim sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm -s --filter @symbola/auth migrate-accounts"
   ```
   Sans cette étape, chaque compte se relie quand même à sa première connexion, par son adresse.
9. **Surveillance** : une sonde Uptime Kuma sur
   `https://<LOGTO_DOMAIN>/oidc/.well-known/openid-configuration`.
10. **Console de Logto** (rarement utile : tout se règle par `configure-identity`) : jamais
    publiée par Caddy, seulement par un tunnel SSH vers `LOGTO_ADMIN_PORT` :
    ```bash
    ssh -L 3003:127.0.0.1:3003 symbola   # staging ; 3002 pour la production
    ```
    puis `http://localhost:3003`. À la première visite, créer son compte d'administration de la
    console (gestionnaire de mots de passe).

## Premiers comptes (Exploitation, puis titulaire)

Un environnement neuf n'a aucun compte. Julien crée le compte **d'exploitation** en ligne de
commande, sur le VPS, depuis le dépôt à jour, après la mise en service de Logto. Aucun mot de
passe : la connexion se fait par « Recevoir un lien de connexion » sur la page de connexion, et
Logto fait installer la double authentification à la première connexion.

```bash
cd /opt/symbola
sudo docker run --rm --network symbola-staging_default -v "$PWD":/app -w /app \
  --env-file infra/compose/.env.staging -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
  node:22-slim sh -c "corepack enable && pnpm install --frozen-lockfile && \
    pnpm -s --filter @symbola/auth create-account -- --role admin --email <ton-e-mail>"
```

L'Exploitation crée ensuite les organisations depuis `/exploitation` (invitation de la titulaire
par e-mail ; en l'acceptant, elle reçoit un lien de connexion). Pour aider quelqu'un (invitation
perdue ou expirée, second facteur perdu), voir `/exploitation/comptes` (ADR 0029). Depuis le
lot 33, une personne peut aussi s'inscrire seule, sur `/inscription` (décision Q5 a).
Tant que les e-mails ne sont pas en service, la même commande crée directement une organisation
et sa titulaire : `-- --role owner --email <e-mail> --organization "<nom>"`.

## Signature en ligne : mise en service de Documenso (DEV-02, ADR 0026)

Tant que ces étapes ne sont pas faites, la signature en ligne s'affiche
« indisponible » (sans erreur) et Documenso ne démarre pas (profil compose
`signature` désactivé). L'essai guidé fonctionne déjà : il utilise le faux
fournisseur. **Actions de Julien sur le VPS**, staging d'abord, depuis
`/opt/symbola` à jour (`sudo git pull`, depuis la session `julien`), avec la nouvelle image de l'app.
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

## Carnet de prestataires : fond de carte (lot 11, ADR 0031)

Facultatif : sans fond de carte, le carnet fonctionne (liste, filtres,
distances, points sur un fond uni). Le géocodage des adresses passe par
l'API de l'IGN dès la production (`GEOCODER` vide), sans clé ni réglage.

1. Choisir une construction récente de Protomaps (liste sur
   <https://maps.protomaps.com/builds>, format `AAAAMMJJ`).
2. Sur le VPS, depuis `/opt/symbola`, mesurer d'abord la taille (rien
   n'est téléchargé) :
   ```bash
   sudo PROTOMAPS_BUILD=<AAAAMMJJ> bash infra/map/install-map.sh
   ```
   Si la taille est trop grande pour le disque, baisser le zoom
   (`MAP_MAXZOOM=13`).
3. Installer (un seul dossier, partagé par staging et production, monté
   en lecture seule) :
   ```bash
   sudo PROTOMAPS_BUILD=<AAAAMMJJ> bash infra/map/install-map.sh --install
   ```
4. Redémarrer seulement le service `symbola` de chaque environnement
   (`up -d symbola`, voir « Mise à jour »). Le dossier par défaut est
   `/opt/symbola-carte` ; un autre se règle par `MAP_TILES_HOST_DIR` dans
   le `.env.<environnement>`.

Le fond de carte n'est pas sauvegardé (il se retélécharge) ; le mettre à
jour une ou deux fois par an suffit.

## Lot 16 : clé de la double authentification (L16-SEC-01, ADR 0037)

> Depuis le lot 33 (ADR 0067), la double authentification est chez Logto ; la même clé
> (`MFA_ENCRYPTION_KEY`) scelle désormais les liens de connexion envoyés par Symbola. Elle reste
> requise : l'app refuse de démarrer sans elle. Perdue, il suffit d'en générer une autre (les
> liens déjà envoyés ne s'ouvrent plus, rien d'autre).

À faire **une fois par environnement, avant** de passer `APP_IMAGE_TAG` à une image du lot 16 :
sans cette clé, l'app refuse de démarrer.

1. Générer une clé propre à l'environnement (jamais la même pour le staging et la production) :
   ```bash
   openssl rand -base64 32
   ```
2. La ranger dans le gestionnaire de mots de passe (« Symbola — clé double authentification —
   staging »). **Perdue, elle oblige chaque compte à reconfigurer sa double authentification.**
3. L'ajouter dans `infra/compose/.env.staging` (puis `.env.production`) :
   `MFA_ENCRYPTION_KEY=<la clé>`, et vérifier :
   ```bash
   sudo grep -c '^MFA_ENCRYPTION_KEY=.\+' infra/compose/.env.staging   # attendu : 1
   ```
4. Suivre ensuite « Mise à jour » comme d'habitude (migration 0075 comprise). Au démarrage, le
   journal de l'app indique `double authentification : n secret(s) chiffré(s) au repos (L16-SEC-01)`
   (aucune ligne si tout était déjà chiffré).

## Mise à jour (nouvelle version)

1. La CI a publié une nouvelle image taguée par le SHA du commit fusionné
   sur `main` — noter ce SHA (ou utiliser `latest`).
2. Sur le VPS, modifier `APP_IMAGE_TAG` dans le `.env.<environnement>`
   concerné (SHA précis recommandé plutôt que `latest`, pour un retour
   arrière fiable).
3. Si la version ajoute une migration de base : la lancer **avant** de
   redémarrer l'app, les migrations étant conçues pour rester compatibles
   avec la version précédente le temps du déploiement. Julien n'a pas Node
   sur son poste : la commande tourne sur le VPS, dans un conteneur
   `node:22-slim` branché sur le réseau Docker de l'environnement (comme
   « Premiers comptes »), depuis le dépôt à jour :
   ```bash
   cd /opt/symbola && sudo git pull   # depuis la session julien, pas depuis sudo -i
   sudo docker run --rm --network symbola-staging_default -v "$PWD":/app -w /app \
     --env-file infra/compose/.env.staging -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
     node:22-slim sh -c "corepack enable && pnpm install --frozen-lockfile && \
       pnpm -s --filter @symbola/db migrate"
   ```
   En production : `symbola-production_default` et `.env.production`.
   Depuis un poste qui a Node, le tunnel SSH ci-dessus reste possible.
4. Redémarrer seulement le service `symbola` :
   ```bash
   sudo docker compose -f infra/compose/docker-compose.prod.yml \
     --env-file infra/compose/.env.staging -p symbola-staging \
     pull symbola
   sudo docker compose -f infra/compose/docker-compose.prod.yml \
     --env-file infra/compose/.env.staging -p symbola-staging \
     up -d symbola
   ```
5. Vérifier `/` répond, puis promouvoir la même procédure en production.

## Retour arrière

**Vers une image antérieure au lot 33** (ADR 0067) : un simple changement de tag ne suffit pas.
Ces images connectent par mot de passe, et la migration 0130 a retiré les mots de passe, les
secrets de double authentification et les appareils de confiance. Son annulation recrée les
colonnes vides, sans rendre aucun mot de passe, et l'annulation de 0129 est alors refusée tant
qu'un compte n'a pas de mot de passe. Revenir avant le lot 33 = **restaurer la sauvegarde prise
juste avant le déploiement** (`docs/runbooks/restauration.md`), en perdant ce qui a été saisi
depuis. La commande `mfa-secrets --unseal` (retour avant le lot 16) a disparu au lot 33 : il n'y a
plus de secret de double authentification chez Symbola.

**Vers une image du lot 33 ou postérieure** : remettre l'ancien tag d'image dans `.env.<environnement>`
(`APP_IMAGE_TAG=<sha précédent>`), puis répéter les étapes 4 et 5
ci-dessus (`pull` puis `up -d symbola`) — en moins d'une minute
(cahier des charges §3). Si la version déployée avait une migration de
base non rétrocompatible, la corriger par une nouvelle migration plutôt
que revenir en arrière sur le schéma (CLAUDE.md §5 : migrations
réversibles, jamais de perte de données).

## Service worker du jour J : interrupteur d'arrêt (lot 29a, ADR 0064)

`apps/symbola/public/sw.js` sert les copies du jour J gardées sur les téléphones. Il n'existe que
sur un appareil qui garde un jour J, et n'est jamais gardé par le cache HTTP : chaque navigateur
reprend la version déployée à sa prochaine visite.

**Quand l'arrêter** : s'il sert une mauvaise page ou bloque un écran. **Attention** : l'arrêter
efface aussi les jours J gardés ; prévenir les planners dont un évènement est proche, pour
qu'elles les gardent de nouveau après le correctif.

1. Dans une PR, remplacer tout le contenu de `apps/symbola/public/sw.js` par :

   ```js
   // Interrupteur d'arrêt (ADR 0064) : efface les copies de Symbola et se désinscrit.
   self.addEventListener("install", () => self.skipWaiting());
   self.addEventListener("activate", (event) => {
     event.waitUntil(
       (async () => {
         for (const name of await caches.keys()) if (name.startsWith("symbola-")) await caches.delete(name);
         await self.registration.unregister();
         for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
       })(),
     );
   });
   ```

2. Déployer comme une nouvelle version (§ Mise à jour), dans la fenêtre de déploiement.
3. Vérifier : `curl -s https://<domaine>/sw.js | head -2` montre l'interrupteur.

Le service worker revient avec le correctif : la première planner qui garde un jour J
l'enregistre de nouveau sur son appareil.

**Retour arrière vers une image antérieure au lot 29** : une image sans `sw.js` ne remplace pas
celui des appareils qui gardent un jour J. Il reste sans effet sur les autres écrans, mais pour
l'enlever, déployer d'abord l'interrupteur d'arrêt, puis l'image antérieure.

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
sudo docker run --rm --network symbola-staging_default alpine:3.20 nslookup postgres
sudo docker run --rm --network symbola-production_default alpine:3.20 nslookup postgres
# Le réseau frontal ne voit aucune base : « can't find postgres » attendu
sudo docker run --rm --network symbola-edge-staging alpine:3.20 nslookup postgres
# Seuls Traefik et l'app de l'environnement sont sur chaque réseau frontal
sudo docker network inspect symbola-edge-staging -f '{{range .Containers}}{{.Name}} {{end}}'
sudo docker network inspect symbola-edge-production -f '{{range .Containers}}{{.Name}} {{end}}'
# Limites appliquées
sudo docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
```

### Migration depuis la première version de SOC-09 (réseau `symbola-edge` unique)

Seulement si un environnement a déjà tourné avec l'ancien compose :

```bash
sudo docker compose -f infra/compose/docker-compose.socle.yml \
  --env-file infra/compose/.env.socle -p symbola-socle up -d   # crée les deux réseaux frontaux
sudo docker compose -f infra/compose/docker-compose.prod.yml \
  --env-file infra/compose/.env.staging -p symbola-staging up -d --force-recreate
sudo docker compose -f infra/compose/docker-compose.prod.yml \
  --env-file infra/compose/.env.production -p symbola-production up -d --force-recreate
sudo docker network rm symbola-edge   # une fois plus aucun conteneur dessus
```

Ajouter d'abord les variables `*_MEM_LIMIT` et `*_CPUS` dans chaque
`.env.<environnement>` (voir les `.example`). Les volumes sont conservés
tant que le nom de projet reste le même (`-p symbola-staging`,
`-p symbola-production`).
