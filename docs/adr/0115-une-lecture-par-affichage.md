# ADR 0115 — Une lecture par affichage, et JSON laissé à Node

- Statut : accepté. Suite de la demande de Julien du 22/11/2026 (« il faut résoudre ce problème pour
  éviter des parcours à rallonge »), après un nouvel échec de la mesure NFR-02 sur main le 23/11
  (306, 332, 306 ms en trois essais, seuil 300 ms).
- Date : 2026-11-23
- Complète : [0114](0114-taches-periodiques-sans-visiter-chaque-organisation.md) (tâches périodiques),
  [0078](0078-mesures-et-accessibilite.md) (mesures).
- Exigences : NFR-02 (95 % des requêtes des parcours P0 en moins de 300 ms), HUB-12.

## Contexte

Mesure page par page (app compilée, tâches périodiques à l'arrêt, base de recette de 1 600
organisations) : trois pages valent le double des autres, la synthèse d'un évènement (~182 ms), le
budget (~168 ms) et « Aujourd'hui » (~150 ms), contre 60 à 100 ms ailleurs. Le 95e centile de la
mesure, c'est en pratique le temps de la synthèse.

Deux causes, relevées au profileur et au journal des requêtes SQL :

1. **JSON.stringify remplacé.** pdfjs-dist (lecture des PDF importés, ADR 0034), dans sa version
   « legacy » passée par le bundler de Next.js, installait les polyfills de core-js dans tout le
   processus serveur, dont un JSON.stringify écrit en JavaScript. React s'en sert pour écrire chaque
   page : environ 10 % du temps de calcul du serveur, sur toutes les pages. Chargé par Node, sans
   bundler, pdfjs laisse JSON intact.
2. **Les mêmes lectures, plusieurs fois par affichage.** La mise en page, la page et ses composants
   demandent chacun la session, l'état des modules, la fiche de l'évènement, la liste des évènements,
   les réglages RGPD… La synthèse faisait ainsi 104 transactions et 142 lectures, dont 54 en double :
   la session relue (et son expiration réécrite) dix fois, l'état des modules 21 fois, la fiche de
   l'évènement, avec ses lieux, ses clients et leurs contacts, sept fois. Les données sont petites
   (quelques lignes) : le coût est celui de chaque lecture (construction de la requête, allers-retours
   d'une transaction).

L'ADR 0114 notait qu'un cache de la session et des modules, essayé seul, ne donnait pas de gain
mesurable. C'est confirmé (environ 3 %) : le gain vient surtout de la fiche et de la liste des
évènements, mesurées cette fois lecture par lecture.

## Décision

1. **pdfjs-dist hors du bundler** (`serverExternalPackages`, déclaré aussi dans l'app pour que Next.js
   le trouve), et chargé seulement à la lecture d'un PDF.
2. **Une lecture par affichage** (`lib/request-memo.ts`) : `cache()` de React, propre à la requête
   (rien n'est partagé entre deux requêtes ni entre deux personnes), seulement pour une requête
   d'affichage (GET). Une action serveur (POST) relit toujours : elle peut avoir changé ce qu'elle
   relit (connexion, second facteur, module activé). Hors d'une requête (tâche de fond, test), aucune
   mise en commun. Lectures concernées : la session (clé : le jeton), l'état des modules de
   l'organisation (une requête pour tous), la fiche d'un évènement et la liste des évènements, la
   progression de l'aide, le profil de l'organisation, les réglages et l'alerte RGPD, l'ouverture d'une
   fonction, les notifications non lues.
3. Les lignes mises en commun sont partagées entre les composants d'un affichage : aucun ne les
   modifie. Aucun changement de schéma ni de contrat.

## Conséquences

- Local, même base : série de la mesure NFR-02 de 183-187 ms à 150-153 ms (−18 %) ; synthèse de
  182 à 147 ms, budget de 168 à 143 ms, « Aujourd'hui » de 150 à 126 ms.
- La synthèse reste la page la plus lente : une soixantaine de lectures y sont faites l'une après
  l'autre. Les regrouper (lectures indépendantes en parallèle) est la suite possible si la mesure de la
  CI reste trop près du seuil.
- Une nouvelle lecture répétée d'un écran passe par `memoizePerRequest` ; une lecture qui suit une
  écriture de la même requête d'affichage (rare : une page qui crée ses valeurs de départ) ne doit pas
  l'utiliser.
