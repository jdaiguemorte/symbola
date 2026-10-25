# ADR 0010 — Facturation conforme

- Statut : accepté
- Date : 2026-10-25

## Contexte

Les factures sont des documents légaux ; la réforme de la facturation électronique s'applique (émission PME/micro au 1er septembre 2027).

## Décision

Numérotation continue sans trou par série et organisation, attribuée en transaction. Facture émise immuable, correction par avoir. Client professionnel : facture Factur-X, transmise à une plateforme agréée (dépôt manuel au MVP, connecteur API générique ensuite). Client particulier : facture PDF classique et export des données d'e-reporting. Mentions légales générées depuis le régime fiscal de l'organisation.

## Conséquences

Règles à faire valider par un comptable avant production ; toutes paramétrables (ADR 0007).
