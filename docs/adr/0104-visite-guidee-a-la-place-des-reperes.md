# ADR 0104 — Visite guidée à la place des repères numérotés

- Statut : accepté (lot 63f ; décision de Julien du 21/11/2026)
- Date : 2026-11-21
- Remplace : le point 3 (« aide par repères ») de l'[ADR 0033](0033-refonte-ux-panneaux-et-aide-par-reperes.md).
  Les autres points de l'ADR 0033 restent en vigueur.
- Précise : [0039](0039-aide-un-seul-bouton-et-tiroir.md) (un seul « ? », tiroir de l'aide).
- Exigences : HUB-11, HUB-10, UX-05 ; spécification `docs/lots/lot-63-retours-recette-planner.md`
  (paquet 63f), maquettes M2 et M10 de `docs/maquette/Recette-planner.html`.

## Contexte

Recette du 21/11/2026 (retours #3 à #8) : les repères numérotés posés sur l'écran, avec leur
liste dans le tiroir, ne se lisaient pas comme une visite ; la planner ne savait ni par où
commencer ni quand c'était fini. Le tutoriel, lui, vivait sur sa propre page : il fallait la
quitter pour agir dans l'exemple, puis y revenir pour « Vérifier ».

## Décision

1. **Visite guidée** (composant `GuidedTour` de `packages/ui`, qui remplace `Landmarks`) : fond
   assombri, la zone expliquée reste claire, une bulle à côté avec « N sur M », « Précédent »,
   « Suivant » (« Terminer » à la dernière étape) et « Passer la visite ». La bulle est une fenêtre
   (`role="dialog"`, `aria-modal`) : le focus y entre, reste piégé, revient à son point de départ à
   la fermeture ; Échap ferme. Sur téléphone (moins de 768 px), pas de découpe : la bulle est
   ancrée en bas de l'écran, la zone concernée encadrée.
2. **Trois à cinq étapes par écran clé** : Aujourd'hui, Évènements, fiche d'un évènement,
   Prestataires, Répartition du budget, Catalogue des devis. Une étape dont la zone n'est pas à
   l'écran affiche sa bulle seule, au centre.
3. **Contenu en données** : `packages/starter-templates/src/tours.json` décrit, par écran, la zone
   (`data-tour`) et le texte en français et en anglais de chaque étape (aucun texte en dur, ADR
   0007). Les textes « Tour » des fichiers de traduction disparaissent.
4. **Lancement** : seule à la première ouverture de l'écran (si la préférence « visites
   automatiques » du centre d'aide est active), puis jamais d'elle-même ; relancée par « ? ›
   Revoir la visite », par le centre d'aide (`?visite=revoir`), et comptée comme vue dès son
   ouverture (progression `tour:<écran>`, inchangée).
5. **Le « ? » garde son tiroir** (ADR 0039) pour le texte d'aide de l'écran ; le tiroir n'a plus
   de liste de repères, mais le bouton « Revoir la visite ».
6. **Tutoriel en panneau latéral** : un tutoriel commencé s'affiche dans un panneau qui reste
   ouvert pendant la navigation dans l'exemple (réductible). Ses étapes se cochent seules : le
   panneau revérifie l'étape à chaque changement d'écran et à intervalle régulier, par les
   `service.ts` (vérification côté serveur, inchangée). « Étape suivante » mène à l'écran de
   l'étape ; « Quitter le tutoriel » supprime l'exemple ; à la fin, retour à l'écran d'où le
   tutoriel a été lancé (adresse relative gardée dans le contexte du tutoriel, contrôlée contre
   les redirections ouvertes).

## Conséquences

- `landmarks.tsx` et les styles `.landmark-*` disparaissent ; les parcours Playwright qui
  fermaient les repères ferment la visite (« Passer la visite »).
- Les captures du centre d'aide sont régénérées (visite ouverte sur les écrans qui en ont une).
- Aucune migration : la progression des visites et des tutoriels reste dans `hub.help_progress`.
