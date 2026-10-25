# ADR 0003 — PostgreSQL : une base par app et Row-Level Security

- Statut : remplacé par ADR 0012 pour le MVP (le principe RLS + `organization_id` reste en
  vigueur ; seule la partie « une base par app » est remplacée)
- Date : 2026-10-25

## Contexte

Les apps doivent pouvoir être maintenues sans se perturber ; le SaaS doit isoler strictement les organisations clientes.

## Décision

Un serveur PostgreSQL, une base et un rôle par app. Chaque table métier porte `organization_id` avec des policies RLS lisant `app.organization_id` fixé par transaction. Les rôles applicatifs n'ont ni la propriété des tables ni `BYPASSRLS`.

## Conséquences

Une erreur applicative ne peut pas exposer les données d'une autre organisation. Pas de jointure possible entre apps : les liens passent par identifiants et API.
