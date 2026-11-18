# ADR 0095 — Notifications de l'équipe, automatismes prêts à activer, radar des risques, tâches hors évènement, santé du planning et terme des clients

- Statut : accepté (spécification du lot 53 validée par Julien le 18/11/2026, décisions D1 à D8 dans
  leur option a ; changements des schémas `hub` et `events`, élargissement de la contrainte des natures
  d'e-mails du hub et dépendance `web-push` accordés le même jour)
- Date : 2026-11-18
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) et [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md)
  (un module, un schéma), [0014](0014-evenements-internes-pour-le-mvp.md) (événements internes),
  [0045](0045-types-d-evenement-et-vocabulaire.md) (vocabulaire), [0064](0064-jour-j-hors-ligne.md)
  (service worker), [0072](0072-emails-a-l-image-de-l-organisation.md) (modèles d'e-mails),
  [0076](0076-file-des-taches-et-adaptateur-e-mail.md) (file des envois, tâches périodiques),
  [0089](0089-proposition-signer-puis-regler-par-virement.md) (règlement, payeurs). Dépendance :
  [0096](0096-bibliotheque-web-push.md).
- Exigences : HUB-15, UX-16, ARC-09 (push), HUB-28, HUB-24, CHR-05, CHR-10, GC-02 ; scénario SC-03 ;
  `docs/lots/lot-53-notifications-automatisations-radar.md`. DPO-10 (pour information).

## Contexte

Symbola faisait déjà beaucoup de choses seul (relances, rappels, feuilles de route, purge), sans que la
planner le voie ni puisse le couper. Elle n'avait ni centre de notifications, ni récapitulatif, ni radar
des risques ; les tâches vivaient toutes dans un évènement ; la santé de l'évènement ne s'expliquait pas ;
deux vocabulaires fixes nommaient les clients.

## Décision

1. **Une mécanique commune** : un fait arrive (événement interne, action d'un module, passage du matin),
   le hub crée une notification par destinataire et par objet (`hub.notifications`, unique sur la sorte et
   l'objet), puis chaque canal part selon les réglages de la personne. Les sortes sont un catalogue fermé
   (`packages/contracts`, comme les natures d'e-mails) ; leurs réglages de départ (canaux, « immédiat »,
   « jour J ») sont des données (`notifications.json`). La spécification prévoyait une table
   `notification_types` : un catalogue lié au code qui produit chaque sorte suffit (aucune sorte ne se
   crée par l'organisation), sans table.
2. **Canaux et réglages (HUB-15)** : application, e-mail, push ; chaque sorte se coupe par canal, pour
   chaque personne (`notification_preferences`, sans ligne = réglage de départ).
3. **Récapitulatif (D1)** : un e-mail chaque matin, à l'heure réglée dans le fuseau de l'organisation
   (Europe/Paris au départ, `notification_settings.time_zone`), une fois par jour (`digest_sent_on`). Il
   reprend les notifications non immédiates et ce qui attend (tâches du jour, risques). Les sortes
   « immédiates » (devis signé, virement déclaré, alerte du jour J) partent tout de suite. La table
   prévue `quiet_hours` est réunie avec le récapitulatif dans `notification_settings` (une ligne par
   personne).
4. **Plages de silence (D2)** : la nuit (qui peut passer minuit) et, au choix, le dimanche : ni push ni
   e-mail immédiat ; ils partent à la fin de la plage (calcul à la minute, changements d'heure compris).
   Le jour d'un évènement, une sorte « jour J » passe outre, si la personne garde ce réglage.
5. **Destinataire (D3)** : le planner principal de l'évènement (lot 52) ; d'ici sa fusion, et pour une
   notification sans évènement, la Propriétaire (chaque adhésion « owner » active,
   `notificationRecipients`). Un incident noté le jour J prévient les autres destinataires, pas son
   auteur. L'e-mail fixe « devis signé » du lot 38a devient la notification « Devis signé ».
6. **Rien de personnel dans un push ni dans l'objet d'un e-mail (SEC-20)** : le push porte la sorte en
   mots, l'action et un chemin de l'app ; l'objet de l'e-mail ne dit que la sorte. Les paramètres d'une
   notification sont des libellés courts (numéro, intitulé, montant en centimes), effacés avec elle après
   90 jours.
7. **Push (D4, ARC-09)** : Web Push par la bibliothèque `web-push` (ADR 0096), derrière une interface
   (`modules/hub/push.ts`) que les tests remplacent. Clés VAPID dans l'environnement, validées au
   démarrage (paire cohérente). Le service worker (ADR 0064) reçoit `push` et `notificationclick` ; sa
   portée hors ligne reste le jour J ; un appareil abonné garde son inscription même sans jour J gardé,
   la déconnexion l'efface. Un abonnement que le service dit disparu (404, 410) est supprimé ; un
   abonnement inutilisé 90 jours aussi.
8. **Automatismes (HUB-28, D5)** : un écran liste chaque automatisme (contrat signé puis évènement
   confirmé ; rappel au payeur à J-7 ; relance RSVP ; rappels des tâches du client ; relances d'impayés ;
   relance avant expiration ; relances préparées des prospects ; feuilles de route ; radar des risques),
   avec son interrupteur, son délai éventuel et son journal (`automation_runs` : quand, sur quoi —
   identifiant, libellé non personnel, écran —, résultat ; 90 jours). Couper arrête les envois à venir ;
   remis en route, l'automatisme ne fait rien de ce qui était prévu avant le jour de la remise en route
   (`resumed_at` → `AutomationHooks.notBefore`, passé à chaque module par la tâche qui le lance). La purge
   RGPD et le contrôle de la chaîne des pièces ne se coupent pas (affichés « toujours actifs »). Le RIB
   du 8e jour hors établissement (JUR-07) n'a pas d'interrupteur.
9. **Rappel au payeur à J-7 (nouveau)** : à partir de J-7 (délai réglable) jusqu'au jour de l'échéance,
   un e-mail (`payment_due_reminder`) au payeur désigné du lot 43 (lien personnel de son évènement,
   lu par les services Budget et Évènements), sinon aux signataires ; une seule fois par échéance et par
   destinataire (clé de la file des e-mails) ; jamais après un virement déclaré ou un paiement noté
   (revérifié juste avant l'envoi). Les relances d'impayés du lot 43, après l'échéance, restent distinctes.
10. **Tâches hors évènement (D6, CHR-10)** : `events.event_tasks.event_id` devient facultatif ; une tâche
    sans évènement n'a ni date relative, ni prestataire, ni autre responsable que la planner ; elle peut
    se répéter (semaine, mois, trimestre, année, seulement hors évènement). L'occurrence suivante naît
    quand celle-ci est faite, ou à sa date (passage du matin), une seule fois (`recurrence_spawned_at`).
    Elle apparaît dans « Aujourd'hui » et dans l'écran Tâches.
11. **Jalons et santé (CHR-05)** : une tâche du rétroplanning peut être un jalon ; la santé du planning
    compte un point par tâche en retard et un poids réglable par jalon en retard ; seuils « à surveiller »
    et « en retard » réglables (`events.planning_health_settings`, départ dans `planning-health.json`).
    « Pourquoi ? » liste les tâches qui la dégradent, jalons d'abord. Une tâche ou un jalon en retard part
    en notification (une fois par tâche).
12. **Radar des risques (D7, GC-02)** : chaque matin (à partir de 6 h, Paris, `risk-radar.json`), avant
    le récapitulatif, et à l'affichage d'« Aujourd'hui » (section « Risques »). Il lit chaque module par
    son service (ARC-01) : prestataires retenus sans contrat, décisions en attente, échéances impayées,
    jalons en retard, feuilles de route non confirmées. Chaque alerte dit sa règle et ses faits ; les seuils
    se règlent (`hub.risk_rules`). Un module fermé ne produit aucune alerte, jamais d'erreur ; une source
    lente est ignorée (ARC-07). Les règles du lot 48 (pièces des prestataires, IBAN « à vérifier ») sont
    déclarées mais « indisponibles » tant que le module ne donne pas ces faits.
13. **Terme des clients (D8, HUB-24)** : par type d'évènement et par langue, un terme (proposé ou libre,
    40 caractères), avec son genre et son nombre (`events.event_type_vocabulary`). Il remplace l'onglet
    « Mariés » ou « Clients » de l'évènement, remplit `{{terme_clients}}` des e-mails des liens et du
    rappel J-7, et titre le bloc du client du devis : figé dans la copie du vendeur à l'envoi
    (`SellerSnapshot.clientTerm`, champ facultatif d'une colonne JSON existante, sans migration du
    schéma `quotes`), un devis émis garde son texte. Les phrases de l'app sont écrites pour rester justes
    quel que soit le terme ; aucun accord n'est deviné.
14. **Migrations** : 0173 (`hub` : notifications, réglages, abonnements, automatismes et journal, règles
    du radar), 0174 (`events` : tâches hors évènement et récurrentes, jalons, terme des clients, seuils de
    santé), 0175 (`hub` : natures `daily_digest`, `payment_due_reminder`, `notification_alert` ajoutées à
    celles de main ; l'annulation rend la liste de main). Chaque annulation est refusée tant qu'une donnée
    en dépend (automatisme coupé, tâche hors évènement, terme réglé, modèle personnalisé).

## Conséquences

- Une tâche périodique de plus (cinq minutes, derrière le verrou des tâches périodiques) ; chaque
  automatisme existant reçoit `AutomationHooks` sans changer sa logique d'envoi.
- Le lot 52 doit brancher le planner principal dans `notificationRecipients` (et le réglage « recevoir
  aussi celles des évènements où je suis assistant ») ; le lot 48 doit donner au radar ses pièces et ses
  IBAN « à vérifier » par le service `vendors`, et produire les sortes `iban_to_verify` et
  `document_expiring`.
- Les notifications, leurs réglages, les abonnements push et le journal des automatismes ne sortent pas
  dans l'export complet (exclusions motivées) ; les automatismes, les règles du radar, les termes et les
  seuils de santé, si.
- DPO-10 (pour information) : abonnements push (données techniques) et services de push des navigateurs
  comme destinataires techniques, au registre et dans la liste des sous-traitants.
