# ADR 0110 — Les messages de la relation sont préparés par Symbola et envoyés par la planner ; l'envoi par Symbola reste en option

- Statut : accepté (décisions de Julien du 22/11/2026, note `docs/audits/2026-11-22-emails-planner.md`,
  § 4 et § 5 ; spécification `docs/lots/lot-65-retours-staging.md`, § 65d).
- Date : 2026-11-22
- Précise : [0102](0102-messagerie-adresse-d-expedition-et-journal-des-envois.md) (adresse d'expédition
  et journal des envois) et la décision Q18 révisée (19/11).
- Complète : [0072](0072-emails-a-l-image-de-l-organisation.md) (modèles d'e-mails),
  [0095](0095-notifications-automatismes-radar-et-vocabulaire.md) (automatismes du lot 53),
  [0107](0107-fenetre-pour-modifier-panneau-pour-les-reglages.md) (fenêtres).
- S'écarte de : FAC-09 et HUB-28 dans le mode par défaut (voir Écarts), Q45.
- Exigences : MSG-01, HUB-20, HUB-28, FAC-09 ; paquet 65d2.

## Contexte

Depuis le lot 55, tout e-mail adressé à un tiers part de Symbola, de l'adresse personnalisée de
l'organisation (ADR 0102). La recette du 22/11 a montré que la planner veut écrire à ses clients et à
ses prestataires depuis sa propre messagerie, avec sa signature et son historique : un message de la
relation (proposition, relance, brief…) qui part d'une adresse de Symbola sonne comme un automate.
Julien a d'abord retiré l'envoi par Symbola pour ces messages (§ 4 de la note), puis l'a gardé en
option, par organisation, pour ce qu'il permet : pièce jointe d'office et relances automatiques (§ 5).

## Décision

1. **Deux familles de modèles, en données, liste fermée** (`packages/starter-templates/src/email-senders.json`,
   contrôlée par `relation-mail-rules.test.ts` : chaque modèle dans une liste et une seule) :
   - **techniques** (21) : accès (`client_link`, `client_link_renewed`, `vendor_link`,
     `vendor_link_renewed`, `day_helper_link`, `guest_invitation`, `guest_reminder`), signature et
     preuve (`quote_signature`, `contract_signature`, `signed_copy`), rendez-vous en ligne (quatre),
     sécurité et compte (`new_device_login`, `identity_changed`, `ownership_transfer`), avis à
     l'équipe (`daily_digest`, `notification_alert`, `new_message`, `prospect_form_received`) :
     **toujours envoyés par Symbola** ;
   - **de la relation** (14) : `prospect_reply`, `prospect_follow_up`, `questionnaire_sent`,
     `proposal_sent`, `order_first`, `proposal_expiry_reminder`, `payment_details`,
     `invoice_reminder`, `payment_due_reminder`, `vendor_brief`, `vendor_brief_reminder`,
     `vendor_roadmap`, `program_published` et `task_reminder` (décision 2 du 22/11).
2. **Un réglage par organisation** (`hub.relation_mail_settings`, migration 0205), dans Paramètres ›
   Modèles d'e-mails, titulaire du compte seulement :
   - **« Je les envoie de ma messagerie »**, par défaut (sans ligne) ;
   - **« Symbola les envoie pour moi »** : le fonctionnement d'avant le lot, inchangé (adresse de
     l'ADR 0102, pièces jointes, relances automatiques du lot 53).
   Changer de réglage ne perd rien : les messages déjà préparés restent « À envoyer ».
3. **Garde-fou** : `sendOrganizationEmail` refuse d'envoyer un modèle de la relation quand
   l'organisation l'envoie de sa messagerie (rien n'est mis en file) ; chaque point d'envoi dépose à
   la place un **message préparé**.
   **Seule exception** (Q45, décision de Julien du 22/11/2026) : le programme décalé le jour J
   (JRJ-05, `publishAndNotifyDayShift`) part toujours de Symbola, quel que soit le réglage. En plein
   mariage, la planner n'a pas le temps d'envoyer elle-même un message par prestataire.
4. **Message préparé** (`hub.prepared_emails`) : le modèle, l'évènement, le destinataire **par son
   identifiant** (lien personnel, contact ou signataire), des références (identifiants seulement),
   l'origine (geste ou automatisme) et la clé de l'envoi qu'il remplace (une fois par clé). **Aucun
   contenu ni aucune adresse** n'est gardé : le message est recomposé à l'ouverture par le module qui
   l'a déposé (`draftQuoteRelationEmail`, `draftEventsRelationEmail`, réunis par
   `lib/prepared-emails.ts`), avec les mêmes valeurs qu'un envoi par Symbola.
5. **La fenêtre « Préparer l'e-mail »** (ADR 0107 ; plein écran sur téléphone) montre le message
   prérempli et modifiable : destinataire, objet, texte, liens personnels déjà insérés. Trois
   actions : **« Ouvrir dans ma messagerie »** (`mailto:`), **« Copier le message »** (messagerie web,
   ou lien trop long), **« J'ai envoyé »**, qui note la date, la personne de l'équipe, le modèle et le
   destinataire (identifiant) au journal du hub et dans le fil d'activité de l'évènement.
   **« Ne pas l'envoyer »** l'écarte. Pas de pièce jointe : le message renvoie à l'espace personnel,
   et « Télécharger le PDF » est à côté quand il y en a un (devis, contrat, programme du client).
6. **Gestes** (proposition, « commande d'abord », brief, programme, questionnaire, réponse et relance
   d'un prospect, remerciements de la clôture) : le geste fait ce qu'il faisait (devis envoyé, liens
   créés, version diffusée…), dépose les messages et ouvre aussitôt la fenêtre (`?preparer=`, des
   identifiants seulement dans l'adresse). Les remerciements de la clôture, dont le texte n'est gardé
   nulle part, s'ouvrent depuis le formulaire ; rouverts plus tard, ils ne peuvent plus être recomposés
   et se préparent de nouveau depuis la clôture.
7. **Automatismes** (lot 53 et suivants : rappel d'échéance, relance d'impayé, RIB du 8e jour,
   relance avant expiration, relance d'un brief, feuille de route, rappel des tâches du client) : ils
   gardent leurs réglages et leurs déclencheurs ; seule leur sortie change, un élément
   **« À envoyer »** dans la partie « Relances » d'« Aujourd'hui » (`email_to_send`), qui ouvre la
   fenêtre. La relance automatique d'un prospect attend toujours la relecture de la planner.
8. **Liens personnels** : un message qui porte un lien (questionnaire, brief, relance de brief,
   feuille de route) reçoit un **nouveau jeton à l'ouverture de la fenêtre**, comme à chaque envoi par
   Symbola ; l'ancien cesse, et la fenêtre le dit. Les jetons restent hachés en base (SEC-14).

## Écarts avec le cahier des charges (Q45)

- **FAC-09** (« relances d'impayés réglables ») et **HUB-28** (automatismes « échéance → relance ») :
  dans le mode par défaut, la relance est **préparée** et envoyée par la planner, pas envoyée par
  Symbola. Avec l'option, elle reste envoyée.
- **MSG-01** et l'ADR 0102 : dans le mode par défaut, la messagerie de Symbola ne sert plus aux
  messages de la relation ; l'option la garde. Les modèles servent dans les deux modes.
- La spécification parlait de « 17 modèles de la relation » et « 18 techniques » ; le partage du § 1
  de la note, validé par Julien, en compte **14** et **21** (avec `task_reminder` côté relation). C'est
  ce partage qui est appliqué.

## Conséquences

- Données : migration 0205 (schéma hub, réversible ; annulation refusée tant qu'un message attend ou
  qu'un réglage existe). Aucune donnée personnelle nouvelle : identifiants seulement (registre RGPD).
- Un module fermé rend ses messages « indisponibles » dans la fenêtre et les retire d'« Aujourd'hui »
  (ARC-06) ; un modèle à variable vide le dit, sans erreur.
- Le geste « Relancer » d'un prestataire (« Noter une relance », M16) est traité à part (65d1).
- Hors périmètre : l'envoi depuis la boîte de la planner par connexion Gmail ou Outlook (écarté le 22/11).
- Tests : `modules/hub/relation-mail-rules.test.ts`, `modules/hub/relation-mail.integration.test.ts`
  (aucun modèle de la relation ne part en mode par défaut ; isolation), et les tests des modules réglés
  en « Symbola les envoie pour moi » (programme avec pièce jointe, relances automatiques) ; programme et
  rappel des tâches préparés (`program-notify`, `task-reminders`).
