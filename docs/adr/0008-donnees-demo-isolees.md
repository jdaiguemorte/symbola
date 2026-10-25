# ADR 0008 — Données de démonstration isolées et éphémères

- Statut : accepté
- Date : 2026-10-25

## Contexte

Chaque module propose un essai guidé sur des données fictives, qui ne doivent polluer ni la comptabilité ni les statistiques.

## Décision

Colonne `is_demo` sur les entités concernées, série de numérotation `DEMO` distincte, filigrane « Document fictif », exclusion systématique des stats, exports, e-reporting et recherches RGPD, faux fournisseur de signature et d'e-mail. Purge à la fin de l'essai, et job de purge des essais abandonnés.

## Conséquences

Un test automatisé vérifie qu'aucune donnée de démo ne subsiste après un essai et qu'aucune requête de reporting ne les inclut.
