# CLAUDE.md — Symbola

Ce fichier fixe les règles du dépôt (NFR-24). Lis-le en entier avant toute tâche. En cas de doute
entre ce fichier et ton intuition, ce fichier gagne. En cas de contradiction entre ce fichier et
`docs/CAHIER_DES_CHARGES.md`, signale-la, écris la question dans `docs/QUESTIONS.md` et demande.

## 1. Le projet en bref

Symbola est une suite SaaS modulaire pour les organisateurs d'évènements, d'abord les wedding
planners (première cliente : une wedding planner, en pilote). Un **hub** central (compte,
organisation, catalogue, droits) donne accès à des **modules** qui fonctionnent seuls ou ensemble.

Sources de vérité :

- `docs/CAHIER_DES_CHARGES.md` : **la référence** (décision Q2 du 11/11/2026). Son § 1 t'est
  adressé (protocole, règles d'arbitrage, définition de « terminé ») ; ses exigences sont
  numérotées (`HUB-01`, `SEC-14`…) ; ses Synthetic Users et scénarios (§ 16 et 17) font la preuve.
- `DESIGN.md` : jetons de design (ADR 0057).
- `docs/gap.csv` et `docs/GAP_REPORT.md` : écart exigence par exigence et plan des lots (§ 7 et 9).
- `docs/QUESTIONS.md` : décisions de Julien (Q1 à Q32, C1 à C5) et questions ouvertes.
- `docs/lots/` : spécification du lot en cours, validée par Julien avant le code.
- `docs/adr/` : décisions d'architecture. Toute décision structurante, ou divergence acceptée
  avec le cahier des charges, = un ADR.
- `docs/conformite/` : fiches pour l'expert-comptable, l'avocat et le DPO ; sous-traitants.
- `docs/archive/` : ancien cahier des charges et PRD. **Plus une référence.**

**Identifiants** (Q1) : un identifiant nu (`HUB-28`) est celui du cahier des charges ; cite-le
dans les commits, les tests et les documents. Les anciens sont préfixés par leur origine :
`PRD-EVT-03` (PRD), `L21-HUB-28` (spécification du lot 21) ; table :
`docs/referentiel/correspondance-identifiants.md`. Les familles anciennes sans équivalent dans le
cahier des charges (SOC, DEV, IMP, RGPD, AIDE, ONB, GEO, DB) gardent leur forme.

Langue : documentation, messages de commit et commentaires métier en français ; identifiants de
code (variables, tables, routes) en anglais.

## 2. Principes non négociables

Architecture du pilote (ADR 0011 à 0014) : **une seule app Next.js** (`apps/symbola/`) à modules
internes, **une seule base PostgreSQL** à un schéma par module, des **événements internes**
(`domain_events`), une authentification maison en attendant le fournisseur d'identité
(ADR 0052, lot 33). L'architecture du cahier des charges (§ 10) reste la trajectoire ; chaque
écart assumé a son ADR (ADR 0011, 0012, 0027, 0051, 0058, 0059).

1. **Un module = une frontière** (ARC-01, ARC-02). Chaque module vit sous
   `apps/symbola/modules/<module>/` avec une porte d'entrée unique, `service.ts`. Jamais d'accès
   au `repository.ts`, aux tables ou aux composants internes d'un autre module : son
   `service.ts`, ou un événement de `domain_events` (ARC-05). Contrats internes en TypeScript
   (`packages/contracts`) ; contrat OpenAPI écrit avant le code pour toute API exposée hors de
   l'app (ARC-04, avenant de l'ADR 0011).
2. **Dégradation propre** (ARC-06, ARC-07) : une fonction qui dépend d'un module non souscrit
   par l'organisation est masquée ou affichée « indisponible », jamais en erreur.
3. **Isolation garantie par la base** (ARC-08, DAT-01, SEC-10, SEC-11) : chaque table métier a
   `organization_id` (obligatoire, indexé), protégé par Row-Level Security. Aucune requête ne doit
   pouvoir lire une autre organisation, même avec un bug applicatif.
4. **Contrôle d'accès côté serveur, refus par défaut** (SEC-12, SEC-13) : session, organisation,
   rôle, objet, portée du lien, à chaque requête. Une erreur ne révèle jamais l'existence d'un
   objet d'une autre organisation. L'Admin (exploitation) n'a aucun accès aux données métier
   (SEC-09, ADR 0029).
5. **Les tiers par lien personnel** (UX-11, SEC-14 à SEC-17, ADR 0053) : client, prestataire et
   invité n'ont pas de compte ; jeton haché, limité, révocable, expirant. Rien n'est partagé par
   défaut (POR-10).
6. **Aucune donnée métier en dur** (HUB-20 à HUB-26, ADR 0007) : listes, modèles, taux,
   catalogues, mentions légales, formats de numérotation, seuils fiscaux = données paramétrables
   par organisation (ou par l'Admin pour les valeurs réglementaires). Les modèles de départ sont
   des fichiers de données traduisibles, jamais des constantes dans le code.
7. **Sécurité héritée, pas réinventée** (SEC-01, ARC-12) : jamais de crypto, de stockage de mots
   de passe ou de signature électronique maison au-delà de l'existant. Briques tierces derrière
   une interface : signature (Documenso, ADR 0026), e-mail, paiement, plateforme agréée.
   Identité déléguée à un fournisseur open source au lot 33 (ADR 0052).
8. **RGPD par construction** (RGP-05, SEC-20) : chaque champ personnel est déclaré dans le
   registre (`privacy.registry.yaml`) ; chaque module implémente `privacy/v1` (find, export,
   anonymize, erase). Réglages protecteurs par défaut, purge automatique avec préavis
   (ADR 0056). Aucune donnée personnelle dans les adresses, les journaux ou les erreurs.
9. **Données fictives isolées** (ARC-13, DAT-10) : le staging n'emploie que des données
   synthétiques (ADR 0016). Les essais guidés créent des données `is_demo` (série `DEMO`),
   exclues des stats, exports, e-reporting et recherches RGPD, puis purgées.
10. **Bilingue FR/EN** : aucun texte affiché en dur, tout passe par les fichiers de traduction.
11. **Tout est testé** (ARC-20, SEC-36) : chaque critère d'acceptation devient un test ; les tests
    d'abus (accès croisé entre organisations, élévation de rôle, lien expiré ou d'un autre
    évènement, débit) sont obligatoires pour toute nouvelle table ou route.

## 3. Stack

Versions figées dans les ADR. Colonne « Pilote » = ce qu'on construit maintenant. Colonne
« Cible » = l'architecture du cahier des charges, à activer quand un ADR la justifie.

| Brique | Pilote (maintenant) | Cible |
| --- | --- | --- |
| Langage | TypeScript en mode `strict` partout | — |
| Monorepo | pnpm workspaces + Turborepo | — |
| Apps | **Une seule app Next.js** (App Router), modules internes sous `modules/<x>/` | Application web progressive hors ligne pour le Jour J (ARC-09, lots 29 et 30) |
| UI | Tailwind CSS + `packages/ui`, jetons de `DESIGN.md` (ADR 0057, lot 25b) | — |
| Validation | Zod (entrées, formulaires, variables d'environnement) | — |
| ORM / migrations | Drizzle ORM + drizzle-kit, migrations annulables (ADR 0036) | — |
| Base | **Une seule base PostgreSQL, un schéma par module** | Une base par module si extrait |
| Identité | **Authentification maison** (argon2id, session opaque, TOTP) derrière `packages/auth` (ADR 0013) | Fournisseur d'identité open source sur le VPS (ADR 0052, lot 33) |
| Événements | **Table `domain_events`** (outbox), schémas versionnés dans `packages/contracts` | Bus séparé si un module est extrait |
| Fichiers | Garage (S3) sur le VPS (ADR 0015, 0051), servis par l'app après contrôle des droits (ADR 0027), ClamAV à l'envoi | Stockage d'objets hors du serveur (NFR-31, palier 2) |
| i18n | next-intl | — |
| PDF | @react-pdf/renderer (ADR 0019), rendu côté serveur | — |
| Carte | MapLibre GL + PMTiles servi par l'app, géocodage IGN derrière une interface (ADR 0031) | — |
| Tests | Vitest, Playwright (ordinateur et 375 px), axe-core | — |
| Proxy | Caddy partagé du VPS (ADR 0018) ; Traefik en dev local uniquement | — |
| Déploiement | Docker Compose, à la main hors fenêtre (ADR 0058) | Chaîne qui refuse hors fenêtre (NFR-07, lot 40a) |
| CI | GitHub Actions : Semgrep, Gitleaks, Trivy, OSV-Scanner, Renovate, OWASP ZAP (staging) | — |
| Sauvegarde | restic chiffré vers Hetzner Storage Box, copies instantanées (ADR 0051) | — |
| Surveillance | Uptime Kuma, alertes ntfy sur le téléphone | — |
| E-mails | Mailpit en dev (jamais d'e-mail réel hors production), IONOS en production | Envoi depuis le domaine du planner (Q18, lots 38 et 55) |

**Un seul serveur** (VPS Contabo, Luxembourg) héberge production et staging isolés (ADR 0016) ;
les sauvegardes partent chez Hetzner. Sous-traitants : `docs/conformite/sous-traitants.md`.

Toute dépendance hors de cette liste : **demande avant de l'ajouter**, en expliquant pourquoi
l'existant ne suffit pas, puis écris l'ADR.

## 4. Structure du dépôt

```
apps/
  symbola/            # l'unique app Next.js (ADR 0011)
    app/              # routes
    modules/
      hub/            # accueil, admin, démarrage, aide, orchestrateur RGPD, import (écran)
      events/         # évènements, rétroplanning, programme
      budget/         # budget
      quotes/         # devis, factures, encaissements
      vendors/        # carnet de prestataires
      <module>/
        service.ts    # porte d'entrée publique : seul point d'accès pour les autres modules
        repository.ts # accès base du module, jamais importé hors du module
packages/
  ui/  auth/  contracts/  db/  privacy/  import-engine/  i18n/  testing/  starter-templates/  config/
infra/
  compose/  backup/  monitoring/  server/  map/
docs/
  adr/  lots/  runbooks/  conformite/  referentiel/  recette/  maquette/  schemas/  archive/
```

Le partage transverse passe par `packages/` (`auth` : authentification et rôles ; `contracts` :
contrats internes et schémas d'événements ; `db` : Drizzle, RLS, contexte d'organisation,
`domain_events` ; `privacy` : contrat `privacy/v1` et registre ; `testing` : tests d'isolation et
fabriques). Si un module est extrait plus tard, `modules/<x>/` devient `apps/<x>/` et `service.ts`
devient son contrat HTTP `/v1/...`, décrit en OpenAPI.

## 5. Règles de code

### Multi-tenant et autorisations (SEC-10 à SEC-13)

- Chaque requête base s'exécute dans une transaction qui fixe le contexte :
  `SET LOCAL app.organization_id = $1` (helper dans `packages/db`). Les policies RLS le lisent.
- Le rôle PostgreSQL de l'app n'est jamais propriétaire des tables et n'a pas `BYPASSRLS` ;
  l'administration emploie un rôle distinct (SEC-11).
- Chaque route serveur vérifie : session ou lien valide, organisation, rôle, objet. Jamais de
  contrôle uniquement côté client.

### Sécurité (SEC-18 à SEC-24)

- Toute entrée externe (API, formulaire, webhook, fichier importé) est validée par Zod.
- Webhooks entrants : signature vérifiée, sinon rejet et journalisation.
- Fichiers (SEC-21) : type vérifié par le contenu, taille limitée, antivirus, stockage privé,
  téléchargement servi par l'app après contrôle des droits (ADR 0027).
- Import CSV/Excel : neutraliser les cellules commençant par `=`, `+`, `-`, `@`.
- En-têtes : CSP stricte, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`.
- Secrets (SEC-23, ARC-15) : variables d'environnement validées au démarrage ; `.env*` jamais
  commités (sauf `.env.example` sans valeur).
- Journaux (SEC-20) : jamais de donnée personnelle (e-mail, nom, téléphone) ; des identifiants.

### Données (ARC-17, DAT-01 à DAT-09)

- Montants : entiers en centimes, devise EUR explicite, jamais de `float` ; règle d'arrondi
  unique de l'ADR 0059 (TVA par taux).
- Dates : stockées en UTC (`timestamptz`), affichées en `Europe/Paris` (fuseau de l'évènement à
  venir, ARC-17) ; dates sans heure en `date`.
- Clés primaires non devinables (UUID) ; clés étrangères dans un schéma de module, pas entre
  schémas (avenant de l'ADR 0012).
- Factures : numérotation continue sans trou par série et par organisation, attribuée en
  transaction ; une facture émise est immuable et fige ses données (DAT-04), correction par avoir.
- Chaque migration est réversible et ne touche que le schéma de son module (DAT-09, ADR 0036).

### Événements internes (`domain_events`, ARC-05, ADR 0014)

- Nom : `<module>.<entité>.<action>` au passé, ex. `quotes.quote.signed`.
- Chaque événement a un schéma versionné dans `packages/contracts`, un `organization_id`, un
  identifiant unique et une date.
- Publication dans la même transaction que l'écriture métier (outbox). Un worker interne
  consomme et appelle les gestionnaires, de façon idempotente.

## 6. Tests

- Chaque exigence a ses tests ; les `describe` portent son identifiant :
  `describe('EVT-05 — Statuts, report et annulation', ...)`. Chaque critère d'acceptation = un
  `it`. Un test d'une ancienne story garde son identifiant préfixé (`L21-HUB-28`).
- Écrire d'abord les tests à partir des critères, les voir échouer, puis implémenter.
- Tests d'isolation obligatoires pour toute nouvelle table ou route (helpers dans
  `packages/testing`) : organisation A ne lit ni ne modifie B ; un lien n'ouvre que son
  évènement et ses droits ; l'Admin n'accède à aucune donnée métier.
- Les règles de dates (échéances, purge RGPD, rétroplanning) sont testées avec une horloge
  simulée, cas limites inclus (veille, jour même, passage à l'heure d'été).
- Playwright couvre au moins un parcours par exigence d'écran, en taille ordinateur et en 375 px.
- **Rejeu** (C4) : à chaque lot, Claude Code rejoue en local le scénario concerné (§ 17) sur le
  jeu fictif (`docs/recette/symbola-synthetic-users.json`) et écrit `docs/recette/SC-xx.md` ;
  Julien rejoue sur le staging aux portes 1 et 2.

## 7. Définition de « terminé »

Celle du cahier des charges (§ 1), exclusivement (Q23). Une exigence est terminée quand :

1. ses critères d'acceptation sont couverts par un test automatisé ;
2. le scénario Synthetic User concerné passe sans blocage ;
3. la chaîne de contrôle sécurité est verte (SEC-30 à SEC-36) ;
4. l'aide contextuelle et les textes de l'écran sont à jour.

Les autres règles de ce fichier s'appliquent toujours, sans entrer dans cette définition :
textes en français et en anglais (C1), registre RGPD, écran en 375 px et axe-core, aucune liste
ni règle fiscale en dur, documentation à jour, ligne de `docs/gap.csv` mise à jour.

## 8. Méthode de travail

- Un lot = une branche `lot-<n>-<nom>` et une pull request ; lots numérotés à partir de 22 (Q26),
  dans l'ordre de `docs/GAP_REPORT.md` § 9. Jamais de commit direct sur `main`.
- Commits petits et explicites (Conventional Commits, en français), avec l'identifiant :
  `feat(events): EVT-05 report et annulation`.
- Avant de coder : spécification `docs/lots/lot-<n>-<nom>.md` (exigences, critères, fichiers
  touchés, ambiguïtés). Attendre la validation de Julien, toujours pour un lot qui change le
  schéma de données ou un parcours P0.
- Arbitrage (§ 1 du cahier des charges) : d'abord la perte de données et les failles SEC en P0,
  puis les parcours P0 cassés, puis le reste. Un parcours terminé vaut mieux que trois modules à
  moitié faits. Ne réécris pas ce qui fonctionne : une divergence acceptable se documente par un
  ADR. Ne tranche jamais seul un point juridique ou tarifaire.
- Après chaque lot : lint, typecheck, tests, rejeu ; résumer ce qui est fait et ce qui reste.

**Demande toujours avant** : d'ajouter une dépendance hors stack ; de modifier un contrat d'API
ou d'événement de façon incompatible ; de toucher le schéma d'un autre module ; d'agir sur un
serveur réel (staging, production), un secret ou un DNS ; de supprimer des données ou des
fichiers hors de ton périmètre.

## 9. Commandes

Julien travaille sans toolchain Node/Python natif sur son Mac ; toutes les commandes tournent
dans Docker Desktop. Les commandes `pnpm` ci-dessous sont celles que Claude Code utilise en
interne ; Julien passe par l'équivalent Docker donné à droite. Sur le VPS : `ssh symbola`, puis
`sudo -i` pour être root ; `sudo git pull` se lance depuis la session `julien`, jamais depuis
`sudo -i` (Git y refuse le dépôt).

| Besoin | Commande (si Node est disponible) | Équivalent Docker (poste de Julien) |
| --- | --- | --- |
| Installer les dépendances | `pnpm install` | `docker run --rm -v "$PWD":/app -w /app node:22-slim corepack enable && corepack use pnpm@9.15.0 && pnpm install` |
| Démarrer le socle + l'app en dev | `pnpm dev` | `cp .env.example .env` (une fois, puis remplir les mots de passe et les trois secrets `GARAGE_*`, générés par `openssl rand`) puis `docker compose -f infra/compose/docker-compose.dev.yml --env-file .env up -d && pnpm dev`, depuis la racine du dépôt |
| Lint | `pnpm lint` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm lint` |
| Vérification des types | `pnpm typecheck` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm typecheck` |
| Tests | `pnpm test` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm test` |
| Parcours bout en bout (Playwright, nécessite le socle démarré + bootstrap + migrate ; lancés aussi en CI, job `e2e`) | `pnpm --filter @symbola/app test:e2e` | — (navigateur requis : passer par la CI, ou Node et `pnpm --filter @symbola/app exec playwright install chromium`) |
| Régénérer les captures du centre d'aide (lot 13, ADR 0033 ; socle démarré + bootstrap + migrate, puis relire les images dans la PR) | `pnpm --filter @symbola/app help:captures` | — (navigateur requis : passer par Claude Code) |
| Contrôle des frontières de modules (ADR 0011) | `pnpm check:boundaries` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm check:boundaries` |
| Préfixer les anciens identifiants d'un fichier (lot 25, Q1) | `node tools/referentiel/prefix-legacy-ids.mjs <fichier…>` | `docker run --rm -v "$PWD":/app -w /app node:22-slim node tools/referentiel/prefix-legacy-ids.mjs <fichier…>` |
| Créer/mettre à jour le rôle applicatif PostgreSQL (une fois par base, SOC-05 ; crée aussi la base dédiée de Documenso si `DOCUMENSO_DB_PASSWORD` est rempli, DEV-02, ADR 0026) | `pnpm --filter @symbola/db bootstrap` | `docker run --rm --network symbola-dev_default -v "$PWD":/app -w /app --env-file .env node:22-slim pnpm --filter @symbola/db bootstrap` |
| Appliquer les migrations de base (après le bootstrap, SOC-05) | `pnpm --filter @symbola/db migrate` | `docker run --rm --network symbola-dev_default -v "$PWD":/app -w /app --env-file .env node:22-slim pnpm --filter @symbola/db migrate` |
| Annuler la dernière migration appliquée (lot 15, ADR 0036 ; **Julien**, après une sauvegarde, voir `docs/runbooks/restauration.md` § 4 bis) | `pnpm --filter @symbola/db rollback -- <tag>` | `docker run --rm --network symbola-dev_default -v "$PWD":/app -w /app --env-file .env node:22-slim pnpm --filter @symbola/db rollback -- <tag>` |
| Remettre en clair les secrets de double authentification, **seulement** avant de relancer une image antérieure au lot 16 (L16-SEC-01, ADR 0037 ; **Julien**, voir `docs/runbooks/deploiement.md` § Retour arrière) ; `--seal` les chiffre (l'app le fait aussi au démarrage) | `pnpm --filter @symbola/auth mfa-secrets -- --unseal` | voir le runbook (conteneur `node:22-slim` sur le réseau Docker de l'environnement) |
| Tests d'isolation RLS réels (SOC-05, nécessite le socle démarré + bootstrap + migrate) | `pnpm --filter @symbola/db test:integration` | `docker run --rm --network symbola-dev_default -v "$PWD":/app -w /app --env-file .env node:22-slim pnpm --filter @symbola/db test:integration` |
| Charger le jeu fictif de recette (lot 24a, DAT-10 ; socle démarré + bootstrap + migrate ; refusé en production ; comptes écrits hors du dépôt, voir `docs/runbooks/jeu-fictif.md`) | `pnpm --filter @symbola/app seed:recette` | `docker run --rm --network symbola-dev_default -v "$PWD":/app -w /app --env-file .env -v "$HOME/symbola-recette":/recette node:22-slim pnpm --filter @symbola/app seed:recette -- --comptes /recette/comptes.txt` (comptes dans `~/symbola-recette/comptes.txt`) |
| Créer un compte Admin, ou une organisation et sa titulaire (mot de passe généré, affiché une fois ; **Julien, sur le VPS**, voir `docs/runbooks/deploiement.md` § Premiers comptes) | `pnpm --filter @symbola/auth create-account -- --role admin --email <e-mail>` | voir le runbook (conteneur `node:22-slim` sur le réseau Docker de l'environnement) |
| Lancer le socle en local seul | — | `docker compose -f infra/compose/docker-compose.dev.yml --env-file .env up` |
| Vérifier les scripts serveur (SOC-10, SOC-12, lots 11, 22 et 23) | `shellcheck -x infra/server/*.sh infra/backup/*.sh infra/map/*.sh infra/monitoring/*.sh` | `docker run --rm -v "$PWD/infra":/mnt:ro -w /mnt koalaman/shellcheck:stable -x server/check-hardening.sh server/acces-base.sh backup/backup.sh backup/restore.sh backup/lib.sh backup/check-snapshot-protection.sh monitoring/disk-check.sh` |
| Tests des sauvegardes et des configurations de déploiement (SOC-09 à SOC-12, lot 22) | `pnpm --filter @symbola/tools-deployment-config test` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm --filter @symbola/tools-deployment-config test` |
| Sauvegarder un environnement à la main (SOC-10, **Julien, sur le VPS**) | — | `sudo systemctl start symbola-backup@staging.service` (voir `docs/runbooks/restauration.md`) |
| Restaurer un environnement (SOC-10, **Julien, sur le VPS**, destructif) | — | `sudo /opt/symbola/infra/backup/restore.sh staging --confirm=staging` |
| Contrôler que les copies instantanées de la Storage Box sont hors d'atteinte du VPS (lot 22, NFR-13, **Julien, sur le VPS**, avant la première donnée réelle) | — | `sudo /opt/symbola/infra/backup/check-snapshot-protection.sh staging --confirm=staging` (voir `docs/runbooks/restauration.md`, § 7) |
| Vérifier le durcissement du VPS (SOC-12, **Julien, sur le VPS**) | — | `sudo bash infra/server/check-hardening.sh` (lecture seule, voir `docs/runbooks/durcissement-serveur.md`) |
| Ouvrir `psql` sur un environnement, tracé et motivé (SEC-09, lot 23, **Julien, sur le VPS**) | — | `sudo /opt/symbola/infra/server/acces-base.sh staging --motif="…"` (voir `docs/runbooks/acces-exploitation.md`) |

Le socle de dev (Postgres, Garage, ClamAV, Mailpit, Traefik) est défini dans
`infra/compose/docker-compose.dev.yml` ; les variables d'environnement sont validées par Zod au
démarrage de l'app (`packages/env`, voir `.env.example`). `pnpm dev` démarre l'app ; le socle se
lance à part. Cette section se complète à chaque lot qui ajoute une commande.
