# Lot 61 — Retours de la recette staging du 20/11/2026 (côté wedding planner)

**Statut** : fait sur la branche `lot-61-retours-recette-staging`. Aucune migration, aucun changement
de schéma ni de contrat. Reste la recette de Julien sur le staging, et le lot d'ergonomie d'ensemble
(§ D), à cadrer avec lui.

## Contexte

Premiers retours de Julien le 20/11/2026, après le déploiement de `main` (66f6f55e) en recette. Il
teste d'abord la partie wedding planner et demande un travail d'ergonomie bien plus poussé sur toute
l'application. Causes relevées dans le code, chacune reproduite en local sur le jeu fictif :

- **Six rubriques du menu des Paramètres s'ouvrent hors des Paramètres** (Exports comptables,
  Relances, Modèles de proposition, de contrat, de devis, d'évènement). Le menu des réglages
  (`app-shell.tsx`) et la règle « cet écran est un réglage » (`settings-paths.ts`) étaient deux
  listes tenues à la main ; les lots 31, 43 et 58 ont ajouté leurs rubriques à la première sans la
  seconde. L'écran s'affichait donc sans le menu des réglages, sous « Devis et factures » ou
  « Événements ».
- **Modèles de proposition, mot d'accueil rétréci** : la page rangeait chaque modèle dans une
  `item-list`, dont la règle met tout formulaire en grille de trois colonnes ; le mot d'accueil se
  retrouvait dans la colonne du milieu.
- **Radar des risques et Automatisations, champs décalés** : la classe `form-inline` ne disait pas
  sa direction. La règle de base met un formulaire en colonne ; `items-end` poussait alors chaque
  champ contre le bord droit. Même défaut sur les formulaires des plans de salle. Et la classe
  `button-secondary` n'existait que dans les tutoriels : neuf boutons qui la portaient restaient des
  boutons principaux.
- **« Retirer l'adresse » (Mon compte, Mon calendrier)** : le retrait était fait, mais la zone
  verte qui montre l'adresse restait à l'écran, gardée par l'état du formulaire de création.
- **« Relances » et « Délais de relance »** : deux rubriques, dans deux groupes, aux noms voisins.
  La première règle les e-mails envoyés aux clients (proposition qui expire, échéance impayée) ; la
  seconde, le suivi des prospects (alertes d'« Aujourd'hui », relances préparées, brochure).
- **Relier un agenda (Rendez-vous, Mes disponibilités)** : la semaine prenait plus de deux écrans
  (sept blocs de quatre champs empilés) avant d'arriver à « Mes agendas », dont le mode d'emploi
  tenait en un paragraphe.

## A. Navigation

### UX-13 (L13-HUB-16) — Une rubrique des Paramètres s'ouvre dans les Paramètres

- **Étant donné** le menu des Paramètres, **quand** elle clique sur n'importe quelle rubrique,
  **alors** l'écran s'ouvre avec le menu des réglages, la rubrique y est allumée, et le menu
  principal allume « Paramètres » (ni « Devis et factures », ni « Événements »).
- Les sous-écrans d'une rubrique (un modèle de devis ouvert) restent dans les Paramètres.
- Les écrans de métier (un devis, un évènement, les encaissements) ne deviennent pas des réglages.
- **Fait** : une seule liste, `app/settings-menu.ts`, lue par le menu et par `settings-paths.ts`.
  Une rubrique ajoutée au menu est donc un écran de réglage, sans seconde liste à tenir.

### UX-10 — « Relances » et « Délais de relance » ne se confondent plus

- « Délais de relance » devient **« Relances des prospects »** (menu, titre, aide, lien depuis
  « Aujourd'hui », foire aux questions). Son bloc intérieur devient « Relances préparées ».
- « Relances » devient **« Relances de devis et de paiement »** (menu, titre, aide).
- Chaque écran dit en une phrase ce que règle l'autre et y mène.

## B. Écrans corrigés

### FAC-02 — Modèles de proposition

- Un modèle par carte, avec sa pastille (« Modèle de départ » ou sa version).
- Le mot d'accueil prend la largeur de la carte, huit lignes, avec une phrase qui dit où le client
  le lit ; les places des blocs sont en grille (un, deux, trois par ligne selon la place).
- Les photos et la suppression d'un modèle restent sous le formulaire.

### GC-02, HUB-28 — Radar des risques et Automatisations

- **Liste de réglages** : une seule carte, une ligne par règle ou par automatisme. À gauche le
  titre, la phrase et l'état ; à droite les commandes (case, seuil, « Enregistrer » ; « Couper » ou
  « Activer », délai) ; dessous, le journal. En colonne à 375 px et quand le menu des réglages
  prend la place.
- Le seuil et le délai sont des champs courts ; « Enregistrer » d'une ligne est un bouton
  secondaire.
- La pastille « Indisponible : … » passe à la ligne au lieu de faire déborder l'écran à 375 px.

### HUB-29 — Mon calendrier (Mon compte, et programme d'un évènement)

- **Quand** elle retire l'adresse, **alors** la zone qui la montrait disparaît, et l'écran dit
  « Adresse retirée : elle ne répond plus. ».
- L'adresse créée s'affiche avec son bouton « Copier l'adresse » sur la même ligne, puis trois
  étapes numérotées (copier, ouvrir l'abonnement dans Google Agenda, Apple Calendrier ou Outlook,
  coller) et le délai de relecture de l'agenda.
- Une pastille dit l'état (« Adresse active », « Aucune adresse ») ; « Nouvelle adresse » et
  « Retirer l'adresse » sont côte à côte.

### RDV-02 — Mes disponibilités et agendas

- Un sommaire en tête mène à « Ma semaine », « Jours fermés » et « Mes agendas ».
- La semaine tient en une ligne par jour (« De … à …, puis de … à … ») ; les champs passent à la
  ligne à 375 px. Les noms des champs envoyés au serveur ne changent pas.
- « Mes agendas » : chaque agenda relié est une ligne (nom, état en pastille, dernière lecture,
  « Relire maintenant », « Retirer ») ; « Relier un agenda » donne les étapes, agenda par agenda,
  puis le nom et l'adresse côte à côte. La note de confidentialité est gardée, sous le formulaire.

## C. Design system

Trois motifs ajoutés à `globals.css` et décrits dans `DESIGN.md` (aucun nouveau jeton) : **liste de
réglages** (`setting-list`, `setting-row`), **formulaire en ligne** corrigé (`form-inline`,
`field-short`), **valeur à copier** (`copy-field`). Le **bouton secondaire** (`button-secondary`)
et le **bouton principal désigné** (`button-primary`) existent maintenant partout.

## D. Suite proposée : l'ergonomie de toute l'application

Le relevé est fait : [`docs/audits/2026-11-20-releve-ergonomie.md`](../audits/2026-11-20-releve-ergonomie.md)
(101 écrans mesurés, constats par famille, découpage du lot 62 et décisions à prendre).

Julien attend un travail d'ergonomie d'ensemble. Ce lot traite les écrans qu'il a signalés ; il
n'a pas relu les autres. Proposition pour le lot suivant, à valider par Julien avant le code :

1. **Relevé écran par écran** du côté wedding planner, en taille ordinateur et en 375 px, sur le
   jeu fictif : chaque écran contre une grille courte (une action principale, champs à la bonne
   largeur, pas de formulaire empilé sur plusieurs écrans, états vides, libellés du métier).
2. **Motifs communs** tirés du relevé, écrits dans `DESIGN.md` et portés par `packages/ui`.
3. **Reprise par familles d'écrans** (réglages, listes, fiches, formulaires longs), une pull
   request par famille, chacune avec ses captures avant et après.

## Fichiers touchés

- `apps/symbola/app/settings-menu.ts` (nouveau), `settings-paths.ts`, `settings-nav.tsx`,
  `app-shell.tsx`, `settings-menu.test.ts` (nouveau).
- `apps/symbola/app/globals.css`, `DESIGN.md`.
- `apps/symbola/app/devis/modeles-proposition/`, `app/devis/relances/page.tsx`,
  `app/parametres/relances/page.tsx`, `app/parametres/radar/`, `app/parametres/automatisations/`.
- `apps/symbola/app/calendar-address-form.tsx`, `calendar-actions.ts`, `app/profil/page.tsx`,
  `app/events/[id]/page.tsx`, `app/rendez-vous/disponibilites/page.tsx`.
- `packages/i18n/src/messages/fr.json`, `en.json`.
- `apps/symbola/e2e/lot-61-retours-recette-staging.spec.ts` (nouveau),
  `e2e/lot-20-retours-recette.spec.ts` (libellé).

## Vérifications

- Tests unitaires : `settings-menu.test.ts` (sept cas), jetons de design, traductions FR/EN.
- Playwright, ordinateur et 375 px, axe-core et absence de défilement horizontal :
  `lot-61-retours-recette-staging.spec.ts` (trois parcours).
- Rejeu à l'écran sur le jeu fictif (Camille, SC-03) : les six rubriques, les quatre écrans repris,
  création puis retrait de l'adresse du calendrier.
