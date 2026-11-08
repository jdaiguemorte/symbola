# ADR 0043 — Une réserve de connexions par processus ; une garde d'accès par écran

- Statut : accepté
- Date : 2026-11-08
- Précise : [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md) (base unique, RLS),
  [0013](0013-auth-maison-pour-le-mvp.md) (authentification maison) et
  [0035](0035-traitements-de-fond-suivis-des-imports.md) (traitements de fond des imports)
- Story : ARC-01 (lot 16, spécification `docs/lots/lot-16-reprise-ux.md`)

## Contexte

Audit du 08/11/2026 (`docs/audits/2026-11-08-audit-complet.md`, R1, R2 et R6).

- **R1** : chaque page, action ou traitement ouvrait sa propre réserve `postgres()` puis la
  fermait (`createAppConnection()` puis `sql.end()`, 315 appels dans 152 fichiers). Chaque
  requête payait l'ouverture et l'authentification d'une connexion. Sous charge, on approchait
  vite `max_connections` (100).
- **R2** : le contrôle de session de 4 à 5 lignes était recopié dans chaque page. Un oubli sur
  un nouvel écran l'ouvrait sans contrôle de rôle : la RLS protège les données, pas l'écran.
- **R6** : le module témoin `hello` du lot 0 restait branché sur l'accueil (« Bonjour depuis
  Symbola »).
- Le traitement de fond des imports (ADR 0035) visitait toutes les organisations à chaque
  passage, chaque seconde.

## Décision

### Une réserve de connexions par processus

- `packages/db` expose `appDatabase()` : une seule réserve par processus, de 10 connexions.
  Une connexion inutilisée est rendue au bout de 30 secondes.
  - La réserve est rangée sur `globalThis`. Next.js peut charger le module plusieurs fois
    (rechargement à chaud, paquets serveur distincts), et une seule réserve doit en résulter.
  - Le code de l'app ne la ferme jamais. `closeAppDatabase()` sert aux fins de fichiers de
    tests.
- **Le partage est sûr.** Le contexte RLS est fixé par
  `set_config('app.organization_id', …, true)`, donc limité à la transaction de
  `withOrganization`. Les autres réglages (`SET LOCAL`, `pg_advisory_xact_lock`) sont eux aussi
  limités à la transaction. Le dépôt n'a aucun réglage de session.
  - `packages/db/src/shared-pool.integration.test.ts` le vérifie : le contexte ne survit pas à
    sa transaction, et des transactions simultanées de 15 organisations ne voient chacune que
    leurs lignes.
- `createAppConnection()` reste pour les scripts (comptes, migrations, secrets) et pour les
  tests, qui ouvrent leur propre connexion et la ferment eux-mêmes.
- **Remplacement mécanique**, par un script sur l'arbre syntaxique. Il ne touchait que la
  forme `const { sql, db } = createAppConnection(); … try { … } finally { await sql.end(); }`,
  et les `try` sans autre rôle ont disparu. `lib/architecture.test.ts` vérifie que le code de
  l'app n'ouvre plus de connexion à lui.
- **Transactions imbriquées.** Une transaction qui en ouvrirait une autre en attendant pourrait
  épuiser une réserve commune. Vérification faite une fois : réserve ramenée à une seule
  connexion, les 349 tests d'intégration de l'app passent, sans aucun blocage.

### Une garde d'accès par écran

`lib/guards.ts` réunit les gardes. Chacune renvoie la personne connectée ou redirige.

| Garde | Écrans | Redirections |
| --- | --- | --- |
| `requireSignedIn()` | accueil, profil, centre d'aide | connexion, double authentification |
| `requirePlanner()` | écrans de la planner | marié vers son espace, Admin vers l'accueil |
| `requireOwner()` | module RGPD | comme `requirePlanner()` ; un collaborateur reçoit `null`, et l'écran lui explique qu'il n'y a pas accès |
| `requireClient()` | espace du marié | les autres rôles vers l'accueil |
| `requireAdmin()` | console Admin | anciennement `lib/require-admin.ts` |

- `requirePlanner()` renvoie le même objet `{ status, user }` qu'avant, avec `organizationId`
  garanti. Le reste de chaque page n'a pas changé : les blocs recopiés sont devenus une ligne.
  Les accès communs d'une rubrique (`importStepContext`, `vendorSettingsAccess`) appellent la
  garde eux-mêmes.
- **Contrôle automatique** (`lib/guards.test.ts`) :
  - chaque `page.tsx` appelle une garde, sauf la liste des écrans publics, chacun avec son
    motif : connexion, double authentification en cours, jetons d'invitation, de
    réinitialisation ou de signature fictive, simple redirection ;
  - plus aucune page ne recopie le contrôle de session.
- Les actions serveur gardent leur contrôle, qui répond par un message d'erreur au lieu de
  rediriger.

### Module témoin `hello` retiré

- Retirés : le module de l'app, ses contrats (`packages/contracts/src/hello`), sa clé de
  module, ses textes, sa participation à la recherche RGPD et la salutation de l'accueil.
- Les tests qui passaient par lui reposent sur un autre module :
  - HUB-03-03 désactive le module Événements ;
  - les tests d'activation désactivent le module Budget.
- La couverture des envois de fichiers (SOC-08) et des événements internes (SOC-06) reste
  dans `packages/files` et `packages/db`.
- **Gardée** : la table `hello.greetings`, témoin des tests d'isolation RLS de `packages/db`
  (inchangés). La supprimer demanderait une migration qui efface des données, et la réécriture
  de ces tests sur une table métier : décision laissée à Julien.
  - Mise à jour du 08/11/2026 : Julien a décidé de la supprimer (migration 0079, ADR 0045).
- Les boutons d'activation de la console Admin nomment désormais le module dans la langue de
  l'écran (« Événements : activé (désactiver) ») au lieu de sa clé technique.

### Traitement de fond des imports ciblé

- Une organisation est signalée au traitement de fond du même processus quand un traitement
  est créé ou relancé, une fois sa transaction validée. Elle l'est aussi quand son traitement
  reste inachevé à la fin d'un passage.
- Un passage ne visite que les organisations signalées.
- Un tour complet a lieu au démarrage du serveur, pour reprendre un traitement interrompu, puis
  toutes les 5 minutes, en filet de sécurité (`lib/import-jobs.test.ts`).
- Aucune migration : l'ensemble vit en mémoire, comme le traitement, et le tour complet couvre
  un redémarrage.

## Conséquences

- Une page ne paie plus l'ouverture d'une connexion. Chaque environnement tient au plus
  10 connexions applicatives, plus celles des traitements ponctuels.
- **Règle pour la suite** : ne pas appeler, depuis l'intérieur d'une transaction ouverte, un
  service qui ouvre la sienne et l'attendre. Ce motif n'existe pas aujourd'hui, mais sous
  charge, avec une réserve commune, il pourrait tout bloquer.
- Un nouvel écran sans garde fait échouer `lib/guards.test.ts`. Un écran public s'ajoute
  explicitement à la liste, avec son motif.
- Si l'app tourne un jour dans plusieurs processus, un traitement créé dans l'un est repris
  par l'autre au plus tard au tour complet suivant (5 minutes). Le signal passerait alors par
  la base, par exemple une table ou un `LISTEN/NOTIFY`.
- Bascule vers l'architecture cible (une app par module) : chaque app aura sa propre réserve,
  par le même `appDatabase()`.
