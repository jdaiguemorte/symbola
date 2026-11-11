# Lot 28 — Budget à cinq montants, prestataires, échéancier et export

**Statut** : spécification à valider par Julien. Branche `lot-28-budget-cinq-montants` (partie du
lot 24b, pas encore fusionné, pour la suite des migrations). Le lot change le schéma et ferme un
parcours P0 : il attend ta validation. Huit décisions en fin de document.

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

---

## Lot 28b — Échéancier, documents, HT et TTC, export, annuaire

### Partie E — Échéancier par prestataire (BUD-03, décision D7)

- Sur la ligne d'un prestataire retenu : acompte, paiements intermédiaires et solde, chacun avec un
  montant (fixe ou pourcentage de l'engagé), une date et un statut (à payer, payé le…). Le payé de
  la ligne est la somme des échéances payées.
- **Rappels** : un bloc « Échéances prestataires » dans « Aujourd'hui » liste les échéances des
  7 prochains jours et celles en retard, avec le lien vers la ligne.
- Données nouvelles, sans donnée personnelle ; registre RGPD tenu.

### Partie F — Documents de la ligne (BUD-04)

Une ligne a trois emplacements : **devis, contrat, facture** du prestataire. Chacun s'ouvre en un
clic, avec les règles de dépôt actuelles (type vérifié, antivirus, stockage privé, servi après
contrôle des droits).

### Partie G — HT et TTC selon le client (BUD-09, décision D5)

- Les montants se saisissent TTC, avec un **taux de TVA par ligne** (20 % par défaut ; 0 % pour un
  prestataire en franchise).
- **Particulier** : TTC seul. **Entreprise** : HT et TTC côte à côte. Le mode vient du type de
  client, sans réglage manuel.
- Arrondi de l'ADR 0059 (par taux).

### Partie H — Export XLSX et PDF (BUD-10, décision D6)

- Le budget de l'événement s'exporte en **XLSX** et en **PDF** : lignes, cinq montants, totaux,
  échéances, et HT et TTC si le client est une entreprise.
- Mise en forme de l'organisation : logo, couleur et nom repris des réglages des documents (lot 17).
- Export journalisé (famille « exports »).

### Partie I — Annuaire des prestataires (PRE-01, décision D8)

La fiche du carnet gagne une **évaluation** (1 à 5) et des **tarifs indicatifs** (texte libre).
Les deux sont importables depuis un tableur, comme les autres champs.

### Tests, rejeu et documents du 28b

- Tests :
  - **intégration** : échéances et payé, rappels, documents, HT et TTC, export ;
  - **e2e** : échéancier, export et fiche du carnet, en ordinateur et en 375 px.
- Rejeu de SC-04, étape 6 (« Camille marque l'acompte comme payé »), avec les mesures : totaux
  exacts au centime.
- Aide, fiche du centre d'aide, grille d'écart.

---

## Migrations

- **28a** : cinq montants sur `budget.budget_lines`, avec reprise ; statuts des prestataires
  rattachés et case « Non requis » du poste (schéma `events`) ; seuil d'alerte (organisation et
  événement).
- **28b** : échéances des prestataires et nature des documents (schéma `budget`) ; taux de TVA par
  ligne ; évaluation et tarifs indicatifs (schéma `vendors`).

Chaque migration ne touche que le schéma de son module, et a son script d'annulation.

## Hors périmètre

- Le partage d'une dépense au client et sa validation dans le portail (SC-04, étapes 3 et 4), le
  budget en trois chiffres côté client, et l'absence des honoraires dans la liste des dépenses du
  client : lot 27 (POR-05).
- Les liens personnels des prestataires : lot 26.
- L'e-mail de rappel d'une échéance : avec les modèles d'e-mails (lot 38).

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
