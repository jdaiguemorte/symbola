# Lot 62 — Ergonomie d'ensemble, côté wedding planner

**Statut** : spécification proposée le 20/11/2026, **à valider par Julien** (décisions D1 à D5).
Rien ne se code avant. Aucun changement de schéma de données, aucun contrat d'API ou d'évènement
modifié, aucune dépendance nouvelle.

Sources : le relevé [`docs/audits/2026-11-20-releve-ergonomie.md`](../audits/2026-11-20-releve-ergonomie.md)
(101 écrans mesurés, 38 avec défauts) et les maquettes du lot
(https://claude.ai/artifact/Mj8xuv1bdgyWjqFBe4xyDe : huit planches, « aujourd'hui » et « après »
côte à côte pour chaque paquet).

Quatre paquets, **une pull request chacun**, partis de `main` : `lot-62a-socle`,
`lot-62b-reglages`, `lot-62c-fiche-evenement`, `lot-62d-devis`. Le 62a passe d'abord ; les trois
autres ne touchent pas les mêmes écrans et peuvent avancer en parallèle après lui (voir « Travail
en parallèle »).

## Contexte

En recette staging le 20/11/2026, Julien demande « un travail d'ergonomie plus prégnant pour que
toute l'application soit irréprochable ». Le lot 61 a corrigé les écrans qu'il avait signalés ; le
relevé a mesuré tous les autres. Les défauts se rangent en familles : formulaires empilés dans une
colonne étroite, un formulaire et un bouton par ligne, plusieurs boutons principaux par écran,
champs courts en pleine largeur, puces et pastilles en guise de mise en page, classes de style sans
règle, débordement et petites cibles sur téléphone, menu des Paramètres de 51 rubriques.

Exigences du cahier des charges servies : UX-13 (un seul patron : mêmes emplacements, mêmes
libellés), UX-05 (téléphone d'abord), UX-07 et UX-09 (annuler, enregistrement automatique), UX-12
(simple d'abord), UX-14 et NFR-17 (accessibilité), NFR-19 (de 360 à 1 920 px).

## Mesure commune aux quatre paquets

Chaque paquet rejoue l'outil de relevé (`apps/symbola/e2e/zz-releve-ergonomie.spec.ts`) avant et
après, et donne le tableau des écarts dans sa pull request. **Critères communs**, pour tout écran
repris :

- un seul bouton principal visible (hors panneau ouvert) ;
- aucun nombre, date, heure ou code de plus de 260 px de large ;
- aucune suite de six champs ou plus empilés sur un même bord en 1440 px ;
- aucun débordement horizontal en 375 px ; aucune cible tactile de moins de 44 px ;
- axe-core sans violation ; textes en français et en anglais ; aide de l'écran à jour.

## 62a — Socle

### UX-13 — Les motifs existent une fois, dans `DESIGN.md` et `globals.css`

- **Étant donné** `DESIGN.md`, **alors** il décrit cinq motifs nouveaux : formulaire en grille,
  liste éditable, actions de ligne, bouton de danger, message d'erreur (avec le message
  d'attention), et la règle des rubriques d'un écran long.
- **Étant donné** `globals.css`, **alors** chaque motif a ses classes, sans valeur hors jeton (le
  test `design-tokens.test.ts` reste vert).
- Les composants qui portent un comportement (liste éditable, sommaire de rubriques) vont dans
  `packages/ui` ; les motifs de pure mise en page restent des classes.

### UX-13 — Une classe employée a une règle

- **Étant donné** un écran qui emploie une classe de style, **quand** la suite de tests tourne,
  **alors** un test échoue si la classe n'a aucune règle dans `globals.css` et n'est pas déclarée
  comme repère (liste d'exceptions tenue dans le test).
- Les règles qui manquent sont écrites : `danger`, `notice-error`, `overdue`, `paid`, `signed`,
  `declined`, `pending`. Les classes sans objet (`checkbox-label`, `link-form`, `primary-button`)
  sont retirées des écrans.
- **Quand** elle annule un rendez-vous, **alors** le bouton est un bouton de danger (bord et texte
  `critical`), plus un bouton principal.
- **Quand** une réservation échoue, **alors** le message est un message d'erreur (`critical-soft`,
  libellé « Erreur »), plus un message vert.

### UX-13 — Une ligne de formulaire dit sa direction

- Les six règles écrites comme l'était `form-inline` (`inline-add`, `matches-manual`, `pay-add`,
  `postpone form`, `seating-form`, `field-prep`) disent leur direction. **Alors** aucun formulaire
  n'aligne ses champs à droite par accident (neuf formulaires relevés : types de repas, programme,
  paramètres des devis, jour J).

### NFR-19 — La liste des évènements tient en 375 px

- **Étant donné** `/events` en 375 px, **alors** aucun défilement horizontal de la page (266 px
  aujourd'hui) ; le tableau défile dans sa zone, ou passe en cartes.

**Fichiers** : `DESIGN.md`, `apps/symbola/app/globals.css`, `packages/ui/src/`, un test nouveau
(`apps/symbola/app/css-classes.test.ts`), `app/events/page.tsx` et sa liste, `app/rendez-vous/`,
`app/rdv/`, `app/reserver/`, les écrans qui portent les classes retirées.

## 62b — Écrans de réglage

### UX-12 — Formulaires en grille

- **Entreprise et TVA** (`/parametres`) : trois cartes (identité, adresse, coordonnées imprimées)
  et un seul « Enregistrer la fiche » ; la TVA dans sa carte, en formulaire en ligne. **Alors**
  l'écran tient en deux écrans au plus en 1440 px (4,3 aujourd'hui) et compte un bouton principal
  (cinq aujourd'hui).
- **Paramètres des devis** (`/devis/parametres`), **RGPD** (`/rgpd/reglages`), **prestataires par
  lien**, **modèles de budget**, **listes du jour J**, **nouvel article du catalogue**, **relances
  des prospects** : mêmes règles ; les durées et les préfixes en champs courts.
- **Exports comptables** : le plan de comptes est un tableau (compte, libellé), une ligne par
  compte.

### UX-13 — Listes éditables

- **Termes des clients**, **types d'évènements**, **étapes du pipeline**, **types de repas**,
  **catalogue** : un tableau, une ligne par élément, des actions de ligne à libellé court
  (« Modifier », « Archiver », « Monter », « Descendre »), le nom de l'élément dans le nom
  accessible. **Alors** plus aucun bouton d'envoi n'est répété plus de trois fois à l'écran
  (14 « Enregistrer » sur les termes aujourd'hui).
- L'enregistrement suit la décision D1.

### UX-13 — Menu des Paramètres

- Selon D2. Dans les deux cas : **quand** elle ouvre une rubrique, **alors** cette rubrique est
  visible et allumée dans le menu sans faire défiler, en 1440 × 900 ; un champ « Chercher un
  réglage » filtre les rubriques par leur nom.

### UX-13 — Journal d'activité

- La colonne « Quoi » a la largeur de son texte : aucun libellé sur plus de deux lignes en 1440 px.

**Fichiers** : `app/parametres/` (page et formulaires), `app/devis/parametres/`,
`app/devis/exports-comptables/`, `app/devis/catalogue/`, `app/events/parametres/` (termes, types,
étapes, repas, listes du jour J, prestataires par lien), `app/budget/parametres/`,
`app/rgpd/reglages/`, `app/parametres/relances/`, `app/parametres/journal/`, `app/settings-nav.tsx`,
`app/settings-menu.ts`, traductions.

## 62c — Fiche d'évènement

### UX-13, UX-05 — Programme du jour J

- **Étant donné** le programme d'un évènement, **alors** chaque séquence est une ligne d'un
  tableau (début, fin, durée, séquence, lieu, qui) avec deux actions de 44 px ; **quand** elle
  clique « Modifier », **alors** la ligne s'ouvre en place, une seule à la fois.
- **Alors** l'écran compte un bouton principal (34 aujourd'hui), aucune cible de moins de 44 px en
  375 px (282 aujourd'hui), et tient en trois écrans au plus en 1440 px pour treize séquences (6,9
  aujourd'hui).
- La diffusion, le PDF, l'agenda et l'import d'un chrono restent en tête de la carte.

### UX-13, UX-05 — Budget d'un évènement

- **Étant donné** les lignes du budget, **alors** elles forment un tableau (la ligne et ses montants),
  éditable en place ; plus de liste à puces ni de « Ajuster » par ligne.
- **Alors** l'écran tient en huit écrans au plus en 375 px (17,4 aujourd'hui).
- Les calculs, les cinq montants et l'arrondi (ADR 0059) ne changent pas.

### UX-12 — Mariés (clients)

- Les coordonnées de chaque personne sont un formulaire en grille (e-mail et téléphone côte à
  côte ; adresse, code postal, ville) ; **alors** l'onglet tient en trois écrans au plus en 1440 px
  (5,8 aujourd'hui).

### UX-05 — Rétroplanning

- Aucune cible de moins de 44 px en 375 px (44 aujourd'hui) ; les cases à cocher gardent leur
  comportement (UX-07, « Annuler » après coche).

**Fichiers** : `app/events/[id]/page.tsx` et ses composants (programme, clients, rétroplanning),
`app/budget/[eventId]/` (table des lignes, simulation, payeurs), traductions.

## 62d — Devis

### UX-12 — Le devis en rubriques

- **Étant donné** un devis, **alors** l'écran s'ouvre sur ses lignes et ses totaux ; la page de
  proposition, le paiement et l'acompte, l'acheteur et la livraison, les honoraires et commissions
  sont des rubriques (onglets), chacune à son adresse (`?rubrique=`).
- **Alors** l'écran tient en trois écrans au plus en 1440 px (9,1 aujourd'hui) et compte un bouton
  principal, celui de la prochaine action (« Envoyer le devis », puis « Faire signer », selon le
  statut) (14 aujourd'hui).
- Un encart « Avant d'envoyer » résume l'état de chaque rubrique et y mène.
- Aucune règle de calcul, de numérotation, de signature ou d'immutabilité ne change (DAT-04).

### UX-12 — Modèles de contrat, relances

- `/devis/modeles-contrat` (création) et `/devis/relances` : formulaires en grille, champs courts.

**Fichiers** : `app/devis/[quoteId]/page.tsx` et ses sections (lignes, proposition, échéancier,
acheteur, honoraires, signature, factures), `app/devis/modeles-contrat/`, `app/devis/relances/`,
traductions.

## Décisions demandées à Julien

- **D1 — Enregistrement des listes.** (a) Un seul « Enregistrer » par liste, avec le nombre de
  lignes modifiées et « Annuler les modifications ». (b) Enregistrement à la sortie du champ, avec
  « Annuler la dernière modification » (UX-07, UX-09). **Recommandation** : (b) pour les réglages
  (62b), (a) pour le programme et le budget (62c), où une saisie à moitié faite ne doit pas partir
  chez le client. La maquette du programme bascule entre les deux.
- **D2 — Menu des Paramètres.** (a) Groupes repliables, celui de la rubrique ouverte déplié, et
  recherche. (b) Page d'accueil des Paramètres en tuiles, menu réduit au groupe ouvert.
  **Recommandation** : (a). Les deux sont maquettés.
- **D3 — Ordre.** Après 62a : (a) 62c d'abord (les écrans de tous les jours), (b) 62b d'abord (là
  où la recette a commencé), (c) les trois en parallèle. **Recommandation** : (c), les paquets ne
  partagent pas d'écran.
- **D4 — Maquettes.** Valent-elles accord sur les motifs, ou faut-il une maquette par écran avant
  chaque paquet ? **Recommandation** : les huit planches valent accord ; un écran qui s'en écarte
  est montré dans la pull request avant fusion.
- **D5 — Regroupement des rubriques (seulement si D2 = b).** Les tuiles regroupent 51 rubriques en
  26 ; ce regroupement est à valider nommément.

## Ambiguïtés

- **Enregistrement d'une liste d'un coup (D1 a)** : il demande une action serveur qui enregistre
  plusieurs lignes dans une transaction (programme, budget). Elle reste dans le module concerné
  (`service.ts`), sans changer le schéma ; ses tests d'isolation sont à écrire (CLAUDE.md § 6).
- **Devis en rubriques** : un devis signé ou facturé montre aujourd'hui tout sur une page ; les
  rubriques ne doivent rien cacher de ce qui engage (échéancier, signature, factures). À vérifier
  rubrique par rubrique dans le 62d.
- **Routes non relevées** (33, faute de donnée dans le jeu fictif : imports, plans de salle,
  demandes RGPD, modèles ouverts) : chaque paquet relève celles qui le concernent après avoir
  complété le jeu fictif.
- **`DESIGN.md`** : l'outil de validation de son format signale une référence qu'il ne connaît pas
  (`{elevation.float}`, l'ombre des panneaux). Sans effet sur l'app ; à corriger dans le 62a ou à
  laisser, au choix de Julien.

## Travail en parallèle

Le 62a touche `globals.css` et `DESIGN.md` ; il est fusionné avant que les autres partent. Ensuite,
62b, 62c et 62d n'ont aucun écran en commun. Leurs seuls fichiers partagés sont les traductions
(`fr.json`, `en.json`) et, par ajouts, `globals.css` : chaque paquet ajoute ses règles dans un bloc
à son nom et ses textes dans les espaces de noms de ses écrans, pour des fusions sans conflit.

## Définition de « terminé »

Celle du cahier des charges (§ 1). Pour chaque écran repris : ses critères ci-dessus couverts par
un parcours Playwright en taille ordinateur et en 375 px, les critères communs mesurés par l'outil
de relevé, le scénario concerné rejoué sur le jeu fictif (SC-02 pour le devis, SC-03 pour la fiche
d'évènement), l'aide et les captures du centre d'aide à jour, la ligne UX-13 de `docs/gap.csv`
mise à jour.
