# ADR 0085 — Prestataires par lien : brief groupé et cloisonné, un lien du brief au jour J, choix du client qui engage

- Statut : accepté (spécification du lot 47 validée par Julien le 18/11/2026, décisions D1 à D10
  dans leur option a ; migration `hub` à part accordée le 18/11/2026)
- Date : 2026-11-18
- Complète : [0053](0053-acces-des-tiers-par-lien-personnel.md) (liens personnels),
  [0054](0054-budget-et-prestataires-du-lot-28.md) (« Retenu » engage la ligne de budget, PRE-02),
  [0072](0072-emails-a-l-image-de-l-organisation.md) (modèles d'e-mails, garde-fou des envois
  groupés), [0076](0076-file-des-taches-et-adaptateur-e-mail.md) (file des tâches de fond),
  [0027](0027-fichiers-servis-par-l-app.md) (fichiers servis après contrôle des droits).
- **Revient sur** la décision D9 du lot 28 (« une décision n'engage rien d'elle-même »), pour les
  seules décisions « options » (voir le point 5).
- Exigences : PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; scénario SC-05 ;
  `docs/lots/lot-47-prestataires-par-lien.md`. Question AV-6 à l'avocat.

## Contexte

Pour un poste (les fleurs), la planner écrivait à chaque prestataire, recopiait les réponses,
comparait les devis à la main et montrait deux propositions au client, qui répondait sans que rien
ne s'engage. PAR-05 demande un brief commun, une réponse du prestataire par son lien, un
comparatif, une sélection au client dont le choix engage le budget et crée les tâches de suivi,
puis une feuille de route à J-30 et J-7 confirmée par le prestataire.

## Décision

1. **Un brief par poste** (D1, D10) : `events.vendor_briefs` (besoin, nombre d'invités, budget
   indicatif masqué par défaut, date limite) et ses inspirations (`vendor_brief_documents`,
   documents de l'évènement). Les destinataires sont des prestataires consultés du poste ; sans le
   module Prestataires, le nom et l'e-mail se saisissent (ARC-07).
2. **Un e-mail et un lien par prestataire, cloisonnés** (PRE-03) : l'envoi passe par l'écran de
   contrôle des destinataires (MSG-02, empreinte de la liste) ; chaque e-mail part seul, sans copie,
   avec le lien personnel du prestataire (public `vendor`, jeton haché). Le serveur ne donne à un
   lien que son prestataire : jamais un autre nom, montant ou réponse (tests d'abus).
3. **Un seul lien du brief au jour J** (D3) : ce que montre `/prestataire` dépend du statut. En
   consultation : le brief et une action ; écarté : « un autre choix a été fait » ; retenu :
   l'espace complet (lot 26b), le dépôt de la facture et la feuille de route. Sans code par défaut
   en consultation (rien de sensible) ; le code reste possible une fois retenu.
4. **Un clic d'e-mail n'enregistre rien** (D4) : les deux boutons de l'e-mail mènent à
   `/lien?reponse=oui|non#jeton` ; la page présélectionne la réponse, qu'un toucher confirme (les
   messageries ouvrent les liens pour les vérifier). Les variables `link_available` et
   `link_unavailable` deviennent chacune un bouton à son libellé.
5. **Le choix du client engage** (D6) : dans la transaction de sa réponse à une décision
   « options », le prestataire choisi passe à « Retenu » (l'événement `events.vendor_slot.booked`
   engage la ligne de budget, règle PRE-02), les autres consultés en lice passent à « Écarté »
   (motif « un autre choisi », sans e-mail), les tâches de suivi sont créées depuis la liste de
   l'organisation (`vendor-follow-up-tasks.json`, HUB-20), et l'état d'avant est gardé sur la
   décision (`engagement`). La planner est prévenue (« Aujourd'hui ») et **annule le tout d'un
   geste pendant 7 jours** : statuts d'avant, tâches non commencées retirées,
   `events.vendor_option.undone` publié. **Cela remplace la décision D9 du lot 28 pour les seules
   décisions « options »** ; une dépense validée ou un programme approuvé n'engagent toujours rien
   d'eux-mêmes. Le choix ne vaut pas commande auprès du prestataire : le contrat reste à signer
   (première tâche de suivi) ; la phrase sous le bouton attend l'avis de l'avocat (AV-6).
6. **Avis du client** (D7) : « J'aime », « Pas pour nous » et un commentaire par option, avant de
   choisir (`event_decision_option_feedback`), lus par la planner dans le comparatif. Un payeur
   (catégories choisies) ne voit une décision « options » que pour un poste de son périmètre.
7. **Scénarios** (D5, BUD-05) : `vendor_scenarios` et `vendor_scenario_choices` (au plus un
   prestataire consulté par poste) ; deux scénarios côte à côte, totaux TTC au centime, devis sans
   montant « à préciser », face à l'enveloppe du client (BUD-02) et au budget estimé.
8. **Envois planifiés** (D2, D8) : une tâche horaire, derrière le verrou des tâches périodiques
   (ADR 0076), envoie la relance la veille de la date limite (rattrapée le jour même) et les
   feuilles de route à J-30 et J-7 (dans le fuseau de l'évènement, chacune rattrapée jusqu'à la
   suivante), entre 9 h et 19 h. Chaque envoi est réservé en base avant de partir (une fois
   chacun) et passe par la file des tâches de fond avec sa clé d'unicité. Comme le jeton d'un lien
   n'est gardé que haché, une relance ou une feuille de route **rééquipe le lien d'un nouveau
   jeton** : l'ancien bouton cesse de valoir.
9. **E-mails** (D9) : trois natures, `vendor_brief`, `vendor_brief_reminder`, `vendor_roadmap`,
   modifiables par l'organisation ; la contrainte `hub.email_templates_kind_check` est élargie
   par une migration `hub` à part (0160), annulable, avec la réunion des natures de `main`.
10. **Facture du prestataire** : rangée dans les documents de l'évènement (non partagée), avec le
    lien qui l'a déposée (`uploaded_by_link_id`) ; `uploaded_by_user_id` devient facultatif. Elle
    ne crée rien dans la facturation de la planner.
11. **Réglages** (partie F) : `vendor_coordination_settings` (date limite par défaut, relance,
    feuilles de route J-30 et J-7 désactivables, délai de l'alerte, tâches de suivi) ; sans ligne,
    les valeurs de départ (`vendor-coordination.json`).

## Conséquences

- Migrations 0159 (`events`) et 0160 (`hub`), annulables ; l'annulation est refusée tant qu'une
  facture déposée par un prestataire, une réponse au fil d'activité ou un modèle réécrit existent.
- Nouveaux événements internes : `events.vendor.answered`, `events.vendor_option.chosen`,
  `events.vendor_option.undone` (v1), sans nom ni montant.
- RGPD : besoin du brief, message du prestataire, avis du client et nom d'un scénario au registre ;
  `privacy/v1` du module events les trouve et les efface. Le devis déposé suit la durée des
  documents de l'évènement.
- Le budget engagé par un choix annulé : voir « Point ouvert ».

## Point ouvert

L'historique des montants du budget (`budget.budget_line_history.new_value_cents`) n'admet pas de
valeur vide : le module Budget ne sait pas « désengager » une ligne. L'annulation sous 7 jours
publie `events.vendor_option.undone` ; la libération de l'engagé côté Budget dépend de la réponse
de Julien (migration `budget` à part, ou engagé laissé à corriger à la main).
