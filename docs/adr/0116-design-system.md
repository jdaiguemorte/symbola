# ADR 0116 — Le Design System de Symbola : `DESIGN.md` en règles, composants, motifs et lexique

- Statut : proposé (porte 4 du lot 68, à valider par Julien)
- Date : 2026-11-26
- Complète : [0057](0057-charte-graphique-design-md.md) (les jetons de `DESIGN.md`, inchangés)
- Amende : [0107](0107-fenetre-pour-modifier-panneau-pour-les-reglages.md) (la roue « Réglages »
  quitte les en-têtes ; une fenêtre longue a un seul « Enregistrer »), [0104](0104-visite-guidee-a-la-place-des-reperes.md)
  (visites proposées, croix « Fermer la visite »), [0103](0103-assistant-l-essentiel-apres-le-questionnaire.md)
  (l'assistant de démarrage perd « Passer » ; « L'essentiel » est gardé)
- Exigences : UX (§ 5 de `docs/CAHIER_DES_CHARGES.md`), UX-14 et WCAG 2.2 AA (Q11), NFR-24
- Sources : `docs/lots/lot-68-audit-ux-parcours.md` (phase 6) ; `docs/audits/2026-11-ux-parcours/`
  (synthèse, décisions de la porte 2, notes 07 à 12, note 13) ; maquettes `docs/maquette/lot-68/`

## Contexte

L'ADR 0057 a fait de `DESIGN.md` la source des jetons : couleurs, polices, rayons, espacements. Les
lots 61 à 63 y ont ajouté des règles de composants au fil des retours. L'audit UX du lot 68 a montré
que cela ne suffisait pas : la même tâche avait cinq formes et deux panneaux (C-38), le retour après
une action n'avait ni place ni forme (C-09), le danger non plus (C-08), la couleur d'action portait
huit rôles (synthèse, § 8), un même verbe avait plusieurs sens (C-87). Les six volets de maquettes,
validés les 25 et 26/11/2026, ont fixé les formes cibles ; Julien a décidé que les choix des maquettes
récentes l'emportent sur les règles plus anciennes, à condition qu'aucune fonction majeure ne
disparaisse, et qu'il attend une ergonomie irréprochable sur toute l'app. Il restait à en faire une
référence unique pour les lots de réalisation et pour les écrans qui n'ont pas été dessinés.

Les couleurs de la marque passeront à un trio bleu vif, orange et crème, dont les valeurs ne sont pas
connues (A3 du lot 68).

## Décision

1. **`DESIGN.md` devient le Design System de Symbola.** En plus des jetons, il porte :
   - la répartition des couleurs par rôle, selon l'option A (« orange de marque seulement ») retenue à
     la porte 2 : la couleur d'action ne porte que l'action et les liens ; l'attente et « bientôt »
     sont neutres ; l'ambre ne dit plus que « À vérifier » et « À compléter » ; le rouge, le vrai
     retard, l'erreur et le danger ; un état se lit toujours sans la couleur ;
   - 22 règles de forme (dont D10 : une action principale, zones d'action, en-tête en 200 px, ligne à
     une cible, une action rapide et un menu ; trois niveaux de danger ; champs obligatoires marqués
     « * ») ;
   - les composants et leurs états, nouveaux (ligne type, fenêtre d'un objet, menu « ⋯ », bascules
     en encre, message de retour sombre, frise d'étapes, barres d'enregistrement, de sélection et du
     bas, panneau du bas, états vide, rempli et repris, aide proposée) ou repris des lots 61 à 63 ;
   - les motifs de parcours (créer, ouvrir et revenir, changer la date, agir sur plusieurs, faire et
     retrouver, supprimer, rattacher, relancer, reprendre un mariage, partager, premier jour,
     chercher, régler) ;
   - le lexique : objets, rôles, verbes, mots retirés.
   Chaque règle cite le constat ou la décision qui la fonde.
2. **Les jetons ne changent pas.** L'en-tête de `DESIGN.md` garde ses couleurs, sa typographie, ses
   rayons, ses espacements et son ombre ; l'ADR 0057 reste la décision sur les jetons, leur reprise
   dans `@theme` et `packages/ui`, et leurs tests. Seule la liste `components` s'allonge, écrite avec
   les jetons existants ; `status-pending` passe de l'ambre au neutre.
3. **Une valeur hors jeton dans une maquette n'est pas une règle.** Un écran réalisé emploie le jeton
   le plus proche (S3 de la note 13).
4. **La future marque se décrit par rôles, sans valeurs** : le bleu prend le rôle de `primary` et de
   lui seul ; l'orange reste au logo, aux illustrations et aux écrans vides, jamais dans une liste ni
   sur un bouton ; le crème est le fond de page et du bandeau d'information, jamais un fond d'alerte.
   Le passage au trio sera un changement de valeurs des jetons, avec un nouvel ADR qui complète
   l'ADR 0057 et ses tests de contraste.
5. **La page de référence** `docs/maquette/lot-68/34-design-system-reference.html` montre chaque
   composant et ses états en 1 440 et en 375 px. Elle n'emploie que les jetons, et sert de modèle aux
   lots de réalisation ; en cas d'écart avec `DESIGN.md`, `DESIGN.md` fait foi.
6. **Tout lot qui touche un écran le passe à la liste de contrôle** de la note 13 (§ 4), aux trois
   tailles (1 440 px, 911 × 512, 375 px), et note les écarts dans sa spécification.
7. **Les changements de règle passent par `DESIGN.md`** et, s'ils sont structurants, par un ADR ; un
   écran ne crée pas sa propre forme d'un composant existant.

## Ce qui reste ouvert

Quinze points (S1 à S15, note 13, § 6), chacun avec une recommandation déjà appliquée dans
`DESIGN.md` et la page de référence ; les valeurs du trio ; les noms définitifs des rôles (S7).

## Conséquences

- Les lots de réalisation (phase 7) appliquent `DESIGN.md` écran par écran ; le lot 70 (volet 1) en
  est le premier. Les écarts qu'il listait au § 9 de sa spécification sont résolus ici.
- `packages/ui` et `globals.css` gagnent les composants nouveaux au fil des lots, sans nouveau jeton.
- Le contrôle automatique des textes (`lexique.test.ts`, lot 70g) prend sa liste dans le lexique de
  `DESIGN.md` ; « famille » en sort si S13 est retenu.
- Un utilitaire de test des règles mesurables (S14) est à écrire au premier lot de réalisation.
- Les captures du centre d'aide sont à régénérer quand les écrans changent, puis au passage au trio.
- Aucun écran ne change avec cet ADR : il ne fixe que la référence.
