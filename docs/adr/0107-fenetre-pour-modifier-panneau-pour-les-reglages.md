# ADR 0107 — La fenêtre pour modifier, le panneau latéral pour les réglages

- Statut : accepté (décision de Julien du 21/11/2026 sur les maquettes M11 et M12 : « Grande fenêtre (A) »).
- Date : 2026-11-21
- S'écarte de : UX-13 du cahier des charges (« Liste, puis fiche, puis panneau latéral d'édition »).
- Complète : [0033](0033-refonte-ux-panneaux-et-aide-par-reperes.md) (panneau latéral commun, `SidePanel`).
- Exigences : UX-09, UX-13, BUD-01, BUD-03, BUD-04 ; spécification
  `docs/lots/lot-63-retours-recette-planner.md` (Q42 bis, paquet 63c), maquettes M8, M11, M12.

## Contexte

La recette du 21/11 a montré deux défauts du panneau latéral d'édition (UX-13) :

- il est trop étroit pour une modification longue (la fiche complète d'un prestataire, une ligne de
  budget avec trois échéances) : les tableaux deviennent des cartes, il faut défiler ;
- la roue « Réglages » d'un écran menait à une autre page, et la planner perdait son parcours (#29).

## Décision

1. **Toute modification se fait dans une fenêtre** (dialog natif en modal) : tâche, échéance, fiche
   complète d'un prestataire, ligne de budget avec son échéancier, évènement.
   - Fond assombri, focus piégé, Échap ferme ; jamais deux fenêtres l'une sur l'autre.
   - Courte : une colonne (`window-short`). Longue : jusqu'à 860 px, deux colonnes ou rubriques à
     gauche (`window-long`), « Suivant » ou « ligne suivante » pour enchaîner sans y être obligée,
     enregistrement à chaque rubrique.
   - Sur téléphone, la fenêtre prend tout l'écran, avec « Retour » et les mêmes rubriques.
2. **Le panneau latéral ne sert qu'aux réglages d'un écran et à la consultation rapide**, là où voir
   l'écran d'origine compte. Jamais pour une modification longue.
3. **Les réglages d'un écran s'ouvrent dans le panneau, sans quitter l'écran** : la roue « Réglages »
   (`SettingsLink`) mène à `/reglages/<clé>` ; sur une navigation depuis l'app, la route est
   interceptée (emplacement parallèle `app/@panel`, route `(.)reglages/[key]`) et la page des réglages
   s'affiche dans le panneau, au-dessus de l'écran courant, qui ne bouge pas. « Fermer », Échap ou le
   retour du navigateur ramènent à l'écran tel qu'il était. Ouverte directement (nouvel onglet,
   rechargement), l'adresse renvoie à la page complète des réglages. Sur téléphone, le panneau prend
   l'écran et son bouton dit « Retour à <écran> » ; l'écran d'origine passe par une **clé**
   (`?retour=events`), jamais par un nom (aucune donnée personnelle dans l'adresse).
4. Les pages de réglages restent des pages complètes : leur contenu se rend en `<main>` seul, ou en
   bloc dans le panneau (`ScreenMain`, un seul `<main>` par page). Chacune garde ses propres contrôles
   de session, d'organisation, de rôle et de module.
5. **Pas d'iframe** : l'app refuse d'être encadrée (`X-Frame-Options: DENY`, CSP), règle maintenue.

## Écart avec le cahier des charges

UX-13 demande un panneau latéral d'édition. Symbola garde le panneau pour les réglages et la
consultation, et passe l'édition dans une fenêtre. Les deux gestes restent les mêmes partout
(mêmes emplacements, mêmes libellés), ce qui est l'objet d'UX-13.

## Conséquences

- Premières fenêtres longues : la ligne de « Budget et prestataires » (M12, lot 63c). Les
  modifications longues existantes en panneau (fiche complète d'un prestataire, tâche) passent en
  fenêtre avec leurs paquets (63d, 63e) ; le panneau `SidePanel` reste pour les réglages.
- Le glisser-déposer, geste d'ordinateur, est toujours doublé d'un bouton (« Déplacer vers… »).
- Règles écrites dans `DESIGN.md` (Composants : Fenêtre, Panneau latéral, Glisser-déposer).
- Tests : `app/reglages/panels.test.ts`, parcours `e2e/lot-63c-evenements-budget-documents.spec.ts`
  (ordinateur et 375 px, axe-core).
