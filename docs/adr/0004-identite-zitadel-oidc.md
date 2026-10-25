# ADR 0004 — Identité : Zitadel (OIDC)

- Statut : remplacé par ADR 0013 pour le MVP (à reconsidérer si une deuxième app ou une
  ouverture SaaS justifie le SSO)
- Date : 2026-10-25

## Contexte

Il faut SSO entre apps, MFA, multi-organisation, invitations, sans écrire de code d'authentification.

## Décision

Zitadel auto-hébergé, une organisation Zitadel par client. Les apps sont des clients OIDC. MFA obligatoire pour les rôles professionnels, facultative pour les mariés. Alternative écartée : Keycloak (plus lourd à exploiter, multi-tenant moins natif).

## Conséquences

Aucun mot de passe dans nos bases. Zitadel devient un composant critique : sauvegardé et surveillé comme une base de production.
