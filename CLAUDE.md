# CLAUDE.md — Symbola

Ce fichier fixe les règles du dépôt. Lis-le en entier avant toute tâche. En cas de doute entre ce fichier et ton intuition, ce fichier gagne. En cas de contradiction entre ce fichier et `docs/`, signale-la et demande.

## 1. Le projet en bref

Symbola est une suite SaaS modulaire pour les métiers de l'événementiel (premier client : une wedding planner). Un **hub** central (connexion unique, catalogue d'apps, droits) donne accès à des **apps autonomes** qui fonctionnent seules ou ensemble.

Sources de vérité, à lire selon la tâche :

- `docs/cahier-des-charges.md` : vision, architecture, sécurité, RGPD, catalogue complet des apps.
- `docs/PRD-MVP.md` : périmètre du MVP et **critères d'acceptation** de chaque story (format Étant donné / Quand / Alors).
- `docs/lots/` : spécification du lot en cours.
- `docs/adr/` : décisions d'architecture. Toute nouvelle décision structurante = un nouvel ADR.

Langue : documentation, messages de commit et commentaires métier en français ; identifiants de code (variables, tables, routes) en anglais.

## 2. Principes non négociables

**Note sur l'architecture (lire avant tout le reste) :** le kickoff initial visait une
architecture multi-apps/multi-bases dès le MVP (ADR 0002-0005). Elle a été revue à la baisse pour
le MVP par les ADR 0011-0014 : **un seul module Next.js** (`apps/symbola/`) avec des **modules
internes**, **une seule base PostgreSQL** à schémas logiques, **une authentification maison**
plutôt que Zitadel, et des **événements internes** (table `domain_events`) plutôt que NATS. Raison :
un seul développeur, à temps partiel, pour un seul client pilote au démarrage — l'architecture
cible décrite dans `docs/cahier-des-charges.md` reste la trajectoire si un second client ou une
équipe la justifie (voir ADR 0011-0014, section « Conséquences » de chacun pour le coût de
bascule). Les principes ci-dessous sont formulés pour le MVP ; chaque principe garde entre
parenthèses son équivalent à l'échelle « module » plutôt qu'« app ».

1. **Un module = une frontière de code claire** (plus tard, si justifié : un produit autonome,
   son dossier, sa base, son image Docker, sa version). Chaque module vit sous
   `apps/symbola/modules/<module>/` avec une porte d'entrée unique (`service.ts`). Le module
   fonctionne même si une organisation n'a pas souscrit la fonctionnalité correspondante.
2. **Jamais d'accès direct aux données internes d'un autre module** (plus tard, si justifié :
   jamais d'accès à la base d'une autre app). Les modules communiquent uniquement par leur
   `service.ts` (contrat interne, versionné en pensant à une future API `/v1/...` décrite en
   OpenAPI dans `packages/contracts`) ou par la table d'événements internes `domain_events`
   (schémas dans `packages/contracts`, mêmes conventions que les futurs événements NATS).
3. **Dégradation propre** : une fonction qui dépend d'un module non souscrit par l'organisation
   est masquée ou affichée « indisponible », jamais en erreur.
4. **Multi-tenant dès le départ** : chaque table métier a `organization_id`, protégée par Row-Level Security PostgreSQL. Aucune requête ne doit pouvoir lire une autre organisation, même avec un bug applicatif.
5. **Aucune donnée métier codée en dur** : listes (postes, sources, motifs), modèles (rétroplanning, répartition, programme), catalogue, régime de TVA, mentions légales, formats de numérotation, seuils fiscaux = données paramétrables par organisation (ou par l'Admin pour les valeurs réglementaires). Les « modèles de départ » sont des fichiers de données traduisibles, jamais des constantes dans le code.
6. **Sécurité héritée, pas réinventée** : authentification et MFA par Zitadel (OIDC), signature par DocuSeal derrière une interface, paiements par Stripe plus tard. Ne jamais écrire sa propre crypto, son propre stockage de mots de passe ou sa propre signature électronique.
7. **Tout est testé automatiquement** : chaque critère d'acceptation du PRD devient un test. Les tests d'isolation (organisation A ↔ B, marié ↔ autre événement) sont obligatoires sur chaque API.
8. **RGPD par construction** : chaque champ personnel est déclaré dans le registre de données de l'app (`privacy.registry.yaml`). Chaque app implémente le contrat `privacy/v1` (find, export, anonymize, erase).
9. **Bilingue FR/EN** : aucun texte affiché en dur dans les composants, tout passe par les fichiers de traduction.
10. **Données de démonstration isolées** : les essais guidés créent des données marquées `is_demo`, avec une série de numérotation `DEMO`, exclues des stats, exports, e-reporting et recherches RGPD, puis purgées automatiquement.

## 3. Stack

Versions exactes à figer au lot 0 sur la dernière version stable, puis notées dans l'ADR concerné.
Colonne « MVP » = ce qu'on construit maintenant (ADR 0011-0014). Colonne « Cible » = l'architecture
du cahier des charges, à activer seulement si un second client ou une équipe la justifie.

| Brique | MVP (maintenant) | Cible (si justifié plus tard) |
| --- | --- | --- |
| Langage | TypeScript en mode `strict` partout | — (inchangé) |
| Monorepo | pnpm workspaces + Turborepo | — (inchangé) |
| Apps | **Une seule app Next.js** (App Router), modules internes sous `modules/<x>/`, PWA installable | Une app Next.js par module |
| UI | Tailwind CSS + shadcn/ui, dans `packages/ui` | — (inchangé) |
| Validation | Zod (entrées, formulaires, variables d'environnement) | — (inchangé) |
| ORM / migrations | Drizzle ORM + drizzle-kit | — (inchangé) |
| Base | **Une seule base PostgreSQL, un schéma par module** | Une base et un rôle par app |
| Identité | **Authentification maison** (argon2id, session opaque, MFA TOTP) derrière `packages/auth` | Zitadel (OIDC, organisations, rôles, MFA) |
| Événements | **Table `domain_events`** (outbox interne), schémas versionnés dans `packages/contracts` | NATS JetStream |
| Fichiers | Garage (S3, ADR 0015 — remplace MinIO, image retirée des registres publics), liens signés à durée limitée, antivirus ClamAV à l'envoi | — (inchangé) |
| i18n | next-intl | — (inchangé) |
| Tests | Vitest (unitaires et intégration), Playwright (bout en bout, mobile 375 px), axe-core (accessibilité) | — (inchangé) |
| Proxy | Traefik v3, HTTPS Let's Encrypt, un seul sous-domaine | Un sous-domaine par app |
| Déploiement | Docker Compose, un seul fichier pour le socle + l'app | Un fichier par app + un pour le socle |
| CI | GitHub Actions | — (inchangé) |
| Sécurité CI | Semgrep, Gitleaks, Trivy, OSV-Scanner, Renovate, OWASP ZAP (staging) | — (inchangé) |
| Sauvegarde | restic (chiffré) | — (inchangé) |
| Surveillance | Uptime Kuma | — (inchangé) |
| E-mails de dev | Mailpit (jamais d'e-mail réel hors production) | — (inchangé) |

**Un seul serveur** (VPS Contabo) héberge production et staging isolés dès le MVP et dans la
cible ; aucun autre serveur, aucun système de secours au démarrage.

Toute dépendance hors de cette liste : **demande avant de l'ajouter**, en expliquant pourquoi l'existant ne suffit pas.

## 4. Structure du dépôt

```
apps/
  symbola/            # l'unique app Next.js du MVP (ADR 0011)
    app/              # routes : (hub), events, budget, quotes
    modules/
      hub/            # tableau de bord, admin, onboarding, aide, orchestrateur RGPD, import (écran)
      events/         # Événements et Chrono
      budget/         # Budget
      quotes/         # Devis et Facturation
      hello/          # module témoin du lot 0 (supprimable ensuite)
      <module>/
        service.ts    # porte d'entrée publique du module — seul point d'accès pour les autres modules
        repository.ts # accès DB du module, jamais importé hors du module
packages/
  ui/             # design system partagé
  auth/           # helpers d'authentification maison côté serveur et client, contrôle des rôles (ADR 0013)
  contracts/      # contrats internes par module (futurs OpenAPI), schémas d'événements (futur NATS), tests de contrat
  db/             # helpers Drizzle, pattern RLS, utilitaire de contexte organisation, table domain_events (ADR 0014)
  privacy/        # contrat privacy/v1, format et vérificateur du registre de données
  import-engine/  # lecture de fichiers, détection d'encodage/séparateur, mapping de colonnes, rapprochements
  i18n/           # messages communs FR/EN, formats de date et de montant
  testing/        # helpers de tests d'isolation, fabriques de données, corpus de fichiers d'import
  starter-templates/ # modèles de départ facultatifs (JSON/YAML traduisibles)
  config/         # tsconfig, eslint, prettier partagés
infra/
  compose/        # socle + app symbola ; dev, staging, prod
  traefik/  backup/  monitoring/
docs/
  adr/  lots/  runbooks/
```

Un module n'importe jamais le `repository.ts` ou les composants internes d'un autre module —
seulement son `service.ts` (ADR 0011). Le partage transverse passe par `packages/`. Si un module
est extrait en app autonome plus tard, `modules/<x>/` devient `apps/<x>/` et `service.ts` devient
son contrat HTTP `/v1/...` (trajectoire décrite dans chaque ADR 0011-0014).

## 5. Règles de code

### Multi-tenant et autorisations

- Chaque requête base s'exécute dans une transaction qui fixe le contexte : `SET LOCAL app.organization_id = $1` (helper dans `packages/db`). Les policies RLS lisent ce paramètre.
- Le rôle PostgreSQL de l'app n'est jamais propriétaire des tables et n'a pas `BYPASSRLS`.
- Chaque route serveur vérifie : session valide, organisation, rôle, et pour un marié l'appartenance à l'événement. Jamais de contrôle uniquement côté client.
- Le rôle Admin (opérateur de la suite) n'a **aucun** accès aux données métier des organisations.

### Sécurité

- Toute entrée externe (API, formulaire, webhook, fichier importé) est validée par Zod.
- Webhooks entrants : signature vérifiée, sinon rejet et journalisation.
- Fichiers : type vérifié par le contenu, taille limitée, antivirus, stockage privé, lien signé temporaire.
- Import CSV/Excel : neutraliser les cellules commençant par `=`, `+`, `-`, `@`.
- En-têtes : CSP stricte, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`.
- Secrets : uniquement via variables d'environnement validées au démarrage ; `.env*` jamais commités (sauf `.env.example` sans valeur).
- Logs : jamais de donnée personnelle en clair (pas d'e-mail, nom, téléphone) ; utiliser des identifiants.

### Données

- Montants : entiers en centimes, devise EUR explicite. Jamais de `float` pour l'argent.
- Dates : stockées en UTC (`timestamptz`), affichées en `Europe/Paris` ; dates sans heure en `date`.
- Factures : numérotation continue sans trou par série et par organisation, attribuée en transaction ; une facture émise est immuable (correction par avoir).
- Chaque migration est réversible et ne touche que la base de son app.

### Événements internes (`domain_events`, ADR 0014)

- Nom : `<module>.<entité>.<action>` au passé, ex. `quotes.quote.signed`, `events.event.confirmed`.
- Chaque événement a un schéma versionné dans `packages/contracts`, un `organization_id`, un identifiant unique et une date — mêmes conventions que les futurs événements NATS, pour que la bascule ne touche que le transport.
- Publication : insertion dans `domain_events` au sein de la même transaction que l'écriture métier (outbox). Un worker interne consomme et appelle les gestionnaires, de façon idempotente.

## 6. Tests

- Chaque story du PRD a un fichier de tests dont les `describe` portent l'identifiant : `describe('EVT-03 — Statut des postes prestataires', ...)`. Chaque critère Étant donné / Quand / Alors = un `it`.
- Écrire d'abord les tests à partir des critères, les voir échouer, puis implémenter.
- Tests d'isolation obligatoires pour toute nouvelle table ou route (helpers dans `packages/testing`) : organisation A ne lit ni ne modifie B ; un marié n'accède qu'à son événement ; l'Admin n'accède à aucune donnée métier.
- Les règles de dates (échéances, purge RGPD, rétroplanning) sont testées avec une horloge simulée, cas limites inclus (veille, jour même, passage à l'heure d'été).
- Playwright couvre au moins un parcours par story en taille ordinateur et en 375 px.

## 7. Définition de « terminé »

Une story est terminée quand :

1. Tous ses critères d'acceptation passent en tests automatisés.
2. Les tests d'isolation passent.
3. La CI est verte, sans alerte critique de sécurité.
4. Les textes existent en FR et EN.
5. Tout champ personnel nouveau est déclaré dans `privacy.registry.yaml`.
6. L'écran fonctionne en 375 px et sur ordinateur, et passe axe-core.
7. Aucune liste, aucun modèle ni aucune règle fiscale n'est en dur.
8. Le module a sa visite guidée, son essai avec données de test et ses articles d'aide.
9. La documentation concernée est à jour.

## 8. Méthode de travail

- Un lot = une branche `lot-<n>-<nom>` et une pull request. Jamais de commit direct sur `main`.
- Commits petits et explicites (Conventional Commits, en français) : `feat(events): EVT-03 statut des postes`.
- Avant de coder une story : relire ses critères dans le PRD, lister les fichiers touchés, signaler toute ambiguïté.
- Après chaque story : lancer lint, typecheck, tests ; résumer ce qui a été fait et ce qui reste.
- Toute décision structurante (nouvelle dépendance, nouveau pattern, changement de contrat) = un ADR dans `docs/adr/`.

**Demande toujours avant** : d'ajouter une dépendance hors stack ; de modifier un contrat d'API ou d'événement de façon incompatible ; de toucher la base d'une autre app ; d'agir sur un serveur réel (staging, production), un secret ou un DNS ; de supprimer des données ou des fichiers hors de ton périmètre.

## 9. Commandes

Julien travaille sans toolchain Node/Python natif sur son Mac ; toutes les commandes tournent
dans Docker Desktop. Les commandes `pnpm` ci-dessous sont celles que Claude Code utilise en
interne (Node est disponible dans cet environnement de développement) ; Julien passe par
l'équivalent Docker donné à droite.

| Besoin | Commande (si Node est disponible) | Équivalent Docker (poste de Julien) |
| --- | --- | --- |
| Installer les dépendances | `pnpm install` | `docker run --rm -v "$PWD":/app -w /app node:22-slim corepack enable && corepack use pnpm@9.15.0 && pnpm install` |
| Démarrer le socle + l'app en dev | `pnpm dev` | `cp .env.example .env` (une fois, puis remplir les mots de passe) puis `docker compose -f infra/compose/docker-compose.dev.yml --env-file .env up -d && pnpm dev`, depuis la racine du dépôt |
| Lint | `pnpm lint` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm lint` |
| Vérification des types | `pnpm typecheck` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm typecheck` |
| Tests | `pnpm test` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm test` |
| Contrôle des frontières de modules (ADR 0011) | `pnpm check:boundaries` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm check:boundaries` |
| Créer/mettre à jour le rôle applicatif PostgreSQL (une fois par base, SOC-05) | `pnpm --filter @symbola/db bootstrap` | `docker run --rm --network symbola-dev_default -v "$PWD":/app -w /app --env-file .env node:22-slim pnpm --filter @symbola/db bootstrap` |
| Appliquer les migrations de base (après le bootstrap, SOC-05) | `pnpm --filter @symbola/db migrate` | `docker run --rm --network symbola-dev_default -v "$PWD":/app -w /app --env-file .env node:22-slim pnpm --filter @symbola/db migrate` |
| Tests d'isolation RLS réels (SOC-05, nécessite le socle démarré + bootstrap + migrate) | `pnpm --filter @symbola/db test:integration` | `docker run --rm --network symbola-dev_default -v "$PWD":/app -w /app --env-file .env node:22-slim pnpm --filter @symbola/db test:integration` |
| Lancer le socle en local seul | — | `docker compose -f infra/compose/docker-compose.dev.yml --env-file .env up` |
| Vérifier les scripts serveur (SOC-10, SOC-12) | `shellcheck -x infra/server/*.sh infra/backup/*.sh` | `docker run --rm -v "$PWD/infra":/mnt:ro -w /mnt koalaman/shellcheck:stable -x server/check-hardening.sh backup/backup.sh backup/restore.sh backup/lib.sh` |
| Tests des sauvegardes et des configurations de déploiement (SOC-09 à SOC-12) | `pnpm --filter @symbola/tools-deployment-config test` | `docker run --rm -v "$PWD":/app -w /app node:22-slim pnpm --filter @symbola/tools-deployment-config test` |
| Sauvegarder un environnement à la main (SOC-10, **Julien, sur le VPS**) | — | `sudo systemctl start symbola-backup@staging.service` (voir `docs/runbooks/restauration.md`) |
| Restaurer un environnement (SOC-10, **Julien, sur le VPS**, destructif) | — | `sudo /opt/symbola/infra/backup/restore.sh staging --confirm=staging` |
| Vérifier le durcissement du VPS (SOC-12, **Julien, sur le VPS**) | — | `sudo bash infra/server/check-hardening.sh` (lecture seule, voir `docs/runbooks/durcissement-serveur.md`) |

Le socle de dev (Postgres, Garage, ClamAV, Mailpit, Traefik) est défini dans
`infra/compose/docker-compose.dev.yml` (SOC-03) ; les variables d'environnement sont validées par
Zod au démarrage de l'app (`packages/env`, voir `.env.example`). `pnpm dev` démarre l'app ; le
socle se lance à part tant qu'ils ne sont pas encore orchestrés en une seule commande (prévu avant
la fin du lot si le temps le permet, sinon noté comme limite connue). Cette section se complète à
chaque story qui ajoute une commande (migrations, build des images, déploiement — SOC-05 à SOC-12).