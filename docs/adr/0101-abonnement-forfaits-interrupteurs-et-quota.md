# ADR 0101 — Abonnement en libre-service, forfaits par module, interrupteurs par fonction et quota de stockage

- Statut : accepté (lot 54 ; décisions D1 à D3 de Julien du 19/11/2026, toutes en (a) ; montants de
  départ validés comme hypothèses de travail, « ça reste paramétrable plus tard »)
- Date : 2026-11-19
- Complète : [0079](0079-socle-des-modules-rendez-vous-et-invites.md) (interrupteurs de modules),
  [0087](0087-reglement-par-virement-au-rib.md) (virement au RIB),
  [0071](0071-programme-diffuse-et-releve-de-stockage.md) (relevé du stockage),
  [0100](0100-fermeture-d-un-espace-et-effacement-au-30e-jour.md) (fermeture d'un espace).
- Exigences : HUB-27, ARC-06, NFR-26, DOC-06 ; spécification `docs/lots/lot-54-abonnement-et-forfaits.md`.

## Contexte

Les modules s'ouvraient à la main, par l'Exploitation (`hub.organization_modules`, ADR 0079). Le
cahier des charges demande des droits d'usage pilotés par l'abonnement (ARC-06), un libre-service
(essai, choix des apps, résiliation en moins de trois clics, HUB-27), des fonctions nouvelles
derrière un interrupteur (NFR-26) et un quota de stockage qui prévient avant de bloquer (DOC-06). La
société de Julien n'est pas encore créée : Symbola ne peut pas facturer ses abonnements.

## Décision

1. **Catalogue en données.** `packages/starter-templates/src/plans.json` porte les offres (essai,
   App seule, Suite Solo, Suite Agence, forfait Pilote), les options (Espaces couples, Rendez-vous,
   Plans de salle, stockage supplémentaire par tranche) et les règles (30 jours d'essai, rappels à
   J-7 et J-1, alertes à 80 et 95 %, préavis de 7 jours). Aucun prix, quota ni libellé d'offre dans
   le code (HUB-20 : contrôle des libellés étendu à `plans.json`, contrôle des montants dans
   `plan-catalog.test.ts`). L'Exploitation modifie le catalogue dans `/exploitation/offres` ; à sa
   première modification, il est copié dans `hub.plans` et `hub.plan_modules`, puis lu de là. Le
   catalogue est validé en entier avant d'être écrit : une seule offre d'essai, un seul forfait
   Pilote, jamais en libre-service (contrainte en base aussi), rien ne se supprime (une offre sort du
   libre-service). Le préavis ne descend pas sous sept jours (schéma, et contrainte de
   `hub.storage_quota_states` : six jours au moins entre le début du plein et le refus, minuit de
   Paris compris).
2. **Droits d'usage** (ARC-06). L'abonnement d'une organisation (`hub.organization_subscriptions`,
   RLS) = offre + app choisie (App seule) + options + tranches de stockage + période. Chaque
   changement réécrit `hub.organization_modules` pour tous les modules du registre ;
   `isModuleEnabled` relit la base à chaque requête : l'effet a lieu à la requête suivante, sans
   redéploiement. Une clé de module inconnue du registre (les Plans de salle avant le lot 60) est
   ignorée : refus par défaut. Un module fermé est masqué ou « indisponible » (ARC-07, inchangé).
   **Sans abonnement**, une organisation reste réglée par l'Exploitation comme avant le lot (aucune
   migration de données, aucun quota) : la pilote reçoit le forfait Pilote quand l'Exploitation le
   pose (`/exploitation/organisations`).
3. **Interrupteurs par fonction** (NFR-26). Une fonction déclare sa clé (`FEATURE_FLAG_KEYS`) ; elle
   est fermée pour tous ; l'Exploitation l'ouvre à une organisation (la pilote d'abord), puis à toutes
   (`/exploitation/interrupteurs`, `hub.feature_flags`, `hub.feature_flag_organizations`). Première
   fonction derrière un interrupteur : **l'abonnement en libre-service lui-même**
   (`subscription_self_service`), requis seulement à l'ouverture commerciale. Fermé : l'inscription
   ne démarre pas d'essai et « Mon abonnement » dit que l'abonnement est réglé par l'équipe Symbola.
4. **Essai** (HUB-27, D2 a). À l'inscription, si la fonction est ouverte : 30 jours de suite complète,
   sans carte, avec les données de démonstration existantes. Fin à minuit (Paris) du 30e jour.
   Rappels par e-mail à J-7 et à J-1 (le plus proche de la fin seulement : jamais J-7 après J-1). À
   la fin, **lecture seule** : rien n'est effacé, tout se lit et s'exporte. Une écriture (toute
   requête autre que GET ou HEAD, méthode posée par le middleware dans `x-symbola-method`) est
   refusée par `getPlannerAuthContext` (et donc par les gardes) ; seules l'abonnement, l'export et la
   fermeture l'acceptent (`allowReadOnly`). Choisir une offre lève la lecture seule.
5. **« Mon abonnement »** (`/parametres/abonnement`, Propriétaire). L'offre, les apps, les options, le
   total, le stockage (jauge, détail par module). « Changer » : effet immédiat ; une période en cours
   continue et l'écart au prorata est calculé pour la facture suivante. Une offre qui admet moins
   d'utilisateurs que l'équipe n'en compte est refusée. **Résilier** : « Mon abonnement » →
   « Résilier » → « Confirmer la résiliation » (trois clics depuis les Paramètres, comptés par le
   parcours Playwright ; deux depuis l'écran). L'accès reste jusqu'à la fin de la période payée (de
   l'essai, s'il court ; tout de suite en lecture seule) ; on peut revenir dessus jusque-là. À
   l'échéance, le passage horaire lance la **fermeture du lot 35c** (export pendant 30 jours, puis
   effacement), sans demander le nom de l'espace : la résiliation a déjà été confirmée. Un espace
   rouvert après cette fermeture revient en lecture seule.
6. **Paiement** (D1 a, ADR 0087). Facture de l'éditeur réglée par virement, plus tard. **La
   facturation réelle reste éteinte** : `hub.platform_settings.subscription_billing_enabled` vaut
   faux, sans écran pour l'allumer ; aucune facture n'est émise ni envoyée ; « Mon abonnement » le
   dit. Le prorata est calculé et tracé au journal (`hub.subscription.changed`), pour la facturation
   à venir.
7. **Quota de stockage** (DOC-06). Le passage horaire mesure le stockage des organisations abonnées,
   par module, évènements d'essai exclus (`measureOrganizationStorageByModule`), et le compare au
   quota de l'offre plus les tranches. À 80 % puis à 95 %, un bandeau et un e-mail préviennent la
   Propriétaire (une fois par palier, réarmé en redescendant) ; à 100 %, le préavis commence : les
   **nouveaux dépôts** ne sont refusés qu'à minuit (Paris) au bout de sept jours. La garde est dans
   `@symbola/files` (`uploadFile` : raison `storage_full`, garde enregistrée par le hub) ; les
   lectures et l'export n'y passent jamais. Exemptés : les copies signées reçues du fournisseur de
   signature (pièces légales) et la reprise d'un export ; les photos du jour J (hors ligne, prises sur
   place) n'utilisent pas `uploadFile`. Un tiers qui dépose par son lien lit seulement que le dépôt
   n'est pas possible pour le moment.

## Écarts assumés

- **Natures d'e-mails** : la spécification prévoyait des natures d'e-mails (fin d'essai, quota) en
  migration. Ces e-mails sont des e-mails de Symbola à la Propriétaire, au texte fixe des fichiers de
  traduction (`Emails.fixed`), comme ceux de la fermeture (lot 35c) : aucune nature modifiable par la
  planner, donc aucune migration de `email_templates`.
- **Hypothèses non chiffrées par la spécification** : l'App seule a un utilisateur et 5 Go, l'essai
  10 Go. Valeurs de départ, en données, à valider par Julien (`docs/QUESTIONS.md`, Q41).
- **Comptage des trois clics** : depuis les Paramètres, où « Mon abonnement » est listé. La lecture
  juridique de « trois clics » (fonctionnalité de résiliation des contrats conclus par voie
  électronique) est une question pour l'avocat (fiche, AV-12), à la création de la société.

## Conséquences

- Migration `0191_lot54_hub_subscriptions` (schéma `hub` seulement, ajouts) ; annulation refusée
  tant qu'une organisation a un abonnement.
- Au déploiement, rien ne change pour la pilote tant que l'Exploitation n'ouvre pas la fonction et ne
  pose pas d'offre (runbook de déploiement).
- Les tables nouvelles sont exclues de l'export complet (le contrat avec Symbola n'est pas une
  donnée de l'organisation ; un espace repris a son propre abonnement).
- Hors périmètre : prestataire de paiement (D1 b), factures réelles de l'éditeur, forfaits à l'usage.
