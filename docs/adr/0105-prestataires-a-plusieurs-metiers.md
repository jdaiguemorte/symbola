# ADR 0105 — Prestataires à plusieurs métiers

- Statut : accepté (décision de Julien du 21/11/2026, Q3 de l'analyse de la recette ; accord du 21/11
  sur les migrations 0198 et 0199, le résultat de la reprise montré avant la production).
- Date : 2026-11-21
- Complète : [0031](0031-prestataires-carnet-et-carte.md) (carnet et carte), [0040](0040-familles-de-types-de-prestataires.md)
  (familles et fusion de types), [0107](0107-fenetre-pour-modifier-panneau-pour-les-reglages.md) (la
  fenêtre pour modifier).
- Exigences : PRE-01, PRE-11, HUB-20, HUB-13 ; spécification
  `docs/lots/lot-63-retours-recette-planner.md` (paquet 63e), analyse
  `docs/audits/2026-11-21-recette-planner.md` (#14), maquettes M4 et M11.

## Contexte

Une fiche de prestataire n'avait qu'un type (`vendors.type_id`). La wedding planner travaille avec des
prestataires qui exercent plusieurs métiers (officiante et décoratrice, photographe et vidéaste,
coiffure et maquillage). Son import en a tiré trois types (« Photographe », « Vidéaste »,
« Photographe & Vidéaste ») et une même personne devait choisir un seul métier, perdant les
étiquettes et les champs de l'autre ; le filtre « Vidéaste » ne la trouvait pas.

## Décision

1. **Une fiche a des métiers** : table `vendors.vendor_type_links` (organisation, fiche, type,
   `is_primary`, `position`), Row-Level Security, au plus **un métier principal** par fiche (index
   unique partiel) et un métier une seule fois. Un déclencheur vérifie que la fiche et le type sont de
   l'organisation du lien (une clé étrangère ne voit pas la Row-Level Security, SEC-10).
2. **Le principal** donne la couleur et l'icône sur la carte et la famille qui range les étiquettes
   importées ; les étiquettes et les champs de **chaque** métier coché s'ajoutent sur la fiche, avec les
   étiquettes « pour tous ».
3. **Trouvée par n'importe lequel de ses métiers** : filtres par type et par famille, « à classer »
   (un métier sans famille, ou aucun), recherche par mot (les libellés des métiers entrent dans le
   texte cherché), recherche globale, comptes (une fiche compte pour chacun de ses métiers, une seule
   fois dans sa famille et dans le total). L'export d'une sélection porte la liste des métiers,
   le principal en premier ; l'export complet (export/v1) porte la table des métiers, et la reprise
   d'une archive d'avant le lot change son `typeId` en métier principal.
4. **Migration en deux temps**, schéma `vendors` seulement :
   - **0198** ajoute la table et reprend chaque fiche typée : son type devient son métier principal.
     Ajout seul, l'ancienne version de l'app tourne encore ;
   - **0199** retire `vendors.type_id` (arrêt de l'app, `-- symbola: arret-requis`) après avoir repris
     une fiche typée entre-temps par l'ancienne version. Son annulation remet la colonne, remplie par le
     métier principal : l'image d'avant peut alors tourner. L'annulation de 0198 est refusée tant
     qu'une fiche a plusieurs métiers.
5. **Types combinés en données** : `packages/starter-templates/src/vendor-type-synonyms.json`, rubrique
   `combined`, liste les valeurs qui désignent plusieurs métiers (« Photographe et vidéaste »,
   « Coiffure et maquillage », « Officiante et décoratrice »…) et les séparateurs (« et », « & », « / »,
   « + », « - », « , ») qui en reconnaissent d'autres quand chaque morceau est le synonyme d'un type de
   départ **différent**. Un synonyme d'un seul type n'est jamais coupé (« Hôtel / hébergement »,
   « Vins et boissons »). Le type de départ « Coiffure et maquillage » devient deux types,
   « Coiffure » (clé `hair_makeup` gardée : postes, programme et répartition du budget la citent) et
   « Maquillage » (clé `makeup`).
6. **Import** : une valeur combinée donne plusieurs métiers à la même fiche, chacun choisi sous son
   libellé à l'étape « Types », qui dit de quelle valeur du fichier il vient ; le premier est le
   principal. Une fiche rapprochée garde ses métiers et reçoit ceux du fichier.
7. **Reprise des types combinés existants** : commande `pnpm --filter @symbola/app vendors:split-types`,
   lancée après les migrations ; sans option, un **rapport** organisation par organisation (rien n'est
   écrit) ; avec `--appliquer`, en une transaction par organisation, chaque type combiné est fusionné
   dans son premier métier (fusion du lot 16, journalisée par `vendors.vendor_type.merged`, inchangé)
   ou le devient s'il n'existe pas (renommé) ; les métiers suivants sont retrouvés (type de départ,
   synonymes) ou créés depuis le catalogue de départ, et ajoutés aux fiches après leurs métiers. Le
   rapport ne cite que des libellés de métiers et des nombres. Rejouable.
8. **Contrat interne** : `VendorSummary` porte `typeIds` (le principal en premier) et `primaryTypeId` ;
   `typeId` reste, déprécié, égal au principal, le temps que les appelants passent aux métiers.
   `VendorInput` prend `typeIds` et `primaryTypeId` (l'ancien `typeId` seul s'il manque).
   `countVendorsByFamily`, `previewVendorTypeSplit` et `splitCombinedVendorTypes` s'ajoutent.
9. **Fiche en grande fenêtre** (ADR 0107, maquette M11) : rubriques « Identité », « Métiers et
   étiquettes », « Coordonnées », « Tarifs et note », sommaire à gauche ; « Suivant » enregistre et
   enchaîne sans y obliger, « Enregistrer et fermer » ; sur téléphone, une page avec « Retour ». Une
   nouvelle fiche se crée à la première rubrique, puis s'ouvre dans sa fenêtre. Les pièces, la banque,
   les fichiers et le point sur la carte gardent leurs formulaires sur la fiche (journal des IBAN,
   dépôts de fichiers).

## Conséquences

- Le rapport de reprise du jeu fictif local est dans `docs/recette/lot-63e-reprise-types-combines.md`.
  Sur le staging puis la production : déployer (0198, 0199), lancer le rapport, le montrer à Julien,
  puis `--appliquer` (`docs/runbooks/deploiement.md`).
- Un type de départ « Coiffure et maquillage » déjà posé dans une organisation est renommé
  « Coiffure » par la reprise et ses fiches reçoivent « Maquillage ».
- Les modules qui lisent le type d'un prestataire passent par `typeIds` ; `typeId` disparaîtra du
  contrat une fois plus aucun appelant.
