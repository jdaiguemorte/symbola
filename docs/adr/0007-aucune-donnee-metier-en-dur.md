# ADR 0007 — Aucune donnée métier codée en dur

- Statut : accepté
- Date : 2026-10-25

## Contexte

La suite doit servir plusieurs métiers et plusieurs statuts (franchise de TVA ou non) ; l'utilisateur doit pouvoir tout ajuster.

## Décision

Listes, modèles, catalogue, régime de TVA, mentions légales, formats de numérotation : données par organisation. Valeurs réglementaires (seuils, barèmes) : paramètres gérés par l'Admin. Modèles de départ : fichiers de données traduisibles dans `packages/starter-templates`, proposés à l'onboarding.

## Conséquences

Plus de travail initial (écrans de paramétrage), mais aucune livraison de code pour un changement de règle. Une revue de code refuse toute liste métier en constante.
