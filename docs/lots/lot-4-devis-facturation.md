# Lot 4 — Devis et Facturation

Une PR par story (`lot-4-dev-0x-<nom>`), tests d'abord à partir des critères ci-dessous
(`describe('DEV-0x — ...')`), tests d'isolation obligatoires pour chaque nouvelle table et
chaque route. Commits en français (Conventional Commits), confirmation de Julien avant chaque
`git push`. Ordre de construction (PRD §11) : **DEV-01, DEV-03, DEV-02, DEV-04**, puis le bloc
« Encaissements à venir » du tableau de bord, puis la visite guidée et l'essai du module.

Ce module fait rentrer l'argent : devis issus du catalogue, signature en ligne, échéancier
d'acomptes, factures conformes. **Les règles légales de facturation sont des exigences, pas des
options** (PRD §6, ADR 0010) — et elles restent **à faire valider par le comptable de la planner
avant la mise en production**.

## Décisions prises avec Julien avant de coder (27/10/2026)

1. **Factur-X reporté après le pilote.** Au lot 4 : factures PDF classiques (les clients du pilote
   sont des particuliers, les mariés) et export des données d'e-reporting. Le format Factur-X
   (PDF/A-3 + XML CII embarqué) pour un client professionnel fera l'objet d'un lot dédié, **avant
   le 1er septembre 2027**, avec un validateur dans la CI (veraPDF ou Mustang) — sans lui, la
   conformité PDF/A-3 ne serait pas vérifiable. Le modèle de données le prévoit déjà (type de
   client, champs acheteur).
2. **Signature : interface + adaptateur DocuSeal + Compose.** Interface `SignatureProvider`
   (ADR 0006), adaptateur DocuSeal réel (API + webhook), faux fournisseur pour les tests et
   l'essai guidé, conteneur DocuSeal ajouté au socle Docker Compose (dev, staging, prod). Le
   démarrage sur le VPS, le sous-domaine public de la page de signature et son DNS restent des
   **actions de Julien** (CLAUDE.md §8).
3. **Numérotation par année, par défaut** : `D-2027-0001` (devis), `F-2027-0001` (factures),
   `A-2027-0001` (avoirs), compteur remis à 1 chaque 1er janvier (heure de Paris) ; l'année fait
   partie du numéro, la suite reste continue et sans trou. Préfixes et format **paramétrables par
   organisation** (CLAUDE.md §2.5). Série `DEMO-…` séparée pour l'essai guidé (ADR 0008), qui ne
   consomme jamais la série légale.
4. **Un devis est toujours rattaché à un événement au MVP** (le pilote a le module Événements).
   Le « dossier local » prévu par le PRD quand Événements n'est pas souscrit viendra avec un
   second client : le module Devis se masque alors proprement (dégradation, CLAUDE.md §2.3).

## Points à valider avec Julien (signalés, pas tranchés)

- **E-mail des signataires** : `events.event_clients` n'a ni e-mail ni adresse ; les accès
  mariés (EVT-06) ont un e-mail, mais pas forcément pour chaque marié. Proposition : l'e-mail et
  l'adresse de facturation de chaque signataire se saisissent **sur le devis** (copie figée dans
  le module Devis, déclarée dans `privacy.registry.yaml`), pré-remplis depuis les accès mariés
  quand ils existent.
- **Webhook DocuSeal** : le PRD exige une « signature cryptographique ». À vérifier sur la version
  de DocuSeal déployée : si elle n'envoie qu'un en-tête secret partagé (et non un HMAC du corps),
  on compare cet en-tête en temps constant **et** on relit le statut de la soumission par l'API
  DocuSeal avant d'agir — à acter dans un ADR à la PR DEV-02.
- **Base de DocuSeal** : sa propre base (jamais le schéma d'un module Symbola, CLAUDE.md §5),
  sur le même PostgreSQL du socle ou en SQLite dans son volume — à choisir à la PR DEV-02.
- **Mentions légales d'une facture à un particulier** (liste de départ ci-dessous, données
  paramétrables) : à relire par le comptable.
- **E-reporting** : période (bimestrielle en franchise selon le PRD), contenu et format de
  l'export (CSV proposé) à confirmer avec le comptable ; seule la production du fichier est au
  lot 4 (pas de transmission automatique, aucune API connue chez HBS e-factures).

## Frontières de module (ADR 0011)

- Nouveau module `apps/symbola/modules/quotes/` (schéma PostgreSQL `quotes`), porte d'entrée
  `service.ts`, contrat `packages/contracts/src/quotes/service-contract.ts` vérifié par
  `_contractCheck`.
- **Aucune clé étrangère vers un autre schéma** : `event_id`, les clients (`event_client_id`) et
  l'organisation sont des uuid opaques, validés à la couche service via
  `eventsService.getEvent` / `listEvents`. Régime de TVA, mentions, SIREN, adresse, logo : lus
  via le service du hub (`getOrganizationProfile`, `computeLegalMention`, `getDocumentHeader`) et
  **copiés dans le document au moment de son émission** (un document émis ne change jamais quand
  le profil change — ONB-02).
- Signature → événement confirmé (DEV-02) : le module Devis appelle
  `eventsService.changeEventStatus` dans la même opération que le passage du devis à « Signé »,
  et publie `quotes.quote.signed` dans `domain_events` (outbox, schéma versionné dans
  `packages/contracts`). Le worker continu n'étant toujours pas câblé (limite connue des lots 2
  et 3), l'appel direct au service est ce qui fait foi ; l'événement interne prépare la bascule.
- Essai guidé : `lib/demo-purge.ts` doit purger aussi les données du module Devis d'un
  événement fictif (ADR 0008), avant la suppression de l'événement.

## Modèle de données (`packages/db/src/schema/quotes.ts`, schéma `quotes`)

Toutes les tables ont `organization_id`, RLS forcée (policy `organization_isolation`),
migration « grant » dédiée. Montants en **centimes entiers EUR** ; taux de TVA et remises en
**points de base entiers** (2000 = 20,00 %) ; quantités en **millièmes entiers**
(`quantity_milli`, 1500 = 1,5) — jamais de `float` (CLAUDE.md §5). Les arrondis (TVA par ligne,
remise) sont des fonctions pures testées (`modules/quotes/amounts.ts`), arrondi au centime le
plus proche, demi vers le haut.

- **`catalog_items`** (DEV-01) : `label`, `description`, `unit`, `unit_price_cents` (HT),
  `vat_rate_basis_points`, `category`, `archived_at` (un article utilisé n'est jamais supprimé,
  seulement archivé). Modèle de départ facultatif dans `packages/starter-templates`.
- **`number_series`** : `kind` (`quote`, `invoice`, `credit_note`), `is_demo`, `prefix`, `format`,
  `year`, `last_number`. Attribution **en transaction** (`SELECT … FOR UPDATE` puis incrément),
  dans la même transaction que l'écriture du document : un échec annule aussi le numéro, donc
  **aucun trou**. Test de concurrence obligatoire (N émissions parallèles → N numéros consécutifs,
  aucun doublon, aucun trou).
- **`quotes`** : `event_id`, `number`, `status` (`draft`, `sent`, `signed`, `declined`,
  `expired`), `current_version`, `is_demo`.
- **`quote_versions`** : `quote_id`, `version` (1, 2, 3…), `valid_until` (date, 30 jours par
  défaut, paramétrable), `global_discount_basis_points` ou `global_discount_cents`, copies figées
  à l'envoi (`vat_regime`, `legal_mention`, en-tête vendeur, totaux HT/TVA/TTC), `sent_at`.
  **Une version envoyée est immuable** ; modifier un devis envoyé crée la version suivante, les
  précédentes restent consultables (DEV-01).
- **`quote_lines`** : `version_id`, `catalog_item_id` (nullable : ligne libre), `label`,
  `description`, `unit`, `quantity_milli`, `unit_price_cents`, `vat_rate_basis_points`,
  `discount_basis_points`, `position`.
- **`quote_signers`** : `version_id`, `event_client_id` (opaque), `name`, `email`,
  `billing_address`, `status`, `signed_at`.
- **`signature_requests`** (DEV-02) : `version_id`, `provider`, `external_id`, `status`,
  `signed_document_key`, `audit_certificate_key` (stockage privé `@symbola/files`).
- **`signature_webhook_log`** : réception de chaque appel webhook (accepté ou rejeté, motif,
  sans donnée personnelle), pour la journalisation exigée par le PRD.
- **`payment_schedule_items`** (DEV-03) : `version_id`, `label`, `amount_cents` ou
  `percentage_basis_points`, `due_date`, `paid_at`, `paid_on` (date), `payment_method` (liste
  paramétrable), `position`. Le solde est **calculé**, jamais stocké ; somme des acomptes >
  total → refus (fonction pure + contrôle serveur).
- **`invoices`** (DEV-04) : `quote_id`, `schedule_item_id` (nullable), `kind` (`deposit`,
  `balance`), `number`, `issued_at`, copies figées vendeur/acheteur/lignes/totaux/mentions,
  `pdf_key`, `is_demo`. **Immuable une fois émise** : aucune mise à jour ni suppression permise
  par le rôle applicatif (trigger PostgreSQL qui refuse `UPDATE`/`DELETE`, testé), correction
  par avoir uniquement.
- **`credit_notes`** : `invoice_id`, `number` (série avoirs), `issued_at`, montants, motif,
  `pdf_key` — eux aussi immuables.

## Stories et critères d'acceptation (PRD §6, précisés)

### DEV-01 — Catalogue et composition d'un devis

- Catalogue par organisation (`/devis/catalogue`) : intitulé, description, unité, prix HT, taux
  de TVA, catégorie ; archivage plutôt que suppression d'un article déjà utilisé.
- Étant donné une planner **en franchise de TVA**, alors chaque devis (et facture) porte
  automatiquement « TVA non applicable, art. 293 B du CGI » et aucune TVA n'est calculée (taux
  ignorés, totaux HT = TTC) — mention issue de `computeLegalMention` du hub, jamais en dur dans le
  module.
- Étant donné un régime de TVA inconnu (questionnaire non terminé), quand elle veut envoyer un
  devis, alors l'app le lui demande à ce moment-là (ONB-01), sans bloquer la composition.
- Composition depuis la fiche d'un événement : articles du catalogue, quantités, descriptions
  ajustables, remise par ligne ou globale, lignes libres ; totaux HT, TVA par taux, TTC
  recalculés côté serveur.
- Numéro unique attribué **à la création** du devis (série devis), validité 30 jours (proposé,
  paramétrable). Modifier un devis envoyé crée V2, V3… ; les versions précédentes restent
  consultables et téléchargeables.
- PDF du devis (même patron que le programme, ADR 0019) : logo, coordonnées, SIREN, mentions,
  numéro et version, date de validité ; filigrane « Document fictif » pour un devis d'essai.
- ONB-02 : étant donné un devis non signé créé avant la date d'effet d'un changement de régime,
  alors l'app propose d'en faire une nouvelle version avec le nouveau régime.

### DEV-03 — Acomptes et encaissements à venir

- Échéancier dans le devis : montant ou pourcentage, date ; somme > total → refus ; solde
  calculé. Recalcul si le total de la version change.
- `/devis/encaissements` : échéances non payées triées par date, total par mois (heure de
  Paris).
- Marquer payée : date et mode de paiement (liste paramétrable, modèle de départ).
- Échéance dépassée et non payée : signalée « en retard » (texte + couleur, axe-core), et
  remontée au tableau de bord du hub (bloc Encaissements ci-dessous). Règles de dates testées
  avec une horloge simulée (veille, jour même, lendemain, passage à l'heure d'été).

### DEV-02 — Signature en ligne

- Envoi du devis (version courante figée) au fournisseur de signature ; chaque signataire reçoit
  son lien (e-mail envoyé par Symbola, pas par DocuSeal, cahier des charges §« Signature »).
- Webhook du fournisseur (`/api/webhooks/signature`) : appel **non authentifié valablement →
  rejet (401) et journalisation**, sans effet ; appel valide et idempotent (rejouer le même
  appel ne change rien de plus).
- Quand le dernier signataire a signé : devis « Signé », PDF signé et certificat de preuve
  archivés (stockage privé, lien signé), e-mail à la planner, **événement passé à Confirmé**
  (EVT-02), `quotes.quote.signed` publié.
- Test obligatoire : le faux fournisseur remplace DocuSeal sans changer le module Devis (même
  suite de tests contre les deux implémentations, l'adaptateur DocuSeal testé contre un serveur
  HTTP simulé).
- Le marié voit dans son espace (`/espace/[id]`) le devis à signer et son lien (PRD EVT-06), via
  le contrôle d'accès existant (`hasActiveClientAccess`).

### DEV-04 — Factures conformes

- Depuis un devis signé : facture d'acompte (par échéance) ou de solde ; numéro de la série
  factures, continu et sans trou (test de concurrence) ; copies figées de tout ce qui figure sur
  la facture.
- Facture émise : ni modification ni suppression, y compris par appel direct à la base avec le
  rôle applicatif (trigger testé) ; correction par **avoir** (série à part), partiel ou total.
- Mentions de départ d'une facture à un particulier (données paramétrables, à relire par le
  comptable) : numéro, date d'émission, date de la prestation ou de l'acompte, identité du
  vendeur (nom, adresse, SIREN), nom et adresse de l'acheteur, désignation, quantités, prix
  unitaires HT, taux et montant de TVA (ou mention de franchise), totaux HT/TTC, acomptes déjà
  versés, échéance de paiement.
- Client particulier : facture PDF ; export e-reporting par période (`/devis/e-reporting`) :
  montants totaux et dates/montants des encaissements, **excluant toute donnée d'essai**.
- Client professionnel : **Factur-X reporté** (décision 1) ; le choix « professionnel » est
  enregistré mais l'émission est refusée avec un message clair tant que le lot dédié n'est pas
  fait.

### Bloc « Encaissements à venir » du tableau de bord (HUB-02)

- Acomptes non payés des 90 prochains jours (proposé, paramétrable) avec total par mois, et
  échéances en retard en tête. Bloc absent si le module Devis n'est pas souscrit ; « indisponible »
  s'il ne répond pas en 2 secondes, le reste de la page fonctionnant.

### Visite guidée et essai du module (AIDE-01/02)

- Visite guidée du module Devis (et du module Budget, encore manquante — lot 3).
- Essai guidé : devis fictif sur l'événement d'essai, série `DEMO`, faux fournisseur de
  signature (le marié fictif « signe » sans e-mail à un tiers), factures fictives en filigrane ;
  tout est purgé avec l'essai (`lib/demo-purge.ts`) ; test : aucune donnée démo dans les
  exports, l'e-reporting ni le tableau de bord.

## RGPD

Champs personnels nouveaux (à déclarer dans `privacy.registry.yaml` à la PR qui les crée) :
nom, e-mail et adresse de facturation des signataires, copies figées de l'acheteur sur les
factures. Le module implémente `privacy/v1`. **Conservation légale des factures** (10 ans,
code de commerce — à confirmer avec le comptable) : une demande d'oubli n'efface pas une facture
émise ; elle est signalée comme « conservation légale » dans le suivi RGPD.

## Écrans (`apps/symbola/app/`)

- `/devis/catalogue`, `/devis/parametres` (séries, validité par défaut, modes de paiement,
  mentions), `/devis/encaissements`, `/devis/e-reporting`.
- `/devis/[quoteId]` : composition, versions, échéancier, envoi en signature, factures et avoirs.
- Section « Devis » sur `/events/[id]` (import de `modules/quotes/service.ts` depuis la page).
- Section « Devis à signer » sur `/espace/[id]`.
- Toutes les routes et actions d'écriture : `getPlannerAuthContext()` ; webhook : authentifié par
  le fournisseur, jamais par la session.

## Nouvelles dépendances envisagées

Aucune pour DEV-01, DEV-03 et DEV-04 (PDF via `@react-pdf/renderer`, ADR 0019). DEV-02 : client
HTTP natif (`fetch`) pour l'API DocuSeal, pas de SDK. Image Docker `docuseal/docuseal` (version
exacte figée et notée dans l'ADR de la PR DEV-02). Factur-X (lot dédié) demandera probablement
`pdf-lib` et un validateur : à demander le moment venu.

## Après le lot 4

Lot 5 — Import (IMP-01 à 05), puis lot 6 — RGPD et recette (avec, avant la production : lot
Factur-X, validation du comptable, déploiement DocuSeal sur le VPS par Julien).
