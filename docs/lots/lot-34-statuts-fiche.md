# Lot 34 — Statuts, report et annulation, dates relatives, fiche d'identité de l'évènement

**Statut** : spécification **validée par Julien le 14/11/2026** (« Oui, je valide » : D1 à D13 en
(a), contrats d'événements internes en version 2 compris).
Branche `lot-34-statuts`, partie de `main` après le lot 33 (PR #114).

## Contexte

Phase 1 du plan (`docs/GAP_REPORT.md` § 7) : fermer les parcours P0. Le lot 34 met le cycle de
vie d'un évènement au niveau du cahier des charges. Il applique la décision **Q7 a** du
11 novembre (`docs/QUESTIONS.md`) et l'**ADR 0055**, qui renvoie au lot 34 la correspondance
avec les statuts actuels et la migration.

**Exigences** (toutes P0) :

| ID | Exigence | Critère | État (`docs/gap.csv`) |
| --- | --- | --- | --- |
| EVT-01 | Création depuis un modèle de type ; rétroplanning, budget type et listes de contrôle générés. | Trois champs suffisent : nom, date, type. | Partiel : rétroplanning seulement à la confirmation ; pas de listes de contrôle |
| EVT-05 | Statuts : Option, Confirmé, En préparation, Jour J, Clôturé, Reporté, Annulé. Un report décale le rétroplanning après confirmation. | Le report recalcule les échéances relatives et liste celles qui tombent dans le passé. | Partiel : statuts du PRD (prospect, devis envoyé, confirmé, réalisé, perdu) |
| CHR-01 | Rétroplanning en dates relatives au jour J, recalculé si la date change. | Les tâches déjà faites ne bougent pas. | Partiel : recalcul par écart, sans date relative par tâche |
| DAT-07 | Une tâche garde sa date relative (J-90) et sa date absolue ; la relative fait foi tant que la tâche n'a pas été déplacée à la main. | — | Partiel |
| FAC-13 | Avoirs, annulation et report d'évènement selon les conditions du contrat. | Avoir au MVP ; frais d'annulation en V1. | Partiel : avoirs en place ; annulation et report non gérés |
| ARC-17 | Dates en UTC en base, affichées dans le fuseau de l'évènement. | — | Partiel : pas de fuseau propre à l'évènement |
| EVT-03 | Fiche d'identité : dates, lieux multiples, invités estimés et confirmés, interlocuteurs, style, notes. | Chaque lieu porte adresse, horaires et contact. | Partiel : lieux sans horaires ni contact ; invités absents |
| CHR-02 | Tâches avec responsable (planner, client, prestataire), échéance, statut, pièces jointes, commentaires, dépendances. | Dépendances en V1. | Partiel : ni responsable prestataire, ni pièces jointes, ni commentaires |

## Ce qui existe aujourd'hui

- **Statuts** (`events.event_status`) : `prospect`, `quote_sent`, `confirmed`, `done`, `lost`, avec
  l'historique (`event_status_history`) et un motif de perte. Le statut est lu par la liste des
  évènements, le calendrier, « Aujourd'hui », le portefeuille, l'alerte « même jour », la purge
  RGPD (règle prospect ou client), les liens des tiers (fermés pour un évènement perdu), le mode
  Jour J, l'import, le jeu de recette et la signature d'un devis (qui confirme l'évènement).
- **Frise du statut** cliquable sur la fiche (lot 13) ; « Perdu » demande un motif.
- **Rétroplanning** : appliqué à la main depuis un modèle, proposé à la confirmation (décision
  L12-EVT-13, remplacée par l'ADR 0055). Un changement de date propose de décaler toutes les
  tâches non faites du même écart (`tasks_scheduled_for`). Une tâche ne garde ni sa date relative
  ni la trace d'un déplacement à la main. Les modèles ne sont pas rattachés aux types.
- **Lieux** : `venue_name` et `venue_city` sur l'évènement, plus la liste `event_places` (nom,
  adresse, prestataire) utilisée par le programme du jour J. Ni horaires ni contact.
- **Tâches** : responsable planner ou clients ; ni prestataire, ni pièces jointes, ni commentaires.
- **Avoirs** en place (lot 4) ; rien ne se passe côté devis et factures quand un évènement est
  reporté ou perdu.
- **Fuseau** : tout s'affiche en `Europe/Paris`.
- **Contrats d'événements internes** : `events.event.created` et `events.event.status_changed`
  (version 1) portent la liste actuelle des statuts.

## Découpage (D1)

- **34a — Cycle de vie** : EVT-05, EVT-01 (rétroplanning à la création), CHR-01, DAT-07, FAC-13,
  ARC-17.
- **34b — Fiche d'identité et tâches** : EVT-03, CHR-02.

## Lot 34a — Cycle de vie

### Partie A — Les sept statuts (EVT-05 ; D2, D3)

- **Liste fixe** (ADR 0055), libellés traduits, vocabulaire du type d'évènement conservé :
  Option, Confirmé, En préparation, Jour J, Clôturé, Reporté, Annulé.
- **Correspondance des statuts actuels** (D2), à la migration :
  - `prospect` et `quote_sent` deviennent **Option** (l'envoi d'un devis se lit sur le devis) ;
  - `confirmed` reste **Confirmé** ;
  - `done` devient **Clôturé** ;
  - `lost` devient **Annulé**, motif de perte gardé.

  L'historique des statuts suit la même correspondance.
- **Passages** (D3) :
  - un évènement naît **Option** ; la signature d'un devis le passe en **Confirmé** (comme
    aujourd'hui) ;
  - **En préparation** se pose à la main ;
  - **Jour J** s'applique de lui-même le jour de l'évènement, dans son fuseau, pour un évènement
    confirmé ou en préparation ;
  - **Clôturé** se pose à la main ; la fiche le propose dès le lendemain ;
  - **Reporté** et **Annulé** : parties B et C.
- **La frise** suit les sept statuts : Option, Confirmé, En préparation, Jour J, Clôturé ; Reporté
  et Annulé sont des écarts, affichés à part.
- **Partout où le statut compte**, la règle est réécrite et testée :
  - en cours (« Aujourd'hui », portefeuille, même jour) : Option, Confirmé, En préparation,
    Jour J, Reporté ;
  - calendrier : sûr pour Confirmé à Clôturé, provisoire pour Option et Reporté ;
  - liens des tiers : fermés pour un évènement annulé ;
  - purge RGPD : règle prospect pour une Option et pour un évènement annulé sans avoir été
    confirmé ; règle client sinon (l'historique le dit) ;
  - mode Jour J, import, jeu de recette.

### Partie B — Le report (EVT-05, CHR-01, DAT-07 ; D4, D5)

- **Chaque tâche garde sa date relative** (DAT-07, D5) : un écart en jours avec la date de
  l'évènement (J-90), en plus de sa date absolue.
  - Une tâche venue d'un modèle, ou créée à la main sur un évènement daté, est relative.
  - La déplacer à la main la **fixe** : sa date absolue fait foi, et le report ne la bouge plus.
    La fiche le montre (« date fixée ») et propose de la remettre en relatif.
  - Migration : l'écart des tâches existantes se calcule depuis la date d'application du
    rétroplanning (`tasks_scheduled_for`).
- **« Reporter l'évènement »** (D4) demande la nouvelle date, ou « date à définir ». Le statut passe
  en **Reporté**.
- **Confirmer le report** recalcule les échéances relatives (CHR-01) :
  - les tâches faites et les tâches fixées ne bougent pas ;
  - avant de valider, la planner voit la liste des tâches qui tomberaient dans le passé ;
  - le statut revient à celui d'avant le report (Confirmé ou En préparation).
- **Un simple changement de date** (sans report) suit la même règle : recalcul proposé, liste des
  tâches qui tombent dans le passé.
- **Côté devis et factures** (FAC-13, D7) : les échéances « avant l'évènement » du devis signé
  suivent la nouvelle date ; les factures déjà émises ne bougent pas.

### Partie C — L'annulation (EVT-05, FAC-13 ; D6, D7)

- **« Annuler l'évènement »** demande un motif : la liste des motifs de perte, renommée « motifs
  de perte ou d'annulation ». La confirmation nomme l'évènement (UX-07).
- **Effets** (D6) :
  - les données restent, avec la durée de conservation des règles RGPD (ADR 0024 et 0056) ;
  - les liens des tiers se ferment ;
  - les rappels de tâches aux clients s'arrêtent ;
  - une signature en attente est annulée ;
  - les factures d'acompte programmées ne s'émettent plus.
- **Avoirs** (FAC-13, D7) : la fiche liste les factures déjà émises de l'évènement, chacune avec
  « Émettre un avoir » (avoir existant, lot 4). Le calcul des frais d'annulation reste en V1.
- **Réactiver** un évènement annulé le remet en Option.

### Partie D — Rétroplanning à la création (EVT-01 ; D8)

- **Modèle de type** (D8) : un modèle de rétroplanning peut être rattaché à un type d'évènement
  (Paramètres des évènements). Les modèles de départ sont rattachés à leur type.
- **À la création**, Option comprise, le modèle du type s'applique, sinon le premier modèle. Sans
  date, il s'applique quand la date est saisie. Les postes de budget par défaut viennent avec
  l'évènement, comme aujourd'hui.
- **Listes de contrôle** : voir les ambiguïtés.

### Partie E — Le fuseau de l'évènement (ARC-17 ; D9)

- **Un fuseau par évènement** (D9), `Europe/Paris` par défaut, choisi dans la liste des fuseaux
  IANA sur la fiche.
- **Affichés dans ce fuseau** : le jour J (statut Jour J, mode Jour J), le programme, les heures
  liées à l'évènement (activité, liens, décisions). La mention du fuseau s'ajoute quand il
  diffère de `Europe/Paris`.
- Les dates sans heure (date de l'évènement, échéances) restent des dates.

## Lot 34b — Fiche d'identité et tâches

### Partie F — Les lieux (EVT-03 ; D10)

- **Une seule liste de lieux** (D10) : `event_places` porte désormais l'adresse, les horaires
  (début et fin, facultatifs) et le contact (nom, téléphone, e-mail, facultatifs). Le premier lieu
  est le lieu de réception.
- **Migration** : `venue_name` et `venue_city` deviennent le premier lieu, puis disparaissent.
  Les écrans, l'import et les exports qui les lisaient passent par la liste.
- Le contact d'un lieu est une donnée personnelle : il entre dans le registre RGPD et dans
  `privacy/v1`.

### Partie G — Invités, style et notes (EVT-03 ; D11)

- **Invités estimés et confirmés** : deux nombres sur la fiche. Le nombre confirmé se saisit à la
  main, jusqu'au module Invités.
- **Style** et **notes** : deux textes libres.
- **Interlocuteurs** : les clients de l'évènement (déjà là) et les contacts des lieux.

### Partie H — Les tâches (CHR-02 ; D12, D13)

- **Responsable prestataire** (D12) : une tâche peut être confiée à un prestataire retenu sur
  l'évènement. Elle apparaît dans son espace, où il la coche, comme le client sur son portail
  (CHR-04).
- **Pièces jointes** (D13) : fichiers joints à une tâche, avec les mêmes contrôles que les
  documents de l'évènement (lot 29b) : type vérifié par le contenu, taille limitée, antivirus,
  stockage privé, téléchargement servi après contrôle des droits.
- **Commentaires** (D13) : un fil par tâche (auteur, date, texte), lu et écrit par l'équipe.
- **Dépendances** : V1 (critère de CHR-02).

## Décisions à prendre

- **D1 — Découpage.**
  - (a) Deux PR : 34a (cycle de vie) puis 34b (fiche et tâches).
  - (b) Une seule PR.

  **Recommandation : (a).** Le 34a change le statut partout, et sa recette se fait seule.
- **D2 — Correspondance des statuts actuels.**
  - (a) Prospect et devis envoyé deviennent Option ; réalisé devient Clôturé ; perdu devient
    Annulé (motif gardé).
  - (b) Garder Prospect, Devis envoyé et Perdu en plus des sept statuts, jusqu'au pipeline
    (CRM-02, lot 44).

  **Recommandation : (a).** C'est la liste de l'ADR 0055 ; l'envoi d'un devis se lit déjà sur le
  devis, et le pipeline aura ses propres étapes.
- **D3 — Passages automatiques.**
  - (a) Jour J s'applique de lui-même le jour de l'évènement ; En préparation et Clôturé se
    posent à la main, Clôturé étant proposé dès le lendemain.
  - (b) Tous les passages à la main.
  - (c) En préparation et Clôturé automatiques aussi (au premier prestataire retenu, au lendemain).

  **Recommandation : (a).** Le jour J ne se discute pas ; la clôture, si (SC-09 : soldes,
  avis, archivage).
- **D4 — Report.**
  - (a) Le report pose « Reporté » ; les échéances se recalculent quand la planner confirme le
    report, après avoir vu les tâches qui tomberaient dans le passé.
  - (b) Recalcul immédiat dès la nouvelle date saisie.

  **Recommandation : (a)**, comme l'écrit EVT-05 (« après confirmation »).
- **D5 — Tâches créées à la main.**
  - (a) Relatives elles aussi, tant qu'elles ne sont pas déplacées à la main.
  - (b) Toujours fixées.

  **Recommandation : (a).** Une tâche « J-30 » ajoutée à la main doit suivre un report.
- **D6 — Effets d'une annulation.**
  - (a) Données gardées ; liens fermés, rappels arrêtés, signature en attente annulée, factures
    programmées suspendues.
  - (b) Données gardées, rien d'autre ne change (à la planner de tout arrêter).

  **Recommandation : (a).** Rien ne doit partir vers un client d'un évènement annulé.
- **D7 — Devis et factures au report et à l'annulation.**
  - (a) Au report, les échéances « avant l'évènement » du devis signé suivent la nouvelle date ;
    à l'annulation, la fiche propose un avoir pour chaque facture émise.
  - (b) Rien d'automatique : la planner fait elle-même.

  **Recommandation : (a).** Je ne tranche pas le juridique : l'avoir est proposé, jamais émis
  d'office, et les frais d'annulation restent en V1.
- **D8 — Rétroplanning à la création.**
  - (a) Modèle rattaché au type, appliqué dès la création, Option comprise.
  - (b) Toujours le premier modèle, sans rattachement au type.

  **Recommandation : (a).** EVT-01 dit « depuis un modèle de type ».
- **D9 — Fuseau.**
  - (a) Un fuseau par évènement, `Europe/Paris` par défaut.
  - (b) Un fuseau par organisation seulement.

  **Recommandation : (a)**, comme ARC-17 (« le fuseau de l'évènement ») : un mariage à l'étranger
  doit pouvoir vivre à son heure.
- **D10 — Lieux.**
  - (a) Une seule liste, `event_places` complétée ; `venue_name` et `venue_city` deviennent le
    premier lieu.
  - (b) Garder les deux.

  **Recommandation : (a).** Aujourd'hui le lieu se saisit deux fois (UX-02).
- **D11 — Invités confirmés.**
  - (a) Saisis à la main jusqu'au module Invités.
  - (b) Reportés au module Invités.

  **Recommandation : (a).**
- **D12 — Tâche confiée à un prestataire.**
  - (a) Visible et cochable dans l'espace du prestataire retenu.
  - (b) Étiquette seulement, sans rien dans son espace.

  **Recommandation : (a)**, comme le client (CHR-04).
- **D13 — Pièces jointes et commentaires.**
  - (a) Au 34b, réservés à l'équipe.
  - (b) Visibles aussi du client et du prestataire concernés.
  - (c) Reportés en V1.

  **Recommandation : (a).** Le partage avec les tiers suivra le portail (POR-10 : rien n'est
  partagé par défaut).

## Contrats d'événements internes (à approuver)

- `events.event.created` et `events.event.status_changed` passent en **version 2**, avec la
  nouvelle liste de statuts.
- Un événement de version 1 reste lisible : ses statuts sont traduits par la correspondance de D2.
- C'est une **modification incompatible** d'un contrat : elle demande ton accord (CLAUDE.md § 8).

## Migrations (prévision, schéma `events` seulement)

- **34a** :
  - nouveau type de statut ; correspondance de D2 pour `events` et `event_status_history` ;
    défaut Option ;
  - `events.time_zone` (texte, `Europe/Paris` par défaut) ;
  - `event_tasks.offset_days` (entier, nul pour une tâche sans date relative) et
    `event_tasks.fixed_at` (déplacée à la main) ; reprise de l'écart des tâches existantes ;
  - `task_templates.event_type_id` (facultatif) ;
  - état « reporté » : date d'avant et statut d'avant, pour confirmer le report.
- **34b** :
  - `event_places` : horaires et contact ; reprise de `venue_name` et `venue_city`, puis retrait ;
  - `events` : invités estimés et confirmés, style, notes ;
  - `event_tasks` : responsable `vendor` et prestataire retenu ;
  - nouvelles tables : pièces jointes et commentaires des tâches (RLS, `organization_id`).

Chacune a son script d'annulation et son test. L'annulation de la correspondance des statuts
ramène Reporté et En préparation à `confirmed`, Jour J à `confirmed`, Annulé à `lost`, Option à
`prospect`. Gel des déploiements : elles partent avec le déploiement d'ensemble.

## Fichiers touchés (prévision)

- `packages/db` : schéma `events`, migrations et annulations, test d'annulation.
- `packages/contracts` : statuts, événements internes en version 2.
- `apps/symbola/modules/events` : statuts, report, annulation, dates relatives, fuseau, lieux,
  tâches (responsable prestataire, pièces jointes, commentaires), `privacy/v1`.
- `apps/symbola/modules/quotes` : échéances au report, signature annulée, factures programmées
  suspendues, avoirs proposés.
- `apps/symbola/app` : fiche de l'évènement (frise, report, annulation, fuseau, lieux, invités),
  liste, calendrier, accueil, mode Jour J, portail et espace prestataire, paramètres des modèles.
- `apps/symbola/lib` : « Aujourd'hui », portefeuille, purge RGPD, import, jeu de recette.
- `packages/i18n` : libellés des statuts et des nouveaux écrans, en français et en anglais ; aide
  des écrans.
- `privacy.registry.yaml` : contact des lieux, commentaires et pièces jointes des tâches.
- `docs` : ADR 0055 (mise en œuvre), éventuel ADR du fuseau, `gap.csv`, rejeux.
- `e2e` : les 18 parcours qui touchent au statut, plus les nouveaux.

## Tests

- **Chaque critère devient un `it`** sous son identifiant.
- **Correspondance des statuts** : migration et annulation sur une base de test, historique
  compris.
- **Horloge simulée** :
  - Jour J le jour même dans le fuseau de l'évènement (veille et lendemain, passage à l'heure
    d'été, fuseau lointain) ;
  - report : J-90 suit la nouvelle date, une tâche faite ou fixée ne bouge pas, la liste des
    tâches tombées dans le passé est juste.
- **Isolation et abus** : nouvelles tables (A ne lit pas B) ; un prestataire ne voit que ses
  tâches et celles de son évènement ; un lien d'un évènement annulé ne s'ouvre plus ; pièce jointe
  refusée par le contrôle de contenu.
- **Playwright** : ordinateur et 375 px, axe-core ; option créée avec son rétroplanning, signature
  qui confirme, report avec la liste des tâches passées, annulation avec l'avoir proposé, fiche
  d'identité et tâche confiée à un prestataire.
- **Rejeu** : SC-02, étapes 1 et 6 (la demande crée une option planifiable ; la signature la
  confirme), et un report du mariage de référence (SC-03, données du jeu fictif). Résultats dans
  `docs/recette/`.

## Hors périmètre

- Pipeline en colonnes, étapes paramétrables, glisser-déposer (CRM-02, lot 44).
- Calcul des frais d'annulation (FAC-13, V1).
- Dépendances entre tâches (CHR-02, V1).
- Évènements en plusieurs temps forts (EVT-04, P1).
- Module Invités (le nombre confirmé se saisit à la main).

## Ambiguïtés relevées

- **EVT-01 cite des « listes de contrôle »** que le cahier des charges ne définit nulle part
  ailleurs ; son critère ne les mentionne pas (« trois champs suffisent »). Je propose de les
  traiter comme le rétroplanning généré, et de te poser la question si tu entends autre chose
  (par exemple la check-list du jour J).
- **Le cahier des charges n'a plus ni « Devis envoyé » ni « Perdu »** : ils reviendront avec le
  pipeline (CRM-02, P1, lot 44). D'ici là, une option perdue est « Annulé » avec son motif.
- **« Un report décale le rétroplanning après confirmation »** peut se lire « après la
  confirmation de l'évènement » ou « une fois le report confirmé ». D4 retient la seconde
  lecture ; elle couvre la première, puisqu'on ne reporte qu'un évènement daté.
- **Aucun scénario du § 17 ne joue un report** : le rejeu le fait sur le mariage de référence.
