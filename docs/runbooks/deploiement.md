# Runbook — Déploiement (SOC-09)

Ce runbook couvre le premier déploiement, les mises à jour et le retour
arrière de l'app `symbola` (ADR 0011 : une seule app pour le MVP) sur le
VPS Contabo, en staging et en production.

**Rappel impératif** : Claude Code ne touche jamais au serveur réel, au
DNS ni aux secrets — Julien exécute chaque commande marquée « sur le
VPS » ou « sur ton poste ».

**Fenêtre de déploiement** (NFR-07, ADR 0075, qui remplace l'ADR 0058) :
aucun déploiement en production du vendredi 12 h au lundi 8 h, heure de
Paris. `deploy.sh` (§ Mise à jour) refuse hors fenêtre, sauf correctif
urgent passé avec `--urgence="motif"`, motif journalisé. Le staging n'est
pas concerné ; le retour arrière (`rollback.sh`) non plus.

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
7. **Mettre à jour l'app** vers l'image du lot 33 (« Mise à jour » ci-dessous ; migrations 0129,
   0130 et 0131 comprises : 0130 retire définitivement les mots de passe ; 0131, lot 33b, ajoute
   les réponses du questionnaire et le rôle des invitations).
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

## Socle des lots 46 et 49 : clé du chiffrement au niveau du champ (DAT-08, ADR 0079)

À faire **une fois par environnement, avant** le premier déploiement qui contient le socle des
lots 46 et 49 : sans cette clé, l'app refuse de démarrer.

1. Générer une clé propre à l'environnement, différente de `MFA_ENCRYPTION_KEY` (l'app refuse
   deux clés identiques) :
   ```bash
   openssl rand -base64 32
   ```
2. La ranger dans le gestionnaire de mots de passe (« Symbola — clé des données chiffrées —
   staging »). **Perdue, les valeurs chiffrées sont perdues** (adresses d'agendas extérieurs,
   régimes des invités) : la sauvegarde restic contient les données, pas cette clé.
3. L'ajouter dans `infra/compose/.env.staging` (puis `.env.production`) :
   `DATA_ENCRYPTION_KEY=<la clé>`, et vérifier :
   ```bash
   sudo grep -c '^DATA_ENCRYPTION_KEY=.\+' infra/compose/.env.staging   # attendu : 1
   ```
4. Suivre ensuite « Mise à jour » comme d'habitude.

## Mise à jour (nouvelle version) : une commande (lot 40a, ADR 0075)

1. La CI publie l'image de chaque commit fusionné sur `main`, taguée par son
   SHA complet (40 caractères) : le noter.
2. Sur le VPS, depuis ta session `julien` (sudo, pas `sudo -i`) :
   ```bash
   sudo /opt/symbola/infra/server/deploy.sh staging <sha>
   ```
   Vérifier le staging, puis la même commande avec `production`.
3. Le script enchaîne, et s'arrête au premier problème en le disant :
   - **fenêtre** (production seulement) : refus du vendredi 12 h au lundi
     8 h, heure de Paris ;
   - **contrôle du durcissement** (`check-hardening.sh`) : un ÉCHEC arrête
     tout, avant la moindre modification ;
   - **sauvegarde** de l'environnement (`symbola-backup@<env>`) : en échec,
     tout s'arrête ;
   - **dépôt** `/opt/symbola` avancé jusqu'au commit (refus s'il n'est pas
     sur `main`, ou si le dépôt est déjà plus loin : revenir en arrière,
     c'est `rollback.sh`) ;
   - **image** tirée, puis **migrations** : `migrate:plan` dit si l'une
     demande d'arrêter `symbola`, que le script arrête alors le temps des
     migrations (quelques secondes) ;
   - **démarrage** et sonde de santé : si la nouvelle version ne répond pas,
     le script remet aussitôt la précédente ;
   - **journal** : « Nouvelle version de Symbola installée » au journal
     d'audit (visible dans celui de chaque organisation), et une ligne dans
     `/var/log/symbola/deploiements.log`.
4. **Correctif urgent hors fenêtre**, ou contrôle du durcissement en échec
   sans rapport avec la version : ajouter `--urgence="motif"` (sans donnée
   personnelle), qui est journalisé. Une sauvegarde en échec arrête le
   déploiement même en urgence.
5. Le premier déploiement par le script note la version précédente
   seulement si `APP_IMAGE_TAG` est un SHA (pas `latest`) : c'est elle que
   `rollback.sh` remettra.

### Migrations qui demandent l'arrêt de l'app (depuis le lot 40a)

Une nouvelle migration qui retire, renomme ou change le type d'une colonne
porte le marqueur `-- symbola: arret-requis <raison>`, et son paragraphe ici
cite son tag (contrôle de la CI, `packages/db/src/migration-compatibility.test.ts`).
Aucune pour l'instant.

### Migrations livrées avant le lot 40a (déploiement d'ensemble)

`deploy.sh` les applique d'un coup, `symbola` arrêté pendant ce temps :
douze d'entre elles (0079, 0086, 0103 à 0106, 0111, 0112, 0130, 0132, 0133,
0135) portent un changement que l'ancien code ne sait pas lire, et
`migrate:plan` les signale « arrêt requis ». Ce que fait chacune, pour
lire le résultat :

   **Exception, migration 0132 (lot 34a, ADR 0055)** : elle renomme les statuts des évènements
   (prospect et devis envoyé deviennent Option, réalisé devient Clôturé, perdu devient Annulé).
   L'image d'avant ne les lit plus : arrêter `symbola` (`… -p symbola-staging stop symbola`),
   lancer la migration, puis démarrer la nouvelle image (§ À la main ; `deploy.sh` le fait seul). L'interruption dure le temps
   de la migration, quelques secondes. **Même chose pour la migration 0133 (lot 34b)** : le lieu
   de réception passe de deux colonnes de l'évènement (`venue_name`, `venue_city`, retirées) au
   premier lieu de la liste ; l'image du lot 34a les lit encore. La migration 0134 (lot 35a,
   exports complets) n'ajoute qu'une table et une colonne : elle passe sans arrêter `symbola`.
   **La migration 0135 (lot 36a, ADR 0069) demande, elle, l'arrêt de `symbola`** : elle reprend
   les clients des évènements dans les contacts du hub, puis retire leurs coordonnées
   d'`event_clients`, que l'image du lot 35a lit encore. La reprise se fait dans une seule
   transaction : en cas d'échec, rien n'est repris et l'ancienne image redémarre telle quelle.
   La migration 0136 (lot 36b : membres des foyers et entreprises, identifiants d'entreprise,
   import de contacts) n'ajoute qu'une table, deux colonnes et une valeur : elle passe sans
   arrêter `symbola`.
   La migration 0137 (lot 37a : dossiers, versions, partage et liens de partage des documents d'un
   évènement) ajoute trois tables, trois colonnes et une valeur, et met chaque document existant en
   version 1, dans « Divers », non partagé : elle passe aussi sans arrêter `symbola`.
   Les migrations 0138 à 0140 (lot 37b, ADR 0071) passent aussi sans arrêter `symbola` : 0138
   ajoute les versions diffusées du programme et fait du programme existant de chaque évènement sa
   version 1 (déjà vue par ses liens) ; 0139 ajoute le relevé de stockage et la taille du logo ;
   0140 les tailles des documents signés et des dossiers de preuve. Au premier démarrage de l'image
   du lot 37b, le relevé du mois est pris dans l'heure, et les tailles manquantes sont lues une
   fois au stockage : un fichier absent est signalé au journal (« relevé de stockage : fichier
   absent du stockage », avec l'identifiant de la ligne), sans bloquer le relevé.
   Les migrations 0141 et 0142 (lot 38a, ADR 0072) passent sans arrêter `symbola` : 0141 ajoute
   la date et le nombre d'envoi par e-mail d'une version du programme (les deux seules colonnes
   d'une version que l'app peut modifier) ; 0142 ajoute les modèles d'e-mails de l'organisation,
   vides au départ (chacun vaut son texte de départ). Aucun réglage nouveau : l'adresse
   d'expédition reste `SMTP_FROM` ; le nom affiché devient celui de l'organisation et les réponses
   vont à son adresse de contact.
   La migration 0143 (lot 38b, ADR 0072) passe aussi sans arrêter `symbola` : elle ajoute les
   modèles de messages de la planner et leurs versions, et les adresses des flux de calendrier
   (vides au départ). La route `/calendrier/…` est publique (adresse secrète, lecture seule,
   débit limité) : rien à ouvrir de plus dans Caddy.
   Les migrations 0144 à 0147 (lot 39a, ADR 0073) passent sans arrêter `symbola` : elles ajoutent
   `deleted_at` et `deleted_by` (vides) à dix-sept tables des schémas `events`, `hub`, `quotes` et
   `budget`, et des politiques RLS qui cachent ce qui est à la corbeille. La purge de la corbeille
   tourne toutes les heures dans l'app (rien à planifier). Leur annulation est refusée tant qu'une
   ligne est à la corbeille.
   La migration 0148 (lot 39b, ADR 0074) passe aussi sans arrêter `symbola` : elle ajoute la table
   des brouillons de formulaires (vide au départ), purgée avec la corbeille. Les erreurs du serveur
   s'écrivent dans le journal du conteneur `symbola` sous la forme `erreur serveur {"reference":…}` :
   la référence est celle que l'écran d'erreur montre à la personne.
   Les migrations 0150 à 0153 (lot 49, ADR 0083) passent sans arrêter `symbola` : temps forts des
   évènements (`events.key_moments`), durées de la purge des invités (0151) et contrainte des
   natures d'e-mails élargie à l'invitation et à la relance (0152, `hub`), schéma `guests` (vide). Le module Invités reste **fermé** chez chaque organisation tant
   que l'Exploitation ne l'ouvre pas (après l'analyse d'impact, Q38) ; la page `/rsvp` est publique
   (jeton après « # », débit limité) : rien à ouvrir de plus dans Caddy. La tâche horaire des
   invités (purge avec préavis, relances) démarre avec l'app. Leurs annulations sont refusées tant
   que des invités ou des temps forts existent.

### À la main, si le script ne peut pas servir

Les gestes que `deploy.sh` enchaîne, pour un cas qu'il ne couvre pas (noté
au journal d'exploitation) : mettre `APP_IMAGE_TAG=<sha>` dans le
`.env.<environnement>` concerné, lancer les migrations dans un conteneur
`node:22-slim` branché sur le réseau Docker de l'environnement, depuis le
dépôt à jour (arrêter `symbola` avant, si l'une d'elles le demande) :
   ```bash
   cd /opt/symbola && sudo git pull   # depuis la session julien, pas depuis sudo -i
   sudo docker run --rm --network symbola-staging_default -v "$PWD":/app -w /app \
     --env-file infra/compose/.env.staging -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
     node:22-slim sh -c "corepack enable && pnpm install --frozen-lockfile && \
       pnpm -s --filter @symbola/db migrate"
   ```
   En production : `symbola-production_default` et `.env.production`.

Puis redémarrer seulement le service `symbola` :
   ```bash
   sudo docker compose -f infra/compose/docker-compose.prod.yml \
     --env-file infra/compose/.env.staging -p symbola-staging \
     pull symbola
   sudo docker compose -f infra/compose/docker-compose.prod.yml \
     --env-file infra/compose/.env.staging -p symbola-staging \
     up -d symbola
   ```

Vérifier que `/` répond, puis promouvoir la même procédure en production.

## Retour arrière

**En une commande** (lot 40a, ADR 0075), sur le VPS :

```bash
sudo /opt/symbola/infra/server/rollback.sh production --motif="la page devis ne s'ouvre plus"
```

Il remet l'image de la version précédente notée par `deploy.sh`, attend la
sonde de santé et journalise le retour (« Retour à la version précédente de
Symbola », `/var/log/symbola/deploiements.log`). Le schéma ne bouge pas : les
migrations restent compatibles avec la version précédente (contrôle de la
CI). Il n'attend pas la fenêtre de déploiement. Relancé, il revient à la
version qu'il vient de quitter. `--motif` est facultatif.

Les paragraphes qui suivent valent pour revenir à une image d'avant le
lot 40a, où le schéma doit être annulé à la main, après une sauvegarde.

**Vers une image antérieure au lot 33** (ADR 0067) : un simple changement de tag ne suffit pas.
Ces images connectent par mot de passe, et la migration 0130 a retiré les mots de passe, les
secrets de double authentification et les appareils de confiance. Son annulation recrée les
colonnes vides, sans rendre aucun mot de passe, et l'annulation de 0129 est alors refusée tant
qu'un compte n'a pas de mot de passe. Revenir avant le lot 33 = **restaurer la sauvegarde prise
juste avant le déploiement** (`docs/runbooks/restauration.md`), en perdant ce qui a été saisi
depuis. La commande `mfa-secrets --unseal` (retour avant le lot 16) a disparu au lot 33 : il n'y a
plus de secret de double authentification chez Symbola.

**Vers une image du lot 33** (antérieure au lot 34a) : la migration 0132 doit être annulée
(`restauration.md`, § 4 bis : `0132_lot34a_events_lifecycle`), après une sauvegarde. L'annulation
rend les statuts du PRD et perd ce qui n'y existait pas : En préparation et Reporté redeviennent
Confirmé (la date d'avant un report en cours est perdue, la nouvelle reste), l'écart des tâches,
les tâches fixées, le fuseau et le rattachement des modèles aux types disparaissent. Arrêter
`symbola` avant l'annulation, puis démarrer l'image du lot 33.

**Vers une image du lot 34a** (antérieure au lot 34b) : annuler la migration 0133
(`0133_lot34b_events_fiche_tasks`), après une sauvegarde. Le lieu de réception redevient deux
colonnes, reprises du premier lieu ; les horaires et le contact des lieux, les invités, le style,
les notes, les pièces jointes et les commentaires des tâches sont perdus (les fichiers des pièces
jointes restent dans le stockage, sans ligne : `restauration.md`, § 4 bis), et une tâche confiée à
un prestataire revient à la planner. Arrêter `symbola` avant l'annulation.

**Vers une image du lot 37a** (antérieure au lot 37b) : les migrations 0138 à 0140 peuvent rester
(l'image du lot 37a ignore les versions, le relevé et les tailles) ; remettre l'ancien tag d'image,
puis les étapes 4 et 5. Les clients et les prestataires revoient alors le programme en direct ; une
version diffusée entre-temps reste en base, sans effet. Pour revenir plus loin, annuler 0140, 0139
puis 0138 (`0140_lot37b_quotes_file_sizes`, `0139_lot37b_hub_storage_snapshots`,
`0138_lot37b_events_program_versions` ; les versions et les relevés sont perdus).

**Vers une image du lot 36b** (antérieure au lot 37a) : la migration 0137 peut rester (l'image du
lot 36b ignore les dossiers, les versions, le partage et les liens) ; remettre l'ancien tag
d'image, puis les étapes 4 et 5. Les liens de partage ne s'ouvrent plus (la page `/partage`
n'existe pas). Un document supprimé par cette image laisse dans le stockage les fichiers de ses
versions précédentes ; un document qu'elle dépose n'a pas de version 1 au retour du lot 37a. Pour
revenir plus loin, annuler 0137 d'abord (`0137_lot37a_events_documents`, refusée tant qu'une
ouverture de lien est au fil d'activité ; les versions précédentes, les dossiers, les partages et
les liens sont perdus, leurs fichiers restent dans le stockage).

**Vers une image du lot 36a** (antérieure au lot 36b) : la migration 0136 peut rester (l'image du
lot 36a ignore sa table, ses colonnes et sa valeur) ; remettre l'ancien tag d'image, puis les
étapes 4 et 5. Un import de contacts déjà au journal y apparaît sans libellé de nature. Pour revenir
plus loin, annuler 0136 d'abord (`0136_lot36b_contacts_members`, refusée tant qu'un import de
contacts existe ; les liens des foyers et les identifiants d'entreprise sont perdus).

**Vers une image du lot 35a** (antérieure au lot 36a) : annuler la migration 0135
(`0135_lot36a_contacts`), après une sauvegarde, `symbola` arrêté. Chaque client retrouve ses
coordonnées, reprises de son contact ; un client retiré par le RGPD redevient « [anonymisé] ». Les
contacts sans évènement, les notes des contacts et leurs adresses de facturation sont perdus. Deux
évènements qui partageaient un contact gardent chacun sa copie. Démarrer ensuite l'image du
lot 35a.

**Vers une image du lot 34b ou du lot 35a** (la migration 0134 du lot 35a peut rester : l'image du
lot 34b ignore sa table et sa colonne ; la migration 0135 est annulée d'abord, ci-dessus) : remettre l'ancien tag d'image dans `.env.<environnement>`
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

## Suivi des erreurs : mise en service de GlitchTip (lot 40b, ADR 0077)

GlitchTip n'est jamais exposé sur internet : l'app lui écrit par le réseau Docker, son écran
s'ouvre par un tunnel SSH. Tant qu'il n'est pas mis en service, les erreurs restent au journal du
conteneur `symbola`, avec leur référence (ADR 0074). Pour un environnement (ici la production ;
le staging prend `.env.staging`, `symbola-staging` et le port 8091) :

1. Dans `.env.production` : `GLITCHTIP_DB_PASSWORD` et `GLITCHTIP_SECRET_KEY`
   (`openssl rand -hex 32` chacun, distincts du staging), et ajouter `erreurs` à
   `COMPOSE_PROFILES` (par exemple `signature,erreurs`). `GLITCHTIP_LOCAL_PORT` est déjà dans le
   modèle (8090).
2. Démarrer GlitchTip et sa base (il crée ses tables seul au premier démarrage) :
   ```bash
   sudo docker compose -f infra/compose/docker-compose.prod.yml \
     --env-file infra/compose/.env.production -p symbola-production \
     up -d glitchtip-postgres glitchtip
   ```
3. Depuis ton poste, un tunnel : `ssh -L 8090:127.0.0.1:8090 symbola`, puis
   <http://localhost:8090>. Le premier compte s'inscrit ; les inscriptions se ferment après lui.
   Créer l'organisation, puis un projet « symbola » (plateforme Node.js).
4. Copier l'adresse (DSN) du projet en remplaçant l'hôte par `glitchtip:8000`, le nom du service
   sur le réseau Docker : `ERROR_TRACKING_DSN=http://<clé>@glitchtip:8000/<numéro>` dans
   `.env.production`. Puis redémarrer `symbola` (`up -d symbola`, ou le prochain `deploy.sh`).
5. Alerte : dans le projet, une règle d'alerte vers un webhook, l'adresse du sujet ntfy de la
   surveillance (`docs/runbooks/surveillance.md`).
6. Vérifier : une erreur suivante apparaît dans le projet, avec la référence que montre l'écran.
   Rien de personnel n'y figure : l'app trie ce qui part (ADR 0077).

Mémoire : 768 Mo au plus pour GlitchTip et 256 Mo pour sa base en production (512 Mo et 256 Mo
au staging) ; à noter au journal d'exploitation à la mise en service. Sa base n'est pas
sauvegardée (des erreurs techniques, gardées 30 jours).

## Jeu fictif sur le staging (DAT-10, lot 40a)

Après le déploiement de la version à recetter, sur le VPS :

```bash
sudo /opt/symbola/infra/server/recette.sh staging
```

Il charge le jeu fictif (`docs/runbooks/jeu-fictif.md`) par le chargeur de
l'app ; il refuse la production (ADR 0016) et une base déjà chargée. Les
comptes et les liens créés vont dans `/root/symbola-recette/comptes-recette.txt`,
lisible par root seul.

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
