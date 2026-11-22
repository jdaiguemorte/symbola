# ADR 0114 — Tâches périodiques : ne visiter que les organisations qui ont du travail

- Statut : accepté. Demandé par Julien le 22/11/2026 (« il faut résoudre ce problème pour éviter des
  parcours à rallonge »), après l'échec répété de la mesure NFR-02 sur la CI du lot 65.
- Date : 2026-11-22
- Complète : [0076](0076-file-des-taches-et-adaptateur-e-mail.md) (file des tâches de fond), [0095](0095-notifications-automatismes-radar-et-vocabulaire.md)
  (notifications).
- Exigences : NFR-02 (95 % des requêtes des parcours P0 en moins de 300 ms), ARC-10.

## Contexte

Les tâches périodiques tournent dans le processus de l'app, derrière le verrou des tâches
(lib/scheduler-lock.ts). Plusieurs passent **chaque organisation**, une petite transaction après
l'autre, même quand elle n'a rien à faire. La file des tâches de fond (ARC-10) le faisait **toutes
les 30 secondes**, avec trois transactions par organisation. Avec les centaines d'organisations que
crée la suite de tests, ce passage durait plus de 8 secondes sur 30 : la base et le processus
étaient occupés en continu, et les pages des parcours P0 en pâtissaient (NFR-02 à 308-339 ms sur la
CI). En production, la charge grandit avec chaque espace ouvert.

Un cache des lectures le temps d'une requête (session, modules) a été essayé et mesuré : sans gain
mesurable, il n'a pas été gardé. Une recherche des organisations « qui ont du travail » par une seule
requête traversant les organisations se heurte à l'isolation par la base (RLS, SEC-10) : elle
demanderait une fonction privilégiée par table, et donc un changement de schéma.

## Décision

1. **File des tâches de fond** : le processus tient la liste des organisations dont une tâche est
   due (inscription d'un e-mail ; à chaque visite, la prochaine reprise planifiée ou la fin du verrou
   d'un envoi en cours, lues dans la même transaction). Le passage des 30 secondes ne visite qu'elles.
   Un **tour complet** visite chaque organisation au démarrage, puis toutes les cinq minutes : il
   rattrape ce que le processus ne sait pas (redémarrage, tâche inscrite par un autre processus). Les
   tâches interrompues et les tâches dues sont lues dans une seule transaction ; la purge à 30 jours
   n'a lieu qu'avec un tour complet, une fois par heure.
2. **Passage du matin des notifications** : le processus retient le jour du dernier passage de chaque
   organisation et ne redemande plus à la base, toutes les cinq minutes, un passage déjà fait. La base
   reste l'arbitre (une seule réservation par jour) ; un redémarrage la relit.
3. Aucune garantie de l'ADR 0076 ne change : une tâche n'est prise qu'une fois, un envoi interrompu
   n'est pas renvoyé, le contenu s'efface à la fin. Aucun changement de schéma.

## Conséquences

- Mesure locale, serveur en régime établi, 1 613 organisations : 95e centile des pages P0 à
  182-215 ms (246 ms pendant un tour complet), contre 207-229 ms et des pointes à 282-369 ms avant.
- Une tâche inscrite par un autre processus que celui qui tient le verrou part au plus cinq minutes
  plus tard (au lieu de 30 secondes) ; l'envoi immédiat (queueAndSendEmail) ne change pas.
- Le passage du matin d'une organisation reste unique par jour même si le processus redémarre.
- Les autres tâches périodiques (notifications immédiates, récapitulatifs, tours complets des imports
  et des exports) passent encore chaque organisation toutes les cinq minutes ; si la charge l'exige,
  le même principe s'y appliquera, ou une fonction privilégiée par table (avec un ADR et un
  changement de schéma).
