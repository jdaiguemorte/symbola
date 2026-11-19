# ADR 0099 — Plans de salle des lieux et des évènements : module fermé par défaut, éditeur SVG sans dépendance, versions diffusées par lien

- Statut : accepté (spécification du lot 60 validée par Julien le 18/11/2026, décisions D1 à D9
  dans leur option a ; migration de la rubrique du portail acceptée le même jour)
- Date : 2026-11-19
- Complète : [0079](0079-socle-des-modules-rendez-vous-et-invites.md) (module fermé par défaut),
  [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md) (un schéma par module, sans clé
  étrangère entre schémas), [0027](0027-telechargements-servis-par-l-app.md) (fichiers privés servis par
  l'app), [0019](0019-generation-pdf-react-pdf.md) (PDF côté serveur),
  [0053](0053-acces-des-tiers-par-lien-personnel.md) (tiers par lien personnel),
  [0086](0086-plan-de-table-et-synthese-traiteur.md) (plan de table du lot 50).
- Exigences : **hors cahier des charges** (demande de Julien du 18/11/2026). Le lot prolonge
  PRE-06 (« Fiche lieu : capacités, plans… ») pour sa partie « plans », et touche INV-05 par la
  copie des tables. Exigences propres au lot, préfixées (Q1) : L60-PLA-01 à L60-PLA-05
  (`docs/lots/lot-60-plans-de-salle.md`).
- Numéro : 0097 est pris par le lot 58 et 0098 laissé au lot 35b/35c (sessions parallèles du
  19/11) ; ce lot prend **0099**.

## Contexte

La planner dessine le plan d'un lieu à la main, ou l'annote sur le PDF du lieu, et le refait à
chaque mariage dans le même lieu. Elle l'envoie par e-mail au traiteur, au DJ et au loueur, et
chacun l'imprime. Elle oublie souvent, le jour J, qui se branche sur quelle prise. Le cahier des
charges ne nomme pas cette fonction : c'est une divergence acceptée, d'où cet ADR.

## Décision

1. **Un module `floorplans`, fermé par défaut** (D1) : schéma `floorplans`, huit tables, RLS sur
   `organization_id`, auteur des lignes et suppressions journalisées. Le lieu (`vendor_id`),
   l'évènement (`event_id`), son lieu (`event_place_id`), le prestataire retenu
   (`vendor_candidate_id`) et le lien (`link_id`) sont désignés sans clé étrangère entre schémas.
   La clé `floorplans` entre au registre des modules (`MODULE_ENABLED_BY_DEFAULT` : `false`) ;
   l'Admin l'ouvre organisation par organisation. Sans lui, chaque écran répond « indisponible »,
   et la fiche du lieu, l'évènement et les liens n'offrent aucune entrée (ARC-07). Les écrans des
   lieux demandent aussi le carnet ; ceux d'un évènement, le module Évènements et la visibilité
   de l'évènement pour la Planner (lot 52).
2. **Configurations par lieu, à l'organisation** : un espace d'un lieu (nom, dimensions en
   centimètres entiers), ses installations fixes (prises avec nombre, ampérage et triphasé, eau,
   portes, issues, livraison, piliers, scène), ses configurations nommées et leur capacité
   calculée. Jamais partagées avec une autre organisation, ni avec le lieu.
3. **Un plan dessiné à l'échelle, en SVG dessiné par React, sans dépendance** (D2, D3) : une
   unité du dessin = un centimètre ; événements « pointeur » (souris et doigt) ; aimantation sur
   une grille de 50 cm ; clavier (Tab, flèches de 10 cm ou 1 m, R pour 15°, Suppr, annuler et
   rétablir), chaque geste annoncé (`role="status"`) ; panneau des propriétés et liste des
   éléments équivalente au dessin, voies du lecteur d'écran et du téléphone (D5 : à 375 px, le
   glisser fin est réservé aux écrans de 768 px et plus). La grille, les pas, la largeur d'une
   place et la bibliothèque de départ sont des données (`floorplan-elements.json`, FR et EN).
4. **Enregistrement d'un bloc, avec révision** : l'éditeur garde ses changements jusqu'à
   « Enregistrer » ; le serveur relit tout (Zod, types de la bibliothèque, prestataires retenus de
   l'évènement, prises de l'espace) et refuse une révision périmée sans rien écraser.
5. **Contrôles signalés, jamais bloquants** : chevauchement (séparation des axes sur les emprises
   tournées), élément hors de l'espace, places assises sous le nombre d'invités attendus,
   prestataire sans prise, surcharge **déclarée** d'une prise (plus de prises demandées que
   disponibles, ou ampérage demandé supérieur), câble trop court. Les contraintes de la base
   restent sûres face à NULL (`coalesce(…, false)`).
6. **L'électricité est un repérage** (D6) : le tableau « Électricité » et le PDF rappellent que
   Symbola ne fait pas d'étude électrique.
7. **Fond de plan en image calibrée** (D4) : PNG, JPEG ou WebP seulement, reconnus par leur
   contenu (taille lue dans l'en-tête, sans dépendance), puis le contrôle commun (taille, antivirus,
   stockage privé) ; servi par l'app après contrôle des droits. La calibration (deux points et la
   distance réelle) met le plan à l'échelle. Un fond de plan partagé par plusieurs espaces ou
   versions n'est supprimé du stockage que lorsque plus rien ne le désigne. Le PDF du lieu (D4 b)
   n'est pas accepté.
8. **Plan de l'évènement par copie** : une configuration du lieu est copiée (espace, installations,
   éléments, liaisons) dans l'évènement, puis ajustée sans modifier le lieu ; « Enregistrer comme
   configuration du lieu » fait l'inverse, sans les prestataires. Un lieu hors catalogue part d'un
   espace vide.
9. **Versions diffusées** : chaque diffusion fige le plan (`layout_versions`, sans note interne) et
   porte un numéro ; une version nouvelle est signalée au lien jusqu'à sa lecture (`link_views`).
10. **Ce que voient les tiers** (D8, POR-10) : un prestataire **retenu** voit, par son lien, la
    dernière version, son emplacement en évidence, ses besoins et sa prise, l'accès de livraison et
    les issues ; les autres prestataires par leur type, et par leur nom seulement si la planner l'a
    coché. Le client lit la même version par la rubrique « Plan de salle » de son lien, **fermée par
    défaut** (migration `events` de `event_links_rubrics_check`). L'évènement est toujours celui du
    lien. PDF A4 paysage à une échelle normalisée (1:20 à 1:1000) avec cartouche, barre d'échelle,
    tableau des éléments et tableau « Électricité ».
11. **Plan de table** (D7) : « Créer les tables du plan de table » copie une fois les tables (nom ou
    numéro, forme, places) dans le plan de table d'un temps fort, par le service du module Invités
    (`importSeatingTables`) ; une table du même nom n'est pas recréée ; aucune synchronisation. Ce
    lot ne place pas les invités.

## Conséquences

- Deux migrations : `0191_lot60_floorplans` (schéma, droits, RLS) et
  `0192_lot60_events_floorplan_rubric` (contrainte des rubriques des liens). Annulations refusées
  tant qu'un espace existe, ou qu'un lien a la rubrique ouverte. Numérotées après les lots 35b
  (0184-0185), 35c (0186-0187) et 58 (0188-0190), fusionnés avant ce lot. Une version diffusée garde
  son fond de plan dans une colonne de fichier (`layout_versions.background_key`) : l'export la livre
  comme fichier et la reprise d'un export (lot 35b) lui donne sa nouvelle clé.
- RGPD : aucun champ qui désigne une personne ; les notes libres et le fond de plan sont au
  registre ; les plans d'un évènement sont une fiche rattachée à l'évènement, effacée avec lui
  (corbeille, oubli). Le module entre à l'export complet (sans les versions vues par un lien).
- Duplication d'un évènement et modèles d'évènement (lot 58, ADR 0097) : le plan de salle **ne suit
  pas** (choix le plus sobre). Pour réutiliser un plan ajusté, la planner l'enregistre comme
  configuration du lieu, puis la copie dans le nouvel évènement.
- Fermeture d'un espace (lot 35c, ADR 0100) : le schéma `floorplans` rejoint la liste des schémas
  effacés par `core.erase_organization_schema` (migration 0191, à confirmer par Julien) ; les fonds de
  plan partent avec les fichiers de l'organisation.
- Le module se vend ou s'ouvre à part (HUB-27, lot 54) ; les combinaisons de modules de
  l'ADR 0062 l'ajouteront à leur preuve.
- Hors du lot : 3D, import DWG ou PDF, étude électrique, partage entre organisations ou avec le
  lieu, commande au loueur, placement des invités.
