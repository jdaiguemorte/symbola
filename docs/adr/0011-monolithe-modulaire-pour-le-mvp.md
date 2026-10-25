# ADR 0011 — Une seule app Next.js, modules internes (remplace ADR 0002 pour le MVP)

- Statut : accepté, remplace ADR 0002
- Date : 2026-10-26

## Contexte

L'ADR 0002 proposait une app Next.js par module, cohérente avec une architecture visant plusieurs
équipes et plusieurs clients dès le départ. Le projet démarre avec un seul développeur, à temps
partiel, pour un seul client pilote (l'activité de wedding planning). Multiplier les apps, leurs
builds et leurs déploiements dès le lot 0 ajoute un coût d'exploitation (CI, images Docker,
sous-domaines, supervision) sans bénéfice tant qu'il n'y a ni deuxième client ni équipe.

## Décision

Une seule app Next.js (`apps/symbola/`) pour le MVP. Les modules métier (hub, events, budget,
quotes) vivent sous `apps/symbola/modules/<module>/`, chacun avec une porte d'entrée unique
(`service.ts`) qui expose ses fonctions publiques. Règle stricte : un module n'importe jamais le
fichier interne d'un autre module (`repository.ts`, composants internes), seulement son
`service.ts` — exactement la discipline que l'ADR 0002 imposait entre apps séparées, appliquée ici
entre dossiers. Un contrôle de dépendances en CI vérifie cette frontière (ESLint boundaries ou
équivalent).

## Conséquences

Un seul build, un seul déploiement, une seule base de code à relire pour le développeur solo.
Si un second client ou une équipe justifie plus tard l'isolation complète (déploiement
indépendant par module, scaling séparé), extraire un module en app Next.js autonome est un
chantier borné : le dossier `modules/<x>/` devient l'app, `service.ts` devient son contrat HTTP
`/v1/...`. La discipline de frontière imposée dès maintenant est ce qui rend cette extraction
mécanique plutôt qu'une réécriture. Le routage et la navigation partagée entre modules (session,
layout commun) devront être revus à ce moment : c'est le point de friction principal identifié.
