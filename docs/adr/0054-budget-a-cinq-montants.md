# ADR 0054 — Budget à cinq montants

- Statut : accepté (décisions Q8 a et Q9 de Julien du 11/11/2026) ; mise en œuvre au lot 28 (28a : cinq montants, statuts, enveloppe ; avenant ci-dessous)
- Date : 2026-11-11
- Remplace : [0032](0032-budget-remplace-les-postes.md) (prévu, réel, écart), qui reste en
  vigueur jusqu'au lot 28.
- Exigences : BUD-01 à BUD-04, PRE-01, PRE-02 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

Le budget actuel a deux montants par ligne, prévu et réel, et leur écart (ADR 0032). Le nouveau
cahier des charges en demande cinq, une enveloppe avec seuil d'alerte, un échéancier par
prestataire et des liens vers les documents.

## Décision

1. **Cinq montants par ligne** (BUD-01) : estimé, devisé, engagé, payé, reste à payer. Le reste à
   payer se calcule (engagé moins payé), il ne se saisit jamais. Les totaux se recalculent à
   chaque saisie.
2. **Enveloppe globale du client** et alerte de dépassement à un seuil réglable, affichée avant
   l'engagement de la dépense (BUD-02).
3. **Échéancier par prestataire** (BUD-03) : acompte, paiements intermédiaires, solde, dates,
   statut, rappels. Chaque échéance proche apparaît dans « Aujourd'hui ».
4. **Liens** entre ligne, prestataire et documents (devis, contrat, facture), ouverts en un clic
   (BUD-04).
5. **Statuts des prestataires** alignés sur le nouveau document (Q9, PRE-01, PRE-02).
6. **Gardé de l'ADR 0032** : le budget existe dès la création de l'évènement ; icône par ligne ;
   lignes par défaut fournies par les modèles de départ (données, ADR 0007) ; montants en
   centimes entiers.
7. **Reprise** : la correspondance des colonnes actuelles (prévu, réel) avec les cinq montants
   et la migration sont fixées au lot 28, qui change le schéma et attend la validation de
   Julien.

## Conséquences

- Le planner voit d'un coup d'œil ce qui est estimé, promis, signé, payé et dû.
- Le lot 28 touche les tables du budget, les écrans, les exports et l'aide.

## Avenant du 12/11/2026 — Correspondance et reprise (lot 28a, décisions D2 à D4)

Décisions de Julien du 11/11/2026 (`docs/lots/lot-28-budget-cinq-montants.md`, toutes en (a)).

1. **Correspondance des montants (D2)** : le prévu devient l'**estimé**, le réel devient
   l'**engagé** (il était rempli au passage du poste à « Réservé » : c'est un engagement, pas un
   paiement). Le **devisé** reprend le devis du prestataire retenu quand il en a un ; le **payé**
   part de vide. L'historique garde ses lignes : `planned` devient `estimated`, `actual` devient
   `committed`. Un import du budget fait avant le lot s'annule encore (ses anciens noms sont
   traduits à la lecture).
2. **Statuts (D3)** : chaque prestataire rattaché à un évènement a l'un des sept statuts
   Pressenti, Consulté, Devis reçu, Retenu, Contrat signé, Soldé, Écarté. Le poste n'a plus de
   statut propre : il affiche le plus avancé de ses prestataires (« À trouver » sans prestataire
   ou quand tous sont écartés) ; « Non requis » est une case du poste. Retenir un prestataire
   écarte les autres prestataires du poste.
3. **Reprise des statuts** (migration 0103) : Contacté → Consulté, Devis reçu → Devis reçu,
   Décliné → Écarté ; le prestataire choisi d'un poste « Réservé » → Retenu ; un poste réservé
   sans prestataire consulté reçoit un prestataire Retenu (son nom et son montant) ; les autres
   prestataires d'un poste retenu (« non retenus ») → Écarté ; un poste « Non requis » coche sa
   case.
4. **« Retenu » engage la ligne** : le module Événements publie `events.vendor_slot.booked`
   (contrat inchangé) quand un prestataire devient retenu ou que son montant change ; le module
   Budget écrit l'engagé, et le devisé s'il est encore vide.
5. **Enveloppe et seuil (D4)** : l'enveloppe est le budget souhaité du client (fiche de
   l'évènement), sinon le total de la simulation. Le seuil d'alerte vaut 90 % par défaut (modèle
   de départ `budget-alert.json`, ADR 0007), se règle par organisation (Paramètres › Budget) et
   s'ajuste par évènement (table `budget.alert_thresholds`, RLS). Avant de retenir un
   prestataire, l'app calcule l'engagé total qui en résulterait ; au-delà du seuil, le
   dépassement chiffré s'affiche et la planner confirme. Un bandeau rappelle le dépassement en
   haut du budget. Sans module Budget, rien ne s'affiche (ARC-06).
6. **Lecture d'un autre schéma** : la reprise du devisé (migration 0104) lit le schéma `events`
   (prestataire retenu et son devis) sans y écrire ; c'est la seule entorse à « une migration ne
   touche que son schéma » (DAT-09), limitée à une lecture, faite une fois, après 0103.
7. **Annulation** : 0104 rend le prévu et le réel (le devisé, le payé, leur historique et les
   seuils sont perdus) ; 0103 rend la réponse du prestataire et le statut du poste (Pressenti
   devient Contacté ; Retenu, Contrat signé et Soldé deviennent Devis reçu, leur poste
   « Réservé » ; Écarté devient Décliné, y compris pour un prestataire seulement « non retenu »).

## Avenant du 12/11/2026 — Lignes, prestataires retenus, échéancier (lot 28b, décisions Q33, D9 à D14)

Décisions de Julien du 12/11/2026 (Q33 en (a) ; D9 à D14 en (a), sauf D12 en (b)).

1. **Catégories et lignes (Q33)** : le poste de l'évènement est la catégorie ; il porte plusieurs
   lignes (`budget.budget_lines` perd son unicité par poste, gagne un libellé, un prestataire
   rattaché et un ordre). La catégorie totalise ses lignes ; la simulation et les écrans qui ne
   désignent qu'une catégorie visent sa première ligne. Reprise (migration 0105) : chaque ligne
   devient la première de sa catégorie, au libellé du poste, liée à son prestataire retenu.
2. **Plusieurs prestataires retenus par catégorie (D10)** : « Retenir » écarte les concurrents
   encore en lice (Pressenti, Consulté, Devis reçu), pas les prestataires déjà retenus. Le poste
   ne porte plus de nom, de montant ni de prestataire choisi (D14, migration 0106) : ses
   prestataires rattachés les portent ; un nom saisi sur un poste sans prestataire de ce nom
   devient un prestataire rattaché « Pressenti ».
3. **Ce que « Retenu » engage (D11)** : l'événement `events.vendor_slot.booked` (version 2) porte
   le prestataire. Une seule ligne du prestataire : son devis en est le devisé et l'engagé ;
   plusieurs lignes : chacune engage son devisé ; aucune ligne : une ligne libre de la catégorie
   (sans prestataire ni engagé, celle de la simulation) devient la sienne, sinon une ligne est
   créée à son nom. Précision apportée au code : reprendre la ligne libre garde l'écart à
   l'estimé de la simulation (SC-04 : « la ligne Traiteur passe à engagé »).
4. **Échéancier (D7, D12, D13)** : une échéance vise une ligne (`budget.vendor_payments`, RLS) ;
   montant fixe, ou pourcentage de l'engagé du prestataire (toutes ses lignes de la catégorie ;
   de la ligne sans prestataire), recalculé tant qu'elle n'est pas payée. Payée, son montant est
   figé. Dès qu'une ligne a des échéances, son payé en est la somme et ne se saisit plus. Les
   échéances non payées des 7 prochains jours et en retard sont rappelées dans « Aujourd'hui ».
5. **Documents (BUD-04)** : chaque document joint a une nature (devis, contrat, facture).
6. **Lecture d'un autre schéma** : la reprise de 0105 lit le schéma `events` (libellé et
   prestataire choisi du poste), avant que 0106 ne retire ce dernier ; même entorse limitée que
   0104.
7. **Annulation** : 0106 rend au poste un prestataire choisi (le premier engagé) ; 0105 est
   refusée tant qu'une catégorie a plusieurs lignes, et perd les échéances et la nature des
   documents.

## Avenant du 12/11/2026 — HT et TTC, export, annuaire (lot 28c, décisions D5, D6 et D8)

Décisions de Julien du 11/11/2026 (D5, D6 et D8 en (a)).

1. **Taux de TVA par ligne (BUD-09)** : `budget.budget_lines` gagne un taux en points de base
   (0 à 10000, borné par la base), saisi comme au catalogue (« 20 », « 5,5 »). Vide, la ligne
   prend le taux de départ des modèles (`budget-vat.json`, 20 %, ADR 0007) : aucune reprise de
   données (migration 0107), et un changement du taux de départ ne vaut que pour les lignes
   sans taux saisi. 0 % pour un prestataire en franchise.
2. **Le mode suit le client (D5)** : le type d'acheteur du devis de l'événement, lu par la
   porte d'entrée du module Devis ; précision apportée au code : le devis signé le plus récent,
   à défaut le plus récent. Sans devis, ou sans module Devis : particulier. Particulier : TTC
   seul ; professionnel : le HT sous chaque montant TTC (écran, portail du client, export).
   Le contact unique (lot 36) en deviendra la source.
3. **Calcul du HT (ADR 0059)** : montants saisis TTC ; HT d'une ligne = TTC × 10000 / (10000 +
   taux), arrondi au centime le plus proche, la moitié vers le haut. Les totaux HT d'une
   catégorie et du budget additionnent les TTC par taux avant de les convertir, une fois par
   taux : la somme des HT des lignes peut différer d'un centime du total HT (3 × 1,00 € à 20 %
   font 2,50 € HT, pas 2,49 €).
4. **Export (BUD-10, D6)** : classeur XLSX écrit par l'app (`lib/xlsx-workbook.ts`, SpreadsheetML
   dans l'archive ZIP existante, sans dépendance) : feuilles « Budget » (catégories, lignes, cinq
   montants et écart ; taux, HT et TTC côte à côte pour un professionnel) et « Échéances » ;
   montants au format monétaire, en-têtes à la couleur des documents de l'organisation (module
   Devis ; sans lui, la couleur de départ). Une cellule de texte n'est jamais une formule. PDF
   (@react-pdf, A4 paysage) : même contenu, logo et nom de l'organisation, filigrane « Document
   fictif » pour un événement d'essai. Route `/budget/<id>/export?format=xlsx|pdf` : session,
   rôle, organisation, module, identifiant et événement vérifiés côté serveur ; un événement
   d'une autre organisation répond comme un objet inexistant. Journal : `budget.budget.exported`
   (famille « exports »), avec le format et le nombre de lignes, aucun nom.
5. **Annuaire (PRE-01, D8)** : la fiche du carnet gagne une évaluation (1 à 5, bornée par la
   base) et des tarifs indicatifs (texte libre), migration 0108. L'évaluation s'affiche dans le
   carnet (étoiles, lues « 4 sur 5 ») et se filtre (« au moins N », paramètre `note`). Les deux
   s'importent : l'évaluation se lit en chiffre, sur 5 ou en étoiles ; une note illisible laisse
   la fiche sans évaluation. Les synonymes « tarifs » et « prices » passent des prestations
   (note interne) aux tarifs indicatifs. RGPD : déclarés au registre, recherchés et exportés avec
   la fiche, effacés à l'oubli.
6. **Annulation** : 0108 retire l'évaluation et les tarifs ; 0107 retire le taux (les montants
   TTC restent).
