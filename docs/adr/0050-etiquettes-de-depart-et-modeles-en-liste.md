# ADR 0050 — Étiquettes de départ et rangement des étiquettes importées ; modèles en liste puis détail ; modes de paiement réactivables

- Statut : accepté
- Date : 2026-11-10
- Précise : [0049](0049-etiquettes-reglages-et-ecrans-mixtes.md) (étiquettes par groupe et par
  famille), [0033](0033-refonte-ux-panneaux-et-aide-par-reperes.md) (panneau latéral), le lot 14
  (import des prestataires) et DEV-03 (modes de paiement)
- Décisions de Julien du 10/11/2026 : maquette du lot 21, décisions 1 à 6 validées (« Je valide
  les 6 »), `docs/lots/lot-21-etiquettes-et-reglages.md`.

## Contexte

En recette du lot 20 sur le staging, la fiche d'une fleuriste importée montrait encore toutes
les étiquettes de l'organisation, et les tranches de capacité restaient cochables ensemble.
L'import ne crée que le libellé d'une étiquette : sans groupe ni famille, elle vaut pour tous les
types et se coche librement. L'ADR 0049 laissait le rangement à la main (un clic par unité pour
les paliers, une famille étiquette par étiquette) et ne livrait aucune étiquette de départ.
Julien : « Ces étiquettes devraient être par défaut puis potentiellement ensuite modifiées
ajustées par chacun des clients […] l'idée est de leur faciliter le travail en première
instance. »

Sur les écrans de réglage : les modèles de programme et de rétroplanning tenaient sur une seule
page, sans modification de ligne ; un mode de paiement « archivé » disparaissait sans retour
possible.

## Décision

### Étiquettes de départ (PRE-18)

- Données : `packages/starter-templates/src/vendor-tags.json` (et `vendor-tags.event-agency.json`
  pour les agences, fusionné par clé de groupe). Chaque groupe a un libellé traduit, un drapeau
  « palier » et des étiquettes ; chaque étiquette vise des familles de départ par leur clé
  (`vendor_families.starter_key`), vide = toutes les familles. Aucune migration.
- Un même groupe peut servir plusieurs familles (« Style », « Prestations ») : ce sont les
  étiquettes qui portent les familles, la fiche n'affiche que celles du type choisi.
- Posées par l'assistant de démarrage avec les familles et les types. Une organisation existante
  les ajoute d'un clic depuis l'écran Étiquettes. Une étiquette existante du même libellé (sans
  casse ni accents, en français ou en anglais) n'est pas dupliquée : si elle n'a ni groupe ni
  famille, elle prend ceux du modèle. Une étiquette dont la famille visée n'existe plus dans
  l'organisation n'est pas créée.

### Rangement des étiquettes importées (PRE-19)

- Fonctions pures (`modules/vendors/tag-arrangement.ts`), appliquées par le service en une
  transaction. Seules les étiquettes sans groupe ni famille sont touchées.
- Une étiquette qui correspond à une étiquette de départ en prend le groupe et les familles. Une
  tranche (« 250 à 300 personnes ») rejoint le palier connu de son unité, sinon un nouveau palier
  quand au moins deux tranches partagent l'unité. Les autres prennent les familles des
  prestataires qui les portent (par leur type). Ce qui ne correspond à rien reste dans
  « Autres ».
- Une fiche qui portait plusieurs tranches d'un même palier garde la plus haute (« peut
  accueillir jusqu'à ») ; le récapitulatif la nomme, avec un lien.
- À l'import : automatique, limité aux étiquettes créées par cet import (une étiquette créée à la
  main n'est jamais rangée sans clic). Un échec du rangement ne défait pas l'import ; le bouton
  reste proposé. Pour l'existant : « Ranger mes étiquettes importées » sur l'écran Étiquettes,
  puis un récapitulatif. Le cadre « Paliers repérés » du lot 20 disparaît de l'écran ; les
  fonctions du contrat restent (compatibilité).

### Modèles en liste puis détail (EVT-21, EVT-22)

- `/events/modeles-programme` et `/events/modeles` listent les modèles ; chacun s'ouvre sur sa
  propre adresse (`…/<id>`), en tableau à colonnes fixes, actions en fin de ligne. Création,
  renommage, ajout et modification d'une ligne dans le panneau latéral ; suppression du modèle
  après confirmation.
- Contrat du module Événements, ajouts compatibles : `updateProgramTemplateItem`,
  `renameProgramTemplate`, `updateTaskTemplateItem`, `renameTaskTemplate`. Une ligne modifiée
  garde sa place.

### Modes de paiement réactivables (DEV-13)

- Interrupteur « Accepté » par mode : désactiver archive le mode (plus proposé à l'encaissement,
  les paiements enregistrés gardent leur mode), réactiver efface l'archivage
  (`restorePaymentMethod`, ajout compatible au contrat du module Devis). Ajouter un mode du même
  nom qu'un mode désactivé le réactive.
- L'icône vient de la correspondance du libellé avec les modes de départ (français ou anglais),
  `starterPaymentMethodKinds()` ; un mode ajouté a une icône générique. Aucune migration.

### Menu des réglages (HUB-28, HUB-29)

- Le menu défile seul quand il dépasse la fenêtre (hauteur maximale, `overscroll-contain`).
- Chaque groupe a une icône et un titre lisible ; ses rubriques sont en retrait.

## Conséquences

- Aucune migration au déploiement de ce lot.
- Défaire un import supprime ses étiquettes ; un groupe créé par le rangement peut alors rester
  vide (« 0 étiquette ») et se supprime à la main.
- Le contenu des étiquettes de départ est une proposition : à ajuster dans les fichiers de
  données, jamais dans le code.
- Hors périmètre : convertir un palier en champ chiffré du type (déjà écarté par l'ADR 0049).
