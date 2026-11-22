# ADR 0112 — L'heure d'envoi de chaque automatisme ; des envois à l'heure exacte

- Statut : accepté. Spécification du lot 66 validée par Julien le 22/11/2026 (D1) ; maquette M17
  (`docs/maquette/Envois-et-marque.html`).
- Date : 2026-11-22
- Complète : [0095](0095-notifications-automatismes-radar-et-vocabulaire.md) (automatismes),
  [0114](0114-taches-periodiques-sans-visiter-chaque-organisation.md) (tâches périodiques).
- Exigences : HUB-28, CHR-05 ; spécification `docs/lots/lot-66-envois-et-marque.md`, paquet 66a.

## Contexte

Les automatismes qui envoient un e-mail partaient au premier passage horaire d'une plage fixe, écrite
dans les données de départ (9 h à 19 h, 9 h à 20 h pour les invités) : entre 9 h et 9 h 59 selon
l'heure de démarrage du serveur. Les relances automatiques de prospects n'avaient aucune plage et
pouvaient partir la nuit. La planner ne pouvait rien régler.

## Décision

1. **Une heure par automatisme** (D1 a), au quart d'heure, préremplie par **l'heure d'envoi par
   défaut** de l'organisation (9 h 00 au départ, `sending.json`). Concernés : rappel au payeur,
   relance avant expiration, relances d'impayés, rappel des tâches du client, relances des invités,
   feuille de route, relances de prospects. Le RIB du 8e jour et la relance du brief, sans
   interrupteur, suivent l'heure par défaut. Les rappels de rendez-vous gardent leur délai relatif.
2. **Une fenêtre, pas une plage** : un envoi part à partir de son heure, et encore pendant six heures
   (`catchUpHours`, rattrapage d'un serveur arrêté), jamais après minuit. Les règles de chaque
   automatisme (un rappel à partir de tel jour, une seule fois, clé de la file) ne changent pas : un
   envoi manqué part au passage suivant, le jour même, jamais en double. Les plages fixes des données
   de départ sont retirées.
3. **Le fuseau de l'évènement** : la relance avant expiration, le rappel au payeur, la relance du
   brief et la feuille de route lisent l'heure dans le fuseau de leur évènement. Les envois qui
   regroupent plusieurs évènements (rappel des tâches d'une personne, relances d'impayés, des invités,
   des prospects, RIB) la lisent à Paris. **Écart assumé** avec la spécification (« dans le fuseau de
   l'évènement ») pour ces derniers : le pilote est à Paris ; les lire par évènement demanderait de
   découper chaque envoi groupé.
4. **À l'heure exacte** : les tâches de ces automatismes passent toutes les cinq minutes (au lieu
   d'une heure). Pour ne pas charger la base (ADR 0114), chaque organisation n'est lue que si l'heure
   d'un de ses automatismes est venue, dans le fuseau de Paris ou d'un de ses évènements à venir ; puis
   au plus une fois par heure pendant le rattrapage. Les heures et les fuseaux de chaque organisation
   sont gardés une demi-heure par le processus, et relus aussitôt après un réglage.

## Conséquences

- Paramètres › Automatisations : « Heure d'envoi par défaut », et « Envoi à » sur chaque automatisme
  concerné (« 09:00 (par défaut) » tant qu'il n'a pas la sienne). Réglage de la Propriétaire.
- Données : `hub.automations.send_time` (nulle : l'heure par défaut) et `hub.sending_settings`
  (migration 0207, avec le rappel du jour J de 66b).
- Un élément qui devient dû après la fin du rattrapage part le lendemain à l'heure (le rappel au
  payeur reste borné au jour de l'échéance ; les relances d'impayés prennent le relais).
- Plusieurs processus qui tiennent tour à tour le verrou des tâches relisent les heures au plus une
  demi-heure après un réglage fait ailleurs.

## Le rappel du jour J (lot 66b ; D2 à D4 ; M18)

1. **Un automatisme « Rappel du jour J »**, réglé par cible (D2) : la planner (cochée au départ ; la
   personne en charge de l'évènement, sinon la titulaire), les prestataires retenus, l'équipe de
   l'évènement et ses renforts, les clients (décochés au départ). Pour chaque cible, la veille ou le
   matin même, à une heure (D3) ; valeurs de départ dans `day-reminder.json`. Le réglage d'un évènement
   (onglet Programme) remplace celui de l'organisation, cible par cible (couper, autre moment, autre
   heure).
2. **Envoyé par Symbola, toujours** (D4) : les quatre modèles (`day_reminder_*`) sont rangés côté
   techniques (`email-senders.json`), comme le programme décalé du jour J ; ils restent modifiables
   (migration 0210). Une fois par personne et par évènement (clé de la file des e-mails) ; jamais pour
   un évènement annulé, reporté, clos, d'essai ou sans date.
3. **Contenu** : la planner reçoit le programme, les contacts du jour, ce qui reste ouvert (postes sans
   prestataire retenu, ses tâches non faites à l'échéance de l'évènement) et le bouton du mode Jour J ;
   un prestataire, ses horaires (les séquences de son poste), le lieu et les contacts du jour ; l'équipe,
   le programme et les contacts ; les clients, un mot. Les prestataires et les clients retrouvent le
   programme dans leur espace : leur lien personnel n'est gardé que haché, il ne peut pas être remis dans
   l'e-mail. Un prestataire retenu sans lien reçoit le rappel à l'adresse du carnet. « Ce qui reste
   ouvert » ne lit pas encore les contrats non signés ni les échéances du module Devis (écart assumé :
   les modules ne se lisent que par leur service, et le module Évènements ne lit pas le module Devis).
4. **À l'heure** : une tâche toutes les cinq minutes ; les réglages et les évènements des jours proches
   de chaque organisation sont gardés une demi-heure (relus après un réglage) : la base n'est lue pour
   envoyer que lorsqu'un rappel est dû. Trace dans le journal de l'automatisme et le journal des envois
   (par évènement).
