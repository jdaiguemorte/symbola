# ADR 0124 — Une CI en deux vitesses : voie rapide sur les PR, suite complète sur main

- Statut : accepté (lot 76 ; décision de Julien du 28/11/2026)
- Date : 2026-11-28
- Complète : [0078](0078-mesures-et-accessibilite.md) (parcours, mesures et accessibilité),
  [0114](0114-taches-periodiques-sans-visiter-chaque-organisation.md) et
  [0115](0115-une-lecture-par-affichage.md) (mesure NFR-02 : trois séries, médiane, seuil 300 ms).
- Diverge de : `docs/CAHIER_DES_CHARGES.md`, ARC-20 (« Aucune fusion si un contrôle échoue ») : sur une PR,
  seule une partie des parcours de bout en bout est jouée avant la fusion.
- Exigences : ARC-20 (tout est testé), SEC-36 (tests d'abus dans la chaîne de contrôle), NFR-01,
  NFR-02. Spécification : [lot 76](../lots/lot-76-ci-deux-vitesses.md).

## Contexte

Chaque PR rejouait toute la suite des parcours de bout en bout : 870 parcours sous Chromium (435 en
ordinateur, 435 en 375 px), 74 min en série partagées en deux moitiés, plus 15 min de scénarios sous
Firefox et WebKit. Un seul parcours à la fois par job : chaque connexion passe par un lien, Mailpit et
Logto (lot 33). Le 28/11/2026, la moitié 1 prenait 48 min sur main ; celle de la PR #218 a été coupée
à 60 min, sans rendre ses traces ; la limite a été portée à 90 min, en sursis (PR #219).

Une découpe en trois avait été abandonnée le 23/11 : elle plaçait la mesure du serveur (NFR-02) en
tête d'une part, serveur froid, où elle mesurait 412 à 450 ms au lieu d'environ 220 ms.

Pendant la réalisation des lots 70 à 74, une dizaine de PR passent par heure. Rien n'est en
production (pré-MVP, staging jetable).

## Décision

1. **Voie rapide sur chaque pull request** : le socle (une vingtaine de parcours essentiels, tenus dans
   `apps/symbola/e2e/socle.ts`) et les fichiers de parcours que la PR modifie ou ajoute, sous
   Chromium, en ordinateur et en 375 px, et, dans leur propre job, les mesures du temps de réponse
   (point 3). Cible : moins de 15 minutes. Tous les autres contrôles de la
   PR restent (lint, types, tests unitaires, isolation RLS, Semgrep, Gitleaks, OSV, Trivy, Factur-X).
2. **Suite complète sur `main` après chaque fusion**, chaque nuit, à la demande (`workflow_dispatch`),
   et sur une PR étiquetée `suite-complete` : Chromium en quatre parts, scénarios sous Firefox et
   WebKit, mesures du temps de réponse. **Aucun parcours n'est supprimé.**
3. **Les mesures NFR-01 et NFR-02 dans leur propre job, sur chaque PR comme sur `main`** (ajout de
   Julien du 28/11/2026 : une PR qui alourdit toutes les pages s'arrête avant la fusion). Tous les
   tests dont le titre porte « NFR-01 » ou « NFR-02 », à place fixe et serveur chaud : serveur démarré
   une fois, réchauffé par le socle, puis mesuré sans redémarrer. La découpe de la suite ne déplace
   plus la mesure. Chaque mesure dit sa valeur même réussie, et le résumé du job donne le tableau des
   valeurs, seuils et marges. Aucun seuil ni aucune méthode ne change.
4. **Le socle est une liste, pas une étiquette `@socle`** dans les fichiers : une étiquette aurait
   modifié une vingtaine de fichiers de parcours tenus par d'autres branches. Un test vérifie que
   chaque entrée désigne un parcours existant, et la CI qu'elle en sélectionne exactement un.
5. **Pas de sélection par « zone touchée »** : aucune règle simple et fiable entre les dossiers de
   l'app et les noms des fichiers de parcours (spécification, § 2). La voie rapide avertit quand une
   PR touche les outils communs des parcours ; l'étiquette `suite-complete` est faite pour les PR à
   risque.
6. **Traces toujours publiées** : limite de durée propre à l'étape des parcours, arrêt propre de
   Playwright deux minutes avant, envoi des traces en `if: always()`.

## Contrepartie acceptée

Une PR peut être fusionnée alors qu'un parcours hors du socle et hors de ses fichiers est cassé :
`main` passe au rouge après la fusion, et se corrige aussitôt par une PR. Julien l'accepte **tant que
rien n'est en production**.

## Condition : retour à la suite complète avant le premier déploiement réel

Avant le premier déploiement réel (données de vrais clients), **la suite complète redevient
obligatoire avant tout déploiement**. Elle l'est par construction aujourd'hui, et doit le rester :

- `publish-image` dépend du job `e2e`, qui sur `main` est la suite complète : l'image d'un commit
  n'existe sur GHCR que si toute la suite est verte, et `deploy.sh` refuse un commit sans image. Ne
  jamais détacher `publish-image` de la suite complète, ne jamais publier une image à la main.
- `docs/runbooks/deploiement.md` demande de vérifier la CI complète du commit avant de déployer.
- Julien tranche, avant la production, s'il exige aussi la suite complète **avant la fusion**
  (protection de `main`, étiquette obligatoire ou file de fusion), et si `deploy.sh` doit vérifier
  lui-même le statut de la CI du commit.

Revenir sur cette condition demande un nouvel ADR.

## Conséquences

- Verdict d'une PR en un quart d'heure ; la suite complète environ 25 min sur `main`, en parallèle.
- Un parcours instable ou cassé se voit sur `main` (et la nuit), pas sur la PR : il se signale et se
  corrige, il ne se masque pas.
- Les exécutions sur `main` ne s'annulent plus entre elles : seule la plus récente attend.
- La mesure NFR-02 dépend désormais du réchauffement par le socle, et non plus de sa place dans une
  moitié : sa valeur avant et après le lot est relevée dans la PR du lot 76.
- Suite possible : plusieurs parcours à la fois dans un job, en ouvrant une fois les sessions des
  comptes de test (spécification, § 7).
