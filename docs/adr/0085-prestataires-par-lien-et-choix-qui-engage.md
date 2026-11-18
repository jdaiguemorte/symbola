# ADR 0085 — Prestataires par lien : brief groupé et cloisonné, un lien du brief au jour J, choix du client qui engage

- Statut : accepté (spécification du lot 47 validée par Julien le 18/11/2026, décisions D1 à D10
  dans leur option a ; migrations `hub` et `budget` à part accordées le 18/11/2026 ; D6 revue par
  Julien le 18/11/2026 : plus de délai, modification du retenu à tout moment ; AV-6 tranché)
- Date : 2026-11-18
- Complète : [0053](0053-acces-des-tiers-par-lien-personnel.md) (liens personnels),
  [0054](0054-budget-et-prestataires-du-lot-28.md) (« Retenu » engage la ligne de budget, PRE-02),
  [0072](0072-emails-a-l-image-de-l-organisation.md) (modèles d'e-mails, garde-fou des envois
  groupés), [0076](0076-file-des-taches-et-adaptateur-e-mail.md) (file des tâches de fond),
  [0027](0027-fichiers-servis-par-l-app.md) (fichiers servis après contrôle des droits).
- **Revient sur** la décision D9 du lot 28 (« une décision n'engage rien d'elle-même »), pour les
  seules décisions « options » (voir le point 5).
- Exigences : PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; scénario SC-05 ;
  `docs/lots/lot-47-prestataires-par-lien.md`. AV-6 tranché par Julien (noté dans la fiche de l'avocat).

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
   (motif « un autre choisi », sans e-mail), et les tâches de suivi sont créées depuis la liste de
   l'organisation (`vendor-follow-up-tasks.json`, HUB-20), **rattachées au prestataire**
   (`event_tasks.follow_up_candidate_id`). La planner est prévenue (« Aujourd'hui »). **Cela
   remplace la décision D9 du lot 28 pour les seules décisions « options »** ; une dépense validée
   ou un programme approuvé n'engagent toujours rien d'eux-mêmes.
   **Pas de délai** (décision de Julien du 18/11/2026, qui remplace la fenêtre de 7 jours de la
   spécification) : Symbola affiche un devis et met en relation, il ne porte pas la facture du
   prestataire ; aucune rétractation n'a lieu d'être ici. La planner **modifie le prestataire
   retenu à tout moment** : un autre consulté du poste (il passe à « Retenu », l'engagé passe à son
   devis, ses tâches de suivi sont créées, l'ancien est écarté), ou personne (chacun revient en
   lice). Un prestataire qui n'est plus retenu perd ses tâches de suivi non commencées (celles
   faites restent) et l'événement `events.vendor_retention.released` est publié. Le client ne
   change pas seul son choix ; la planner peut le lui redemander (nouvelle décision « options »).
   Le choix **ne vaut pas commande** (AV-6, tranché par Julien) ; sous le bouton : « Votre choix
   est transmis à <planner> ; le contrat se signe directement avec le prestataire. »
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

- Migrations 0159 (`events`), 0160 (`hub`) et **0161 (`budget`, accord de Julien du 18/11/2026,
  option a)**, chacune annulable et à part ; elles suivent la règle de renumérotation (numéro et
  `when`) si une autre PR fusionne avant. 0161 rend `budget.budget_line_history.new_value_cents`
  facultative : la libération d'un engagé est historisée (nouvelle valeur vide). Les annulations
  sont refusées tant qu'une facture déposée par un prestataire, une réponse au fil d'activité, un
  modèle réécrit ou un engagé libéré à l'historique existent.
- Nouveaux événements internes : `events.vendor.answered`, `events.vendor_option.chosen`,
  `events.vendor_retention.released` (v1), sans nom du client.
- Module Budget : sur `events.vendor_retention.released`, par son propre service, il libère
  l'engagé des lignes du prestataire **seulement s'il vaut encore ce que la retenue avait engagé**
  (son devis, ou le devisé de chaque ligne) ; un engagé modifié depuis n'est pas touché ; un rejeu
  ne libère rien de plus ; sous RLS de l'organisation de l'événement.
- RGPD : besoin du brief, message du prestataire, avis du client et nom d'un scénario au registre ;
  `privacy/v1` du module events les trouve et les efface. Le devis déposé suit la durée des
  documents de l'évènement.
