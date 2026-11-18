# ADR 0084 — Formulaire de contact public et pipeline en colonnes dans le module Évènements

- Statut : accepté (spécification du lot 44 validée par Julien le 18/11/2026, décisions D0 à D11
  dans leur option a ; élargissement de la contrainte des natures d'e-mails du hub accordé le même
  jour)
- Date : 2026-11-18
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) et [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md)
  (un module, un schéma), [0044](0044-limitation-de-debit.md) (limitation de débit,
  en-têtes), [0055](0055-statuts-d-evenement-et-retroplanning-a-la-creation.md) (statuts du cycle de vie),
  [0069](0069-contact-dans-le-noyau.md) (fiche contact unique), [0072](0072-emails-a-l-image-de-l-organisation.md)
  (modèles d'e-mails), [0079](0079-socle-des-modules-rendez-vous-et-invites.md) (chiffrement au niveau
  du champ).
- Exigences : CRM-01, CRM-02 ; parcours PAR-02 (étape 1) ; scénario SC-02 (variante V1) ;
  `docs/lots/lot-44-contact-pipeline.md`. Questions AV-4 et AV-5 à l'avocat.

## Contexte

Une demande de mariage arrive par e-mail, téléphone ou message ; la planner la recopie. Le cahier
des charges veut qu'en V1 le formulaire crée le prospect (SC-02, PAR-02) et que les prospects
avancent dans un pipeline aux étapes réglables (CRM-02). Toutes les pages refusaient jusqu'ici
d'être encadrées (`X-Frame-Options: DENY`, `frame-ancestors 'none'`).

## Décision

1. **Pas de module CRM** (D8) : le prospect est un évènement au statut Option ; le formulaire, les
   demandes et les étapes vivent dans le module `events` (schéma `events`). Le contact passe par le
   service du hub.
2. **Étapes à l'intérieur du statut Option** (D9) : `events.pipeline_stages` (une à dix, liste de
   l'organisation copiée de `pipeline-stages.json` à la première ouverture) et
   `events.events.pipeline_stage_id` (vide : la première étape). Les statuts ne deviennent pas
   paramétrables (ADR 0055) : « Gagné » confirme l'évènement (`changeEventStatus`), « Perdu »
   l'annule avec son motif obligatoire (`cancelEvent`). Un passage d'étape entre au fil d'activité
   (nature `stage_changed`). Ordre des cartes : la plus ancienne activité en haut (D11). À 375 px,
   une étape à la fois (D10).
3. **Déplacer** (D0) : le composant commun `app/ui/move-to-group.tsx` (bouton « Déplacer » et liste
   au clavier et au doigt, glisser-déposer HTML à la souris, annonce, focus), utilisé sans
   modification ; les deux sorties sont des groupes du composant, qui ouvrent une fenêtre de
   confirmation avant l'enregistrement.
4. **Formulaire public** (D2, D3) : `/contact/<adresse>`, adresse choisie par la planner (même règle
   que la page de réservation du lot 46), liste de champs fixe tirée de CRM-01, champs facultatifs
   masquables. La ligne `events.contact_forms` se lit sans organisation (politique `public_lookup`,
   exception écrite comme `appointments.booking_pages`) ; elle ne porte rien de personnel.
5. **Encadrement** (D1) : seule `/contact/<adresse>/cadre` échappe à `X-Frame-Options: DENY`
   (règle d'en-têtes de `next.config.ts` par expression négative) ; sa CSP pose
   `frame-ancestors 'self'` et les sites déclarés par la planner (https, cinq au plus), lus en base
   par le middleware. Le middleware passe donc à l'environnement **Node.js** (stable depuis
   Next.js 15.5) et importe le seul fichier `modules/events/contact-frame.ts` (une lecture), pas le
   service entier, pour rester léger. Un formulaire fermé ou inconnu : `frame-ancestors 'none'`.
   `'self'` sert à l'aperçu dans les réglages.
6. **Anti-spam local** (D4), sans service extérieur : piège à robots existant ; heure d'ouverture
   scellée par le chiffrement au niveau du champ du socle (AES-256-GCM, `DATA_ENCRYPTION_KEY`,
   rattachée au formulaire : ni falsifiable ni recopiable), refus sous trois secondes ; limitation
   de débit par adresse IP (empreinte) et par organisation ; plus de deux liens : demande mise de
   côté « à vérifier » (rien n'est créé avant son acceptation ; effacée à 30 jours sinon). Un envoi
   refusé reçoit la même réponse qu'un succès. Seuils en données (`contact-form.json`).
7. **À l'envoi** (D5) : contact retrouvé par son e-mail exact, jamais modifié (`resolveContact`
   du hub), sinon créé ; évènement Option à la première étape, avec la source choisie ou
   « Formulaire de contact » (ajoutée à la liste de l'organisation si besoin) ; message, période et
   tranche de budget dans `events.prospect_requests`, affichés tels quels ; événement
   `events.prospect.received` (v1, identifiants seulement) dans la même transaction.
   L'historique des statuts accepte un auteur vide pour ce prospect créé sans compte
   (`event_status_history.changed_by_user_id` devient facultatif).
8. **E-mails** (D6, D7) : aucun e-mail au prospect (pas de relais pour les robots) ; « Nouvelle
   demande de contact » à la titulaire, réglable, sans le message ni les coordonnées (nature
   `prospect_form_received`, contrainte `hub.email_templates_kind_check` élargie par la migration
   hub 0161, à part et annulable — exception écrite à DAT-09, accordée par Julien).
9. **Langue** : la page publique suit la langue du navigateur ; sans cookie (cadre dans un autre
   site), `i18n/request.ts` lit `Accept-Language`.

## Conséquences

- Migrations 0160 (`events`) et 0161 (`hub`), numérotées après celle du lot 50 (0159), chacune avec son annulation (refusée tant que des
  demandes, des passages d'étape, un historique sans auteur ou un modèle personnalisé existent).
  Compatibles avec la version précédente du code (ajout seul, contrainte relâchée).
- Registre RGPD : `events.prospect_requests` (message, période, tranche, champs en attente) ;
  `privacy/v1` du module events trouve, exporte et efface les demandes.
- Le middleware tourne en Node.js : une lecture en base pour la seule page encadrée.
- Hors périmètre : champs personnalisés, questionnaires, modèles de réponse, relances, doublons
  (lot 45) ; encadrement de la page de réservation du lot 46.
- À la fusion, la PR qui passe en second renumérote ses migrations et réunit les natures d'e-mails
  (lots 46 et 47).
