# ADR 0049 — Étiquettes par groupe et par famille ; un seul accès aux réglages ; vocabulaire des écrans mixtes

- Statut : accepté
- Date : 2026-11-10
- Précise : le lot 11 (PRE-01 à PRE-05, étiquettes libres), [0040](0040-familles-de-types-de-prestataires.md)
  (familles de types), [0045](0045-types-d-evenement-et-vocabulaire.md) (vocabulaire selon le
  type d'événement) et [0039](0039-aide-un-seul-bouton-et-tiroir.md) (tiroir d'aide)
- Décisions de Julien du 10/11/2026 : maquette du lot 20, décisions 1 à 6 validées (« les
  propositions me conviennent »), `docs/lots/lot-20-retours-recette.md`.

## Contexte

En recette des lots 18 et 19, Julien a relevé :

- **Étiquettes** : elles « doivent correspondre à une typologie de prestataire pour éviter
  d'avoir couchage affiché pour une fleuriste », la liste est « à rallonge », et certaines
  « sont clairement des paliers » : « 150 à 200 couchages » et « Moins de 150 couchages ne
  peuvent pas être cochés tous les 2 sur le même lieu ». Les étiquettes étaient une liste plate
  par organisation, en cases à cocher, souvent reprises de l'import (lot 14).
- **Réglages** : une roue crantée seule sur trois écrans, trois boutons et un « Plus
  d'options » sur Événements.
- **Vocabulaire** : « dans mes tâches, le vocabulaire mariage est-il figé ? ». Il suit le métier
  et le type de chaque événement (ADR 0045), mais les écrans qui mêlent tous les événements
  prenaient celui du métier.

## Décision

### Étiquettes en groupes, par famille, avec des paliers (décision 5)

- **Données** (migration 0084, annulable) :
  - nouvelle table `vendors.vendor_tag_groups` (`label`, `exclusive`, `position`), sous RLS
    comme les autres tables du module ;
  - `vendors.vendor_tags` reçoit `group_id` (nul = « Autres » ; la suppression d'un groupe
    rend ses étiquettes à « Autres »), `family_ids` (vide = toutes les familles) et `position`
    (ordre des paliers).
  - Les fiches gardent `tag_ids` : aucune reprise de données.
- **Palier** : un groupe `exclusive` n'accepte qu'une étiquette par fiche. Le formulaire le
  présente en segments à choix unique (avec « Non précisé »). Le service refuse aussi deux
  paliers du même groupe (`VendorTagTierConflictError`), quelle que soit l'origine de la
  demande.
- **Par famille** : la fiche n'affiche que les étiquettes valables pour toutes les familles ou
  pour celle du type choisi. Une étiquette masquée n'est plus envoyée, donc elle est retirée
  de la fiche à l'enregistrement : changer un lieu en fleuriste retire ses étiquettes de lieu.
- **Pastilles** : grises et lisibles, sauges une fois choisies. La case reste le vrai contrôle
  (clavier, lecteur d'écran) ; elle est seulement masquée à l'œil.
- **Reprise des étiquettes importées** : une fonction pure (`modules/vendors/tag-tiers.ts`)
  repère les tranches dans les libellés : « 100 à 150 personnes », « Moins de 50… », « Plus
  de 200… », avec ou sans espace avant l'unité. Elle les regroupe par unité, sans casse, accent
  ni pluriel. L'écran Étiquettes les propose, et rien n'est rangé sans clic : le groupe
  « palier » est créé et les étiquettes y prennent leur ordre.
- **Carnet** : le filtre par étiquette est rangé par groupe (`optgroup`).

### Un seul accès aux réglages (décisions 1 et 2)

- Un bouton « Réglages » (roue et libellé) à droite du titre de chaque écran de module :
  Événements, Tâches, Devis et factures, Encaissements, Prestataires, et dans les onglets de
  la fiche d'un événement. Il remplace la roue seule (`GearLink`, retirée) et les boutons de
  réglages des Événements. Le nom accessible commence par le libellé visible (WCAG 2.5.3).
- « Plus d'options » disparaît. L'essai guidé se lance depuis l'aide des Événements : le
  tiroir d'aide accepte désormais une action propre à l'écran (`extra` dans `Landmarks`,
  `helpExtra` dans `PageTour`). Il reste proposé quand la liste est vide.

### Vocabulaire des écrans qui mêlent les événements (décision 6)

- Sur l'accueil, la liste des événements, Tâches, Devis et factures et Encaissements :
  vocabulaire neutre (« Événement », « Clients ») dès que l'organisation a des événements des
  deux vocabulaires. Un événement sans type compte avec le vocabulaire du métier. Sinon, c'est
  le vocabulaire du métier, comme avant.
- Chaque ligne de Tâches garde le vocabulaire de son événement (« Mariés » ou « Clients »).
- Le module Événements expose `listEventAudiences` : le vocabulaire de chaque événement en une
  requête, sous RLS. C'est un ajout au contrat, donc compatible.

## Conséquences

- Annuler 0084 (`docs/runbooks/restauration.md`, § 4 bis) retire les groupes, familles et
  ordres des étiquettes. Les étiquettes et leur présence sur les fiches restent.
- Une organisation qui a importé ses étiquettes voit ses paliers proposés une fois, sur
  l'écran Étiquettes.
- Hors périmètre : convertir un palier en champ chiffré du type (« capacité ≥ 120 ») et
  rattacher automatiquement les étiquettes importées à une famille.
