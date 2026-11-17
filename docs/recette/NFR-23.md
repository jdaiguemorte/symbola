# Rejeu NFR-23 — Installation en moins de trente minutes sur une machine neuve

Lot 40a (NFR-23, décision D7, ADR 0075).

- Date : 17/11/2026, workflow « Installation » de la CI (exécution 44162885922, PR #130), sur un
  runner Ubuntu neuf, sans cache : le guide `docs/INSTALLATION.md` rejoué tel quel par
  `tools/installation/rejouer.mjs`, bloc par bloc.

| Bloc du guide (ligne) | Ce qu'il fait | Durée |
| --- | --- | ---: |
| 35 | Dépendances (`pnpm install --frozen-lockfile`) | 0 min 06 s |
| 45 | Réglages locaux (`.env`, secrets tirés au hasard) | 0 min 00 s |
| 70 | Socle : PostgreSQL, rôle de l'app et base de Logto, puis Garage, ClamAV, Mailpit, Logto, Traefik | 1 min 06 s |
| 84 | Migrations, réglage de Logto, jeu fictif de recette | 0 min 12 s |
| 95 | L'app démarre et répond sur `/login` | 0 min 36 s |

Résultat : **installation en 2 min 00 s**, pour un seuil de 30 minutes. Le temps d'un poste réel
dépend surtout du téléchargement des images (le runner de la CI a un réseau rapide) ; la marge reste
large. Le rejeu se refait à chaque version majeure (étiquette `v*`), à chaque changement du guide ou
du socle de dev, et à la demande.
