# Lot 11 — Prestataires consultés, carnet de prestataires et carte

Demandé par Julien après les essais du staging du lot 10 (04/11/2026), maquettes validées
(artifact « Symbola — prestataires et carte (lot 11) »). Constat : un poste de la fiche
événement n'accepte qu'un prestataire, en texte libre ; or la planner consulte souvent
plusieurs prestataires pour une même prestation, reçoit leurs devis et prend des notes
(« traiteur : uniquement des produits frais »). Elle veut aussi un **carnet de prestataires**
pour ne pas recréer 20 fois le même, avec une **carte**. Ce carnet est l'app « Prestataires et
carte interactive » de l'ancien cahier des charges (§ 5.5, V2,
`docs/archive/cahier-des-charges-v1.md`) : ce lot l'avance.
Décisions techniques : ADR 0031.

## Décisions de Julien (04/11/2026)

- Tout en un lot : prestataires consultés et devis par poste, carnet, carte.
- Notes d'un prestataire consulté : internes par défaut, **visibles par les clients note par
  note** (case « Clients »).
- Dépendances acceptées : `maplibre-gl` et `pmtiles` (carte sans abonnement), géocodage par
  l'API de l'IGN (gratuite, sans clé, seule l'adresse du prestataire est envoyée), pas de
  PostGIS (distance calculée par la base).
- Paramètres en **pastilles cliquables**, une par solution accessible.
- Restent pour plus tard (ancien cahier des charges) : isochrones, carte partagée aux clients,
  lieux des événements sur la carte.

## Architecture

- Nouveau module `vendors` (`apps/symbola/modules/vendors/`, schéma PostgreSQL `vendors`, clé
  de module `vendors` désactivable par l'Admin) : types et champs, étiquettes, fiches,
  fichiers (plaquettes, RIB), géocodage, distances, historique.
- Les prestataires consultés vivent dans le module `events` (ils appartiennent à un poste d'un
  événement) ; ils référencent une fiche du carnet par un identifiant opaque (pas de clé
  étrangère entre schémas, ADR 0011) et gardent le nom en clair, ce qui permet de travailler
  **sans le module Prestataires** (saisie libre).
- Les types, champs et étiquettes de départ viennent de `packages/starter-templates`
  (traduisibles, modifiables), jamais du code.

## L11-EVT-10 — Plusieurs prestataires consultés par poste

- **Quand** la planner ouvre un poste de l'onglet Prestataires, **alors** elle voit les
  prestataires consultés : nom (lien vers la fiche du carnet s'il y en a une), réponse
  (Contacté, Devis reçu, Écarté ; « Retenu » / « Non retenu » une fois le poste réservé),
  montant et fichier du devis, notes, case « Montrer aux clients ».
- Elle ajoute un prestataire consulté en le cherchant dans son carnet (nom, ville, type) ou en
  le créant ; **sans le module Prestataires**, elle saisit seulement un nom.
- Le poste a une note « Ce que veulent les clients pour ce poste ».
- **Quand** elle ajoute un premier consulté à un poste « À trouver », **alors** le poste passe à
  « Devis demandé » ; **quand** un devis est reçu (montant ou fichier), **alors** le poste passe
  à « Devis reçu » s'il n'était pas plus avancé. Le statut reste modifiable à la main.
- **Quand** elle choisit « Retenir », **alors** le poste passe à Réservé avec le nom du
  prestataire et le montant du devis (PRD-EVT-03) ; le budget se met à jour comme aujourd'hui
  (`events.vendor_slot.booked`). Les autres consultés restent visibles, « non retenu ».
- Un devis joint suit les règles des fichiers (PDF ou image, 20 Mo, antivirus, stockage privé,
  servi par l'app, ADR 0027).
- Un poste déjà réservé en texte libre reste tel quel ; il peut être ajouté au carnet.

## L11-EVT-11 — Notes et options montrées aux clients

- Chaque note d'un consulté est interne par défaut ; la case « Clients » la rend visible.
- **Étant donné** un consulté « montré aux clients », **alors** l'espace clients liste, par
  poste, ses options : nom, notes « Clients », montant et devis (téléchargeable par les clients
  de cet événement seulement). Les notes internes et les consultés non montrés n'y sont jamais.

## L11-PRE-01 — Fiche d'un prestataire (carnet)

- Coordonnées (contact, téléphone, e-mail, adresse), type, étiquettes, note interne, champs
  propres au type, plaquettes et RIB (fichiers privés, mêmes règles que les devis).
- Un prestataire n'existe qu'une fois ; une recherche par nom propose les fiches existantes
  avant d'en créer une. Archivage plutôt que suppression s'il a un historique.

## L11-PRE-02 — Types, champs et filtres

- La planner crée ses types et leurs champs (nombre, texte, heure, montant, liste de choix,
  oui/non) et choisit ceux qui servent de filtres. Types de départ modifiables (lieu de
  réception, hôtel, traiteur, photographe, DJ, fleuriste…).

## L11-PRE-03 — Adresse placée sur la carte

- **Quand** une adresse est enregistrée, **alors** elle est placée automatiquement (géocodage
  IGN) ; la planner peut corriger le point à la main. Sans réponse du géocodage, la fiche est
  enregistrée sans point, avec un message.

## L11-PRE-04 / L11-PRE-05 / L11-PRE-06 — Carte, filtres, cercle

- La carte montre les prestataires (une couleur par type, regroupement quand ils sont
  nombreux) ; la liste à côté suit les filtres.
- Filtres combinables : type, champs-filtres (≥, ≤, égal, oui/non), étiquettes, « déjà
  travaillé avec ».
- « Autour de » : une fiche du carnet ou une adresse, et un rayon en km ; la liste se trie par
  distance au centre.
- Sans fond de carte installé, la liste et les filtres fonctionnent ; la carte l'indique.

## L11-PRE-07 — Trajet estimé

- Distance à vol d'oiseau × 1,3 (détour), durée à 60 km/h ; toujours affichée « estimation ».
  Coefficient et vitesse paramétrables par organisation.

## L11-PRE-09 — Historique avec la planner

- La fiche liste les événements où le prestataire a été consulté : événement, date, issue
  (retenu, non retenu, en cours), prix devisé, prix final (réel du budget si le module Budget
  est souscrit) et prix moyen pratiqué.

## L11-PRE-10 — Du carnet vers le poste

- Depuis la carte ou une fiche : « Ajouter au poste … » d'un événement en cours de
  préparation. Depuis un poste : « Trouver sur la carte autour du lieu ».

## L11-PRE-11 — Exporter une sélection

- La sélection filtrée s'exporte en CSV (cellules neutralisées) ou en PDF.

## L11-HUB-12 — Paramètres en pastilles

- Une pastille par solution accessible (Organisation, Événements, Prestataires, Budget, Devis
  et factures), puis des pastilles pour les réglages de la solution choisie. Une solution non
  souscrite n'apparaît pas.

## Règles transverses

- RLS sur chaque nouvelle table ; tests d'isolation (organisation A ↔ B ; un client ne voit que
  les options montrées de son événement ; l'Admin ne voit aucune fiche).
- Données personnelles (nom du contact, e-mail, téléphone, adresse d'un indépendant, notes)
  déclarées au registre ; contrat `privacy/v1` du module `vendors`.
- Recherche globale (AIDE-08) : le carnet entre dans « Tâches et prestataires ».
- Aide : visite du carnet, article d'aide, tutoriel « Comparer plusieurs devis pour un poste ».
- FR/EN, 375 px, axe-core.

## Tests

- Unitaires : distance et trajet estimé, filtres de champs, validation des champs par type,
  export CSV neutralisé.
- Intégration : consultés et statut automatique, retenir → réservé → budget, notes et options
  vues par les clients, fiches/types/étiquettes, géocodage simulé, filtres et cercle,
  historique, isolation de chaque table, RGPD.
- e2e (ordinateur et 375 px) : comparer deux devis et retenir ; créer une fiche et la retrouver
  par la recherche et le cercle ; l'espace clients voit seulement les options montrées ;
  paramètres en pastilles.
