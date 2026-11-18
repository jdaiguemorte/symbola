# Lot 43 — Proposition en page web, signer puis régler, relances, répartition par payeur

**Statut** : spécification proposée le 18/11/2026, **validée par Julien le 18/11/2026** : toutes les décisions retenues dans leur option recommandée (a), changements de schéma et élargissement de la contrainte des natures d'e-mails du `hub` compris (accord donné). Le lot change les
schémas `quotes` et `budget` (tables et colonnes) et la contrainte des natures d'e-mails du `hub`
(D10) : validation explicite requise (CLAUDE.md § 8). Aucune dépendance nouvelle.

Branche `lot-43-proposition-et-reglement`, partie de `main`. Aucune version intermédiaire n'est
déployée (gel des déploiements) : le lot se rejoue en local.

Ce lot avance **en parallèle des lots 45 et 51** : voir « Travail en parallèle » à la fin.

## Contexte

Le parcours **PAR-02** (P0, « Convertir ») va de la demande au contrat signé et à l'acompte
encaissé. Les lots 31 (devis complet, contrat, signature, rétractation), 44 (formulaire de
contact, pipeline) et 46 (rendez-vous) en ont posé l'essentiel. Il manque l'étape 5 : « Le
client reçoit une page de proposition. Il lit, choisit ses options, signe, paie l'acompte. Un seul
enchaînement, sur téléphone. »

Moment de vérité de PAR-02 : signer et payer tiennent en moins de trois minutes pour le client.
Scénario **SC-02** (étapes 4 à 8) : aperçu « vu par le client », Léa coche une option et signe sur
son téléphone, Maxime signe deux jours plus tard, l'acompte est réglé et Camille voit
l'encaissement.

**Décision de Julien du 18/11/2026 (Q21, ADR 0087)** : le règlement se fait **par virement au RIB
du planner**, sans prestataire de paiement ni carte. Dans tout ce lot, « payer » veut dire :
afficher le RIB, le montant et une **référence unique**, recueillir la déclaration du payeur, puis
laisser la planner confirmer l'encaissement.

Exigences du lot :

- **FAC-02** (P1) — Proposition commerciale en page web et en PDF ; le client y choisit ses
  options. *Critère* : le total suit les options cochées.
- **GC-01** (P1) — Signer et payer en un seul geste : proposition, signature et acompte dans le
  même enchaînement. *Critère* : le droit de rétractation et son information restent respectés
  (JUR-07). Lu avec l'ADR 0087 : signer **puis régler par virement**.
- **FAC-08** (P1, **Divergent**, ADR 0087) — Le règlement par virement : RIB, référence par
  échéance, déclaration du payeur, confirmation de la planner. Rapprochement manuel.
- **FAC-09** (P1) — Relances d'impayés réglables ; pénalités de retard paramétrées. *Critère* :
  une relance s'arrête dès l'encaissement.
- **FAC-15** (P1, rattachée à ce lot, D1) — Devis à durée de validité, versions successives,
  relance avant expiration. *Critère* : une version signée est figée.
- **SEC-16** (P1) — Action sensible depuis un lien (signer, voir le budget détaillé) : code à usage
  unique envoyé au contact. *Critère* : le code expire en dix minutes.
- **BUD-06** (P1) — Répartition par payeur : mariés, familles, entreprise. *Critère* : chaque
  payeur ne voit que sa part si le client le décide.
- **BUD-11** (P1) — Calendrier des sorties d'argent à venir pour le client. *Critère* : vue mois
  par mois.

## Ce qui existe aujourd'hui

- **Devis complet** (lot 31a) : sections, options cochées par le client dans son portail
  (`app/portail/client-quote-options.tsx`), total qui suit, figé dès que la signature commence ;
  validité en jours (`quote_settings.validity_days`) ; versions figées à l'envoi.
- **Contrat et signature** (lot 31b, ADR 0065) : signature combinée devis et contrat
  (Documenso, ADR 0026), dossier de preuve. **Canal de conclusion** obligatoire (établissement, à
  distance, hors établissement, foire ou salon), qui fixe le régime :
  - à distance : information précontractuelle complète, quatorze jours, formulaire type, bouton
    « commande avec obligation de paiement », exécution anticipée par une case distincte ;
  - hors établissement : exemplaire remis, **aucun paiement avant sept jours**.

  Réponse 1 de l'avocat (JUR-07).
- **Échéancier et factures** (lots 31c, 41) : acompte, intermédiaires, solde ; facture d'acompte
  émise à la signature ; Factur-X.
- **Déclaration de paiement** par le payeur et confirmation par la planner (POR-09) ; moyens de
  paiement de l'organisation (`quotes.payment_methods`).
- **Liens personnels** (ADR 0053) : client, payeur (catégories du budget partagées, POR-10) ;
  **code à usage unique par e-mail** à l'ouverture d'un lien (`link-otp.ts`, lot 26b). L'avenant
  de l'ADR 0053 liste déjà les actions sensibles : signer, payer, voir le budget détaillé.
- **Échéance dépassée signalée** à l'accueil de la planner (PRD DEV-03) ; pénalités de retard
  entre professionnels (lot 41, `late-penalty.json`).
- **Budget du client** (lot 28) : cinq montants, échéancier des prestataires (BUD-03), payeurs
  limités à leurs catégories.

## Une seule PR

Le lot tient en une PR. Il compte sept exigences, mais elles forment un seul parcours (PAR-02,
étapes 5 à 7) et deux écrans du portail (proposition, budget). S'il fallait couper, la coupure
naturelle serait A + B + C (proposition, signer puis régler, relances), puis D (payeurs et
calendrier) ; elle serait argumentée dans la PR.

## Partie A — La proposition en page web (FAC-02, FAC-15 ; D1 à D3)

- **Une page par version de devis envoyée**, ouverte par le lien du client
  (`/portail/proposition/<version>`). Elle tient sur téléphone, en une colonne, dans cet ordre :
  1. le mot d'accueil de la planner (texte du modèle, modifiable par devis) ;
  2. la présentation de l'organisation (identité, logo, couleurs : lot 38) ;
  3. les **sections du devis**, avec les **options à cocher**, et le **total qui suit** (règle du
     lot 31a, reprise telle quelle) ;
  4. l'échéancier (acompte, solde) et les conditions (acompte ou arrhes, barème d'annulation) ;
  5. la validité (« valable jusqu'au 12 janvier 2027 ») ;
  6. le bouton principal, « Accepter et signer », qui ouvre l'enchaînement de la partie B.
- **PDF** de la même proposition, généré côté serveur (`@react-pdf/renderer`), avec les options
  choisies, ou toutes les options si rien n'est choisi.
- **Modèle de proposition** (D2) : mot d'accueil, ordre des blocs, photos (documents de
  l'organisation). Il appartient aux données de l'organisation, par type d'évènement (HUB-21) ; le
  départ est dans `proposal-templates.json`, en français et en anglais.
- **Aperçu « vu par le client »** (UX-17, SC-02 étape 4) : la planner voit la page exacte, sans
  rien enregistrer (mécanisme du lot 27a).
- **Validité et relance** (FAC-15, D1) :
  - la page affiche la date d'expiration ;
  - à J-3 de l'expiration (réglage), un e-mail de relance part au client qui n'a ni signé ni
    refusé ;
  - une version expirée ne se signe plus et affiche « Proposition expirée : contactez <planner> » ;
  - la planner prolonge ou envoie une nouvelle version ;
  - une version signée est figée (règle existante) ; les versions successives restent lisibles.

## Partie B — Signer puis régler, en un enchaînement (GC-01, FAC-08, SEC-16, JUR-07 ; D4 à D6)

- **L'enchaînement**, sur téléphone :
  1. **options** (si elles ne sont pas déjà choisies) ;
  2. **code à usage unique** envoyé par e-mail au signataire, valable 10 minutes (SEC-16, D4) ;
  3. **information précontractuelle et commande** selon le canal (règles du lot 31b, inchangées) ;
  4. **signature** (Documenso, inchangé) ;
  5. **écran « Régler l'acompte »**.
- **L'écran « Régler l'acompte »** (ADR 0087) :
  - montant de l'acompte, **RIB de l'organisation**, **référence unique** de l'échéance
    (D5 : `SYM-<année>-<numéro court>`, sans donnée personnelle), bouton « Copier » pour chacun ;
  - QR code de virement européen (EPC) avec le montant et la référence (D6), pour l'application
    bancaire qui le lit ;
  - bouton « J'ai fait le virement » : la déclaration du payeur (POR-09, existante), horodatée.
- **Rétractation** (critère GC-01, JUR-07) :
  - **hors établissement** : l'écran de règlement n'affiche **pas** le RIB avant le 8e jour ; il dit
    « Aucun paiement ne peut vous être demandé avant le <date> », et un e-mail apporte le RIB ce
    jour-là ;
  - **à distance** : le RIB s'affiche, mais l'exécution reste soumise à la case « exécution
    anticipée » du lot 31b ; l'écran rappelle le délai de quatorze jours et le formulaire de
    rétractation ;
  - **en établissement** : RIB affiché.
  Aucun de ces textes n'est écrit dans le code : ils viennent de `contract-rules.json`, relu par
  l'avocat.
- **Deux signataires** (SC-02 étape 6) : le second signe plus tard, depuis un autre appareil ;
  l'acompte se règle une fois, par le payeur désigné.
- **Côté planner** : la déclaration de virement apparaît dans « Aujourd'hui » (« Léa déclare avoir
  viré 1 200 € »), avec un bouton « Confirmer l'encaissement » qui reprend le rapprochement
  existant. **Aucun rapprochement automatique** (ADR 0087).
- **JUR-14** (signature renforcée par SMS sous 10 000 €, avancée au-delà, réponse 5 de l'avocat) :
  **hors de ce lot**. Il attend le choix d'un fournisseur de SMS et de l'édition de Documenso
  (Q34) ; l'alerte actuelle (lot 31b, D15) reste. Voir D4.

## Partie C — Relances d'impayés et pénalités (FAC-09 ; D7)

- **Relances** d'une échéance du client non réglée : à J+3, J+10 et J+20 après l'échéance (réglage
  de l'organisation, données de départ `payment-reminders.json`). Chaque e-mail est relu dans un
  modèle (nature `invoice_reminder`, D10) et part de l'adresse de l'organisation (lot 38).
- **Arrêt** (critère FAC-09) : dès que l'échéance est **déclarée payée par le payeur** ou
  **confirmée par la planner**, plus aucune relance ne part (vérification juste avant chaque envoi).
- **Pénalités de retard** :
  - **client professionnel** : les pénalités du lot 41 (taux, indemnité de 40 €) apparaissent dans
    la relance ;
  - **client particulier** : seulement si le contrat prévoit une clause, au taux de cette clause
    (paramètre de l'organisation, vide par défaut). Point pour l'avocat (AV-7).
- **Suspension** : la planner suspend les relances d'une échéance (« arrangement avec le client »),
  avec un motif.
- **Envoi par la file** des tâches de fond (lot 40b), une fois par relance, rattrapé après une
  panne ; horloge simulée dans les tests (veille, jour même, changement d'heure).

## Partie D — Payeurs et calendrier des sorties d'argent (BUD-06, BUD-11 ; D8, D9)

- **Répartition par payeur** (BUD-06) :
  - les payeurs de l'évènement : mariés, famille de l'un, famille de l'autre, entreprise. Ils sont
    tirés des liens « payeur » existants, ou ajoutés sans lien ;
  - **par ligne du budget**, une répartition en pourcentage ou en montant entre payeurs (par
    défaut : 100 % aux mariés) ;
  - **par échéance** de la planner : un payeur désigné.
- **Ce que chaque payeur voit** (critère BUD-06) : le client choisit, sur son portail, si chaque
  payeur voit **seulement sa part** (par défaut) ou tout le budget. La règle existante des
  catégories partagées (POR-10) reste ; la part s'y ajoute. Le contrôle est côté serveur.
- **Calendrier des sorties d'argent** (BUD-11) : dans le portail du client, une vue **mois par
  mois** des montants à venir :
  - échéances de la planner (acompte, solde) ;
  - échéances des prestataires (BUD-03).
  Chaque montant porte son payeur, son statut (à venir, déclaré, réglé) et l'action utile
  (« Régler » pour une échéance de la planner). Un payeur ne voit que ses échéances si sa part
  seule lui est montrée. Sur 375 px : un mois par bloc, sans tableau large.

## Décisions à prendre

- **D1 — FAC-15 dans ce lot.**
  - (a) Rattacher FAC-15 (validité, relance avant expiration) au lot 43, prévu au lot 45.
  - (b) Le laisser au lot 45.

  **Recommandation : (a).** La validité s'affiche sur la page de proposition et bloque la
  signature : le lot 43 la touche de toute façon. Les lots 43 et 45 restent ainsi sans fichier du
  module `quotes` en commun.
- **D2 — Le modèle de proposition.**
  - (a) Mot d'accueil, ordre des blocs et photos dans un modèle par type d'évènement ; le devis
    reste le cœur de la page.
  - (b) Une page libre composée bloc par bloc (texte, image, galerie).

  **Recommandation : (a).** C'est rapide à préparer (PAR-02 : devis envoyé en moins de quinze
  minutes) ; (b) est un éditeur de pages, hors du besoin.
- **D3 — Où vit la page.**
  - (a) Dans le portail du client, par son lien personnel (même accès, mêmes droits).
  - (b) Une adresse publique de proposition, sans lien personnel.

  **Recommandation : (a).** Rien n'est partagé par défaut (POR-10), et le prospect a déjà un lien
  dès l'envoi du devis.
- **D4 — Le code avant de signer.**
  - (a) Code à usage unique **par e-mail**, 10 minutes, avant la signature (SEC-16) ; le SMS de
    JUR-14 reste un lot à part.
  - (b) Attendre le SMS (fournisseur à choisir) pour faire SEC-16 et JUR-14 ensemble.

  **Recommandation : (a).** Le code par e-mail existe déjà (`link-otp.ts`) et satisfait SEC-16 ;
  JUR-14 demande deux choix qui sont les tiens (fournisseur de SMS, édition de Documenso).
- **D5 — La référence de virement.**
  - (a) `SYM-<année>-<numéro court>`, unique par échéance, sans nom ni donnée personnelle (elle
    passe par les banques).
  - (b) Numéro de facture d'acompte.

  **Recommandation : (a).** La facture d'acompte n'existe pas toujours au moment du virement
  (encaissement avant facture) ; une référence courte se recopie sans erreur.
- **D6 — Le QR code de virement.**
  - (a) QR code européen (EPC, norme publique) avec bénéficiaire, IBAN, montant et référence,
    produit par `qrcode` (déjà là, ADR 0028).
  - (b) Pas de QR code.

  **Recommandation : (a).** Gratuit, sans prestataire ; une partie des applications bancaires le
  lit, et sinon le RIB et la référence se copient.
- **D7 — Les pénalités pour un particulier.**
  - (a) Seulement si le contrat les prévoit, au taux de la clause ; vide par défaut.
  - (b) Jamais pour un particulier.

  **Recommandation : (a), sous réserve de l'avocat (AV-7).**
- **D8 — La répartition par payeur.**
  - (a) Par ligne du budget (pourcentage ou montant) et par échéance de la planner ; le client
    choisit ce que chaque payeur voit.
  - (b) Un payeur par catégorie seulement.

  **Recommandation : (a).** Les familles financent souvent une part d'une même ligne (« la moitié
  du traiteur ») ; (b) ne le dit pas.
- **D9 — Le calendrier.**
  - (a) Dans le portail du client et dans le budget de la planner, mois par mois.
  - (b) Portail seulement.

  **Recommandation : (a).** La planner répond souvent à « qu'est-ce qu'on doit payer en mai ? » ;
  c'est la même vue.
- **D10 — Les e-mails.** Touche le schéma `hub` (contrainte des natures d'e-mails).
  - (a) Natures `proposal_sent`, `proposal_expiry_reminder`, `payment_details` (RIB envoyé au 8e
    jour hors établissement), `invoice_reminder` ; contrainte élargie par une migration `hub` à
    part, annulable, avec la réunion des natures de `main`.
  - (b) Réutiliser les natures existantes.

  **Recommandation : (a).** Chaque modèle se relit et se modifie à part (CRM-05, UX-17).

## Points pour les conseils

**Avocat** (question suivante de sa fiche, numéro donné à la fusion) :

- **AV-7** — Relances d'impayés à un **particulier** : une pénalité de retard est-elle possible si
  le contrat la prévoit, et à quel taux maximal ? Quelles mentions dans la relance ? Faut-il un
  délai minimal avant la première relance ?
- **AV-8** — Hors établissement, « aucun paiement avant sept jours » : suffit-il de ne pas
  afficher le RIB avant le 8e jour et de l'envoyer ce jour-là, ou faut-il aussi bloquer la
  déclaration de virement avant cette date ?

**Expert-comptable** : rien de nouveau (factures et encaissements inchangés, lot 41).

## Migrations (prévision)

Numérotation : le lot part du premier numéro libre de `main` au moment de son code (0165 si le lot
47 est fusionné avant). La PR fusionnée après une autre **renumérote** les siennes **et** leur
donne une date (`when` du journal) postérieure à la dernière de `main`.

- **`quotes`** :
  - `proposal_templates` (organisation, type d'évènement, mot d'accueil, blocs, version) ;
  - `quote_versions` : `expires_on`, `expiry_reminded_at`, `proposal_greeting` ;
  - `payment_references` (échéance, référence unique par organisation) ;
  - `payment_reminders` (échéance, rang, envoyée le, suspendue le, motif) ;
  - RLS et index.
- **`budget`** :
  - `event_payers` (évènement, nom, nature, lien facultatif, « voit sa part seule ») ;
  - `budget_line_payer_shares` (ligne, payeur, pourcentage ou montant) ;
  - `budget_lines` ou échéances : payeur désigné ;
  - RLS et index.
- **`hub`** (une migration à part) : contrainte des natures d'e-mails (D10).
- Données de départ : `proposal-templates.json`, `payment-reminders.json`, textes de
  `contract-rules.json` pour l'écran de règlement.

## Fichiers touchés (prévision)

- `packages/db/src/schema/quotes.ts`, `budget.ts`, `hub.ts` (contrainte) ; `drizzle/` et
  `drizzle-rollback/`.
- `apps/symbola/modules/quotes/` : `proposal.ts`, `proposal-pdf.tsx`, `payment-references.ts`,
  `payment-reminders.ts`, `service.ts`, `repository.ts`, `privacy.ts`.
- `apps/symbola/modules/budget/` : `payers.ts`, `cash-calendar.ts`, `service.ts`.
- `apps/symbola/app/portail/` (proposition, règlement, calendrier, payeurs), `app/devis/` (modèle
  de proposition, relances), `app/accueil` (déclarations à confirmer).
- `packages/starter-templates/src/`, `packages/i18n/src/messages/`, centre d'aide,
  `privacy.registry.yaml`.
- `docs/gap.csv` (FAC-02, FAC-08, FAC-09, FAC-15, GC-01, SEC-16, BUD-06, BUD-11), ADR 0089,
  `docs/recette/SC-02.md` (étapes 4 à 8).

## Tests

- **FAC-02** : le total suit les options (règle existante) sur la page et dans le PDF ; aperçu
  « vu par le client » sans enregistrement.
- **FAC-15** (horloge simulée) : relance à J-3, une seule fois ; pas de relance après une
  signature ou un refus ; version expirée non signable ; version signée figée.
- **GC-01** (Playwright 375 px, axe-core) : de la proposition au virement déclaré en moins de trois
  minutes (mesure SC-02) ; deux signataires sur deux appareils.
- **JUR-07** : hors établissement, ni RIB ni déclaration avant le 8e jour, e-mail du RIB ce
  jour-là ; à distance, rappel du délai et case d'exécution anticipée (règles du lot 31b).
- **SEC-16** : code exigé avant de signer, expiré après 10 minutes, nombre d'essais limité ; un
  code d'un autre lien refusé.
- **FAC-08** (ADR 0087) : référence unique par échéance, sans donnée personnelle ; QR code EPC
  valide (contenu décodé) ; déclaration puis confirmation par la planner.
- **FAC-09** (horloge simulée) : relances J+3, J+10, J+20 ; **aucune** relance après une
  déclaration ou une confirmation, même si elle arrive entre la planification et l'envoi ;
  suspension.
- **BUD-06** : part en pourcentage et en montant, totaux exacts au centime ; un payeur « part
  seule » ne voit ni le total ni les autres parts (contrôle serveur, test d'abus).
- **BUD-11** : vue mois par mois, échéances de la planner et des prestataires, filtrée par payeur.
- **Isolation et abus** (SEC-36) : lien d'un autre évènement, lien expiré, payeur qui demande la
  part d'un autre, organisation A contre B, Admin.
- **Rejeu** : SC-02, étapes 4 à 8 ; `docs/recette/SC-02.md`.

## Hors périmètre

- Paiement en ligne, carte, prélèvement, rapprochement automatique (ADR 0087).
- Signature renforcée par SMS et signature avancée (JUR-14) : lot à part après les choix de Q34.
- Proposition composée bloc par bloc (D2 b) ; proposition publique sans lien (D3 b).
- Import du relevé bancaire pour rapprocher les virements (idée de l'ADR 0087, plus tard).

## Ambiguïtés relevées

- GC-01 dit « payer » : lu comme « régler par virement » depuis l'ADR 0087 ; le « seul geste »
  devient un enchaînement sans rupture jusqu'à l'écran de règlement.
- BUD-06 dit « si le client le décide » : c'est le client (lien des mariés) qui choisit ce que voit
  chaque payeur, la planner peut le régler pour lui.

## Travail en parallèle (lots 43, 45 et 51)

- **Avec le lot 45** : les deux élargissent la contrainte des natures d'e-mails du `hub` ; la PR
  fusionnée en second réunit les listes. Aucun fichier du module `quotes` en commun si D1 (a) est
  retenue.
- **Avec le lot 51** : rien de commun dans les schémas (le lot 51 touche `events`) ; le portail est
  touché par le lot 43 seulement.
- Traductions, `gap.csv`, `globals.css` : conflits de texte attendus, à résoudre en gardant tout
  (accolades de `globals.css` équilibrées).
