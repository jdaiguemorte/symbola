# Lot 28 — Budget à cinq montants, prestataires, échéancier et export

**Statut** : spécification validée par Julien le 11/11/2026, décisions D1 à D8 en (a). 28a codé le
12/11/2026 (bilan en fin de partie D), branche `lot-28-budget-cinq-montants`, PR #99. 28b détaillé
le 12/11/2026, décisions D9 à D14 à prendre, branche `lot-28b-echeancier-export` (partie du 28a).

## Contexte

Phase 1 du plan (`docs/GAP_REPORT.md` § 7) : le lot 28 ferme le parcours du budget (PAR-04) et le
scénario SC-04 (« Un devis de traiteur dans le budget »), avec les lots 26 et 27.

**Exigences** : BUD-01 à BUD-04, BUD-09, BUD-10, PRE-01, PRE-02 (toutes P0).
**Décisions déjà prises** :
- Q8 (a) : cinq montants ;
- Q9 : statuts des prestataires alignés sur le cahier des charges ;
- ADR 0054, qui remplace l'ADR 0032 au lot 28.

**Constat du 11/11/2026** :

- **Montants** : une ligne de budget par poste de l'événement, avec deux montants, **prévu** et
  **réel**, leur écart et leur historique. Une simulation (enveloppe, invités, modèle de
  répartition) remplit le prévu.
- **Enveloppe** : elle existe deux fois, le budget souhaité du client sur l'événement et le total
  de la simulation, sans seuil ni alerte.
- **Statuts** : le **poste** a cinq statuts (À trouver, Devis demandé, Devis reçu, Réservé, Non
  requis) ; chaque **prestataire consulté** a trois réponses (Contacté, Devis reçu, Décliné). Le
  passage à « Réservé » remplit le réel du budget (événement interne `events.vendor_slot.booked`).
- **Documents** : un devis se joint à une ligne ; ni contrat ni facture du prestataire.
- **Échéancier** : seul celui du planner existe (les acomptes que ses clients lui versent). Aucun
  échéancier des sommes dues aux prestataires.
- **HT et TTC** : le budget ne connaît pas le type de client. Seul le devis du planner sait si
  l'acheteur est un particulier ou un professionnel.
- **Export** : aucun. L'app sait déjà écrire un PDF (@react-pdf) et une archive ZIP (export RGPD) ;
  elle lit le XLSX sans dépendance (ADR 0022).
- **Annuaire** : fiche, type, zone, notes, documents et import en place ; pas d'évaluation ni de
  tarifs indicatifs.

## Découpage : deux lots, deux pull requests (décision D1)

- **28a — Cinq montants, statuts, enveloppe** : parties A à D. Le cœur du schéma et sa reprise.
- **28b — Échéancier, documents, HT et TTC, export, annuaire** : parties E à I.

---

## Lot 28a — Cinq montants, statuts, enveloppe

### Partie A — Cinq montants par ligne (BUD-01, décision D2)

Chaque ligne de budget porte cinq montants, en centimes, totaux recalculés à chaque saisie :

| Montant | D'où il vient |
| --- | --- |
| **Estimé** | Saisi par le planner, ou rempli par la simulation (répartition de l'enveloppe) |
| **Devisé** | Le montant du devis du prestataire, saisi ou repris du prestataire consulté |
| **Engagé** | Rempli au passage du prestataire à « Retenu » (le devisé), modifiable si le contrat diffère |
| **Payé** | La somme des échéances payées du prestataire (partie E) ; saisi à la main en 28a |
| **Reste à payer** | Calculé : engagé moins payé. Jamais saisi |

Le tableau du budget montre les cinq colonnes et leurs totaux, en 375 px comme en ordinateur (une
carte par ligne sur téléphone). L'historique des montants reste tenu, montant par montant.

**Reprise des données (D2)** : le prévu devient l'estimé, le réel devient l'engagé, le devisé reprend
le devis du prestataire retenu quand il en a un, le payé part de zéro. Migration annulable.

### Partie B — Statuts des prestataires (PRE-02, décisions Q9 et D3)

- Chaque prestataire rattaché à un événement a un statut : **Pressenti, Consulté, Devis reçu,
  Retenu, Contrat signé, Soldé**, plus **Écarté** (il a décliné, ou un autre a été retenu). Le
  cahier des charges ne nomme pas ce dernier ; sans lui, un fleuriste non choisi resterait « Devis
  reçu ».
- **« Retenu » engage la ligne de budget liée** : l'engagé prend le devisé. Le module Événements
  publie l'événement interne ; le module Budget le traite, comme aujourd'hui.
- Le **poste** n'a plus de statut à lui : il affiche le statut le plus avancé de ses prestataires
  (« À trouver » sans prestataire). « Non requis » reste une case du poste.
- **Reprise** :

  | Avant | Après |
  | --- | --- |
  | Contacté | Consulté |
  | Devis reçu | Devis reçu |
  | Décliné | Écarté |
  | Prestataire choisi d'un poste « Réservé » | Retenu |
  | Poste « Non requis » | la case « Non requis » |

### Partie C — Enveloppe et seuil d'alerte (BUD-02, décision D4)

- L'**enveloppe** est le budget souhaité du client, déjà saisi sur la fiche de l'événement. La
  simulation la répartit dans les estimés ; quand le budget souhaité est vide, l'enveloppe est le
  total de la simulation.
- Un **seuil d'alerte** en pourcentage de l'enveloppe : 90 % par défaut, réglable par
  l'organisation dans Paramètres › Budget, ajustable par événement.
- **L'alerte précède l'engagement** : faire passer un prestataire à « Retenu » quand l'engagé total
  dépasserait le seuil affiche d'abord le dépassement chiffré, avec une confirmation. Un bandeau
  rappelle le dépassement en haut du budget.

### Partie D — Tests, rejeu et documents du 28a

- Tests :
  - **intégration** : montants, totaux, reste à payer ; passage à « Retenu » ; seuil ; reprise et
    annulation de la migration ;
  - **e2e** : saisie d'une ligne complète en moins d'une minute, et alerte avant engagement, en
    ordinateur et en 375 px, avec axe-core.
- Rejeu de SC-04, étapes 1, 2 et 5, sur le jeu fictif. Les étapes 3 et 4 (partage au client et
  validation dans son portail) viennent au lot 27.
- ADR 0054 complété (correspondance et reprise), aide du budget, grille d'écart.

### Bilan du lot 28a (12/11/2026)

- **Cinq montants** (BUD-01, D2) : estimé, devisé, engagé, payé par ligne, reste à payer calculé
  (jamais saisi), écart engagé − estimé ; totaux recalculés à chaque saisie ; historique montant
  par montant. Une ligne se complète en un seul envoi, sous un volet « Modifier » ; en 375 px,
  une carte par ligne. Le service refuse désormais un montant négatif ou fractionnaire (seule
  l'action le refusait). Migration 0104 : prévu → estimé, réel → engagé, devisé repris du
  prestataire retenu, payé vide ; un import d'avant le lot s'annule encore.
- **Statuts des prestataires** (PRE-02, Q9, D3) : sept statuts par prestataire rattaché ;
  « Retenir » (ou le statut Retenu) engage la ligne et écarte les autres prestataires du poste ;
  revenir avant Retenu libère le poste. Le poste affiche le statut le plus avancé, « Non requis »
  est une case ; son formulaire garde le raccourci « prestataire retenu + montant ». Migration
  0103 : reprise du tableau ci-dessus, plus les « non retenus » d'un poste réservé → Écarté.
- **Enveloppe et seuil** (BUD-02, D4) : enveloppe = budget souhaité du client, sinon total de la
  simulation ; seuil 90 % (modèle de départ `budget-alert.json`), réglable dans Paramètres ›
  Budget, ajustable par évènement (table `budget.alert_thresholds`, RLS, journal des
  suppressions). Retenir un prestataire au-delà du seuil affiche l'engagé qui en résulterait et le
  dépassement, puis demande une confirmation (fiche de l'évènement : « Retenir », statut Retenu,
  raccourci du poste) ; un bandeau rappelle le dépassement en haut du budget. Sans module Budget,
  aucune alerte.
- **Tests** : unitaires (statut déduit, reste à payer, seuil), intégration (cinq montants,
  totaux, historique, retenue, seuils, aperçu de l'engagement, isolation RLS de la nouvelle table,
  Admin sans accès, aller-retour 0103/0104 avec des données d'avant le lot, import d'avant le lot),
  e2e `bud-01-02-cinq-montants` (ligne complète en moins d'une minute ; alerte avant
  engagement), en ordinateur et en 375 px, axe-core ; parcours existants adaptés.
- **Documents** : avenant de l'ADR 0054 ; aide du budget et des paramètres, tutoriels et visite
  guidée réécrits ; grille d'écart (BUD-02 et PRE-02 Conforme, BUD-01 Partiel) ; question Q33.
- **Écart trouvé** (Q33) : BUD-01 parle de « catégories et lignes » ; l'app tient une ligne par
  poste, alors que le jeu fictif range trois lignes sous « Lieu de réception ». Décision de
  Julien du 12/11 : (a), plusieurs lignes par poste, au début du 28b (partie E0).
- **Déploiement** (gel en cours) : migrations 0103 et 0104 à ajouter à la liste des gestes.

---

## Lot 28b — Lignes, prestataires retenus, échéancier, documents, HT et TTC, export, annuaire

**Statut** : spécification détaillée à valider (12/11/2026), décisions D9 à D14 ci-dessous. Elle
précise les parties E à I déjà validées (D5 à D8) et la partie E0 (Q33, décision du 12/11).

### Constat du 12/11/2026 (après le 28a)

- **Une ligne par poste** : `budget.budget_lines` porte une contrainte d'unicité sur le poste.
- **Un seul prestataire retenu par poste** : le poste garde un prestataire choisi
  (`selected_candidate_id`, nom et montant) ; « Retenir » écarte tous les autres.
- **Le jeu fictif va plus loin** (EV-REF-01) : 24 lignes dans 9 postes ; « Musique » a deux
  prestataires retenus (DJ Solal, Duo Cordes), « Hébergement et transport » aussi (le domaine,
  les navettes) ; le domaine apparaît dans deux postes ; la robe et le costume n'ont pas de
  prestataire ; le devis du traiteur (9 600 €) se répartit sur quatre lignes ; chaque échéance
  vise une ligne (« Acompte du traiteur, 30 % » sur « Dîner, 120 couverts ») et nomme un payeur.
- **Documents** : des devis seulement, sans nature.
- **HT et TTC** : seul le devis du planner connaît le type de client (`clientKind`).
- **Export** : l'app écrit déjà un ZIP et un CSV (`@symbola/privacy`, archive RGPD) et des PDF
  (@react-pdf) ; logo, couleur et nom de l'organisation sont dans les réglages des documents
  (module Devis, lot 17).
- **Accueil** : le bloc « Encaissements à venir » montre ce que les clients doivent au planner ;
  rien pour ce que le planner ou ses clients doivent aux prestataires.
- **Carnet** : ni évaluation ni tarifs.

### Découpage (décision D9)

Le 28b ouvre trois chantiers de schéma (lignes, prestataires retenus, échéances) avant ceux, plus
légers, de la TVA, de l'export et du carnet. Recommandation : deux PR, **28b** (parties E0, E1, E,
F) puis **28c** (parties G, H, I).

### Partie E0 — Lignes sous chaque catégorie (BUD-01, Q33)

- Le **poste** de l'évènement devient la **catégorie** (nom, icône, ordre, case « Non requis » :
  inchangés). Il porte des **lignes** : libellé, prestataire (facultatif, l'un des prestataires
  rattachés à la catégorie), cinq montants, ordre.
- La catégorie totalise ses lignes (cinq montants, écart) ; le budget totalise les catégories.
- **Écrans** : le budget montre chaque catégorie, son total, puis ses lignes ; « Ajouter une
  ligne » sous chaque catégorie ; une ligne se renomme, change de prestataire, se supprime (ses
  montants sortent des totaux, son historique reste au journal). En 375 px : une carte par
  catégorie, ses lignes dedans.
- **Simulation** : la confirmation écrit l'estimé de chaque catégorie sur sa première ligne
  (créée au nom de la catégorie si besoin).
- **Vue du client** : les catégories et leurs totaux, comme aujourd'hui une ligne par poste (le
  détail et la validation au portail : lot 27).
- **Import du budget** : une colonne facultative « Libellé » ; sans elle, la première ligne de la
  catégorie, comme aujourd'hui.
- **Reprise** : chaque ligne actuelle devient la première ligne de sa catégorie, au libellé de la
  catégorie, avec son historique et ses devis ; son prestataire est le prestataire retenu du
  poste. Annulation refusée tant qu'une catégorie a plus d'une ligne.
- **Registre RGPD** : le libellé est un texte libre (« Robe de Léa ») : déclaré, exporté, effacé
  avec les données de l'évènement.

### Partie E1 — Plusieurs prestataires retenus par catégorie (PRE-02, décision D10)

- Une catégorie peut avoir **plusieurs prestataires retenus** (le DJ et le duo de la Musique).
- « Retenir » écarte les **concurrents encore en lice** (Pressenti, Consulté, Devis reçu) ; un
  prestataire déjà retenu le reste. Remplacer un prestataire retenu : le passer à « Écarté ».
- La catégorie affiche le statut le plus avancé (28a) et le nom de ses prestataires retenus. Le
  raccourci du formulaire (« prestataire retenu + montant ») ajoute un prestataire retenu.
- **Ce que « Retenu » engage** (décision D11) : les lignes liées à ce prestataire prennent leur
  devisé comme engagé ; une ligne liée sans devisé, si elle est la seule, prend le montant du
  devis ; sans ligne liée, une ligne est créée au nom du prestataire, au montant du devis (devisé
  et engagé). L'alerte du 28a précède l'engagement, sur le total qui en résulte.
- **Contrat d'événement** : `events.vendor_slot.booked` gagne le prestataire concerné (champ
  facultatif, ajout compatible) ; le module Budget engage ses lignes.
- **Schéma `events`** : le nom, le montant et le prestataire choisi du poste deviennent inutiles
  (tout est porté par les prestataires rattachés) ; ils sont gardés en lecture le temps de la
  reprise, puis retirés par une migration du même lot.

### Partie E — Échéancier (BUD-03, décisions D7 et D12)

- Une **échéance** vise une ligne : libellé (acompte, deuxième échéance, solde…), montant (fixe,
  ou pourcentage de l'engagé, recalculé s'il change ; base : décision D12), date, statut (à payer,
  payé le…).
- Sur l'écran, les échéances se regroupent **par prestataire** (BUD-03) ; une ligne sans
  prestataire a les siennes (la robe).
- **Payé** : dès qu'une ligne a des échéances, son payé est la somme des échéances payées (il ne
  se saisit plus) ; sans échéance, il reste saisi à la main (28a).
- **Rappels** : bloc « Échéances prestataires » dans « Aujourd'hui » (7 prochains jours et retards),
  lien vers la ligne ; absent sans module Budget.
- Le **payeur** du jeu fictif (mariés, parents) relève de BUD-06 (P1) : hors du lot.

### Partie F — Documents de la ligne (BUD-04)

- Chaque document joint a une **nature** : devis, contrat ou facture ; plusieurs par nature.
  Reprise : les devis joints restent des devis.
- Depuis la ligne, chaque document s'ouvre en un clic (règles de dépôt inchangées). Le devis joint
  au prestataire consulté (lot 11) s'affiche aussi sur ses lignes, sans copie.

### Partie G — HT et TTC selon le client (BUD-09, D5) — 28c

- **Taux de TVA par ligne**, saisi comme au catalogue ; 20 % par défaut, valeur de départ dans
  les modèles (données, ADR 0007) ; 0 % pour un prestataire en franchise.
- Montants saisis TTC. **Particulier** : TTC seul. **Entreprise** (type d'acheteur du devis de
  l'évènement, D5) : HT et TTC côte à côte, HT calculé par taux (arrondi de l'ADR 0059).

### Partie H — Export XLSX et PDF (BUD-10, D6) — 28c

- **XLSX** écrit par l'app (archive ZIP existante, sans dépendance) : une feuille « Budget »
  (catégories, lignes, cinq montants, écart, totaux ; HT et TTC si entreprise) et une feuille
  « Échéances » ; montants au format monétaire, en-têtes à la couleur de l'organisation.
- **PDF** (@react-pdf) : même contenu, logo, couleur et nom repris des réglages des documents ;
  sans module Devis, la mise en forme par défaut.
- Export journalisé (famille « exports »), sans donnée personnelle au journal.

### Partie I — Annuaire (PRE-01, D8) — 28c

- La fiche du carnet gagne une **évaluation** (1 à 5) et des **tarifs indicatifs** (texte libre) ;
  l'évaluation s'affiche dans le carnet et se filtre (« au moins 4 ») ; les deux s'importent.

### Tests, rejeu et documents

- **28b** : intégration (lignes, totaux par catégorie, plusieurs retenus, engagement des lignes,
  échéances et payé, rappels, documents par nature, reprise et annulation des migrations,
  isolation des nouvelles tables, Admin) ; e2e (lignes d'une catégorie, échéancier, rappels) en
  ordinateur et en 375 px ; rejeu de SC-04, étapes 1, 5 et 6 (acompte, deux échéances, acompte
  payé ; totaux au centime) ; jeu fictif chargé ligne par ligne, avec ses échéances.
- **28c** : intégration (HT et TTC, export) ; e2e (export, fiche du carnet) ; rejeu de SC-04.
- ADR 0054 complété ; aide, centre d'aide, grille d'écart.

---

## Migrations

- **28a** : cinq montants sur `budget.budget_lines`, avec reprise ; statuts des prestataires
  rattachés et case « Non requis » du poste (schéma `events`) ; seuil d'alerte (organisation et
  événement).
- **28b** : plusieurs lignes par catégorie (libellé, prestataire, ordre), échéances, nature des
  documents (schéma `budget`) ; plusieurs prestataires retenus, retrait du prestataire choisi du
  poste après reprise (schéma `events`).
- **28c** : taux de TVA par ligne (schéma `budget`) ; évaluation et tarifs indicatifs (schéma
  `vendors`).

Chaque migration ne touche que le schéma de son module, et a son script d'annulation.

## Hors périmètre

- Le partage d'une dépense au client et sa validation dans le portail (SC-04, étapes 3 et 4), le
  budget en trois chiffres côté client, et l'absence des honoraires dans la liste des dépenses du
  client : lot 27 (POR-05).
- Les liens personnels des prestataires : lot 26.
- L'e-mail de rappel d'une échéance : avec les modèles d'e-mails (lot 38).
- La répartition par payeur (mariés, familles, entreprise) : BUD-06, P1.
- La comparaison de devis et les scénarios d'options : BUD-05, P1.

## Décisions à prendre

- **D1 — Découpage.** (a) Deux lots, 28a puis 28b, avec deux PR. (b) Un seul lot.
  **Recommandation : (a).** Le 28a porte le schéma et sa reprise, à valider à part.

- **D2 — Correspondance des montants et reprise.**
  - (a) Prévu → estimé ; réel → engagé ; devisé repris du devis du prestataire retenu ; payé à zéro.
  - (b) Prévu → estimé ; réel → payé.

  **Recommandation : (a).** Le réel d'aujourd'hui est rempli au passage à « Réservé » : c'est un
  engagement, pas un paiement.

- **D3 — Statuts.**
  - (a) Les six statuts du cahier des charges, plus « Écarté », par prestataire rattaché ; le poste
    affiche le plus avancé, et garde sa case « Non requis ».
  - (b) Les six statuts seuls.

  **Recommandation : (a).** Sans « Écarté », un prestataire non choisi reste « Devis reçu » pour
  toujours.

- **D4 — Enveloppe et seuil.**
  - (a) L'enveloppe est le budget souhaité du client ; seuil à 90 % par défaut, réglable par
    l'organisation et par événement.
  - (b) L'enveloppe est le total de la simulation.

  **Recommandation : (a).** Le budget souhaité se saisit déjà sur la fiche de l'événement, avec
  les coordonnées du client ; la simulation reste l'outil qui le répartit.

- **D5 — Type de client pour HT et TTC.**
  - (a) Le type d'acheteur du devis de l'événement : particulier ou professionnel, particulier sans
    devis.
  - (b) Une case « client professionnel » sur l'événement.

  **Recommandation : (a).** Sans réglage manuel, comme le demande BUD-09. Le contact unique
  (lot 36) en deviendra la source.

- **D6 — Export XLSX.**
  - (a) Écrit par l'app : un classeur simple, en-têtes à la couleur de l'organisation, montants au
    format monétaire, sans dépendance (comme la lecture, ADR 0022).
  - (b) Une dépendance (exceljs), à ajouter avec son ADR.

  **Recommandation : (a).** L'archive ZIP s'écrit déjà dans l'app ; un classeur simple suffit à
  BUD-10.

- **D7 — Rappels des échéances des prestataires.**
  - (a) Bloc dans « Aujourd'hui », à 7 jours, plus les échéances en retard.
  - (b) Ce bloc, plus un e-mail.

  **Recommandation : (a).** C'est le critère de BUD-03 ; les e-mails viendront avec leurs modèles
  (lot 38).

- **D8 — Annuaire.**
  - (a) Évaluation (1 à 5) et tarifs indicatifs (texte libre).
  - (b) L'évaluation seule.

  **Recommandation : (a).** PRE-01 cite les deux ; le texte libre évite d'inventer une grille de
  tarifs.

### Décisions du 28b (à prendre)

- **D9 — Découpage.** (a) Deux PR : 28b (lignes, prestataires retenus, échéancier, documents) puis
  28c (HT et TTC, export, annuaire). (b) Une seule PR.
  **Recommandation : (a).** Le 28b change deux schémas et reprend des données ; le 28c est léger.

- **D10 — Prestataires retenus par catégorie.**
  - (a) Plusieurs retenus par catégorie ; « Retenir » écarte les concurrents encore en lice, pas
    les prestataires déjà retenus.
  - (b) Un seul retenu par catégorie (comme au 28a) ; un second prestataire du même genre ouvre
    une seconde catégorie (« Musique de la cérémonie »).

  **Recommandation : (a).** Le jeu fictif en a deux dans « Musique » et dans « Hébergement et
  transport » ; (b) obligerait la planner à découper ses catégories selon ses prestataires.

- **D11 — Ce que « Retenu » engage.**
  - (a) Les lignes du prestataire : chacune prend son devisé ; une seule ligne sans devisé prend
    le devis ; sans ligne, une ligne est créée à son nom.
  - (b) Toujours une seule ligne par prestataire, au montant du devis.

  **Recommandation : (a).** Le devis du traiteur couvre quatre lignes (dîner, vin d'honneur,
  brunch, pièce montée) ; (b) perdrait ce détail.

- **D12 — Base d'une échéance en pourcentage.**
  - (a) Pourcentage de l'engagé de **la ligne** visée.
  - (b) Pourcentage de l'engagé **du prestataire** (toutes ses lignes de la catégorie).

  **Recommandation : (b).** L'acompte de 30 % du traiteur vaut 30 % de son devis (2 880 €), pas de
  la seule ligne du dîner (1 980 €) ; l'échéance reste rattachée à une ligne pour le payé.

- **D13 — Payé saisi à la main.**
  - (a) Dès qu'une ligne a des échéances, son payé en est la somme et ne se saisit plus ; sans
    échéance, il reste saisi.
  - (b) Payé toujours calculé : il faut créer une échéance pour tout paiement.

  **Recommandation : (a).** La robe payée en une fois ne demande pas d'échéancier.

- **D14 — Champs du poste devenus inutiles** (nom, montant, prestataire choisi).
  - (a) Retirés au 28b, après la reprise, par une migration du schéma `events` (annulable).
  - (b) Gardés, tenus à jour par le prestataire retenu principal.

  **Recommandation : (a).** Deux sources pour le même fait finissent par diverger ; la recherche,
  le carnet et la vue du client lisent les prestataires rattachés.
