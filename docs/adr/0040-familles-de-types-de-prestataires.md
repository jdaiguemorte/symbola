# ADR 0040 — Familles de types de prestataires, propres à l'organisation ; fusion et suppression sans perte

- Statut : accepté ; les familles de départ sont précisées par [0045](0045-types-d-evenement-et-vocabulaire.md)
  (un seul catalogue pour tous les métiers)
- Date : 2026-11-08
- Précise : [0031](0031-prestataires-carnet-et-carte.md) (carnet de prestataires et carte)
- Stories : L16-PRE-14 et L16-PRE-15 (lot 16, spécification `docs/lots/lot-16-reprise-ux.md`,
  décisions C, D et F validées par Julien le 08/11/2026, avec sa réserve sur D)

## Contexte

Audit du 08/11/2026 (`docs/audits/2026-11-08-audit-complet.md`, U2). Un import ordinaire crée un
type par libellé du fichier : 45 pastilles pour 200 fiches dans le carnet de Julien. Rien ne
permettait de réparer : les réglages ne proposaient que « Supprimer », et supprimer un type
retirait en silence le type de ses fiches. Au-delà de dix couleurs, les points de la carte ne
se distinguaient plus.

## Décision

1. **Deux niveaux : familles et types.** Nouvelle table `vendors.vendor_families`
   (organisation, libellé, couleur, pictogramme, ordre), sous RLS ; `vendor_types.family_id`
   peut être nul : le type est alors « à classer ». Migration 0077, annulable.
2. **Les familles appartiennent à l'organisation** (réserve de Julien sur D) : elle les renomme,
   en crée, change leur ordre, leur couleur et leur pictogramme, et supprime une famille vide.
   Scinder « Beauté et tenues » revient à créer « Tenues » et à y déplacer des types.
3. **Données de départ par métier** (`packages/starter-templates`) :
   - `vendor-families.json` (wedding planner : 10 familles, 28 types) ;
   - `vendor-families.event-agency.json` (agence événementielle et « autre » : 9 familles,
     24 types, liste à corriger par Julien) ;
   - `vendor-types.json` : catalogue des types et de leurs champs ; la couleur passe du type à
     la famille ;
   - `vendor-type-synonyms.json` : un groupe de synonymes par type, aucun libellé dans deux
     groupes.
4. **Posées une seule fois, jamais rétablies d'office.** Le repère
   `vendor_settings.families_seeded_at` le garantit, avec un verrou transactionnel pour deux
   pages ouvertes en même temps.
   - Une organisation **nouvelle** reçoit familles et types à l'assistant de démarrage.
   - Une organisation **existante** reçoit les familles de son métier à la première visite du
     carnet ou de ses réglages : chaque type est rangé par ses synonymes, le reste « à
     classer », et aucune fiche ne change de type.
   - « Ajouter les types de départ » est une demande explicite : elle repose les familles
     manquantes et les types, même après coup.
5. **Carnet.**
   - Pastilles par famille non vide, avec leur nombre de fiches ; les types de la famille
     choisie s'affichent en second rang.
   - « À classer » réunit les types sans famille et les fiches sans type, avec un bandeau.
   - Les nombres viennent d'un comptage par la base (`countVendorsByType`), et non plus de la
     liste limitée à 200 fiches.
   - Sur la carte, la couleur et le pictogramme (jeu d'icônes du budget) sont ceux de la
     famille, avec une légende (critère 1.4.1).
6. **Fusion** (`mergeVendorTypes`).
   - Les fiches passent au type gardé. Un champ propre au type fusionné le suit ; un champ de
     même libellé reprend les valeurs sans écraser celles déjà saisies.
   - Le type fusionné disparaît.
   - L'opération est journalisée par l'événement interne `vendors.vendor_type.merged` (v1,
     outbox, ADR 0014).
   - Un import qui avait créé le type fusionné reste annulable : le type d'une fiche importée,
     disparu depuis, ne compte pas comme une modification à la main.
7. **Suppression d'un type qui a des fiches** : le service la refuse (`VendorTypeInUseError`)
   sans destination explicite, un autre type ou « aucun type ». Les valeurs des champs propres
   au type supprimé partent avec eux ; pour les garder, il faut fusionner.
8. **Réglages en tableaux alignés.** Deux tableaux (familles, types), le détail dans le panneau
   latéral du lot 13 : renommer, famille, champs, fusion en deux temps (choix, puis
   confirmation chiffrée), suppression avec destination. L'ordre des familles change par des
   boutons « monter » et « descendre », utilisables au clavier, plutôt que par
   glisser-déposer.

## Conséquences

- Le contrat `VendorsServiceContract` gagne ses fonctions de familles, de fusion et de
  comptage. `removeVendorType` prend une option `moveVendorsTo` ; sans elle, il échoue si le
  type a encore des fiches. Ce changement de comportement est voulu par la spécification.
- Jusqu'à IMP-12, un type créé par un import part « à classer » ; IMP-12 le rangera par famille
  dès l'étape « Types » de l'import.
- `domain_events` n'est pas sous RLS (SOC-06). La charge utile de la fusion ne contient que des
  identifiants.
- Retour arrière : annuler 0077 (runbook de restauration § 4 bis) retire les familles ; chaque
  fiche garde son type.
