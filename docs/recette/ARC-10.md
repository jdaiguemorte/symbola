# Rejeu ARC-10 — Un e-mail parti pendant une coupure du serveur d'envoi

Lot 40b (ARC-10, ARC-12 ; décisions D9, D10 ; ADR 0076).

- Date : 17/11/2026, en local, par Claude Code.
- Environnement : app compilée (`next start`), base neuve `symbola_lot24` avec le jeu fictif chargé
  par `seed:recette` ; Mailpit du socle de dev.
- Scénario : la spécification prévoyait SC-03 étape 5 (relance du prestataire) avec un serveur
  d'envoi coupé puis rétabli. Cette relance part de la messagerie de Camille (lien `mailto:`), pas
  de Symbola : le rejeu prend donc un e-mail de Symbola de l'atelier de Camille (Atelier Camille
  R.), envoyé par le service du hub, comme les liens, les codes et les invitations.
- Mise en œuvre : l'app compilée tourne normalement, avec son worker de la file et le verrou des
  tâches périodiques. Un script à part envoie l'e-mail avec le serveur d'envoi coupé pour lui seul
  (`SMTP_PORT=1`) : c'est l'app en marche, dans un autre processus, qui doit le reprendre. La
  connexion de Camille par l'écran demande sa double authentification (Logto) : le rejeu ne passe
  pas par l'écran.

| Étape | Ce qui se passe | Résultat |
| --- | --- | --- |
| 1 | L'atelier de Camille envoie un e-mail, serveur d'envoi injoignable | Inscrit dans la file et tenté aussitôt (94 ms) : échec (`AggregateError`, connexion refusée), aucune erreur pour le geste. La tâche est « à faire », 1 tentative, reprise prévue une minute plus tard, contenu gardé. Mailpit : rien |
| 2 | L'app en marche fait son passage (toutes les 30 s) | L'e-mail arrive dans Mailpit 62 s après la coupure ; la tâche est « faite », 2 tentatives, contenu effacé |
| 3 | 40 s plus tard | Toujours un seul e-mail : aucun doublon |

Résultat : **passé sans blocage**. Une tâche rejouée par le worker n'envoie l'e-mail qu'une fois ; le
contenu ne reste dans la base que le temps de l'envoi.

Parcours automatisés : `apps/symbola/modules/hub/jobs.integration.test.ts` (inscription double,
rejeu simultané, reprise, cinq échecs, interruption, purge, isolation) et
`apps/symbola/lib/scheduler-lock.integration.test.ts` (relève du verrou).
