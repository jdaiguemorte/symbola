# Relevé d'ergonomie, écran par écran — côté wedding planner (UX-13, lot 62)

Date : 20/11/2026, par Claude Code, à la demande de Julien après la recette staging (« il faut
vraiment faire un travail d'ergonomie plus prégnant pour que toute l'application soit
irréprochable »). **À valider par Julien avant tout code** : ce relevé borne le travail et propose
son découpage (§ 6). Il ne change aucun écran.

## 1. Méthode

- **Périmètre** : les écrans de l'équipe (Propriétaire et Planner). Hors périmètre : le portail du
  client, les liens des prestataires et des invités, la réservation publique, le Comptable,
  l'exploitation.
- **Jeu de données** : le jeu fictif de recette (`docs/recette/symbola-synthetic-users.json`),
  organisation de Camille, tous modules ouverts, sur `main` (341042e9) compilé.
- **Parcours** : un outil (`apps/symbola/e2e/zz-releve-ergonomie.spec.ts`, hors suite) part de
  l'accueil, suit les liens, et visite une adresse par route et par onglet. Il mesure chaque écran en
  1440 × 900 et en 375 × 812, et le capture en pleine hauteur. Aucun formulaire n'est envoyé.
- **Relecture** : les 42 écrans les plus chargés ont été relus sur capture, un par un.
- **Résultat** : 101 écrans relevés, 63 sans signal mesuré, 38 avec au moins un signal. 33 routes
  n'ont pas été atteintes, faute de donnée dans le jeu fictif (§ 7).

Les captures (202 images, 24 Mo) restent hors du dépôt ; elles se régénèrent par la commande du § 8.

### Grille

| Signal | Seuil | Pourquoi |
| --- | --- | --- |
| Hauteur de l'écran | 3,5 écrans et plus en 1440 | Au-delà, on ne voit plus ce qu'on règle |
| Champs empilés | 6 champs et plus l'un sous l'autre, même bord gauche | La carte reste à moitié vide à droite |
| Champs courts trop larges | un nombre, une date ou une heure de plus de 260 px | Un nombre de jours n'a pas besoin de 576 px |
| Boutons principaux | 3 et plus à l'écran | `DESIGN.md` : un seul bouton principal par écran |
| Même bouton répété | plus de 3 fois le même libellé d'envoi | Un formulaire par ligne au lieu d'une liste |
| Débordement | défilement horizontal en 375 px | NFR-19 |
| Petites cibles | bouton, champ ou liste de moins de 40 px en 375 px | UX-05, cibles tactiles |

Limite : la grille ne juge ni les libellés ni l'ordre des informations ; la relecture sur capture
complète les mesures (§ 3).

## 2. Mesures

| Écran | Titre | Hauteur 1440 (écrans) | Hauteur 375 | Champs empilés | Champs courts trop larges | Boutons principaux | Même bouton répété | Débord. 375 (px) | Petites cibles 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/events/[id]?onglet=programme` | Léa & Maxime | 6.9 | 11.2 | 9 | 5 | 34 | 28 |  | 282 |
| `/budget/[eventId]` | Budget — Léa & Maxime | 6.9 | 17.4 | 9 | 2 | 11 | 9 |  | 33 |
| `/events/[id]?onglet=retroplanning` | Léa & Maxime | 5.9 | 8.7 |  | 1 | 4 | 42 |  | 44 |
| `/devis/[quoteId]` | Devis D-2026-0001 | 9.1 | 12 | 14 | 3 | 14 |  |  |  |
| `/events/[id]/liens/[linkId]/apercu` | Léa & Maxime | 6.7 | 11.8 | 8 |  | 4 | 4 |  |  |
| `/events/[id]?onglet=maries` | Léa & Maxime | 5.8 | 8.3 | 13 | 6 | 9 |  |  |  |
| `/parametres` | Entreprise et TVA | 4.3 | 8.5 | 23 | 1 | 5 |  |  |  |
| `/devis/parametres/documents` | Documents | 4.2 | 8.5 | 7 |  | 3 |  |  |  |
| `/events/parametres/termes` | Termes pour désigner les clients | 4.2 | 10.9 |  |  | 14 | 14 |  |  |
| `/devis/parametres` | Paramètres des devis | 3.4 | 7.8 | 13 | 4 | 2 |  |  |  |
| `/rgpd/reglages` | Réglages RGPD | 2.9 | 7.2 | 6 | 9 | 3 |  |  |  |
| `/parametres/relances` | Relances des prospects | 2.5 | 6.5 | 6 | 5 | 3 |  |  |  |
| `/events/parametres/types` | Types d'événements | 2.3 | 5.9 | 14 |  | 8 | 7 |  |  |
| `/devis/catalogue` | Catalogue des prestations | 2.1 | 5.8 | 7 |  | 7 | 6 |  |  |
| `/events` | Événements | 1.8 | 2.4 |  |  | 4 |  | 266 | 5 |
| `/events/parametres/repas` | Types de repas | 1.6 | 5.1 |  |  | 5 | 4 |  |  |
| `/jour-j/[eventId]` | Léa & Maxime | 8.9 | 11.5 |  |  |  |  |  |  |
| `/parametres/journal` | Journal d'activité | 4.9 | 9 |  |  |  |  |  | 4 |
| `/events/[id]` | Léa & Maxime | 3.3 | 4.9 |  | 8 | 5 |  |  |  |
| `/budget/parametres` | Modèles de budget | 2.6 | 6.3 | 9 | 1 | 2 |  |  |  |
| `/events/parametres/etapes` | Étapes du pipeline | 2.4 | 6.1 |  |  | 5 | 4 |  |  |
| `/taches` | Tâches | 2.1 | 3.2 |  |  | 2 | 11 |  | 11 |
| `/events/parametres/prestataires-par-lien` | Prestataires par lien | 1.9 | 5.7 | 8 | 6 |  |  |  |  |
| `/events/new` | Nouveau prospect | 1.7 | 2 | 6 | 1 |  |  |  |  |
| `/events/parametres` | Lignes du budget par défaut | 1.4 | 5 |  |  |  | 9 |  | 18 |
| `/prestataires` | Carnet de prestataires | 1.3 | 3.5 |  |  | 2 | 12 |  | 7 |
| `/parametres/emails` | Modèles d'e-mails | 7.8 | 13.4 |  |  |  |  |  |  |
| `/budget/[eventId]/payeurs` | Payeurs et répartition | 3.9 | 5 |  |  |  |  |  |  |
| `/devis/exports-comptables` | Exports comptables | 3.4 | 7.3 | 19 |  | 2 |  |  |  |
| `/events/parametres/listes-jour-j` | Listes du jour J | 2.1 | 5.7 |  |  | 4 |  |  |  |
| `/devis/modeles-contrat` | Modèles de contrat | 1.4 | 4.9 |  | 1 |  |  |  |  |
| `/demarrage/pret` | Votre espace est prêt | 1.3 | 2 |  | 1 |  |  |  |  |
| `/devis/relances` | Relances de devis et de paiement | 1.2 | 5 |  | 1 |  |  |  |  |
| `/rgpd` | Données personnelles | 1.1 | 4.6 |  | 1 |  |  |  |  |

Les écrans corrigés au lot 61 (radar, automatisations, proposition, disponibilités, calendrier) ne
figurent pas dans ce tableau.

## 3. Constats, par famille

### A. Formulaires empilés dans une colonne étroite

Chaque champ fait 576 px et passe sous le précédent ; la moitié droite de la carte est vide, et
l'écran s'allonge.

- `/parametres` (Entreprise et TVA) : 23 champs en file, 4,3 écrans. Adresse, code postal et ville
  l'un sous l'autre ; SIRET, e-mail, téléphone, site, TVA, RCS de même.
- `/devis/exports-comptables` : le plan de comptes, dix-neuf champs « compte » puis « libellé » en
  alternance. C'est un tableau à deux colonnes.
- `/devis/parametres` : 13 champs, dont quatre nombres de jours et quatre préfixes d'un caractère
  en pleine largeur.
- `/rgpd/reglages` : neuf durées (mois, jours) en pleine largeur.
- `/events/parametres/prestataires-par-lien` : quatre tâches, chacune « intitulé » puis
  « échéance » empilés ; une ligne par tâche suffirait.
- `/events/[id]?onglet=maries` : cinq champs de coordonnées par personne, deux fois, 5,8 écrans.
- `/devis/catalogue` (nouvel article), `/events/new`, `/budget/parametres` (un champ « % » par
  ligne, dans une liste à puces), `/events/parametres/listes-jour-j`.

### B. Un formulaire et un bouton par ligne

Chaque ligne d'une liste a son propre « Enregistrer » ; l'écran aligne des dizaines de boutons
identiques.

- `/events/[id]?onglet=programme` : 28 « Enregistrer la ligne », 34 boutons principaux.
- `/budget/[eventId]` : neuf lignes « montant, total, Ajuster », dans une liste à puces ; 6,9
  écrans en 1440, 17,4 en 375.
- `/events/parametres/termes` : 14 « Enregistrer » (un par type et par langue).
- `/events/parametres/types` : sept « Enregistrer » et sept « Supprimer », champs empilés dans un
  tableau.
- `/events/parametres/etapes` : une carte par étape, avec « Renommer », « Monter », « Descendre »,
  « Retirer ».
- `/devis/catalogue` : six « Enregistrer l'article ».

### C. Plusieurs boutons principaux par écran

`DESIGN.md` en veut un seul. Relevés : programme 34, devis 14, termes 14, budget 11, mariés 9,
types 8, catalogue 7, `/parametres` 5, étapes 5, repas 5. La cause est souvent la famille B ; le
reste vient de boutons d'envoi laissés en principal faute de classe (voir F).

### D. Champs courts en pleine largeur

Nombres de jours, pourcentages, dates : `/rgpd/reglages` 9, `/events/[id]` (synthèse) 8, mariés 6,
prestataires par lien 6, `/parametres/relances` 5, programme 5, `/devis/parametres` 4, devis 3,
budget 2. Le lot 61 a créé le champ court (`field-short`) ; il n'est employé que sur deux écrans.

### E. Listes à puces et pastilles en guise de mise en page

- `/devis/catalogue` : chaque article est une puce suivie de deux pastilles, « Modifier
  « Coordination du jour J » » et « Archiver « Coordination du jour J » ». Le nom de l'objet est
  répété trois fois par ligne.
- `/events/parametres/repas` : « Renommer Adulte », « Masquer Adulte », en pastilles empilées.
- `/events/parametres/listes-jour-j`, temps forts de la synthèse d'un évènement : même motif.
- `/budget/[eventId]` et `/budget/parametres` : des listes à puces portent des formulaires.

Le nom de l'objet a sa place dans le nom accessible du bouton, pas dans son libellé visible, comme
le font déjà le carnet et les lignes du budget par défaut (`/events/parametres`).

### F. Classes de style sans règle

90 classes employées dans les écrans n'ont aucune règle dans `globals.css`. La plupart sont des
repères sans effet attendu ; celles-ci annoncent un style qui n'existe pas :

| Classe | Où | Effet à l'écran |
| --- | --- | --- |
| `danger` | annuler un rendez-vous (`/rendez-vous/[id]`, lien public), abonnement | Le bouton d'une action destructrice a l'allure du bouton principal |
| `notice-error` | rendez-vous, réservation publique | Une erreur s'affiche comme une information, en vert |
| `checkbox-label` | devis, paramètres des devis, TVA sur les débits | Aucun (le style vient de la règle de base) |
| `link-form` | décisions et liens d'un évènement | Aucun |
| `primary-button` | assistant de démarrage | Aucun (déjà principal par défaut) |
| `overdue`, `paid`, `signed`, `declined`, `pending` | budget, échéancier, signature | L'état n'a pas de couleur propre |

Six autres règles sont écrites comme l'était `form-inline` avant le lot 61 (une ligne sans
direction : posée sur un formulaire, elle pousse les champs à droite) : `inline-add`,
`matches-manual`, `pay-add`, `postpone form`, `seating-form`, `field-prep`. L'effet est relevé sur
neuf formulaires : types de repas (5), programme (2), paramètres des devis (1), jour J (1).

### G. Écrans trop longs

`/aide` 15 écrans (45 en 375), devis 9,1, jour J 8,9, modèles d'e-mails 7,8, programme 6,9, budget
6,9, aperçu d'un lien 6,7, rétroplanning 5,9, mariés 5,8, journal 4,9, `/parametres` 4,3,
documents 4,2, termes 4,2. Les familles A et B en expliquent la plupart ; le devis et les
paramètres de l'entreprise demandent en plus un découpage en rubriques.

### H. Téléphone (375 px)

- `/events` déborde de 266 px : le tableau de la liste n'est pas dans une zone défilante.
- Petites cibles : programme 282, rétroplanning 44, budget 33, lignes du budget par défaut 18,
  tâches 11, carnet 7.

### I. Menu des Paramètres

Cinquante et une rubriques en cinq groupes, dans une colonne qui défile à part : en 1440 × 900, on en
voit une quinzaine. Aucune recherche, aucun groupe repliable ; la rubrique ouverte peut se trouver
hors de vue.

### J. Tableau du journal d'activité

`/parametres/journal` : la colonne « Quoi » est écrasée (un libellé sur cinq lignes), alors que
« Sur quoi » a de la place.

## 4. Ce qui tient déjà

À garder comme références : « Aujourd'hui », la liste des contacts, la liste des devis, les
encaissements, les tâches, le pipeline, la liste des rendez-vous, la synthèse d'un évènement, les
lignes du budget par défaut (`/events/parametres` : une ligne, ses actions à droite, un seul bouton
principal en tête), les écrans vides qui donnent un exemple.

## 5. Motifs à écrire dans `DESIGN.md`

Aux trois motifs du lot 61 (liste de réglages, formulaire en ligne, valeur à copier), ajouter :

1. **Formulaire en grille** : les champs d'une fiche sur deux ou trois colonnes, regroupés par
   sens (adresse, identité, contact) ; champ court pour un nombre, une date, un code.
2. **Liste éditable** : un tableau, une ligne par élément, l'édition dans la ligne ou en panneau
   (UX-13), un seul « Enregistrer » pour la liste ou l'enregistrement automatique (UX-09).
3. **Actions de ligne** : libellés courts (« Modifier », « Archiver ») ou icônes de 44 px, le nom
   de l'objet dans le nom accessible.
4. **Bouton de danger** et **message d'erreur** : deux règles qui manquent.
5. **Rubriques d'un écran long** : sommaire en tête ou onglets, au-delà de trois écrans.

## 6. Proposition de reprise (lot 62), à valider

Une pull request par paquet, chacune avec ses mesures avant et après (même outil) et ses parcours
Playwright en 1440 et 375 px. Aucun changement de schéma n'est prévu.

| Paquet | Contenu | Écrans |
| --- | --- | --- |
| 62a — Socle | Motifs 1 à 5 dans `DESIGN.md` et `globals.css` ; règles manquantes (F) ; les six règles de ligne sans direction ; débordement de `/events` ; test qui refuse une classe sans règle | Tous, sans changer leur structure |
| 62b — Réglages | Familles A, B, D, E sur les écrans de réglage ; menu des Paramètres (I) ; journal (J) | `/parametres`, `/devis/parametres`, documents, exports comptables, catalogue, termes, types, étapes, repas, listes du jour J, prestataires par lien, RGPD, budget (modèles) |
| 62c — Fiche d'évènement | Programme, budget, mariés, rétroplanning : listes éditables, cibles tactiles | `/events/[id]` (quatre onglets), `/budget/[eventId]`, payeurs |
| 62d — Devis | Découpage du devis en rubriques, formulaires en grille | `/devis/[quoteId]`, modèles de contrat, relances |

### Décisions demandées à Julien

- **D1 — Enregistrement des listes** : (a) un seul « Enregistrer » par liste ; (b) enregistrement
  automatique à la sortie du champ, avec « Annuler » (UX-07, UX-09). Recommandation : (b) pour les
  réglages, (a) pour le programme et le budget, où une saisie à moitié faite ne doit pas partir.
- **D2 — Menu des Paramètres** : (a) groupes repliables, le groupe de la rubrique ouverte déplié ;
  (b) une page d'accueil des Paramètres en tuiles, et le menu réduit au groupe courant.
  Recommandation : (a), moins de changement pour la même lisibilité.
- **D3 — Ordre des paquets** : 62a, puis 62c (les écrans de tous les jours) avant 62b et 62d ? Ou
  les réglages d'abord, puisque la recette a commencé par eux ?
- **D4 — Maquette avant le code** : une maquette des motifs 1 à 3 sur deux écrans (Entreprise et
  TVA, programme) à valider avant 62b et 62c, comme aux lots 17 et 20 ?

## 7. Routes non relevées

Sans donnée dans le jeu fictif (aucun import, aucun plan de salle, aucun modèle enregistré, aucune
demande RGPD), ou atteintes seulement par une action : `/contacts/doublons/[pairId]`, `/devis/[quoteId]/proposition`, `/devis/modeles-contrat/[templateId]`, `/events/[id]/cloture`, `/events/[id]/cloture/avis`, `/events/[id]/consultation/[slotId]`, `/events/[id]/invites/plan`, `/events/[id]/messages/[topicId]`, `/events/[id]/plan-de-salle`, `/events/[id]/plan-de-salle/espaces/[spaceId]`, `/events/[id]/relances/[followUpId]`, `/events/[id]/scenarios`, `/events/modeles-programme/[id]`, `/events/modeles/[id]`, `/events/parametres/questionnaires/[templateId]`, `/import/[importId]`, `/import/[importId]/colonnes`, `/import/[importId]/confirmation`, `/import/[importId]/ecarts`, `/import/[importId]/journal`, `/import/[importId]/lignes`, `/import/[importId]/rapprochements`, `/import/[importId]/types`, `/parametres/messages/[id]`, `/plans-de-salle/[layoutId]`, `/prestataires/[id]`, `/prestataires/[id]/plans`, `/prestataires/[id]/plans/[spaceId]`, `/rendez-vous/[id]`, `/rendez-vous/reglages/types/[id]`, `/rgpd/demandes/[id]`, `/rgpd/oublis/[id]`, `/rgpd/purge/[id]`.

À relever dans le paquet qui les touche, après avoir complété le jeu fictif.

## 8. Refaire le relevé

Socle démarré, base chargée du jeu fictif, app compilée et démarrée en `NODE_ENV=test` :

```bash
RELEVE_DIR=/chemin/hors/du/depot pnpm --filter @symbola/app exec playwright test e2e/zz-releve-ergonomie.spec.ts --project=desktop
```

Le dossier reçoit `releve.json` (les mesures) et `shots/` (les captures en 1440 et en 375 px). Sans
`RELEVE_DIR`, le parcours est sauté.
