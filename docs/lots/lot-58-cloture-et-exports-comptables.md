# Lot 58 — Clôture d'un évènement, évaluation des prestataires, modèle, exports comptables

**Statut** : spécification proposée le 19/11/2026, **validée par Julien le 19/11/2026** : toutes les décisions retenues dans leur option recommandée (a), changements de schéma compris (accord donné). Les réponses qu'il a
données le 18/11 sont reprises telles quelles (notées « Julien, 18/11 »). Le lot change les schémas
`events`, `vendors` et `quotes` : validation explicite requise (CLAUDE.md § 8). Aucune dépendance
nouvelle.

Branche `lot-58-cloture-et-exports`, partie de `main`. Aucune version intermédiaire n'est
déployée (gel des déploiements).

## Contexte

Parcours **PAR-09** (« Clôturer et capitaliser ») :

1. à J+1, Symbola propose la clôture : soldes à facturer, paiements de prestataires restants ;
2. la facture de solde part ; le client reçoit un remerciement et une demande d'avis ;
3. la planner note ses prestataires et consigne trois leçons ;
4. le bilan affiche le budget final, le temps passé et la marge ;
5. l'évènement s'archive ; les invités sont purgés à l'échéance (RGP-08) ;
6. l'évènement peut devenir un modèle.

Moment de vérité : la planner voit ce que l'évènement lui a réellement rapporté. Réussite :
clôture complète en moins de quinze minutes.

Scénario **SC-09** (SU-01 Camille, SU-12 Mathilde, expert-comptable) :

1. liste de clôture ;
2. facture de solde, acomptes déduits ;
3. Camille note trois prestataires ;
4. bilan avec le budget final et la marge ;
5. **Mathilde exporte le trimestre : le total se rapproche au centime, la numérotation est
   continue** ;
6. l'évènement devient un modèle, sans donnée personnelle.

Exigences :

- **PAR-09** (P1, Partiel).
- **EVT-08** (P1) — Duplication d'un évènement et enregistrement comme modèle. *Critère* : le
  modèle ne contient aucune donnée personnelle.
- **FAC-11** (P1, Partiel) — Exports comptables (journal des ventes et des encaissements), au
  format convenu avec le comptable ; accès en lecture pour lui. *Critère* : l'export d'un mois se
  rapproche du total facturé au centime.
- **PRE-08** (P1, Partiel) — Évaluation après l'évènement et historique des collaborations.
  *Critère* : la note reste interne à l'organisation.

## Ce qui existe aujourd'hui

- **Facture de solde** qui déduit les acomptes en HT et en TVA (lots 31c et 41) ; relances
  d'impayés (lot 43) ; échéancier des prestataires et remises du jour J (lots 28 et 51).
- **Honoraires et commissions** (lot 48b) : honoraires hors des dépenses, commissions et factures
  de commission au prestataire.
- **Bilan du lendemain** du jour J (lot 51) : pointages, incidents, listes et remises (opérationnel,
  pas financier).
- **Purge des invités** à J+30 avec préavis (lot 49) ; purge RGPD automatique (lot 34).
- **Exports existants** :
  - CSV des écritures d'une année de la chaîne des pièces (`app/devis/parametres/archive/[annee]/
    ecritures`, lot 23b) ;
  - e-reporting en CSV (`app/devis/e-reporting`) ;
  - export complet de l'organisation (lot 35a).
- **Rôle Comptable** en lecture (lot 52) : `/comptable` donne factures, avoirs, encaissements,
  journaux et e-reporting. Il ne voit ni évènement ni contact.
- **Forme juridique et régime de TVA** de l'organisation (`hub.organization_profiles` : micro-
  entreprise, EI, SARL, SAS… ; franchise ou assujetti).
- **Réponse 8 de l'expert-comptable** :
  - micro-entreprise : journal des recettes en CSV (date d'encaissement, mode, numéro de facture,
    client) ;
  - société : journal des ventes et des encaissements, FEC en fin d'exercice, PDF d'origine
    rattachés ;
  - accès en lecture seule pour le comptable.

## Une seule PR

Le lot tient en une PR : un parcours (PAR-09), un scénario (SC-09), et des exports qui en sont
l'étape 5.

## Partie A — La liste de clôture (PAR-09, étapes 1 et 2)

- À **J+1** (fuseau de l'évènement), l'évènement affiche « À clôturer » dans « Aujourd'hui » et
  sur sa fiche, avec une **liste de clôture** cochable :
  - solde à facturer (bouton qui ouvre la facture de solde existante) ;
  - échéances de prestataires restantes et remises non pointées ;
  - commissions à facturer (lot 48b) ;
  - évaluations des prestataires (partie B) ;
  - temps passé (partie C, facultatif) ;
  - trois leçons ;
  - demande d'avis au client.
- **Demande d'avis** (Julien, 18/11 : option a) : un e-mail de remerciement au client, avec un
  **lien d'avis réglé par la planner** (Google, Mariages.net, son site), relu avant l'envoi. Sans
  lien réglé, l'étape propose seulement le remerciement.
- La liste se fait en moins de quinze minutes (mesure de PAR-09, test chronométré sur le jeu
  fictif).

## Partie B — L'évaluation des prestataires (PRE-08)

- Pour chaque prestataire retenu (Julien, 18/11) :
  - une **note de 1 à 5** ;
  - **trois critères facultatifs** : ponctualité, qualité, relation ou rapport qualité-prix ;
  - un **commentaire**.
- **Toujours interne** à l'organisation (critère) : jamais au client, au prestataire, dans un export
  vers un tiers ou dans une recherche publique.
- **Historique des collaborations** sur la fiche du prestataire : évènements, notes, moyenne,
  dernière collaboration. Il reprend l'évaluation existante du lot 11, s'il y en a une.

## Partie C — Le bilan financier, le temps passé, la marge (PAR-09, étape 4)

- **Budget final** : les cinq montants du budget du client, figés à la clôture (estimé, engagé,
  payé, reste, écart à l'enveloppe).
- **Marge** (Julien, 18/11) : **honoraires + commissions − frais propres de la planner**. Les frais
  propres se saisissent librement à la clôture (déplacements, sous-traitance) et ne vont jamais
  dans le budget du client.
- **Temps passé** (Julien, 18/11) :
  - **déclaratif, au bon vouloir de la planner** : un total d'heures saisi à la clôture ;
  - s'il est saisi, le bilan affiche la marge par heure et nourrit un **tableau de bord** discret ;
  - s'il ne l'est pas, **aucune obligation** : le tableau de bord n'est **pas mis en avant**
    (absent de l'accueil, pas de rappel, pas de case rouge).
- Le bilan est interne : jamais montré au client ni au comptable.

## Partie D — Archivage et modèle (PAR-09, étapes 5 et 6 ; EVT-08)

- **Archiver** (Julien, 18/11) : l'évènement passe en **lecture seule**, sort des listes courantes
  (évènements, pipeline, Aujourd'hui), mais reste **consultable** par un filtre « Archivés » et par
  la recherche. Les purges prévues (invités, RGPD) suivent leur calendrier, inchangé.
- **Dupliquer un évènement** (EVT-08) : une copie à une nouvelle date, avec le rétroplanning, le
  programme, la structure du budget et les questionnaires. Les dates sont recalculées. Elle ne
  contient ni client, ni invité, ni devis, ni facture.
- **Enregistrer comme modèle** (EVT-08, Julien, 18/11) : programme, rétroplanning, structure du
  budget (catégories et lignes, sans montants réels), questionnaires, et **les prestataires en
  option**. Ce sont des contacts professionnels, gardés seulement si la planner coche la case.
  **Aucune donnée personnelle de client** (critère), vérifiée par un contrôle qui refuse
  d'enregistrer un modèle contenant un nom de client, un e-mail ou un téléphone de particulier.

## Partie E — Les exports comptables (FAC-11)

- **Format selon la forme juridique** (Julien, 18/11 : « anticiper plusieurs possibilités ») ; la
  forme et le régime sont déjà dans le profil :
  - **micro-entreprise** : **journal des recettes** (CSV) : date d'encaissement, mode, numéro de
    facture, client, montant ;
  - **société ou EI au réel** : **journal des ventes** et **journal des encaissements** (CSV), avec
    comptes de vente et de TVA réglables (plan de comptes par défaut en données, modifiable), et
    **FEC** en fin d'exercice, au format de l'administration ;
  - **PDF d'origine** des factures et avoirs de la période, dans une archive ZIP à part.

  La planner (ou le comptable) peut choisir un autre format que celui proposé par défaut.
- **Période** : mois, trimestre, année ou exercice ; en-tête qui donne la période, l'organisation
  et la date de l'export.
- **Rapprochement** (critère, SC-09 étape 5) : chaque export porte un **contrôle** visible. Le total
  de l'export doit égaler le total facturé et encaissé de la période, au centime. La numérotation
  doit être continue, sans trou dans la période, avec les avoirs. Un écart **bloque** l'export et
  s'explique (« facture F-2027-0042 absente »).
- **Le comptable** (lot 52) les télécharge depuis `/comptable` ; la planner aussi, depuis le module
  des devis. **L'export est le minimum, l'accès comptable un plus** (Julien, 18/11). Chaque export
  va au journal d'audit.
- **Données fictives** (`is_demo`) : jamais dans un export comptable (règle existante).

## Décisions à prendre

- **D1 — Le format par défaut.**
  - (a) Déduit de la forme juridique du profil, modifiable à chaque export.
  - (b) Choisi une fois pour toutes dans les réglages.

  **Recommandation : (a).** La forme juridique est déjà saisie ; un changement de statut (passage
  en société) suit sans réglage oublié.
- **D2 — Le FEC.**
  - (a) Produit pour les sociétés et les EI au réel, au format de l'administration, avec un
    contrôle de structure.
  - (b) Pas de FEC : journaux seulement, le comptable le fait.

  **Recommandation : (a)**, c'est ce que demande la réponse 8 pour une société. Le format exact
  (comptes, libellés) est à relire par l'expert-comptable (EC-9).
- **D3 — Le contrôle de rapprochement.**
  - (a) Bloquant, avec l'écart expliqué.
  - (b) Avertissement seulement.

  **Recommandation : (a).** Un export qui ne se rapproche pas ferait faire au comptable le travail
  que Symbola doit éviter ; l'écart est toujours une anomalie à corriger d'abord.
- **D4 — Les frais propres de la planner.**
  - (a) Saisie libre à la clôture (libellé, montant), hors budget du client.
  - (b) Rattachés aux lignes du budget.

  **Recommandation : (a).** Ce sont ses frais, pas ceux de l'évènement du client (BUD-08).
- **D5 — La garde « aucune donnée personnelle » du modèle.**
  - (a) Le modèle ne copie que des structures. Un contrôle refuse un nom, un e-mail ou un téléphone
    de particulier dans les textes copiés (notes, tâches, programme), et montre où il se trouve.
  - (b) Confiance dans la planner.

  **Recommandation : (a)**, c'est le critère d'EVT-08.

## Points pour les conseils

- **Expert-comptable** :
  - **EC-9** — Le FEC produit par Symbola : le plan de comptes par défaut (706 prestations, 4457
    TVA collectée, 411 clients, 512 banque, 4191 acomptes clients), les libellés et le journal des
    ventes conviennent-ils ? Faut-il un compte client par client (comptes auxiliaires) ?
- **Avocat** : rien. La demande d'avis renvoie vers une plateforme tierce choisie par la planner,
  sans incitation ni condition.

## Migrations (prévision)

Numérotation : à partir du premier numéro libre de `main` (0184 aujourd'hui) ; une PR fusionnée
après une autre renumérote ses migrations **et** leur date (`when`).

- **`events`** :
  - `event_closings` (évènement, clôturé le, par, temps passé facultatif, leçons, frais propres,
    budget figé) ;
  - `events.archived_at` ;
  - modèles d'évènement (`event_templates`, avec les prestataires en option).
- **`vendors`** : `vendor_evaluations` (prestataire, évènement, note, trois critères facultatifs,
  commentaire, par, le).
- **`quotes`** :
  - réglages d'export comptable (format par défaut, plan de comptes) ;
  - `accounting_exports` (période, format, totaux, contrôle, par, le).
- Données de départ : plan de comptes par défaut, textes de remerciement et de demande d'avis
  (FR et EN).

## Tests (prévision)

- **PAR-09** :
  - liste de clôture à J+1 dans le fuseau de l'évènement ;
  - clôture complète en moins de quinze minutes (chronométrée, jeu fictif) ;
  - demande d'avis avec le lien de la planner, relue avant l'envoi.
- **PRE-08** :
  - note et critères ;
  - jamais visibles du client, du prestataire, du comptable, ni dans un export vers un tiers (test
    d'abus) ;
  - historique et moyenne.
- **Bilan** :
  - marge = honoraires + commissions − frais propres, au centime ;
  - temps passé facultatif ;
  - sans temps saisi, aucun rappel ni mise en avant.
- **EVT-08** :
  - duplication à une autre date ;
  - modèle sans donnée personnelle, et contrôle qui refuse un téléphone ou un e-mail de
    particulier ;
  - prestataires gardés seulement si la case est cochée.
- **FAC-11** :
  - journal des recettes (micro), journaux des ventes et des encaissements, FEC (société) ;
  - export d'un mois rapproché au centime ;
  - numérotation continue avec les avoirs ;
  - écart bloquant et expliqué ;
  - données fictives exclues ;
  - comptable : téléchargement en lecture, aucune écriture.
- **Isolation et abus** (SEC-36) sur chaque table neuve.
- **Rejeu** : SC-09 complet ; `docs/recette/SC-09.md`.

## Hors périmètre

- Rapprochement bancaire automatique (ADR 0087).
- Envoi direct de l'export au logiciel du comptable (connecteurs).
- Chronométrage du temps passé tâche par tâche (option b écartée par Julien).

## Travail en parallèle

Ce lot peut avancer en même temps que :
- les lots **35b** (reprise d'un export) et **35c** (fermeture d'un espace), dont les spécifications
  sont validées et débloquées ;
- le lot **60** (plans de salle), validé.

Les schémas ne se recoupent pas : 35b et 35c touchent `hub` et l'export complet, 60 crée le module
`floorplans`. Il restera seulement les conflits habituels sur les traductions, `gap.csv` et
`globals.css`.
