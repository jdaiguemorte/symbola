# ADR 0016 — Isolation réseau staging ↔ production sur le VPS unique

- Statut : accepté
- Date : 2026-10-26
- Complète : ADR 0009 (Docker Compose et Traefik)

## Contexte

Staging et production cohabitent sur le même VPS (lot 0, « strictement
isolés »). Un seul Traefik peut écouter 80/443 : il est donc partagé
(`docker-compose.socle.yml`). La première version de SOC-09 reliait
**tous** les services des deux environnements (PostgreSQL, Garage,
ClamAV, app) au même réseau Docker externe `symbola-edge`.

Conséquence vérifiée sur Docker : sur un réseau partagé, le nom de
service `postgres` est un alias DNS porté par les deux conteneurs
PostgreSQL. Docker répond avec les deux adresses, en alternance.
L'app de production (`POSTGRES_HOST: postgres`) pouvait donc se
connecter à la base de staging, et inversement. Même chose pour `garage`
et `clamav`. S'y ajoutent :

- l'accès réseau direct d'un conteneur de staging (code pas encore
  validé, scanné par ZAP) aux bases de production ;
- le nom de projet fixe `name: symbola-env` : un `docker compose up`
  lancé sans `-p` mélangeait conteneurs et volumes des deux
  environnements ;
- aucune limite de ressources, alors que le lot 0 exige que le staging
  ne pénalise jamais la production.

## Décision

1. **Nom de projet dérivé de l'environnement** :
   `name: symbola-${ENVIRONMENT_NAME:?}`. Sans `ENVIRONMENT_NAME`, Compose
   refuse de démarrer. Oublier `-p` ne fait plus rien partager.
2. **Services internes sur le seul réseau `default` du projet**
   (`symbola-staging_default`, `symbola-production_default`) : PostgreSQL,
   Garage et ClamAV n'ont aucun réseau commun avec l'autre environnement
   ni avec Traefik.
3. **Un réseau frontal par environnement** (`symbola-edge-staging`,
   `symbola-edge-production`), créés par le socle. Seul le conteneur
   `symbola` rejoint celui de son environnement. Traefik est relié aux
   deux et ne fait que router par nom d'hôte : c'est le seul point commun.
   Chaque app indique son réseau par le label `traefik.docker.network`.
4. **Port PostgreSQL en boucle locale obligatoire et distinct**
   (`${POSTGRES_PORT:?}`, 5432 en production et 5433 en staging dans les
   modèles).
5. **Limites mémoire/CPU obligatoires pour chaque conteneur**, fixées
   dans chaque `.env`. Les limites du staging ne dépassent jamais celles
   de la production, ce qu'un test vérifie.

Des tests de configuration (`tools/deployment-config`) vérifient chacune
de ces règles.

## Conséquences

- Une app de staging compromise ne voit, sur le réseau, que Traefik et
  ses propres services.
- Traefik reste un point commun : il a accès en lecture à la socket
  Docker et il est relié aux deux réseaux frontaux. Un proxy de socket
  (`tecnativa/docker-socket-proxy`, hors stack) réduirait l'exposition. Il
  sera proposé séparément s'il s'avère utile (CLAUDE.md §8 : dépendance
  hors stack = demander).
- Les services internes gardent un accès sortant à Internet par le
  réseau `default` (nécessaire à ClamAV pour ses mises à jour de
  signatures). Un réseau `internal: true` pour PostgreSQL et Garage
  empêcherait de publier le port PostgreSQL en boucle locale, donc les
  migrations par tunnel SSH. On ne le fait pas au MVP.
- Si un module devient une app autonome (ADR 0011), elle rejoint le
  réseau frontal de son environnement avec ses propres services internes,
  sur le même modèle.
