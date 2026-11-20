# Lot 54 — Abonnement en libre-service, forfaits par module, quotas, interrupteurs par fonction

**Statut** : spécification proposée le 19/11/2026, **validée par Julien le 19/11/2026** : toutes les décisions retenues dans leur option recommandée (a), changements de schéma compris (accord donné). Les **montants**
proposés sont des valeurs de départ en données, modifiables sans code (Julien, 19/11 : « ça reste
paramétrable plus tard »). Le lot change le schéma `hub` : validation explicite requise.

Branche `lot-54-abonnement`, partie de `main`.

## Décision de Julien (19/11/2026)

> « Propose des forfaits cohérents par module. Ça reste paramétrable plus tard. »

## Exigences

- **HUB-27** (P1) — Abonnement en libre-service : essai, choix des apps, moyen de paiement, factures,
  résiliation. *Critère* : résilier prend moins de trois clics. Il n'est requis qu'à l'ouverture
  commerciale.
- **ARC-06** (P0, Partiel) — Droits d'usage pilotés par l'abonnement : chaque app et chaque fonction
  s'active par organisation, sans redéploiement. *Critère* : l'activation prend effet à la connexion
  suivante.
- **NFR-26** (P1) — Fonctions nouvelles derrière un interrupteur, par organisation. *Critère* : la
  pilote teste avant tous les autres.
- **DOC-06** (P1) — Quota de stockage par offre, visible. *Critère* : l'approche du quota prévient,
  elle ne bloque pas sans préavis.

Règles du cahier des charges (§ 3) que le produit doit rendre possibles :

- clients, prestataires et invités toujours gratuits et illimités ;
- essai gratuit sans carte, avec des données de démonstration ;
- aucune commission sur les paiements ;
- export complet gratuit à tout moment ;
- pas de prix par utilisateur pour les agences ;
- espace couple vendu au planner au mois, sans compter les évènements.

## Proposition de forfaits (valeurs de départ, toutes en données)

Les modules de Symbola aujourd'hui : **Évènements** (rétroplanning, programme, jour J, portail
client), **Budget**, **Devis et factures**, **Prestataires**, **Rendez-vous**, **Invités**, **Plans
de salle**.

| Offre | Pour qui | Contenu | Prix de départ HT |
| --- | --- | --- | --- |
| **Essai** | Tout le monde | La suite complète, 30 jours, avec des données de démonstration, sans carte | 0 € |
| **App seule** | Métiers voisins (S3), découverte | Le hub et **une** app parmi Devis et factures, Rendez-vous, Prestataires | 12 € par mois |
| **Suite Solo** | Planner indépendante (S1) | Évènements, Budget, Devis et factures, Prestataires, portails illimités, 1 utilisateur et 1 assistant, 10 Go | 49 € par mois, ou 490 € par an (deux mois offerts, proche du repère de 560 € par an du § 3) |
| **Suite Agence** | Petite agence (S2) | La suite Solo, utilisateurs illimités, rôles, équipes par évènement, pilotage d'agence (lot 56), 50 Go | 99 € par mois. Paliers plus hauts selon le stockage et les envois, jamais selon le nombre d'utilisateurs |

**Modules en option**, à ajouter à une suite :

| Module | Prix de départ HT | Pourquoi en option |
| --- | --- | --- |
| **Espaces couples (Invités et RSVP)** | 15 € par mois (fourchette du § 3 : 9 à 25 €) | Le module du § 3 : le planner le paie, le couple ne paie rien |
| **Rendez-vous** | 9 € par mois | Utile à toutes, mais pas indispensable au cœur de la suite |
| **Plans de salle** | 9 € par mois | Fonction « en plus » (lot 60) |
| **Stockage supplémentaire** | 5 € par mois par tranche de 50 Go | Au-delà du quota de l'offre |

La pilote (ta compagne) a **tout ouvert sans payer** par un forfait « Pilote » réservé à
l'Exploitation, qui n'apparaît pas dans le libre-service.

**À valider par toi** : ces montants. Le cahier des charges demande de fixer les prix par mesure
(coût par planner pendant le pilote, puis questions de prix aux dix premières planners). Ce sont
des hypothèses de travail, modifiables dans l'écran d'administration sans code.

## Ce qui existe aujourd'hui

- `hub.organization_modules` : un interrupteur par module et par organisation, réglé par
  l'Exploitation (ARC-07) ; certains modules sont fermés par défaut (ADR 0079).
- Stockage mesuré par organisation (lot 37b).
- Essai guidé avec des données `is_demo` (lots 12 et 24).
- Règlement par virement au RIB, sans prestataire de paiement (ADR 0087).
- La société de Julien n'est pas encore créée (lot 42 mis de côté) : Symbola ne peut pas encore
  facturer ses abonnements.

## Partie A — Offres, modules et interrupteurs par fonction (ARC-06, NFR-26)

- **Catalogue des offres en données** (`plans.json`, puis administré par l'Exploitation) : pour
  chaque offre, les modules inclus, le nombre d'utilisateurs, le quota de stockage et le prix. Les
  modules en option ont aussi leur prix.
- **Droits d'une organisation** = offre + options + forfait Pilote éventuel. Ils pilotent
  `organization_modules`, qui existe déjà. **Effet à la connexion suivante** (critère), sans
  redéploiement.
- **Interrupteurs par fonction** (NFR-26) : une fonction nouvelle déclare son interrupteur. Elle
  est fermée pour tous et ouverte d'abord à la pilote, par l'Exploitation.

## Partie B — Le libre-service (HUB-27 ; D1, D2)

- **Essai** : à l'inscription (lot 33), 30 jours de suite complète avec les données de
  démonstration, sans carte. Un rappel part à J-7 et à J-1 ; à la fin, l'organisation passe en
  **lecture seule**, sans rien effacer, avec l'export toujours possible (§ 3).
- **Choisir son offre** : un écran « Mon abonnement » avec l'offre, les options et le total, puis
  « Changer ». Le changement prend effet tout de suite, au prorata sur la facture suivante.
- **Paiement** (D1) : pour l'instant, **facture mensuelle ou annuelle de l'éditeur, réglée par
  virement**, comme l'ADR 0087 ; aucune carte. Les factures de Symbola se téléchargent dans « Mon
  abonnement ».
- **Résilier en moins de trois clics** (critère) : « Mon abonnement » → « Résilier » → confirmer.
  L'organisation garde son accès jusqu'à la fin de la période payée, puis la fermeture du lot 35c
  s'applique (export pendant 30 jours, puis effacement).

## Partie C — Quota de stockage (DOC-06)

- Le quota de l'offre est visible dans « Mon abonnement » : jauge, détail par module.
- **À 80 % et 95 %**, un bandeau et un e-mail préviennent la Propriétaire. **À 100 %**, les nouveaux
  dépôts sont refusés **après un préavis de 7 jours**, jamais sans préavis (critère). La lecture et
  l'export restent toujours possibles.

## Décisions à prendre

- **D1 — Encaisser les abonnements.**
  - (a) Factures de l'éditeur réglées par virement, comme l'ADR 0087 ; le prélèvement ou la carte
    viendront avec un prestataire, plus tard.
  - (b) Un prestataire de paiement dès ce lot (prélèvement SEPA récurrent).

  **Recommandation : (a)**, cohérente avec ta décision du virement et avec la société pas encore
  créée. **Les factures de l'éditeur ne partiront qu'une fois la société créée** : d'ici là, le lot
  livre l'écran, les droits et les quotas, et la facturation reste éteinte.
- **D2 — La fin de l'essai.**
  - (a) Lecture seule, sans rien effacer, export possible.
  - (b) Fermeture de l'espace.

  **Recommandation : (a).** C'est la plus rassurante pour une planner qui a déjà saisi ses
  évènements.
- **D3 — Les montants.** Valeurs de départ ci-dessus, en données. **À toi de valider ou de
  corriger** : c'est un choix commercial, que je ne tranche pas.

## Points pour les conseils

- **Avocat** : conditions générales d'abonnement de l'éditeur (essai, reconduction, résiliation,
  réversibilité, à écrire à la création de la société), et loi sur la résiliation en trois clics
  (contrats conclus par voie électronique). À voir avec lui à la création de la société.
- **Expert-comptable** : la facturation de l'éditeur (TVA, Factur-X) viendra avec la société.

## Migrations (prévision)

- **`hub`** :
  - `plans` et `plan_modules` (catalogue, prix, quotas) ;
  - `organization_subscriptions` (offre, options, début, fin, période, état : essai, actif, résilié,
    lecture seule) ;
  - `feature_flags` (fonction, organisations ouvertes) ;
  - alertes de quota ;
  - natures d'e-mails (fin d'essai, quota).
- Données de départ : `plans.json`, avec les montants ci-dessus.

## Tests (prévision)

- **ARC-06** : changer d'offre ou d'option ouvre ou ferme les modules à la connexion suivante ; un
  module fermé est masqué ou « indisponible », jamais en erreur (ARC-07).
- **NFR-26** : une fonction derrière un interrupteur n'est visible que de la pilote.
- **HUB-27** : résiliation en trois clics au plus (Playwright, compte des clics), accès jusqu'à la
  fin de la période, puis fermeture du 35c ; fin d'essai en lecture seule, export possible.
- **DOC-06** (horloge simulée) : alertes à 80 % et 95 %, blocage des dépôts seulement après 7 jours
  de préavis, lecture et export toujours possibles.
- **Isolation et abus** : une organisation ne change pas l'offre d'une autre ; seule la Propriétaire
  change l'abonnement ; l'Exploitation gère le catalogue sans voir les données métier.

## Hors périmètre

- Prestataire de paiement pour les abonnements (D1 b).
- Factures réelles de l'éditeur avant la création de la société.
- Forfaits d'agence à l'usage de l'IA (pas d'IA dans Symbola aujourd'hui).
