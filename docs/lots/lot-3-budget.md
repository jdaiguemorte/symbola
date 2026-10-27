# Lot 3 — Budget

Une PR par story (`lot-3-bud-0x-<nom>`), tests d'abord à partir des critères ci-dessous
(`describe('BUD-0x — ...')`), tests d'isolation obligatoires pour chaque nouvelle table.
Commits en français (Conventional Commits), confirmation de Julien avant chaque `git push`.

Le budget suit les dépenses des clients auprès des prestataires, poste par poste : prévu, réel,
écart. Il commence dès le prospect, par une simulation (BUD-01), devient le budget réel à la
confirmation de l'événement (BUD-02), peut recevoir un devis prestataire en pièce jointe
(BUD-03), et le marié le consulte en lecture seule (BUD-04).

## Décisions prises avec Julien avant de coder

1. **Les « postes » du budget sont les mêmes postes prestataires que ceux du module Events**
   (EVT-03, `default_vendor_slots`, paramétrables par organisation) — pas de liste séparée.
   Cohérent avec BUD-02 : « le réel se remplit automatiquement quand un poste est réservé avec
   un montant (EVT-03) ».
2. **Le bandeau « proposer de faire le budget prévu »** (BUD-01, événement confirmé) vit sur la
   fiche événement existante (`/events/[id]`), pas sur une page Budget séparée — la planner le
   voit sans avoir à chercher l'onglet Budget.

## Frontière de module (ADR 0011) — un point d'attention

`budget.*` référence des postes qui appartiennent au module `events` (`default_vendor_slots`).
**Aucune clé étrangère PostgreSQL ne traverse les schémas** : `defaultVendorSlotId` est stocké
comme un `uuid` opaque dans `budget`, jamais contraint par une FK vers `events.default_vendor_slots`
(une FK inter-schéma serait un couplage direct aux données internes d'un autre module, interdit
par CLAUDE.md §2.2). La validité d'un `defaultVendorSlotId` est vérifiée à la couche service, en
appelant `eventsService.listDefaultVendorSlots(organizationId)` — jamais en lisant la table
`events` directement. Si un poste par défaut est supprimé côté Events après avoir été utilisé en
Budget, les lignes budget existantes gardent leur `defaultVendorSlotId` (donnée historique) mais
n'apparaissent plus dans les nouveaux choix de poste.

**Extension de contrat nécessaire (additive, pas de rupture)** : `EventsServiceContract` doit
exposer `hasActiveClientAccess(organizationId, userId, eventId): Promise<boolean>` — aujourd'hui
utilisé seulement en interne par `modules/events/service.ts` (`getClientEventView`). Budget en a
besoin pour BUD-04 (vérifier qu'un compte marié a bien accès à l'événement avant de lui montrer
son budget en lecture seule, et pour refuser toute tentative de modification). C'est un ajout,
pas une modification incompatible — mais à signaler explicitement dans la PR qui la fait.

## Modèle de données (`packages/db/src/schema/budget.ts`, schéma `budget`)

Toutes les tables ont `organization_id`, RLS activée (policy `organization_isolation`, pattern du
module `hello`), migration « grant » dédiée. Montants toujours en centimes entiers EUR
(CLAUDE.md §5) ; pourcentages toujours en points de base entiers (`percentage_basis_points`,
0 à 10000 = 0,00 % à 100,00 %), jamais de `float`.

- **`allocation_models`** : `id`, `organization_id`, `name`, `created_at`. Modèles de répartition
  gérés par la planner (BUD-01).
- **`allocation_model_items`** : `id`, `organization_id`, `model_id` (FK interne au schéma
  `budget`), `default_vendor_slot_id` (uuid opaque, voir ci-dessus), `percentage_basis_points`.
  Un modèle dont la somme des items ne fait pas 10000 est refusé à l'enregistrement — validation
  dans une fonction pure testable sans base (`modules/budget/allocation.ts`, même esprit que
  `modules/events/schedule.ts`), pas seulement côté UI.
- **`event_budgets`** : `id`, `organization_id`, `event_id` (uuid opaque, un seul par événement),
  `total_amount_cents`, `guest_count`, `allocation_model_id` (nullable), `created_at`,
  `updated_at`. La simulation du prospect (BUD-01).
- **`event_budget_items`** : `id`, `organization_id`, `event_budget_id`, `default_vendor_slot_id`
  (uuid opaque), `amount_cents`, `created_at`, `updated_at`. Un montant par poste pour la
  simulation en cours — recalculé quand le modèle ou le total change, ajustable à la main poste
  par poste (le total et le reste à répartir se recalculent côté serveur à chaque changement,
  jamais seulement côté client).
- **`budget_lines`** : `id`, `organization_id`, `event_id` (uuid opaque), `event_vendor_slot_id`
  (uuid opaque — **pas** `default_vendor_slot_id` : `events.event_vendor_slots` (EVT-03) n'a
  aucune référence aux postes par défaut, seulement un `label` texte ; `events.vendor_slot.booked`
  publie l'id du poste de l'événement, pas celui d'un poste par défaut), `planned_amount_cents`,
  `actual_amount_cents` (nullable), `created_at`, `updated_at`. Le budget réel (BUD-02). Créées en
  rapprochant par `label` chaque `event_budget_items` (simulation, clé sur `default_vendor_slot_id`)
  avec le poste de l'événement correspondant (`eventsService.listEventVendorSlots`), quand la
  planner accepte la proposition « en faire le budget prévu » ; refusé si un poste de la
  simulation n'a plus de correspondance par label dans les postes de l'événement (renommé ou
  supprimé entre-temps). Une ligne peut aussi être créée/éditée directement sans simulation
  préalable. L'écart (réel moins prévu, en euros et en pourcentage) est **calculé à la lecture,
  jamais stocké**.
- **`budget_line_history`** : `id`, `organization_id`, `line_id`, `field` (`planned` ou
  `actual`), `old_value_cents` (nullable), `new_value_cents`, `changed_by_user_id`, `changed_at`.
  Chaque modification de `planned_amount_cents`/`actual_amount_cents` est historisée (BUD-02).
- **`budget_line_attachments`** : `id`, `organization_id`, `line_id`, `file_key`, `mime`,
  `size_bytes`, `uploaded_by_user_id`, `created_at`. Le devis prestataire joint (BUD-03), via
  `@symbola/files` (déjà prêt pour BUD-03 d'après son commentaire d'origine : type vérifié par le
  contenu, PDF/image, antivirus, stockage privé, lien signé temporaire — aucun changement
  nécessaire dans `packages/files`). Taille maximale 20 Mo (valeur « proposée » du PRD, acceptée
  telle quelle).

## Stories et critères d'acceptation

### BUD-01 — Simulation pour un prospect

- Modèles de répartition par organisation (`allocation_models`/`allocation_model_items`), CRUD
  sur `/budget/parametres`. Un modèle dont le total des pourcentages n'est pas 10000 points de
  base est refusé à l'enregistrement, avec un message d'erreur clair (pas seulement une alerte
  visuelle : le serveur refuse réellement l'écriture).
- Sur `/budget/[eventId]` (nouvelle route) : saisie du budget total et du nombre d'invités, choix
  d'un modèle → montant par poste (calculé depuis les pourcentages) et coût par invité
  (`total / guestCount`, calculé, jamais stocké).
- Ajustement d'un poste à la main : le total et le reste à répartir (`total - somme des postes`)
  se recalculent aussitôt, côté serveur (Server Action), affichés sans rechargement complet si
  possible, sinon via un `<form>` classique (cohérent avec le reste de l'app, pas de framework
  JS supplémentaire).
- La simulation est liée à l'événement (`event_budgets`/`event_budget_items`), pas seulement en
  mémoire : elle survit à une navigation ou une reconnexion.
- Sur `/events/[id]`, quand `status === "confirmed"` et qu'une simulation existe mais qu'aucune
  `budget_lines` n'existe encore pour cet événement, un bandeau propose d'« en faire le budget
  prévu » ; accepter rapproche par `label` chaque `event_budget_items` avec le poste de
  l'événement correspondant, puis crée les `budget_lines` (voir BUD-02 ci-dessous).

### BUD-02 — Prévu, réel, écart

- Tableau sur `/budget/[eventId]` : poste, prévu, réel, écart (réel moins prévu) en euros et en
  pourcentage du prévu. Dépassement en rouge, économie en vert (texte ou classe, pas seulement
  une couleur seule — accessibilité, axe-core).
- Totaux en haut et en bas du tableau (prévu total, réel total, écart total).
- Modification de `actual_amount_cents` à la main (Server Action), ou automatique : quand
  `modules/events` publie `events.vendor_slot.booked` (déjà émis depuis le lot 2, payload en
  centimes — voir la passation précédente) pour le poste correspondant, le worker de
  `packages/db/src/events/worker.ts` (actuellement non câblé dans l'app qui tourne — écart
  pré-existant signalé au lot 2) devra l'alimenter. **Tant que ce worker n'est pas réellement
  invoqué en continu**, cette partie automatique du critère n'est pas vérifiable en conditions
  réelles : à couvrir par un test d'intégration qui appelle directement le gestionnaire
  d'événement, et à signaler à Julien comme limite connue (même nature que le point 2 des limites
  du lot 2 passées en revue).
- Chaque modification de `planned_amount_cents`/`actual_amount_cents` écrit une ligne dans
  `budget_line_history` (ancienne valeur, nouvelle valeur, auteur, date) — testé par un test
  d'intégration dédié, pas seulement vérifié visuellement.

### BUD-03 — Devis prestataire joint

- Sur chaque ligne du tableau, un formulaire d'envoi de fichier (PDF ou image, 20 Mo maximum) via
  `uploadFile` de `@symbola/files` — mêmes règles que `modules/hello` (type par le contenu,
  antivirus ClamAV, stockage privé). Rejet avec message clair si infecté ou format non supporté.
- Le fichier s'ouvre par un lien signé temporaire (`getSignedDownloadUrl`), jamais une URL
  publique permanente.

### BUD-04 — Budget visible par les mariés

- Le budget apparaît dans `/espace/[id]` (existant, module events) en lecture seule. Le schéma
  `budget` ci-dessus ne prévoit aucun champ de note interne sur une ligne (contrairement au
  programme du jour J, EVT-05) : rien à masquer côté marié au-delà des colonnes déjà publiques
  (poste, prévu, réel, écart).
- Le marié ne peut jamais modifier une ligne, y compris par appel direct à l'API/Server Action :
  chaque Server Action d'écriture de `modules/budget` vérifie `getPlannerAuthContext()` (jamais
  `getClientAuthContext()`), donc un compte marié reçoit `forbidden` avant toute écriture — test
  automatisé obligatoire (un compte marié qui appelle directement l'action de modification doit
  être refusé, pas seulement l'UI qui la cache).
- La lecture passe par `eventsService.hasActiveClientAccess(organizationId, userId, eventId)`
  avant de renvoyer la moindre donnée budget.

## Écrans (`apps/symbola/app/`)

- `/budget/[eventId]` : simulation (BUD-01) et tableau prévu/réel/écart (BUD-02) sur une seule
  page, section par section — pas de sous-navigation supplémentaire pour un seul événement.
- `/budget/parametres` : CRUD des modèles de répartition.
- Bandeau sur `/events/[id]` (import de `budget/service.ts` depuis la page, pas depuis
  `modules/events/`) pour la proposition « en faire le budget prévu ».
- Section budget ajoutée à `/espace/[id]` (lecture seule, import de `budget/service.ts` depuis la
  page comme pour `/events/[id]`).

## Suite après le lot 3

Lot 4 — Devis et Facturation (DEV-01 à DEV-04) : le budget confirmé devient la base du devis, et
`BUD-03` préfigure l'envoi de fichiers réutilisé pour les devis/factures.
