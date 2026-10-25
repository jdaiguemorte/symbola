# ADR 0002 — TypeScript et une app Next.js par module

- Statut : remplacé par ADR 0011 pour le MVP (le principe TypeScript strict reste en vigueur ;
  seule la partie « une app Next.js par module » est remplacée)
- Date : 2026-10-25

## Contexte

Le développement est assisté par Claude Code ; la stack doit être courante, très documentée et unifiée front/back.

## Décision

TypeScript strict partout. Chaque module est une app Next.js (App Router) qui porte son UI, son API (route handlers) et sa PWA.

## Conséquences

Un seul langage, outillage riche. Si un module devient lourd, son API pourra être extraite en service séparé sans changer son contrat.
