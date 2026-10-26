# ADR 0018 — Caddy partagé remplace Traefik comme reverse-proxy

- Statut : accepté, remplace ADR 0009
- Date : 2026-10-26

## Contexte

L'ADR 0009 prévoyait Traefik v3 comme frontal HTTPS sur le VPS Contabo. Le
VPS héberge déjà un Caddy partagé pour d'autres projets de Julien (kindo,
petites-voitures, capsule-vocale), configuré par blocs de sous-domaines
dans un Caddyfile unique. Introduire Traefik comme second reverse-proxy
sur la même machine ajouterait un composant de plus à exploiter (deux
proxys à surveiller, deux façons de gérer les certificats Let's Encrypt,
deux points d'écoute à coordonner sur les ports 80/443) sans bénéfice
pour un seul développeur à temps partiel.

## Décision

Symbola rejoint le Caddy partagé déjà en place : un bloc de plus dans le
Caddyfile existant, un par sous-domaine (`symbola.fr`,
`staging.symbola.fr`), au même titre que les autres projets de Julien sur
ce VPS. HTTPS automatique par Caddy (Let's Encrypt intégré, comme
Traefik). Docker Compose reste inchangé (ADR 0009 pour le reste :
un fichier pour le socle applicatif, un par environnement) — seul le
frontal HTTP change.

SOC-09 continue de préparer les fichiers nécessaires (labels, ports
internes exposés en boucle locale pour le reverse-proxy) ; la
modification du Caddyfile partagé sur le VPS réel reste une action de
Julien, jamais de Claude Code (serveur réel).

**Limite assumée** : la limitation de débit prévue au cahier des
charges (§3) est nativement disponible sur Traefik mais pas sur Caddy
(nécessite un plugin tiers compilé, `caddy-ratelimit` ou équivalent).
Reportée en V2 — pas bloquante pour le MVP à un seul client pilote.

## Conséquences

Un seul reverse-proxy à exploiter sur le VPS, cohérent avec les autres
projets de Julien. Si la limitation de débit devient nécessaire avant la
V2 (abus constaté, ouverture à d'autres clients), compiler Caddy avec le
plugin de rate-limiting ou reconsidérer cette décision. Revenir à Traefik
plus tard resterait possible (Docker Compose et les labels de routage
sont conçus indépendamment du frontal) mais perdrait la mutualisation
avec les autres projets du VPS.
