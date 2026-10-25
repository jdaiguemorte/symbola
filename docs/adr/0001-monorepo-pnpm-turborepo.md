# ADR 0001 — Monorepo pnpm + Turborepo

- Statut : accepté
- Date : 2026-10-25

## Contexte

Plusieurs apps autonomes doivent partager du code (UI, auth, contrats) sans se coupler.

## Décision

Un seul dépôt Git, workspaces pnpm, orchestration Turborepo. Les apps vivent dans `apps/`, le code partagé dans `packages/`. Chaque app a son propre build, sa propre image Docker et son propre déploiement.

## Conséquences

Code partagé versionné au même endroit ; refactorings transverses simples. Il faut une discipline : une app n'importe jamais une autre app, seulement des packages. Un contrôle de dépendances en CI le vérifie.
