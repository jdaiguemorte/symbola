# ADR 0020 — Accès des mariés : rôle client et accès par événement

- Statut : accepté
- Date : 2026-10-27

## Contexte

EVT-06 ouvre l'app aux mariés : chacun crée son compte sur invitation de
la planner, suit le rétroplanning, coche ses tâches et consulte le
programme du jour J, sans jamais voir les notes internes, un autre
événement ni une autre organisation (tests obligatoires).

La RLS (ADR 0012) isole les **organisations** : une session fixe
`app.organization_id` et ne voit que les lignes de cette organisation. Un
marié appartient à l'organisation de sa planner (`hub.users`, rôle
`client`) ; la RLS seule lui laisserait donc lire tous les événements de
cette organisation. Jusqu'ici, les écrans de la planner ne contrôlaient
que la présence d'une organisation, pas le rôle.

## Décision

1. **Compte** : un compte `hub.users` par personne, au rôle `client`,
   rattaché à l'organisation, créé par `@symbola/auth` à l'acceptation
   de l'invitation. Un e-mail déjà pris par un compte professionnel ou
   par une autre organisation est refusé (un compte par personne). La
   double authentification est proposée ; une fois activée, elle est
   demandée à chaque connexion (`login`/`requireUser`).
2. **Accès par événement** : table `events.event_client_accesses` (RLS
   par organisation), une ligne par invitation : e-mail, jeton haché,
   échéance 7 jours, compte lié à l'acceptation, date de retrait. Le
   jeton envoyé est `<organisation>.<secret>` : l'organisation, non
   secrète, permet la recherche sous RLS ; seul le haché du secret est
   stocké. Un marié déjà inscrit dans l'organisation reçoit l'accès à un
   nouvel événement sans nouveau compte.
3. **Contrôle applicatif de l'appartenance à l'événement** : toute lecture
   ou écriture du marié passe par le service du module events
   (`getClientEventView`, `setClientTaskDone`, `listClientEvents`), qui
   vérifie un accès accepté et non retiré pour cet utilisateur et cet
   événement. La vue du marié ne renvoie qu'un résumé de l'événement et
   le programme en variante « mariés » (`programForVariant`), jamais de
   note interne. Le marié ne coche que les tâches dont le responsable est
   « mariés ».
4. **Écrans de la planner fermés aux autres rôles** :
   `getPlannerAuthContext()` (owner, member) remplace `getAuthContext()`
   sur tous les écrans, actions et exports de la planner ; le statut
   `forbidden` est imposé par le type, donc traité partout. L'espace du
   marié (`/espace`) utilise `getClientAuthContext()` (rôle client).
5. **Fil d'activité** : `events.event_activities`, inscrit dans la même
   transaction que la coche, libellé de la tâche copié.

## Conséquences

L'isolation « marié ↔ autre événement » repose sur le code applicatif,
couverte par des tests d'intégration réels ; l'isolation entre
organisations reste garantie par PostgreSQL. Si un jour un marié devait
accéder directement à la base (API publique), il faudrait une policy RLS
supplémentaire par événement (paramètre de session `app.client_user_id`).
Budget et devis s'ajouteront à la vue du marié avec leurs modules (lots 3
et 4), par la même vérification d'accès.
