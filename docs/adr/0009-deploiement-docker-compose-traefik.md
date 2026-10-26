# ADR 0009 — Déploiement : Docker Compose et Traefik

- Statut : accepté ; le choix du reverse-proxy (Traefik) est remplacé par l'ADR 0018 (Caddy partagé du VPS) — le reste (Docker Compose, un fichier par environnement) reste en vigueur
- Date : 2026-10-25

## Contexte

Un seul VPS (24 Go RAM, 300 Go disque) en production, un staging sur un serveur domestique ; pas d'équipe d'exploitation.

## Décision

Docker Compose : un fichier pour le socle, un par app. Traefik v3 en frontal (HTTPS automatique, un sous-domaine par app, limitation de débit). Déployer ou revenir en arrière sur une app = changer son tag d'image et relancer son seul compose.

## Conséquences

Simple à comprendre et à maintenir. Pas de haute disponibilité : acceptée au MVP. Kubernetes écarté (complexité injustifiée).
