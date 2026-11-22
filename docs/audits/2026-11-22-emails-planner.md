# Qui envoie quoi : Symbola ou la messagerie de la planner (22/11/2026)

Demande de Julien du 22/11 : les messages de la relation (commerciaux, relances, échanges avec les
prestataires) partent **de la messagerie de la planner**, avec sa signature et son outil ; Symbola
les **prépare** (modèle, liens personnels déjà insérés). Symbola n'envoie lui-même que les messages
techniques : liens de connexion, invitations à un espace, sécurité.

Ce partage revient sur la décision Q18 révisée et sur l'ADR 0102 (lot 55 : tous les e-mails partent
du domaine de Symbola, avec l'adresse personnalisée de l'organisation). Il demandera un ADR.

## 1. Proposition de partage des 35 modèles (`email-templates.json`)

**Symbola envoie (technique, accès, sécurité, preuve)** :

- **Accès** :
  - `client_link`, `client_link_renewed` ;
  - `vendor_link`, `vendor_link_renewed` ;
  - `day_helper_link` ;
  - `guest_invitation`, `guest_reminder` (lien de réponse de chaque invité).
- **Signature et preuve** : `quote_signature`, `contract_signature` (lien du service de signature),
  `signed_copy`.
- **Rendez-vous en ligne** : `appointment_confirmed`, `appointment_reminder`, `appointment_rescheduled`,
  `appointment_cancelled` (confirmations de la page de réservation).
- **Sécurité et compte** : `new_device_login`, `identity_changed`, `ownership_transfer`.
- **Avis à l'équipe** : `daily_digest`, `notification_alert`, `new_message`, `prospect_form_received`.

**Symbola prépare, la planner envoie de sa messagerie** :

- **Prospects** : `prospect_reply`, `prospect_follow_up`, `questionnaire_sent`. Le lien du
  questionnaire est déjà dans le message.
- **Commercial** : `proposal_sent`, `order_first`, `proposal_expiry_reminder`. Le lien de l'espace du
  client, où se trouvent la proposition et le PDF, est dans le message.
- **Argent** : `payment_details`, `invoice_reminder`, `payment_due_reminder`.
- **Prestataires** : `vendor_brief`, `vendor_brief_reminder`, `vendor_roadmap`, `program_published`.
  Le **lien personnel de l'espace prestataire** est dans le message : le prestataire y dépose son
  devis ou sa proposition.
- **Relances d'un prestataire** : voir M16, « Noter une relance ».

**À trancher** : `task_reminder`, le rappel des tâches du client avec le lien de son espace.
Proposition : Symbola l'envoie, car c'est un rappel mécanique.

## 2. Le geste « Préparer l'e-mail »

1. Une fenêtre montre le message **prérempli et modifiable** : destinataire, objet, texte, liens.
2. **« Ouvrir dans ma messagerie »** ouvre un nouveau message dans le logiciel de la planner, avec sa
   signature (lien `mailto:`). Elle relit, change un mot, envoie.
3. Ensuite, **« J'ai envoyé »** note l'envoi : date et destinataire, au journal de l'évènement, pour
   les relances et le suivi.

Limites techniques, à connaître :

- **Pas de pièce jointe** possible par ce moyen : le PDF du devis passe par le lien de l'espace du
  client. Sinon, « Télécharger le PDF » est à côté, pour le joindre à la main.
- **Longueur** : un `mailto:` long peut être tronqué par certains logiciels. Il faut donc toujours un
  bouton **« Copier le message »**.
- **Messagerie web** (Gmail, Outlook en ligne) : le lien `mailto:` ouvre l'application réglée sur
  l'ordinateur. Si aucune ne l'est, le message se copie.
- Les **automatismes** du lot 53 (rappel d'échéance, expiration d'une proposition, relances de
  prospects et de prestataires) **n'envoient plus**. Ils déposent un élément « À envoyer » dans
  « Aujourd'hui », que la planner prépare et envoie.

## 3. Questions pour Julien

1. Le partage du § 1 te convient-il, en particulier pour la signature (le service envoie le lien) et
   les invités (Symbola envoie l'invitation à répondre) ?
2. `task_reminder` : Symbola l'envoie, ou la planner ?
3. Les automatismes deviennent des éléments « À envoyer » : d'accord ?
4. Faut-il garder l'envoi par Symbola comme **option** pour une organisation qui le préfère, ou le
   retirer pour les messages de la relation ?

## 4. Décisions de Julien (22/11)

1. Partage du § 1 : **accepté** (signature et invitations des invités restent envoyées par Symbola).
2. `task_reminder` : **préparé, envoyé par la planner** ; aucun envoi automatique.
3. Les automatismes deviennent des éléments « À envoyer » d'« Aujourd'hui » : **accepté**.
4. **Pas d'option** d'envoi par Symbola pour les messages de la relation : l'expérience d'une vraie
   messagerie (Gmail ou autre) ne se reproduit pas. Revient sur Q18 révisée et l'ADR 0102 : ADR à écrire.

## 5. Décision révisée par Julien (22/11, plus tard)

Q4 révisée : **l'envoi par Symbola reste en option**, par organisation, pour les planners qui veulent
ce qu'il permet (devis ou facture joint d'office, relances automatiques). Le réglage, dans
Paramètres › E-mails, propose :

- **« Je les envoie de ma messagerie »** (par défaut) : Symbola prépare les messages de la relation,
  la planner les envoie elle-même (§ 2) ; les automatismes déposent des éléments « À envoyer ».
- **« Symbola les envoie pour moi »** : les messages de la relation partent de Symbola comme avant
  (adresse personnalisée de l'ADR 0102, pièces jointes, relances automatiques du lot 53).

Les messages techniques (§ 1, « Symbola envoie ») partent de Symbola dans les deux cas.

