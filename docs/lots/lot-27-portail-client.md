# Lot 27 — Le portail du client

**Statut** : spécification validée par Julien le 12/11/2026 (« Oui, comme recommandé » : D1 à D10
en (a)). Branche `lot-27-portail-client`, partie du 26b (`lot-26b-prestataire-code`, PR #104) ; la
PR visera `main`, après #103 et #104.

## Contexte

Phase 1 du plan (`docs/GAP_REPORT.md` § 7) : le lot 27 donne au portail ouvert par le lot 26 son
contenu, et ferme avec lui le parcours PAR-06 « Embarquer le client » (scénario SC-06).

**Exigences** : POR-02, POR-03, POR-05, POR-09, BUD-07, CHR-04, UX-17 (P0) ; EVT-09 (P1, embarquée
avec les décisions, § 7 du rapport d'écart). POR-04 reste partiel (documents au lot 37, paiement en
ligne au lot 43).
**Voisines, hors du lot** : POR-04 (documents partagés, lot 37 ; paiement des factures, lot 43),
POR-06 (messagerie par sujet, lot 55), POR-07 (questionnaires, lot 45), RDV-01 à RDV-04 (rendez-vous,
lot 46), BUD-11 (part par payeur, lot 43), MSG-02 (envoi test d'un e-mail, lot 38).
**Décisions déjà prises** : ADR 0053 et décisions D1 à D10 du lot 26 (liens personnels, rubriques
par lien, rien partagé par défaut) ; Q8 et ADR 0054 (cinq montants côté planner, trois côté client).
**Scénario** : SC-06 étapes 2 (trois prochaines actions) et 5 (le payeur lit l'échéance et la
déclare réglée par virement, au MVP). Étapes 3 (contrat signé) et 6 (fil) : lots 37 et 55.

**Critères d'acceptation du cahier des charges** :

| ID | Critère |
| --- | --- |
| POR-02 | Accueil : compte à rebours, avancement, « vos trois prochaines actions », prochains rendez-vous. Lisible à 360 px sans défilement horizontal. |
| POR-03 | Choisir entre des options, valider un devis de prestataire, approuver le chrono. Chaque validation laisse une trace horodatée, lisible des deux côtés. |
| POR-05 | Budget simplifié et échéances à venir. Trois chiffres : prévu, engagé, reste à payer. |
| POR-09 | L'aperçu « vu par le client » montre exactement ce que voit chaque interlocuteur. |
| BUD-07 | Vue simplifiée dans le portail et validation des dépenses. La validation est horodatée et nominative. |
| CHR-04 | Tâches confiées au client, visibles dans son portail, avec rappel automatique. Le client coche la tâche depuis son téléphone. |
| UX-17 | Aperçu « vu par le client » sur tout contenu partagé. Tout envoi à plusieurs destinataires affiche leur nombre et leur liste, et propose un envoi test. |
| EVT-09 | Qui a décidé quoi et quand. Une décision validée par le client ne se modifie pas, elle se remplace. |
| SC-06 | Première action de Léa en moins de deux minutes ; Bernard ne voit ni le budget global, ni les autres lignes. |

## Constat du 12/11/2026 (après le lot 26)

- **Portail** `/portail` (lot 26a) : une seule page, rubriques ouvertes au lien les unes sous les
  autres : rétroplanning par mois (le client coche ses tâches « À faire par vous »), programme en
  variante « mariés » et son PDF, options de prestataires montrées (devis et RIB partagés), budget,
  devis à signer. Ni compte à rebours, ni avancement, ni prochaines actions.
- **Budget du portail** : tableau par catégorie (estimé, engagé, écart…) qui défile dans sa zone à
  375 px ; pas des trois chiffres de POR-05 ; pas d'échéances.
- **Échéances des prestataires** (lot 28b) : `budget.vendor_payments` (libellé, montant fixe ou
  pourcentage, date d'échéance, date de paiement) ; la planner les marque payées. Aucune n'est
  visible du client, aucune ne se déclare réglée.
- **Décisions** : aucune. Le client voit les options d'un poste mais n'en choisit pas ; il signe
  les devis de la planner (Documenso) ; rien sur le programme ni sur une dépense. Les historiques
  existants (`event_status_history`, `budget_line_history`, `event_activities`) sont techniques.
- **Rappels** : aucun e-mail au client pour ses tâches.
- **Aperçu** : la planner ne voit pas ce que voit une personne ; elle n'a que la liste des rubriques
  ouvertes au lien.
- **Rendez-vous** : pas de module (lot 46).

## Découpage : deux lots, deux pull requests (décision D1)

- **27a — Ce que le client voit** : accueil (compte à rebours, avancement, trois prochaines
  actions), budget en trois chiffres et échéances, règlement déclaré, rappels des tâches, aperçu
  « vu par » pour la planner.
- **27b — Ce que le client décide** : demandes de décision (options, dépense, programme), réponse
  horodatée et nominative, journal des décisions des deux côtés.

## Lot 27a — Ce que le client voit

### Partie A — Accueil du portail (POR-02, décisions D2 à D4)

- **En tête du portail**, avant les rubriques : « Bonjour Léa », les prénoms, la date et un compte à
  rebours en jours (calendrier de Paris : « Dans 212 jours », « Demain », « C'est aujourd'hui » ;
  rien une fois l'événement passé ; « Date à venir » sans date).
- **Avancement** (D3) : « 18 tâches sur 42 faites » et une barre, sur tout le rétroplanning, sans
  détail des tâches de la planner ; seulement si la rubrique Rétroplanning est ouverte.
- **« Vos trois prochaines actions »** (D2) : les trois plus proches parmi ce que la personne peut
  faire, selon ses rubriques : ses tâches non faites, les devis à signer, les échéances à régler de
  ses catégories (non réglées ni déclarées), et au 27b les décisions en attente. Les retards
  d'abord, puis par date ; chaque action mène à l'endroit où la faire (une tâche se coche sur
  place). Sans action : « Rien à faire pour l'instant ».
- **Prochains rendez-vous** (D4) : bloc absent tant que le module des rendez-vous n'existe pas
  (lot 46), comme une fonction d'un module non souscrit (ARC-06).
- **Navigation** : les rubriques restent sur une page, avec un sommaire d'ancres en tête
  (« À faire », « Programme », « Budget »…).
- **360 px** : aucune largeur fixe ; le test e2e vérifie l'absence de défilement horizontal à 360
  et à 375 px, axe-core compris.

### Partie B — Budget en trois chiffres et échéances (POR-05, BUD-07, décision D5)

- **Trois chiffres** : prévu (estimé), engagé, reste à payer (engagé moins payé, jamais négatif).
  Budget entier : les trois totaux, puis une carte par catégorie avec ses trois chiffres.
  Catégories choisies (payeur) : seulement ses cartes, sans total général (règle du 26a).
- Plus de tableau ni d'écart côté client ; le détail par ligne et les cinq montants restent côté
  planner (ADR 0054).
- **Échéances à venir** : celles des prestataires de ses catégories, non payées, par date : poste,
  prestataire, libellé (« Acompte »), montant, « en retard » après la date. Les échéances payées
  restent visibles trois mois, repliées.

### Partie C — Règlement déclaré (SC-06 étape 5, décision D6)

- Sur une échéance à venir de ses catégories, « Je l'ai réglée » : date (aujourd'hui par défaut) et
  moyen de paiement, choisi dans la liste de l'organisation (`payment-methods.json`, données de
  départ). L'échéance passe à « Déclarée réglée, en attente de confirmation ».
- La planner voit « Déclarée réglée par Bernard Martin le 3 mars (virement) » dans l'échéancier du
  prestataire et sur « Aujourd'hui » ; « Confirmer le paiement » la marque payée à cette date ;
  « Refuser » rend l'échéance à régler, avec un motif montré au client. Les montants payés ne
  bougent qu'à la confirmation.
- Le client peut annuler sa déclaration tant qu'elle n'est pas confirmée. Journal : déclaration,
  confirmation, refus, avec le lien pour auteur.

### Partie D — Rappels des tâches du client (CHR-04, décision D7)

- Un e-mail à la personne du lien pour ses tâches « À faire par vous » non faites : sept jours avant
  l'échéance, la veille, puis une fois le lendemain d'un retard (délais en données de départ,
  `client-task-reminders.json`). Un seul e-mail par personne et par jour, qui regroupe ses tâches.
- Seulement aux liens actifs dont la rubrique Rétroplanning est ouverte ; jamais pour un événement
  perdu ou d'essai ; jamais deux fois le même rappel (table des rappels envoyés) ; envoyés entre
  9 h et 19 h à Paris, par la tâche horaire de l'app ; plafond d'envois de l'organisation (SEC-22).
- L'e-mail ne porte pas le lien (seul son haché est gardé, ADR 0053) : il invite à rouvrir l'espace
  avec le lien personnel reçu, ou à en demander un nouveau à l'organisateur.
- Case « Rappels par e-mail » sur chaque lien, cochée par défaut.

### Partie E — Aperçu « vu par » (POR-09, UX-17, décision D8)

- Sur chaque lien de la fiche, « Voir comme Léa » ouvre `/events/<id>/liens/<lien>/apercu` : la
  page du portail (ou de l'espace du prestataire) rendue par les mêmes composants, avec l'accès de
  ce lien, sous un bandeau « Aperçu : ce que voit Léa Martin ». Les actions sont affichées mais
  inactives ; les fichiers ne s'ouvrent pas.
- Garde de la planner (session, organisation, lien de cet événement) ; aucune session de lien,
  aucune date d'ouverture, rien au journal du lien. Un lien retiré ou expiré montre ce que la
  personne verrait : « Ce lien n'est plus valable ».
- UX-17, envoi à plusieurs destinataires (nombre, liste, envoi test) : il n'existe pas encore
  d'envoi groupé ; il viendra avec les modèles d'e-mails (lot 38).

### Partie F — Tests, rejeu et documents du 27a

- Tests par critère : accueil (compte à rebours en horloge simulée, veille, jour même, passage à
  l'heure d'été ; trois actions et leur ordre ; rubriques fermées), trois chiffres (entier et
  catégories choisies), règlement déclaré (déclarer, annuler, confirmer, refuser ; refus hors de
  ses catégories), rappels (seuils, un par jour, jamais deux fois, heures, lien sans rubrique ou
  retiré, essai), aperçu (même contenu que le portail, aucune trace sur le lien, autre
  organisation refusée).
- Tests d'abus : déclarer une échéance d'une autre catégorie, d'un autre événement, d'une autre
  organisation ; aperçu d'un lien d'un autre événement ; isolation des nouvelles tables.
- e2e en 1280, 375 et 360 px, axe-core. Rejeu SC-06 étapes 2 et 5 (`docs/recette/SC-06.md`).
- Aide (portail, fiche), `docs/gap.csv`, bilan.

### Bilan du lot 27a (12/11/2026)

**Fait** (branche `lot-27-portail-client`, partie du 26b) :

- **Accueil du portail** : compte à rebours en jours de Paris, avancement du rétroplanning
  (« 1 tâche faite sur 3 »), « vos trois prochaines actions » (tâches, devis à signer, échéances ;
  retards d'abord ; la tâche se coche sur place), sommaire des rubriques. Le contenu du portail vit
  dans `app/portail/portal-content.tsx`, règles pures dans `portal-home.ts`.
- **Budget en trois chiffres** : prévu, engagé, reste à payer, en totaux (budget entier) et par
  poste ; plus de tableau ni d'écart côté client. Échéances à venir des catégories du lien, payées
  repliées pendant trois mois.
- **Règlement déclaré** : « Je l'ai réglée » (date, moyen pris dans les moyens de l'organisation),
  annulable par son auteur ; la planner confirme ou refuse (motif montré au client) depuis
  l'échéancier, et voit les déclarations sur « Aujourd'hui ». Journal : `budget.vendor_payment.*`.
- **Rappels des tâches du client** : tâche horaire (`lib/client-task-reminders.ts`), seuils et
  heures en données de départ (`client-task-reminders.json`), un e-mail par personne et par jour,
  sans le lien, dans la langue du lien (nouvelle colonne `event_links.locale`) ; case « Rappels par
  e-mail des tâches » sur chaque lien de client. Journal : `events.link.reminder_sent`.
- **Aperçu « Voir comme »** : `/events/<id>/liens/<lien>/apercu`, mêmes composants que le portail
  et l'espace du prestataire, actions inactives, fichiers fermés, sans session ni trace.
- **Migrations** 0114 (`events`) et 0115 (`budget`), annulables ; registre RGPD : motif de refus.

**Vérifié** (en local, base `symbola_lot24`) : lint, types, frontières de modules, catalogues de
messages, registre RGPD ; tests unitaires (app 378, modèles de départ 40) ; intégration (base 143
dont l'isolation des rappels et le retour arrière de 0114 et 0115, authentification 48, fichiers 12,
e-mail 2, app 509 dont 8 sur le règlement déclaré et 4 sur les rappels) ; parcours e2e complets sur
l'app compilée et une base neuve (ordinateur et 375 px, axe-core) : 212 réussis, 1 échec, 1 ignoré.
L'échec (`l16-sec-01`, délai d'attente de la double authentification) passe seul quatre fois sur
quatre ; un autre, isolé, de `prd-evt-06` en 375 px au dernier passage ciblé, passe trente fois sur
trente avec le parcours du portail : instabilités sous charge, sans lien avec le lot. Semgrep :
0 alerte ; Gitleaks : seul le mot de passe de test déjà sur `main` (`prd-bud-04`) ; journaux du
serveur sans e-mail ni téléphone ; rejeu SC-06 étapes 2 et 5 (`docs/recette/SC-06.md`).

**Corrigé pendant le rejeu** : le chargeur du jeu fictif marque faites les tâches « fait » ; à
360 px, libellés visibles plus courts pour déclarer un règlement (nom complet pour les lecteurs
d'écran).

**Remarques** :

- Après une déclaration, la page se met à jour et l'échéance affiche « en attente de
  confirmation » à la place du formulaire : c'est la confirmation que voit le client.
- Les rappels ne portent pas le lien : la personne rouvre son e-mail d'origine, ou en demande un
  nouveau à l'organisateur (ADR 0053, seul le haché du jeton est gardé).
- Au déploiement d'ensemble (gel) : migrations 0114 et 0115, après 0109 à 0113.

## Lot 27b — Ce que le client décide

### Partie G — Demandes de décision (POR-03, BUD-07, décisions D9 et D10)

- **Sur la fiche**, la planner demande une décision, de trois sortes :
  - **choisir entre des options** : les prestataires montrés d'un poste (deux au moins) ;
  - **valider une dépense** : une ligne du budget ou le devis d'un prestataire, avec son montant ;
  - **approuver le programme** : la version en cours du programme du jour J.
- **Qui répond** (D10) : toute personne dont le lien ouvre la rubrique concernée (Options, Budget
  avec la catégorie, Programme) ; la première réponse décide, les autres voient qui a décidé.
- **Dans le portail**, « À décider » (et dans les trois prochaines actions) : choisir une option, ou
  « Je valide » / « Je ne valide pas », avec un commentaire facultatif. Le programme approuvé puis
  modifié est signalé des deux côtés (« Le programme a changé depuis votre accord du 3 mars »).
- **Effets** : une décision n'engage rien d'elle-même ; la planner voit le choix et retient le
  prestataire, ou engage la dépense, d'un geste (« Retenir Maison Haddad »).

### Partie H — Journal des décisions (EVT-09)

- Table des décisions : sorte, objet, contenu figé au moment de la demande (noms, montants,
  version du programme), demandée par, quand, état (en attente, validée, refusée, retirée,
  remplacée), réponse, commentaire, nom de la personne et lien, quand.
- **Immuable** une fois répondue (garde en base) : la planner ne la modifie pas, elle en demande
  une nouvelle qui la remplace ; l'ancienne reste lisible avec « remplacée par ». Une demande sans
  réponse peut être retirée.
- **Lisible des deux côtés** : « Décisions » sur la fiche (onglet Mariés) et au fil d'activité ;
  « Vos décisions » dans le portail. Journal d'audit : demande, réponse, retrait, remplacement.
- RGPD : le nom de la personne copié dans la décision est déclaré au registre ; effacé (« un
  interlocuteur ») avec le lien lors d'une demande d'oubli.

### Partie I — Tests, rejeu et documents du 27b

- Tests par critère et d'abus : réponse hors de ses rubriques ou catégories, sur une autre
  organisation ou un autre événement, décision déjà prise, modification d'une décision répondue
  refusée par la base ; isolation de la table.
- e2e en 1280 et 360 px. Rejeu SC-06 étape 2 avec une décision (Léa choisit le traiteur).
- Aide, `docs/gap.csv`, bilan.

### Bilan du lot 27b (12/11/2026)

**Fait** (branche `lot-27b-decisions`, partie du 27a) :

- **Demandes de décision** sur la fiche (onglet Mariés, « Décisions du client ») : choisir entre les
  prestataires montrés d'un poste (deux au moins), valider une dépense du budget (montant devisé,
  sinon engagé, sinon estimé), approuver le programme ; message et date de réponse souhaitée
  facultatifs ; une seule demande en attente par sujet ; retirer une demande sans réponse.
- **Réponse du client** dans le portail (« À décider », et dans les trois prochaines actions) :
  choisir une option ou « Aucune ne me convient », valider ou non, commentaire facultatif ; la
  première réponse décide (D10), au nom de la personne et horodatée ; un payeur ne répond qu'aux
  dépenses de ses catégories ; un lien de prestataire ne voit rien.
- **Journal des décisions** (EVT-09) : table `events.event_decisions` (contenu figé à la demande),
  garde en base (`events.guard_decision`) : une décision répondue ou retirée ne change plus, sauf
  l'anonymisation d'une demande d'oubli ; « Demander une nouvelle décision » la remplace (« remplacée
  par ») ; « Vos décisions » dans le portail, « Décisions du client » sur la fiche, fil d'activité
  (`decision_made`), journal d'audit (`events.decision.*`). Programme approuvé puis modifié signalé
  des deux côtés.
- **Effets d'un geste** (D9) : « Retenir Maison Haddad » (prestataire choisi), « Engager 2 880 € »
  (dépense validée) ; rien n'est engagé sans la planner.
- **Migration 0116** (`events`, annulable) ; registre RGPD : nom copié, commentaire, message ;
  l'oubli d'un lien anonymise ses décisions.

**Vérifié** (en local, base `symbola_lot24`) : lint, types, frontières de modules, catalogues de
messages, registre RGPD ; tests unitaires (app 384, dont les règles des décisions) ; intégration
(base 145 dont l'isolation des décisions et le retour arrière de 0116, authentification 48,
fichiers 12, e-mail 2, app 518 dont 9 sur les décisions) ; parcours e2e complets sur l'app compilée
et une base neuve (ordinateur et 375 px, axe-core) : 215 réussis, 0 échec, 1 ignoré (comme avant le
lot) ; Semgrep 0 alerte ; Gitleaks : aucune fuite ; journaux du serveur sans e-mail ni téléphone ;
rejeu SC-06 étape 2 avec une décision (`docs/recette/SC-06.md`).

**Corrigé pendant le rejeu** : le chargeur du jeu fictif rattache les prestataires consultés sans
ligne de budget ; le formulaire de réponse est en colonne en taille ordinateur.

**Remarques** :

- Une décision « options » ne propose que les prestataires montrés aux clients (deux au moins) ; un
  programme vide ne se fait pas approuver.
- L'engagement d'une dépense validée reprend le montant figé dans la décision ; si la dépense a
  changé depuis, la planner demande une nouvelle décision.
- Au déploiement d'ensemble (gel) : migration 0116, après 0109 à 0115.

## Migrations (à partir de 0114)

| Lot | Schéma | Contenu |
| --- | --- | --- |
| 27a | `events` | `event_links.task_reminders` (booléen, vrai par défaut) ; `event_task_reminders` (tâche, lien, seuil, envoyé le ; table technique sous RLS) |
| 27a | `budget` | `vendor_payments` : date et moyen déclarés, lien déclarant, date de déclaration, motif de refus |
| 27b | `events` | `event_decisions` (RLS, garde d'immuabilité) ; sorte du fil d'activité `decision_made` |

Chaque migration a son script d'annulation, testé par `rollback.integration.test.ts`.

## Fichiers touchés (prévision)

- `packages/db/src/schema/{events,budget}.ts`, `packages/db/drizzle/0114_*` et suivantes,
  `packages/db/drizzle-rollback/`.
- `packages/contracts/src/{events,budget}/service-contract.ts`, `packages/contracts/src/audit.ts`.
- `packages/starter-templates/src/client-task-reminders.json`.
- `apps/symbola/modules/events/` (accueil du portail, rappels, décisions), `apps/symbola/modules/budget/`
  (trois chiffres, échéances, règlement déclaré).
- `apps/symbola/app/portail/` (accueil, budget, échéances, décisions), `apps/symbola/app/events/[id]/`
  (aperçu, décisions, case des rappels), `apps/symbola/app/budget/[eventId]/` (déclarations à
  confirmer), `apps/symbola/app/page.tsx` (« Aujourd'hui »), `apps/symbola/lib/` (tâche des rappels).
- `packages/i18n/src/messages/{fr,en}.json` et vocabulaire, `privacy.registry.yaml`.

## Hors périmètre

- Documents partagés et contrat signé en deux touchers (lot 37, SC-06 étape 3).
- Paiement en ligne et factures de la planner payables du portail (lot 43, FAC-08) ; part par
  payeur (BUD-11, lot 43).
- Fil par sujet (lot 55, SC-06 étape 6) ; questionnaires (lot 45) ; rendez-vous (lot 46).
- Envoi groupé avec nombre, liste et envoi test (UX-17, lot 38).
- Code à usage unique avant une action sensible (SEC-16, lot 43) : répondre à une décision ou
  déclarer un règlement n'en demande pas au 27.

## Ambiguïtés relevées

- **« Avancement »** n'est pas défini : rétroplanning entier (D3), plutôt que les seules tâches du
  client ou les étapes du statut.
- **« Valider un devis de prestataire »** (POR-03) et **« validation des dépenses »** (BUD-07) se
  recouvrent : une même sorte de décision, « valider une dépense », porte sur une ligne du budget
  ou sur le devis d'un prestataire.
- **Règlement déclaré** : SC-06 le demande « au MVP » ; le cahier des charges ne dit pas qui le
  confirme. Proposé : la planner, qui voit les relevés (D6).
- **Rappels** : le cahier des charges ne fixe ni délais ni fréquence ; proposés en données de
  départ, modifiables plus tard sans code.

## Décisions à prendre

- **D1 — Découpage.**
  - (a) Deux PR : 27a (ce que le client voit), puis 27b (ce qu'il décide).
  - (b) Une seule PR.

  **Recommandation : (a).** Chacune tient en une semaine ; le 27a ferme déjà les étapes 2 et 5 de
  SC-06.

- **D2 — Les trois prochaines actions.**
  - (a) Mélange de tout ce que la personne peut faire (tâches, devis à signer, échéances à régler,
    décisions), retards d'abord, puis par date.
  - (b) Ses tâches seulement.

  **Recommandation : (a).** Pour Bernard, l'action utile est une échéance, pas une tâche.

- **D3 — Avancement.**
  - (a) Tâches faites sur tout le rétroplanning, sans le détail de celles de la planner.
  - (b) Les tâches du client seulement.
  - (c) L'étape du statut de l'événement.

  **Recommandation : (a).** « On sait où on en est » sans montrer la mécanique interne.

- **D4 — Prochains rendez-vous.**
  - (a) Bloc absent jusqu'au lot 46.
  - (b) Rendez-vous saisis à la main dès le 27.

  **Recommandation : (a).** Un module des rendez-vous à moitié fait serait à refaire.

- **D5 — Budget du client.**
  - (a) Trois chiffres par catégorie, en cartes, et trois totaux en budget entier ; plus de
    tableau ni d'écart ; échéances à venir de ses catégories.
  - (b) Garder le tableau et ajouter les trois chiffres.

  **Recommandation : (a).** Lisible à 360 px, et c'est le critère de POR-05.

- **D6 — Règlement déclaré.**
  - (a) Au 27a : le client déclare (date, moyen), la planner confirme ou refuse ; les montants
    payés ne changent qu'à la confirmation.
  - (b) Au lot 43, avec le paiement en ligne.

  **Recommandation : (a).** SC-06 le demande au MVP, et la confirmation garde le budget juste.

- **D7 — Rappels.**
  - (a) Sept jours avant, la veille, le lendemain d'un retard ; un e-mail regroupé par jour ; sans
    le lien ; case par lien cochée par défaut.
  - (b) Seulement le lendemain d'un retard.

  **Recommandation : (a).** Prévenir avant l'échéance est ce qui évite le retard.

- **D8 — Aperçu « vu par ».**
  - (a) Page de la planner qui rend le portail avec l'accès du lien, actions inactives, sans
    session ni trace sur le lien.
  - (b) Ouvrir une vraie session de lien dans un nouvel onglet.

  **Recommandation : (a).** Même rendu, sans risque de cocher une tâche à la place du client ni de
  fausser « ouvert le ».

- **D9 — Effet d'une décision.**
  - (a) Elle n'engage rien seule ; la planner retient le prestataire ou engage la dépense d'un
    geste depuis la décision.
  - (b) Choisir une option retient aussitôt le prestataire.

  **Recommandation : (a).** La planner garde la main sur ce qui engage de l'argent (contrat,
  acompte).

- **D10 — Qui répond à une décision.**
  - (a) Toute personne dont le lien ouvre la rubrique (et la catégorie) ; la première réponse
    décide.
  - (b) La planner désigne la personne à chaque demande.

  **Recommandation : (a).** Simple pour le couple ; le payeur ne peut répondre que pour ses
  catégories.
