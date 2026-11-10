# Lot 21 — Étiquettes prêtes à l'emploi et écrans de réglage simplifiés

**Statut** : fait sur la branche `lot-21-etiquettes-et-reglages` (depuis `main` 348d079, lot 20
déployé sur le staging le 10/11/2026). Maquette et décisions 1 à 6 validées par Julien le
10/11/2026 (« Je valide les 6 », https://claude.ai/artifact/JkfiLeTAiPNqcyEMw6cQT1) ; choix
d'architecture dans l'[ADR 0050](../adr/0050-etiquettes-de-depart-et-modeles-en-liste.md).
Aucune migration au déploiement. Reste la recette sur le staging.

## Contexte

Retours de Julien du 10/11/2026, en recette du lot 20 sur le staging (captures à l'appui).

**Étiquettes.** Sur la fiche d'une fleuriste importée, toutes les étiquettes de
l'organisation s'affichent : capacités, surfaces, langues, styles. Les quatre tranches de
« personnes » peuvent encore être choisies ensemble. La création d'un prestataire montre la
même liste. Ce que Julien attend : « Ces étiquettes devraient être par défaut puis
potentiellement ensuite modifiées ajustées par chacun des clients […] l'idée est de leur
faciliter le travail en première instance. »

Causes relevées dans le code :

- L'import (`modules/vendors/import.ts`) ne crée que le libellé de l'étiquette : pas de
  groupe, pas de famille. Une étiquette sans famille vaut pour tous les types, et sans groupe
  elle tombe dans la liste à choix multiple.
- Les paliers ne sont rangés qu'après un clic par unité sur l'écran Étiquettes (ADR 0049).
- Aucune étiquette de départ n'existe : `packages/starter-templates` livre les familles et
  les types de prestataires, pas d'étiquettes. Les groupes « Capacité », « Équipements » et
  « Style » de la maquette du lot 20 étaient des exemples.
- Défaut d'affichage : la règle `.vendor-form fieldset` (deux colonnes) s'applique aussi au
  bloc des étiquettes et à chacun de ses groupes. Les pastilles tiennent dans un quart de la
  largeur, une par ligne.

**Programme du jour J.** « Ergonomiquement très moche, et pas forcément pratique. » Tous les
modèles et toutes leurs lignes sont sur une seule page, chaque modèle avec son formulaire
d'ajout. Une ligne est un texte continu suivi de son bouton : « Supprimer » change de place
selon la longueur du texte. Une ligne ne se modifie pas : il faut la supprimer et la
recréer. Le Rétroplanning est construit de la même façon.

**Modes de paiement** (Devis et factures). Une liste avec un bouton « Archiver » par mode.
« Si j'archive je perds la possibilité d'encaisser en chèque ? » Oui : un mode archivé n'est
plus proposé à l'enregistrement d'un paiement, disparaît de la liste et ne peut plus être
réactivé. Les paiements déjà enregistrés gardent leur mode.

**Menu des réglages.** Plus haut que l'écran, il reste collé en haut sans défiler lui-même.
Ses dernières rubriques n'apparaissent qu'en bas de la page affichée. Les titres de groupe en
petites capitales grises se distinguent mal des rubriques cliquables.

## A. Corrections directes

### PRE-20 — Pastilles sur toute la largeur de la fiche

- **Étant donné** la fiche d'un prestataire ou sa création, en taille ordinateur, **alors**
  les pastilles d'un groupe s'alignent sur toute la largeur du bloc Étiquettes et passent à
  la ligne seulement quand la place manque.
- **En 375 px**, idem sur une colonne, sans défilement horizontal.

### HUB-28 — Le menu des réglages défile seul

- **Étant donné** un écran de réglage plus long que la fenêtre et un menu plus haut que la
  fenêtre, **quand** elle fait défiler la molette au-dessus du menu, **alors** le menu défile
  jusqu'à sa dernière rubrique, sans faire défiler l'écran.
- Le menu reste visible en haut de la fenêtre pendant que l'écran défile.

## B. Décisions validées (maquette)

Propositions validées telles quelles le 10/11/2026. Précisions de mise en œuvre :

- Décision 2 : à l'import, seules les étiquettes créées par cet import sont rangées ; une
  tranche qui n'est pas dans les étiquettes de départ rejoint le palier de son unité
  (« 250 à 300 personnes » rejoint « Capacité »).
- Décision 3 : le panneau d'ajout reste ouvert pour enchaîner les lignes ; celui de
  modification se ferme à l'enregistrement.

### Décision 1 — PRE-18 : des étiquettes de départ, rangées par famille

- Un fichier de données traduisible `packages/starter-templates/src/vendor-tags.json` décrit
  des groupes par famille de prestataires. Certains groupes sont des paliers (un seul choix).
  Les ajouts propres aux agences sont dans `vendor-tags.event-agency.json`.
- **À la création d'une organisation**, ces étiquettes sont créées avec les familles et les
  types, comme le reste des modèles de départ. Chaque client les modifie, les retire ou en
  ajoute ensuite.
- **Pour une organisation qui existe déjà**, l'écran Étiquettes propose « Ajouter les
  étiquettes proposées ». Une étiquette qui existe déjà sous le même libellé (sans casse ni
  accents) n'est pas dupliquée : elle prend le groupe et les familles du modèle.
- Contenu proposé (français ; l'anglais suit) :

| Famille | Groupe | Étiquettes |
| --- | --- | --- |
| Lieux et hébergement | Capacité (palier) | Moins de 50 personnes · 50 à 100 personnes · 100 à 150 personnes · 150 à 200 personnes · Plus de 200 personnes |
| Lieux et hébergement | Couchages (palier) | Pas de couchage · Moins de 20 couchages · 20 à 50 couchages · Plus de 50 couchages |
| Lieux et hébergement | Traiteur (palier) | Traiteur libre · Liste de traiteurs agréés · Traiteur imposé |
| Lieux et hébergement | Équipements | Accès PMR · Hébergement sur place · Cuisine équipée traiteur · Espace enfants · Parking · Repli en cas de pluie · Piscine |
| Lieux et hébergement | Style | Champêtre · Château · Demeure de caractère · Domaine viticole · Bord de mer · Urbain · Atypique |
| Traiteur et boissons | Formules | Cocktail · Buffet · Service à l'assiette · Brunch · Food truck |
| Traiteur et boissons | Régimes | Végétarien · Vegan · Sans gluten · Halal · Casher |
| Photo et vidéo | Style | Reportage · Fine art · Posé · Argentique |
| Photo et vidéo | Prestations | Séance couple · Album · Drone · Livraison express |
| Musique et animation | Formation | DJ · Groupe live · Solo ou duo · Orchestre |
| Musique et animation | Répertoire | Pop · Rock · Années 80 · Électro · Jazz · Variété française |
| Fleurs et décoration | Style | Bohème · Champêtre · Romantique · Moderne · Fleurs séchées |
| Fleurs et décoration | Prestations | Arche de cérémonie · Centres de table · Bouquet · Location de contenants |
| Beauté et tenues | Prestations | À domicile · Essai inclus · Invités |
| Cérémonie et organisation | Cérémonie | Laïque · Religieuse · Bilingue |
| Toutes | Langues parlées | Anglais · Espagnol · Italien · Allemand |

  Ajouts agence : Lieux › Capacité en plénière (palier) et Équipements « Salles de
  sous-commission », « Wi-Fi haut débit », « Régie technique ».

### Décision 2 — PRE-19 : les étiquettes importées se rangent toutes seules

- **À l'import**, l'export de l'outil actuel attache chaque critère à un prestataire d'un
  type donné. Une étiquette portée seulement par des prestataires d'une famille est réservée
  à cette famille ; portée par plusieurs familles, elle vaut pour celles-là. Une étiquette
  dont le libellé correspond à une étiquette de départ prend son groupe. Les tranches d'une
  même unité forment un palier, sans clic.
- **Pour les étiquettes déjà importées**, l'écran Étiquettes propose une fois « Ranger mes
  étiquettes importées », avec le même calcul à partir des fiches actuelles. Un récapitulatif
  dit ce qui a été rangé : étiquettes rattachées à une famille, paliers créés, fiches
  ajustées.
- **Une fiche qui portait plusieurs tranches d'un même palier** garde la plus haute (« peut
  accueillir jusqu'à »). Le récapitulatif liste ces fiches pour vérification.
- Rien n'est supprimé : une étiquette qui ne correspond à rien reste dans « Autres », pour
  toutes les familles, et se range à la main comme avant.

### Décision 3 — EVT-21 : Programme du jour J en liste, puis le détail d'un modèle

- **Liste** (`/events/modeles-programme`) : une ligne par modèle (nom, nombre de lignes,
  amplitude « 09:00 → 22:30 »), cliquable. « Nouveau modèle » est un bouton : il demande le
  nom, crée le modèle et ouvre son détail. « Charger le modèle de départ » reste en bas de la
  liste.
- **Détail** (`/events/modeles-programme/<id>`) : un tableau à colonnes fixes, Heure ·
  Intitulé · Lieu · Intervenants · actions. « Modifier » et « Supprimer » sont toujours dans
  la dernière colonne, au même endroit d'une ligne à l'autre. « Ajouter une ligne » et
  « Modifier » ouvrent le panneau latéral (ADR 0033). Le nom du modèle se renomme, et le
  modèle se supprime depuis ce détail, après confirmation.
- **En 375 px**, chaque ligne devient une carte ; ses actions restent en bas à droite.
- Ajout au contrat du module Événements, compatible : modifier une ligne de modèle, renommer
  un modèle.

### Décision 4 — EVT-22 : Rétroplanning sur le même modèle

- Même présentation que le Programme : liste des modèles, puis détail en tableau
  (Échéance · Tâche · Responsable · actions), modification d'une ligne dans le panneau.
- Proposé pour que les deux écrans de modèles se ressemblent ; peut être écarté du lot.

### Décision 5 — DEV-13 : des modes de paiement à activer ou désactiver

- Une carte par mode : icône (virement, carte, chèque, espèces ; icône générique pour un mode
  ajouté), libellé, interrupteur « Accepté ».
- Désactiver : le mode n'est plus proposé à l'enregistrement d'un paiement ; les paiements
  déjà enregistrés gardent leur mode. Le texte de l'écran le dit. Réactiver est possible à
  tout moment.
- « Ajouter un autre mode » reste en dessous.
- L'icône vient de la correspondance entre le libellé et les modes de départ (français ou
  anglais) : pas de migration. Ajout au contrat du module Devis, compatible : réactiver un
  mode.

### Décision 6 — HUB-29 : des groupes lisibles dans le menu des réglages

- Chaque groupe a une icône et un titre en casse normale, en gras, couleur d'encre.
- Ses rubriques sont en retrait, le long d'un filet vertical ; un séparateur entre les
  groupes. La rubrique ouverte reste en vert sauge.
- Tout reste déplié : pas de groupe repliable.

## Hors périmètre

- Convertir un palier en champ chiffré du type (« Capacité assise ≥ 120 »), déjà écarté par
  l'ADR 0049.
- Le programme du jour J d'un événement (onglet de la fiche) : seul l'écran des modèles
  change.
