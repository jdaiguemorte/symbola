# ADR 0082 — Module Invités : RSVP par lien sans session, régimes avec accord et chiffrés, purge automatique

- Statut : accepté (spécification du lot 49 validée par Julien le 18/11/2026, décisions D1 à D13
  dans leur option a)
- Date : 2026-11-18
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) et [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md)
  (un module, un schéma), [0053](0053-acces-des-tiers-par-lien-personnel.md) (liens personnels),
  [0056](0056-purge-rgpd-automatique-avec-preavis.md) (purge automatique avec préavis),
  [0072](0072-emails-a-l-image-de-l-organisation.md) et [0076](0076-file-des-taches-et-adaptateur-e-mail.md)
  (e-mails, file sans doublon), [0078](0078-socle-des-modules-rendez-vous-et-invites.md) (module
  fermé par défaut, chiffrement au niveau du champ, jeton commun).
- Exigences : INV-01 à INV-04, INV-07, RGP-06 à RGP-08, RGP-18, EVT-04 (premier pas) ;
  `docs/lots/lot-49-invites-rsvp.md`. Réponses 2 à 5 de la DPO (Q35) ; points ouverts DPO-1 à
  DPO-6 (Q38, fiche de la DPO, question 14).

## Contexte

Les couples tiennent leur liste dans un tableur et recopient les réponses ; les régimes et
allergies (article 9) circulent par e-mail jusqu'au traiteur. Le lot 49 crée le module Invités :
la liste, la réponse, l'accord et la purge sont la même donnée vue à quatre moments, et RGP-06 à
RGP-08 doivent tenir dès l'activation du module.

## Décision

1. **Un module, un schéma** (D1) : `modules/guests`, schéma `guests`, clé `guests`, fermé par
   défaut (ADR 0078). Les invités ne sont pas des contacts du hub (CRM-03) : ils appartiennent à
   l'évènement, désigné sans clé étrangère entre schémas. Les **temps forts** (D2) vivent dans le
   module events (`events.key_moments`, suppression logique) ; le module Invités les lit par
   `guestEventContexts` du service events.
2. **Activation** (partie G) : avant toute saisie, la titulaire confirme avoir complété l'analyse
   d'impact « socle » (date et auteur gardés, ligne au journal). L'adresse de cette analyse est une
   donnée de départ (`guest-rules.json`), vide tant que Julien ne l'a pas publiée.
3. **Liens** (D3, D13) : un lien par adulte qui a un moyen de contact, jamais pour un enfant — la
   base le refuse aussi (référence composée `(guest_id, guest_kind)` vers `guests(id, kind)`, avec
   `guest_kind = 'adult'`). Chaque remise (e-mail, copie, QR code) crée un **jeton neuf** ; les
   précédents restent valables (un faire-part imprimé ne casse pas) jusqu'à la fin du jour de
   clôture, relue à chaque usage ; la planner retire tous les liens d'une personne d'un geste.
4. **Page de réponse sans session** : `/rsvp#<jeton>` lit le jeton dans le navigateur, le retire de
   l'adresse et le **garde en mémoire de la page** ; il part en POST à chaque action, jamais dans
   un cookie ni un journal. À la différence des liens du portail (ADR 0053, session de 30 jours),
   aucun appareil ne garde d'accès aux régimes d'un invité : rouvrir la page, c'est rouvrir le lien
   reçu. Débit limité par adresse IP et **par lien** (empreinte du jeton), pas par organisation.
5. **Régimes** (D6 à D8) : liste fermée par organisation, copiée des données de départ (régimes
   courants, quatorze allergènes INCO, **aucun régime religieux**, DPO-1) ; aucun champ libre.
   L'accord vient de l'invité lui-même (ou du représentant légal déclaré, pour un enfant) : sans
   lui, le serveur n'enregistre rien. Preuve : horodatage, version du texte, canal, personne,
   déclaration ; le retrait efface les régimes et garde l'horodatage. La liste cochée est chiffrée
   (`f1:`, place `guests.diets.options_sealed` de la personne). Nominatif pour la titulaire seule ;
   ailleurs des nombres par temps fort, « moins de 3 » sous le seuil (données de départ, DPO-5).
6. **Invitations et relances** (D4, D10) : deux natures d'e-mails réécrivables (`guest_invitation`,
   `guest_reminder`), bouton « Répondre » ; l'envoi groupé passe l'écran de contrôle (MSG-02), qui
   annonce le calendrier des relances. Relances par la file `hub.jobs` (clé par foyer et par
   relance), seule la plus récente échue part, revérifiée juste avant l'envoi, jamais après la
   clôture, dans les heures d'envoi (Paris).
7. **Purge** (D9, ADR 0056) : tâche horaire ; régimes à J+7, le reste à J+30 du dernier jour
   (ou de l'annulation), durées dans `hub.privacy_settings` bornées par la DPO ; préavis 7 jours
   avant chaque purge (« Aujourd'hui » et e-mail à la titulaire) ; un seul report, motivé, de 90 jours
   au plus, dont le journal ne garde que la date. La purge du reste supprime aussi les **exports
   stockés** qui peuvent contenir les invités (archives de l'export complet qui comptent des foyers,
   exports RGPD préparés depuis le premier foyer ; DPO-6) et prévient la titulaire. Les preuves
   d'accord perdent la personne (horodatage anonymisé). Opposition : coordonnées et régimes effacés
   aussitôt, liens retirés, présence gardée sous le seul nom (DPO-3).
8. **Import** (D12) : le fichier est contrôlé (taille, antivirus), lu en mémoire par le moteur
   d'import et **jamais gardé** ; l'aperçu se recalcule du même fichier au moment du choix (rien
   n'est écrit avant). Une trace sans donnée personnelle (`guests.guest_imports`) sert à annuler.

## Écarts assumés avec la spécification

- **Temps forts restreints par foyer**, pas par personne : `households.key_moment_ids` (null =
  tous) au lieu d'une table `guest_invitations`. Le cas courant (« le brunch pour la famille
  proche ») est un choix de foyer ; une restriction par personne pourra s'ajouter au lot 50.
- **Contrainte des natures d'e-mails** : la migration hub (0151) réécrit aussi
  `hub.email_templates_kind_check` pour les deux nouvelles natures, sans quoi un modèle réécrit
  par la planner serait refusé. C'est une modification du schéma `hub` au-delà des colonnes de
  conservation : signalée dans la PR. Le lot 46 qui ajoute ses natures réécrira la contrainte avec
  l'union des deux listes.
- **Intitulés des colonnes d'import** dans `guest-import-columns.json`, à part de
  `import-synonyms.json`, dont les intitulés courts (« prénom », « nom ») désignent les clients
  d'un évènement dans l'assistant d'import.
- **Import par action serveur** (limite de 1 Mo, `next.config.ts`) plutôt que par une route de
  dépôt : une liste d'invités en fait quelques dizaines de kilo-octets ; l'écran le dit.
- **Jeton de style `reading`** (18 px) ajouté à `DESIGN.md` : la page de réponse demande un corps de
  18 px au moins, qu'aucun jeton ne donnait.
- **Catégorie `sensible`** ajoutée au registre RGPD pour les régimes (article 9).

## Conséquences

- Avant d'ouvrir le module à la pilote : DPO-1 et DPO-4 tranchés, analyse d'impact remise, puis
  l'Exploitation ouvre le module et la titulaire confirme l'analyse. Rien d'autre à configurer :
  `DATA_ENCRYPTION_KEY` est déjà exigée par le socle (ADR 0078).
- Migrations 0150 à 0152 : ajouts seuls, compatibles avec la version précédente du code (pas
  d'arrêt de l'app) ; leurs annulations refusent tant que des invités ou des temps forts existent.
- La synthèse pour le traiteur et son export (lot 50) suivront la règle de l'accès : nominatif
  pour la titulaire seule, agrégé ailleurs. Les copies hors ligne du jour J n'emportent aucune
  donnée d'invité ; le lot 50 qui les y mettrait devra les purger.
