# ADR 0108 — Écran « Apps » et demandes d'activation pendant le pilote

- Statut : accepté (lot 63g ; spécification `docs/lots/lot-63-retours-recette-planner.md` validée par
  Julien le 21/11/2026, maquette M13 ; accord du 21/11 pour la migration 0200, schéma `hub` seulement)
- Date : 2026-11-21
- Complète : [0101](0101-abonnement-forfaits-interrupteurs-et-quota.md) (abonnement, interrupteur
  `subscription_self_service`), [0079](0079-socle-des-modules-rendez-vous-et-invites.md) (modules
  ouverts par l'Exploitation), [0095](0095-notifications-automatismes-radar-et-vocabulaire.md)
  (notifications), [0029](0029-assistance-admin-et-statistiques-d-usage.md) (l'Exploitation sans
  donnée métier).
- Exigences : HUB-06, HUB-15, HUB-27, ARC-06, ARC-07, SEC-09, SEC-10.

## Contexte

À la recette du 21/11, la wedding planner pilote ne trouvait ni le plan de table (module Invités) ni
les plans des lieux (module Plans de salle). Les deux modules sont fermés par défaut (ADR 0079,
ADR 0099) ; le libre-service d'abonnement est fermé par son interrupteur (ADR 0101), et « Mon
abonnement » le dit sans proposer d'app ; un module non activé ne laisse aucune trace ailleurs
(ARC-07). La planner ne pouvait donc pas savoir que ces apps existent, ni les demander. Le catalogue
décrivait en outre « Plans de salle » comme « plans des lieux et des tables », alors que le plan de
table est dans « Invités ».

## Décision

1. **Un écran « Apps »** (`/apps`), en bas du menu, pour la Propriétaire. Chaque module du registre y
   figure : son état en mots (« Activée », « Non activée », « Demandée le … »), ce qu'il apporte et où
   le trouver une fois activé. Ces textes sont des données traduisibles de `plans.json` (section
   `apps`, schéma `appCatalogSchema`), hors du catalogue des offres que l'Exploitation modifie
   (`hub.plans`) : ce sont des textes de l'app, pas une offre. C'est le **seul** écran qui nomme une app
   non activée ; ailleurs rien ne change (ARC-07). Une Planner n'a pas l'entrée ; l'adresse lui dit que
   l'écran est réservé.
2. **Pendant le pilote** (interrupteur fermé, ou forfait Pilote) : « Demander l'activation » ouvre une
   fenêtre **sans champ libre** (SEC-09) qui dit ce que l'équipe voit, puis enregistre une demande
   (`hub.module_requests`). La demande s'annule tant qu'elle attend ; une seule demande en attente par
   app et par organisation (index unique partiel). L'Exploitation la voit en tête de
   `/exploitation/organisations` et l'**active** (le réglage existant du module) ou la **classe sans
   activer** (la planner peut redemander ; ajout à la spécification, pour qu'une demande ne reste pas
   ouverte sans fin, par exemple pour les Invités tant que l'analyse d'impact n'est pas faite).
3. **Activation et notification** (HUB-15, ARC-06). Dès qu'un module s'ouvre — réglage de
   l'Exploitation (`setModuleEnabled`) ou droits d'un abonnement (`applyEntitlements` : forfait
   Pilote, essai, option ajoutée) — ses demandes en attente passent à « activée » et la Propriétaire
   reçoit une notification de la sorte nouvelle `module_activated` (une par demande, l'objet étant la
   demande), qui mène à l'écran de l'app. Le module apparaît à la requête suivante, comme avant
   (`isModuleEnabled` relu à chaque requête).
4. **Libre-service ouvert** : le même écran propose « Ajouter à mon abonnement » quand l'offre en
   cours admet des options et que le module se vend en option en libre-service. La fenêtre affiche le
   prix sur la période, l'écart au prorata jusqu'à la fin de la période (règle `prorataCents` du
   lot 54) et le nouveau total (`appOffer`, règle pure), puis appelle `changeSubscription` et revient
   sur « Mon abonnement » avec son message habituel. Sinon (App seule, essai, lecture seule,
   résiliation), le lien « Choisir une offre » mène à « Mon abonnement ». Aucune demande n'est
   acceptée dans ce mode (refus `self_service`), sauf sous le forfait Pilote, que la planner ne change
   pas elle-même.
5. **Ce que voit l'Exploitation** (SEC-09). La liste des demandes en attente ne porte que
   l'organisation, la clé du module et la date de la demande, lue organisation par organisation sous la
   RLS (comme les abonnements et les compteurs d'évènements) ; jamais la personne qui a demandé, ni
   l'identifiant de la demande. La date sert à traiter les demandes dans l'ordre ; c'est le seul ajout
   à « l'organisation et la clé du module » de la spécification. Le test le vérifie sur les clés de
   l'objet renvoyé.

## Données

- Migration `0200_lot63g_hub_module_requests` (schéma `hub` seulement) : table `hub.module_requests`
  (organisation, clé du module, auteur, date, état `pending` / `cancelled` / `activated` /
  `declined`, date de traitement ; contrôles : clé de module, état, date de traitement présente si et
  seulement si la demande est close), RLS forcée, droits `SELECT, INSERT, UPDATE` (aucune suppression
  par l'app), horodatage et journal des suppressions ; sorte `module_activated` ajoutée aux contrôles
  de `hub.notifications` et `hub.notification_preferences`. Compatible avec l'image précédente.
- Annulation : refusée tant qu'une demande attend ; sinon la table, les notifications et réglages de
  la sorte nouvelle disparaissent ; les modules déjà ouverts restent ouverts.
- Effacement d'un espace fermé (lot 35c) : la table a `organization_id`, elle est effacée avec le
  schéma `hub` (`core.erase_organization_schema`). Export complet : exclue (une démarche auprès de
  Symbola, pas une donnée de l'organisation), comme l'abonnement.
- Registre RGPD : `requested_by_user_id` est un identifiant de compte (pseudonyme), déclaré.

## Conséquences

- Les numéros 0196 à 0199 sont réservés aux paquets 63c, 63d et 63e, menés en parallèle. Drizzle
  n'applique une migration que si son horodatage (`when` du journal) suit celui de la dernière
  appliquée : à la fusion, 0200 doit garder l'horodatage le plus récent des migrations du lot 63
  (le régénérer s'il le faut) et passer en dernier.
- La liste des demandes de l'Exploitation ouvre une transaction par organisation : suffisant pour le
  pilote ; à revoir (fonction de lecture dédiée sur le rôle de l'Exploitation) au-delà de quelques
  dizaines d'organisations.
- Descriptions du catalogue corrigées : le plan de table dans « Invités », les plans des lieux dans
  « Plans de salle » (un catalogue déjà copié dans `hub.plans` par l'Exploitation garde ses textes :
  à reprendre dans `/exploitation/offres`).
