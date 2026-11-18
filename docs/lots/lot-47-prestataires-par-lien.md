# Lot 47 — Prestataires par lien : brief groupé, espace prestataire, sélection au client

**Statut** : spécification proposée le 18/11/2026, **à valider par Julien**. Le lot change le
schéma `events` (tables et colonnes) et la contrainte des natures d'e-mails du schéma `hub`
(D9) ; il revient sur une décision du lot 28 (D5) : validation explicite requise (CLAUDE.md § 8).
Aucune dépendance nouvelle.

Branche `lot-47-prestataires-par-lien`, partie de `main` (2649e8d, après la PR #134). Aucune
version intermédiaire n'est déployée (gel des déploiements) : le lot se rejoue en local.

Ce lot avance **en parallèle des lots 44 et 50** : voir « Travail en parallèle » à la fin.

## Contexte

Pour trouver un fleuriste, Camille écrit aujourd'hui à trois fleuristes, un par un, recopie leurs
réponses, compare leurs devis à la main, puis montre deux propositions à Léa. Le parcours PAR-05
du cahier des charges le fait en un brief, un comparatif et un choix, sans compte pour personne.

Exigences du lot :

- **PAR-05** (P1) — Coordonner les prestataires : brief commun ; le prestataire ouvre un lien,
  répond « disponible » ou non, dépose son devis ; comparatif ; sélection au client ; le choix du
  client engage la ligne de budget et crée les tâches de suivi ; feuille de route à J-30 et J-7,
  confirmation de réception, alerte sinon.
- **PRE-03** (P1) — Demande de devis groupée : un brief envoyé à plusieurs prestataires, réponses
  réunies dans un comparatif. *Critère* : les prestataires consultés ne se voient pas entre eux.
- **PRE-04** (P1) — Espace prestataire par lien personnel : disponibilité, dépôt de devis et de
  facture, brief, chrono, logistique. *Critère* : aucune création de compte ; une action
  principale par écran.
- **PRE-09** (P1) — Sélection partagée au client, avec avis et choix. *Critère* : le client voit la
  sélection, jamais l'annuaire.
- **BUD-05** (P1) — Comparaison de devis de prestataires et scénarios d'options. *Critère* : deux
  scénarios se comparent côte à côte.

Scénario **SC-05** « Trois fleuristes, un choix » (SU-01 Camille, SU-05 Léa, SU-09 Élodie) :
brief à trois fleuristes ; Élodie ouvre le lien, regarde les inspirations, répond « disponible »
et joint la photo de son devis ; un fleuriste répond « indisponible », le troisième ne répond pas
et reçoit une relance ; Camille partage deux propositions ; Léa choisit ; budget et tâches de
suivi se mettent à jour. *Mesures* : moins de deux minutes pour Élodie ; aucun fleuriste ne voit
les autres. Le parcours mobile du § 6 : « Réponse en un toucher, devis joint en photo, aucun
compte ».

## Ce qui existe aujourd'hui

- **Postes et prestataires consultés** (lot 11, lot 28a) : `events.event_vendor_slots`,
  `events.event_vendor_candidates` (statuts Pressenti → Soldé, plus Écarté ; montant et fichier du
  devis ; « montré aux clients »), notes internes ou visibles du client. « Retenu » engage la ligne
  de budget liée (PRE-02, Conforme).
- **Lien prestataire** (lot 26b, POR-01) : `events.event_links` au public `vendor`, un lien par
  prestataire consulté, code à usage unique possible à l'ouverture. Espace `/prestataire` : date,
  lieux, tâches du prestataire, programme publié et sa version (CHR-07), contact. Il sert
  aujourd'hui aux prestataires **retenus**.
- **Relance manuelle** : bouton « Relancer » (SC-03), activité `vendor_reminded`.
- **Sélection au client** (L11-EVT-11, lot 27/28) : rubrique « Options » du portail
  (`app/portail/client-vendor-options.tsx`) ; décision de type `option` (POR-03,
  `events.event_decisions`) : le client choisit une option et commente. **Le choix n'engage rien
  d'elle-même** (décision D9 du lot 28) : la planner retient ensuite à la main.
- **Fichiers** : dépôt contrôlé (type par le contenu, taille, ClamAV), servis après contrôle des
  droits (ADR 0027).
- **Contacts du jour J** (`events.event_day_contacts`) et **programme** : la matière d'une feuille
  de route existe.
- **File des tâches de fond** (lot 40b, `hub.jobs`) : envois planifiés.
- **E-mails** : natures fermées par `hub.email_templates_kind_check`.

Rien n'existe pour : le brief, la réponse du prestataire (disponibilité, devis déposé par lui), le
comparatif, les scénarios, l'engagement par le choix du client, la feuille de route et sa
confirmation.

## Une seule PR

Le lot tient en une PR. Il est plus large que les lots 44 et 50 (cinq exigences, un parcours
entier), mais ses parties s'enchaînent dans un seul parcours (SC-05) et touchent les mêmes tables :
les couper obligerait à livrer un brief sans réponse, ou un comparatif sans choix. Si la PR
dépasse ce qu'une relecture peut suivre, la coupure naturelle est **A + B + C** (consultation et
comparatif) puis **D + E** (choix du client et feuille de route) ; elle serait argumentée dans la
PR.

## Partie A — Le brief (PRE-03, PAR-05 étape 1 ; D1, D2)

- **Un brief par poste** (D1) : sur la fiche de l'évènement, poste « Fleurs », bouton « Demander des
  devis ». Le brief porte : le besoin (texte), la date et le lieu (repris de l'évènement), le
  nombre d'invités (facultatif), un budget indicatif (facultatif, **masqué par défaut**), des
  inspirations (documents ou photos de l'évènement, choisis un par un), la date limite de réponse.
- **Destinataires** : prestataires choisis dans l'annuaire (module `vendors`, lu par son service ;
  module non souscrit : saisie du nom et de l'e-mail, ARC-07) ; chacun devient (ou est déjà) un
  prestataire consulté du poste.
- **Envoi** : écran de contrôle des destinataires, puis **un e-mail par prestataire**, jamais de
  copie ni de liste visible ; chaque e-mail porte **son** lien personnel (public `vendor`). Le
  statut passe à « Consulté ».
- **Cloisonnement** (critère PRE-03) : un lien n'ouvre que le brief et la réponse de son
  prestataire ; le brief ne contient aucun autre nom ; les noms des autres consultés, leurs
  réponses et leurs montants ne sortent jamais vers un prestataire (contrôle serveur, test d'abus).
- **Relance** (D2) : une relance automatique la veille de la date limite vers ceux qui n'ont pas
  répondu ; le bouton « Relancer » existant reste. Aucune relance vers un prestataire qui a répondu
  ou dont le lien est retiré.

## Partie B — L'espace prestataire par lien (PRE-04, PAR-05 étape 2 ; D3, D4)

- **Deux visages d'un même lien** (D3) :
  - **en consultation** (Consulté, Devis reçu) : le brief, les inspirations, et **une action** :
    « Disponible » ou « Indisponible ». S'il est disponible : dépôt du devis (photo ou PDF, depuis
    le téléphone), montant TTC facultatif, message court. Rien d'autre : ni programme, ni contacts,
    ni tâches, ni client ;
  - **une fois retenu** : l'espace actuel (date, lieux, tâches, programme, contact), plus le dépôt
    de **facture** et la feuille de route (partie E).
- **Une action principale par écran** (critère PRE-04) : la page de consultation n'a qu'un bouton
  principal ; le dépôt est l'écran suivant.
- **Réponse en un toucher** (D4) : l'e-mail du brief porte deux boutons, « Je suis disponible » et
  « Je ne suis pas disponible » ; ils ouvrent la page avec le choix présélectionné, à confirmer d'un
  toucher (un lien d'e-mail ne change jamais rien seul : les logiciels de messagerie ouvrent les
  liens pour les vérifier).
- **Sans compte, sans code par défaut** en consultation (rien de sensible n'y est montré) ; le code
  à usage unique reste possible, comme aujourd'hui, une fois retenu.
- **Effets** : « Disponible » + devis → statut « Devis reçu », montant et fichier rangés sur le
  prestataire consulté (colonnes existantes), « Aujourd'hui » de la planner le signale.
  « Indisponible » → statut « Écarté », motif « indisponible ». Le prestataire peut changer
  d'avis tant que la planner n'a pas tranché.
- **Facture déposée** (retenu) : rangée dans les documents de l'évènement (ADR 0027) et signalée ;
  elle ne crée **rien** dans la facturation de la planner (ce n'est pas sa facture).
- **375 px d'abord** : le parcours est fait pour le téléphone (§ 6) ; mesure SC-05 : moins de deux
  minutes de l'e-mail au devis déposé.

## Partie C — Le comparatif et les scénarios (PRE-03, BUD-05 ; D5)

- **Comparatif par poste** : un tableau, une ligne par prestataire consulté : disponibilité,
  montant, devis (ouvrir), message, date de réponse, notes internes ; tri par montant. Sur
  téléphone, une carte par prestataire.
- **Scénarios** (D5) : la planner compose des **scénarios d'options** pour l'évènement : un
  scénario choisit au plus un prestataire par poste (parmi les consultés) ; son total s'affiche à
  côté de l'enveloppe du client (BUD-02) et du budget estimé. **Deux scénarios se comparent côte à
  côte** (critère BUD-05) : postes en lignes, scénarios en colonnes, écarts en évidence. Un
  scénario peut être montré au client (partie D).
- **Montants** : entiers en centimes, EUR, TTC (ce que paie le client) ; un devis sans montant
  compte « à préciser » et le total le dit.

## Partie D — La sélection au client et son choix (PRE-09, PAR-05 étapes 3 et 4 ; D6, D7)

- **Partager** : depuis le comparatif, la planner coche les prestataires à montrer (ou un
  scénario) et demande un choix : c'est la **décision « options »** existante (POR-03), qui fige
  la sélection au moment de la demande. Le client voit la sélection dans son portail : nom,
  montant, devis, notes cochées « Clients » ; **jamais l'annuaire** ni les consultés non montrés
  (critère PRE-09).
- **Avis** : sur chaque option, le client peut laisser un avis court (« J'aime », « Pas pour nous »
  et un commentaire) avant de choisir ; la planner le lit dans le comparatif.
- **Le choix engage** (D6) : quand le client choisit, le prestataire passe à « Retenu » (ce qui
  engage la ligne de budget, règle PRE-02 existante), les autres consultés du poste passent à
  « Écarté » (sans e-mail automatique : la planner prévient qui elle veut), et les **tâches de
  suivi** sont créées depuis la liste de l'organisation (`vendor-follow-up-tasks.json` : contrat,
  acompte, attestation d'assurance), avec leurs échéances. La planner est prévenue et peut
  **annuler** le tout d'un geste pendant 7 jours (retour à l'état d'avant, tâches non commencées
  retirées). Cela remplace la décision D9 du lot 28 (« une décision n'engage rien d'elle-même »)
  pour les seules décisions « options » ; l'ADR du lot le note.
- **Payeur** : un payeur qui n'a pas le poste dans son périmètre ne voit pas la décision (règle
  existante, POR-10).

## Partie E — La feuille de route et sa confirmation (PAR-05 étapes 5 et 6 ; D8)

- **À J-30 et J-7** (dates dans le fuseau de l'évènement), chaque prestataire **retenu** reçoit un
  e-mail « Votre feuille de route » avec son lien : horaires qui le concernent (programme publié),
  lieux et accès, contact sur place (contacts du jour J), ses tâches. La page affiche la feuille de
  route et **un** bouton : « J'ai bien reçu ».
- **Confirmation** : horodatée, visible sur la fiche (« Confirmé le… »). **Sans confirmation 3
  jours après l'envoi de J-7**, une alerte apparaît dans « Aujourd'hui » de la planner (« Studio
  Lumière n'a pas confirmé sa feuille de route »).
- Un programme republié après l'envoi est déjà signalé au prestataire (CHR-07) ; la confirmation
  porte sur la version vue.
- Envois par la file des tâches de fond (lot 40b), une fois chacun, rattrapés après une panne ;
  testés avec une horloge simulée (veille, jour même, passage à l'heure d'hiver).

## Partie F — Réglages, aide, droits, RGPD

- **Réglages** (titulaire) : date limite par défaut du brief (7 jours), relance la veille (oui),
  feuilles de route (J-30 et J-7, désactivables), délai d'alerte (3 jours), tâches de suivi
  (liste de l'organisation, HUB-20).
- **Droits** : un membre envoie un brief et lit le comparatif comme il modifie un évènement
  aujourd'hui ; les montants suivent les règles actuelles de l'évènement.
- **Aide contextuelle** : « Demander des devis à plusieurs prestataires », « Comparer et proposer au
  client », « La feuille de route des prestataires » ; textes de l'espace prestataire en français
  et en anglais (langue choisie par lien, comme aujourd'hui).
- **RGPD** : brief, réponses, avis et confirmations entrent au registre et dans `privacy/v1` du
  module `events` ; le devis déposé suit la durée des documents de l'évènement ; le prestataire
  retiré de l'évènement emporte son lien (règle existante).

## Décisions à prendre

- **D1 — Où vit le brief.**
  - (a) Un brief par **poste** de l'évènement, envoyé à plusieurs prestataires de ce poste.
  - (b) Un brief libre, sans poste.

  **Recommandation : (a).** Le comparatif, la sélection et l'engagement du budget se font par
  poste ; c'est déjà le modèle des prestataires consultés.
- **D2 — La relance.**
  - (a) Une relance automatique la veille de la date limite, plus le bouton existant.
  - (b) Bouton seulement.

  **Recommandation : (a).** SC-05 (étape 3) : le troisième fleuriste « reçoit une relance » sans
  que Camille y pense.
- **D3 — Le même lien avant et après « Retenu ».**
  - (a) Un seul lien par prestataire consulté ; ce qu'il montre dépend du statut (consultation,
    puis espace complet une fois retenu).
  - (b) Deux liens : un de consultation, un nouveau à la sélection.

  **Recommandation : (a).** Un prestataire garde le même lien du brief au jour J ; le serveur ne
  montre que ce que le statut permet. Un prestataire écarté garde la page « Merci, un autre choix a
  été fait » et rien d'autre.
- **D4 — La réponse depuis l'e-mail.**
  - (a) Deux boutons dans l'e-mail ; la page s'ouvre présélectionnée ; un toucher confirme.
  - (b) La réponse est enregistrée dès l'ouverture du lien de l'e-mail.

  **Recommandation : (a).** (b) serait déclenché par les filtres anti-spam qui ouvrent les liens.
- **D5 — Les scénarios (BUD-05).**
  - (a) Scénarios d'options par évènement : au plus un prestataire par poste, total face à
    l'enveloppe, deux scénarios côte à côte.
  - (b) Comparatif par poste seulement.

  **Recommandation : (a).** Le critère de BUD-05 (« deux scénarios se comparent côte à côte ») ne
  tient pas avec (b).
- **D6 — Le choix du client.** Revient sur la décision D9 du lot 28.
  - (a) Le choix **engage** : Retenu, autres Écartés, tâches de suivi, la planner prévenue, annulable
    7 jours.
  - (b) Le choix reste une réponse ; la planner retient en un clic depuis la notification
    (règle du lot 28).

  **Recommandation : (a).** C'est le texte du cahier des charges (PAR-05 étape 4 ; SC-05 étape 5 :
  « Léa choisit. Le budget et les tâches de suivi se mettent à jour »), qui est la référence (Q2).
  L'annulation de 7 jours garde la main à la planner. (b) reste possible si tu préfères garder la
  règle du lot 28 ; il faudrait alors un ADR d'écart.
- **D7 — L'avis du client.**
  - (a) « J'aime » / « Pas pour nous » et un commentaire court par option, avant le choix.
  - (b) Commentaire seulement, au moment du choix (existant).

  **Recommandation : (a).** PRE-09 demande « avis et choix » ; l'avis aide la planner même sans
  choix final.
- **D8 — La feuille de route.**
  - (a) Dans ce lot : J-30 et J-7, confirmation, alerte à J-4.
  - (b) Reportée au lot 51 (Jour J de terrain).

  **Recommandation : (a).** Elle fait partie de PAR-05, que ce lot ferme ; la matière (programme,
  contacts, lieux) existe déjà.
- **D9 — Les e-mails.** Touche le schéma `hub` (contrainte des natures d'e-mails).
  - (a) Natures `vendor_brief`, `vendor_brief_reminder`, `vendor_roadmap` ; contrainte élargie par
    une migration `hub` à part, annulable (même méthode que les lots 46 et 49).
  - (b) Réutiliser la nature générique du lien prestataire.

  **Recommandation : (a).** Chaque modèle se modifie à part (texte du brief, de la relance, de la
  feuille de route) ; la contrainte reste fermée.
- **D10 — Le budget indicatif dans le brief.**
  - (a) Facultatif, masqué par défaut, montré au prestataire seulement si la planner le coche.
  - (b) Toujours montré.

  **Recommandation : (a).** Donner un budget oriente les devis : c'est un choix commercial de la
  planner, pas un réglage.

## Points pour les conseils

**Avocat** (question suivante de sa fiche, numéro donné à la fusion) :

- **AV-6** — Le choix du client qui engage la ligne de budget (D6 a) : il ne vaut **pas**
  commande auprès du prestataire (le contrat reste à signer, c'est la première tâche de suivi).
  Faut-il le dire au client sur l'écran du choix, et en quels termes ? Recommandation de travail :
  une phrase sous le bouton (« Votre choix est transmis à Camille ; le contrat sera signé
  ensuite »).

**DPO** : rien de nouveau dans les catégories de données (coordonnées professionnelles des
prestataires, déjà au registre). Le devis d'un prestataire peut contenir son nom personnel (auto-
entrepreneur) : même traitement que les devis déjà joints (lot 11).

## Migrations (prévision)

Numérotation : le lot part du premier numéro libre de `main` au moment de son code. La PR
fusionnée en second **renumérote** les siennes **et** leur donne une date (`when` du journal)
postérieure à la dernière de `main` (le migrateur de Drizzle n'applique pas une migration plus
ancienne que la dernière appliquée).

- **`events`** (une migration et son annulation) :
  - `vendor_briefs` (évènement, poste, besoin, nombre d'invités, budget indicatif et sa
    visibilité, date limite, envoyé le, envoyé par) ;
  - `vendor_brief_documents` (brief, document de l'évènement) ;
  - `event_vendor_candidates` : `brief_id`, `availability` (`available`, `unavailable`, vide),
    `answered_at`, `answer_message`, `reminded_at` ;
  - `vendor_scenarios` (évènement, nom, position) et `vendor_scenario_choices` (scénario, poste,
    prestataire consulté) ;
  - `event_decision_option_feedback` (décision, prestataire consulté, avis, commentaire, lien) ;
  - `vendor_roadmaps` (prestataire consulté, échéance J-30 ou J-7, envoyée le, confirmée le,
    version du programme vue) ;
  - `event_decisions` : `engaged_at`, `engagement_undone_at` (D6) ;
  - `event_activities` : natures `vendor_answered`, `vendor_roadmap_confirmed` ;
  - RLS et index sur `organization_id` partout ; droits du rôle applicatif.
- **`hub`** (une migration à part et son annulation) : `email_templates_kind_check` élargie aux
  trois natures de D9, avec la réunion des natures alors présentes sur `main`.
- Données de départ : `vendor-follow-up-tasks.json` (FR et EN, variante agence),
  `email-templates.json` (trois modèles).

## Fichiers touchés (prévision)

- `packages/db/src/schema/events.ts`, `packages/db/src/schema/hub.ts` (contrainte),
  `packages/db/drizzle/`, `packages/db/drizzle-rollback/`.
- `apps/symbola/modules/events/` : `vendor-briefs.ts`, `vendor-scenarios.ts`,
  `vendor-roadmaps.ts`, `vendor-candidates.ts`, `decisions.ts`, `links-repository.ts`,
  `service.ts`, `repository.ts`, `today-sources.ts`, `privacy.ts` ; tests.
- `apps/symbola/modules/vendors/service.ts` (lecture de l'e-mail d'une fiche, si absente) ;
  `apps/symbola/modules/budget/service.ts` (aucun changement attendu : l'engagement passe par la
  règle « Retenu » existante).
- `apps/symbola/app/prestataire/` (page de consultation, dépôt, feuille de route),
  `app/events/[id]/` (brief, comparatif, scénarios), `app/portail/client-vendor-options.tsx` (avis,
  choix qui engage), `app/accueil` (« Aujourd'hui »).
- `packages/contracts` : `events.vendor.answered` et `events.vendor_option.chosen` (v1).
- `packages/starter-templates/src/` ; `packages/i18n/src/messages/fr.json` et `en.json` ; centre
  d'aide ; `privacy.registry.yaml`.
- `docs/gap.csv` (PAR-05, PRE-03, PRE-04, PRE-09, BUD-05), ADR 0085, `docs/recette/SC-05.md`.

## Tests

Chaque critère devient un test ; les `describe` portent l'identifiant.

- **PRE-03** (intégration) : un brief à trois prestataires crée trois liens et trois e-mails
  distincts ; **aucun** e-mail, page ou réponse d'API ne contient le nom, le montant ou la réponse
  d'un autre consulté (test d'abus avec deux liens du même poste).
- **PRE-04** (intégration et Playwright 375 px) : réponse « disponible » avec photo du devis en
  moins de deux minutes, sans compte ni code ; un lien de consultation ne montre ni programme ni
  contacts ni tâches ; une fois retenu, l'espace complet et le dépôt de facture ; le bouton de
  l'e-mail n'enregistre rien sans le toucher de confirmation.
- **Fichiers** (SEC-21) : type falsifié refusé, fichier de test antivirus refusé, taille limitée.
- **Relance** (horloge simulée) : la veille de la date limite, seuls les non-répondants ; aucune
  relance après une réponse ou un lien retiré.
- **BUD-05** (intégration et Playwright) : deux scénarios côte à côte, totaux exacts au centime,
  devis sans montant compté « à préciser ».
- **PRE-09 et D6** (intégration) : le client ne voit que la sélection figée ; son avis est
  enregistré ; son choix rend le prestataire Retenu, écarte les autres, engage la ligne de budget,
  crée les tâches de suivi ; l'annulation sous 7 jours rétablit tout ; un payeur hors périmètre ne
  voit pas la décision.
- **Feuille de route** (horloge simulée) : envois à J-30 et J-7 dans le fuseau de l'évènement,
  une seule fois chacun ; confirmation horodatée ; alerte à J-4 sans confirmation ; aucune
  feuille de route vers un prestataire écarté.
- **Isolation** (SEC-36) : le lien d'un prestataire n'ouvre que son évènement et son poste ; un
  lien d'une autre organisation ou expiré est refusé ; l'Admin ne voit rien ; organisation A ne
  lit ni brief ni réponse de B.
- **ARC-07** : sans le module Prestataires, le brief se fait avec nom et e-mail saisis ; rien
  n'est en erreur.
- **Rejeu** : SC-05 sur le jeu fictif ; `docs/recette/SC-05.md`.

## Hors périmètre

- Pièces à échéance, contrôle de l'IBAN, commissions (PRE-05, PRE-10, PRE-07 : lot 48).
- Fiche lieu et ses contraintes (PRE-06) ; évaluation après l'évènement (PRE-08, lot 58).
- Paiement du prestataire par Symbola ; facture du prestataire lue ou rapprochée.
- Messagerie avec le prestataire (MSG, lot 55) ; SMS.
- Synthèse pour le traiteur partagée par son lien (INV-06 : le lot 50 la produit en
  téléchargement ; son partage par le lien du traiteur viendra après les deux lots).

## Ambiguïtés relevées

- PRE-04 cite « disponibilité, dépôt de devis et de facture, brief, chrono, logistique » ; « chrono »
  et « logistique » sont lus comme le programme publié et la feuille de route, déjà en partie là.
- PAR-05 étape 4 : « crée les tâches de suivi : contrat, acompte, attestation » ; la liste est mise
  en données (HUB-20), avec ces trois tâches au départ.
- L'alerte « absence de confirmation » n'a pas de délai dans le cahier des charges : 3 jours après
  J-7, réglable.

## Travail en parallèle (lots 44, 47 et 50)

- **Avec le lot 44** : les deux touchent `packages/db/src/schema/events.ts` (tables différentes) et
  la contrainte des natures d'e-mails du hub ; conflits attendus dans le schéma, le journal des
  migrations et les traductions, sans recouvrement. La PR fusionnée en second renumérote ses
  migrations (avec leur date) et réunit les listes de natures.
- **Avec le lot 50** : aucun fichier de code commun prévu ; la synthèse pour le traiteur ne passe
  pas par son lien dans ces deux lots.
- **Avec le lot 46** (PR #135) : rien de commun.
