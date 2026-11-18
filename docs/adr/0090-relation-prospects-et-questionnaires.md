# ADR 0090 — Réponses depuis Symbola, relances préparées, fusion des contacts par événement, questionnaires figés dans le module Évènements

- Statut : accepté (spécification du lot 45 validée par Julien le 18/11/2026, décisions D1 à D9 dans
  leur option a ; changements des schémas `events` et `hub` et élargissement de la contrainte des
  natures d'e-mails du hub accordés le même jour)
- Date : 2026-11-18
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) et [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md)
  (un module, un schéma), [0014](0014-evenements-internes-pour-le-mvp.md) (événements internes),
  [0027](0027-telechargements-servis-par-l-app.md) (fichiers servis après contrôle),
  [0053](0053-acces-des-tiers-par-lien-personnel.md) (liens personnels), [0069](0069-contact-dans-le-noyau.md)
  (fiche contact unique), [0072](0072-emails-a-l-image-de-l-organisation.md) (e-mails et modèles de
  messages), [0076](0076-file-des-taches-et-adaptateur-e-mail.md) (file des envois, tâches périodiques),
  [0084](0084-formulaire-de-contact-et-pipeline.md) (prospects et pipeline).
- Exigences : CRM-05, CRM-06, CRM-07, CRM-09, POR-07, HUB-21 ; parcours PAR-02 (étapes 2 et 7) ;
  scénarios SC-02 et SC-10 ; `docs/lots/lot-45-relation-prospects-questionnaires.md`. Question AV-9
  à l'avocat.

## Contexte

Le lot 44 fait entrer les demandes. Il restait à y répondre vite, à relancer sans oublier, à ne pas
avoir deux fois la même personne et à recueillir les informations du couple une seule fois. Jusqu'ici
« Écrire au client » (lot 38b) ouvrait la messagerie de la planner : Symbola n'envoyait rien, ne
gardait aucun historique et ne pouvait donc pas relancer.

## Décision

1. **Deux façons d'envoyer** (D1). « Envoyer depuis Symbola » : le texte, relu et modifié par la
   planner, part par la file des envois (ADR 0076) à l'image de l'organisation, réponses à son
   adresse ; « Ouvrir dans ma messagerie » garde le `mailto`, l'envoi est noté « préparé ». Les deux
   entrent dans `events.event_messages`, l'historique du contact (CRM-03). Les natures d'e-mails
   `prospect_reply` et `prospect_follow_up` portent le texte de la planner (sans bouton) ;
   `questionnaire_sent` porte le lien personnel (bouton « Répondre au questionnaire »).
2. **Brochure par lien** (D1). Un PDF de l'organisation (type vérifié, antivirus, stockage privé),
   jamais en pièce jointe. La variable `{{brochure}}` reste dans le texte jusqu'à l'envoi ; le lien
   (`/partage#<organisation>.<secret>`, seul le haché est gardé sur le message) vaut 30 jours et
   passe par la page de partage existante (lot 37a), qui ne voit jamais le jeton dans l'adresse.
3. **Page de réservation ou créneaux** (ARC-07). `{{lien_rendez_vous}}` vaut une phrase avec la page
   de réservation quand le module Rendez-vous est ouvert et la page active, sinon des créneaux à
   compléter dans le texte.
4. **Relances préparées** (D2). Un réglage par organisation (`events.prospect_follow_up_settings`,
   copié de `prospect-follow-ups.json` : J+3, J+7) ; chaque relance se compte depuis le dernier envoi
   de la planner, à la même heure de Paris. Une tâche horaire prépare la relance du jour
   (`events.prospect_follow_ups`, une par rang et par envoi : rejouable) ; elle apparaît dans
   « Aujourd'hui », la planner la relit et l'envoie, ou la retire. L'envoi automatique est un
   réglage, désactivé par défaut ; une relance qui garde une variable vide attend la relecture.
5. **Arrêt par les faits connus de Symbola** (D3). « A répondu » et « Ne plus relancer » (gestes de la
   planner), changement d'étape, statut autre qu'Option, lien du client ouvert, réponse à un
   questionnaire, rendez-vous pris sur la page publique, signature, nouvel envoi de la planner. Les
   faits des autres modules (rendez-vous, signatures) sont demandés à leurs services par
   `lib/prospect-follow-ups.ts`. Tout est revérifié juste avant l'envoi, sous verrou de la ligne.
   Aucune boîte e-mail n'est lue.
6. **Doublons détectés, fusion manuelle** (D4). `hub.contact_duplicates` (e-mail et téléphone
   normalisés, à la saisie et chaque nuit ; une paire écartée ne revient pas ; jamais avec une fiche
   fictive). La fusion se choisit champ par champ et se confirme ; la fiche absorbée est supprimée
   après que ses notes et appartenances sont passées à la fiche gardée ; `hub.contact_merges` garde
   qui, quand, quelles fiches et les noms des champs repris (aucune valeur).
7. **Les modules suivent par événement** (D5). Le hub publie `hub.contact.merged` v1 (identifiants
   seulement) dans la même transaction ; les consommateurs `events`, `quotes` et `appointments`
   repointent leurs références par leur service, de façon idempotente (corbeille comprise). Pendant
   les quelques secondes du traitement, l'affichage des clients d'un évènement suit la fusion
   (`getContactsByIds(…, { followMerges: true })`) ; les autres lectures ne suivent pas, pour qu'un
   identifiant absorbé ne désigne jamais une autre fiche dans un traitement RGPD.
8. **Questionnaires dans `events`** (D6). Modèles par type d'évènement, duplicables et versionnés
   (`questionnaire_templates`, `questionnaire_template_items` : une version par enregistrement de
   questions changées). Un questionnaire envoyé (`event_questionnaires`) garde une copie figée de ses
   questions : modifier ou retirer le modèle ne le change pas (HUB-21). Il part par le lien personnel
   du client : créé avec la seule rubrique « Questionnaires », ou, s'il existe, rubrique ajoutée et
   jeton renouvelé (le nouveau lien part avec le questionnaire, comme « Renvoyer le lien »).
9. **Réponses et préremplissage** (D7). Chaque réponse est enregistrée aussitôt
   (`questionnaire_answers`, reprise possible) ; « Terminer » ferme le questionnaire, prévient la
   planner (« Aujourd'hui ») et remplit les champs vides de l'évènement ; une réponse qui contredit la
   fiche attend le choix de la planner (`resolution`). Une question déjà répondue dans un autre
   questionnaire de l'évènement (même clé ou même champ) n'est pas reposée ; un champ connu est
   proposé pré-rempli. Pas de question « fichier » (D8).
10. **Migrations** : 0165 (`events`), 0166 (`hub` : doublons, fusions), 0167 (`hub` : contrainte des
    natures d'e-mails, réunion de la liste de `main` et des trois natures ; l'annulation rend la
    liste de `main`). Chacune s'annule, refusée tant que des données en dépendent.

## Conséquences

- PAR-02 est complet de la demande à l'évènement prérempli, sans ressaisie.
- La planner garde la main : rien ne part sans elle, sauf si elle active l'envoi automatique.
- Une réponse par e-mail ou par WhatsApp reste invisible : c'est un geste de la planner (lot 55 pour
  la messagerie).
- Envoyer un questionnaire à un client qui a déjà un lien renouvelle son jeton ; l'ancien lien cesse.
- La fusion ne se défait pas automatiquement ; la trace permet de la reprendre à la main.
- Les relances à un prospect qui a fait une demande sont traitées comme la suite de sa demande, pas
  comme de la prospection (RGP-17 « Sans objet ») ; chaque relance porte « Répondez simplement » et la
  planner peut arrêter les relances. À confirmer par l'avocat (AV-9).

## Options écartées

- Garder seulement le `mailto` (D1 b) : ni historique ni relances.
- Relances automatiques par défaut (D2 b) ; lecture des réponses par e-mail (D3 b) : nouveau
  sous-traitant et données sensibles.
- Fusion automatique sur e-mail identique (D4 b) ; le hub qui écrit dans les tables des autres
  modules (D5 b, contraire à ARC-01).
- Un module `questionnaires` à part (D6 b) ; la réponse qui remplace toujours la fiche (D7 b) ; la
  question « fichier » (D8 b).
