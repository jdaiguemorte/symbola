# ADR 0045 — Types d'événement ; vocabulaire selon l'événement ; catalogue de prestataires commun

- Statut : accepté
- Date : 2026-11-08
- Précise : [0042](0042-ecrans-restants-et-vocabulaire-metier.md) (vocabulaire selon le
  métier), [0040](0040-familles-de-types-de-prestataires.md) (familles de types de
  prestataires) et [0043](0043-connexion-partagee-et-gardes-d-acces.md) (module témoin `hello`)
- Décisions de Julien du 08/11/2026, à la suite de la recette du lot 16 :
  - supprimer la table `hello.greetings` ;
  - un catalogue de familles commun à tous les métiers (« une agence peut gérer mariages
    plus le reste, et une wedding peut gérer des mariages plus le reste ») ;
  - un vocabulaire qui envisage les deux cas : « tous ne seront pas des mariés évidemment,
    mais il peut y en avoir ».

## Contexte

L'ADR 0042 faisait dépendre le vocabulaire (« les mariés » ou « le client ») du métier de
l'organisation. Une wedding planner qui organise un séminaire lisait donc « Prénom du premier
marié », et une agence qui organise un mariage lisait « Prénom du premier contact ».

Les familles de prestataires de départ dépendaient elles aussi du métier : deux catalogues
distincts.

## Décision

### Un type par événement

- **Table `events.event_types`** (migration 0080, annulable) : liste propre à l'organisation,
  sous RLS, avec un test d'isolation.
  - `label`, `position` ;
  - `audience` : qui sont les clients, `couple` (« les mariés ») ou `clients` (« le client ») ;
  - `starter_key` : la clé du type de départ, unique par organisation.
- **`events.events.event_type_id`** : facultatif ; mis à nul si le type est supprimé. Un
  événement d'avant le lot 16 n'a pas de type.
- **Types de départ** (`packages/starter-templates/src/event-types.json`) : Mariage
  (« les mariés »), Anniversaire, Baptême, Séminaire, Soirée d'entreprise, Lancement de
  produit, Autre (« le client »).
  - La même liste pour tous les métiers, dans l'ordre du métier : le mariage d'abord pour
    une wedding planner, le séminaire d'abord pour une agence.
  - L'assistant de démarrage propose une case par type, toutes cochées par défaut, et
    installe les types cochés.
  - Une organisation qui n'a aucun type reçoit tous ceux de son métier à sa première visite
    des événements.
- **Règles**
  - On ne supprime pas le dernier type.
  - Un type qui a des événements ne se supprime qu'en choisissant le type qui les reprend.
  - Le type d'une autre organisation est refusé : la clé étrangère seule ne voit pas la RLS.
  - Le mariage fictif de l'essai guidé prend le premier type « les mariés ».
- **Écrans**
  - Création d'un événement : le type, puis les libellés des clients, qui suivent le type
    choisi.
  - Fiche : le type dans le sous-titre, modifiable.
  - Paramètres › Types d'événements : renommer, choisir qui sont les clients, ajouter,
    supprimer.

### Le vocabulaire suit l'événement

- **Sur la page d'un événement**, le vocabulaire suit son type, sinon le métier. Ce sont les
  adresses `/events/<id>`, `/budget/<id>`, `/espace/<id>`, et `/devis/<id>` par l'événement
  du devis.
- **Ailleurs** (liste des événements, aide, RGPD, Paramètres), il suit le métier, comme le
  prévoyait l'ADR 0042.
- **Mécanique, sans toucher aux appels de texte**
  - `lib/vocabulary.ts` lit l'adresse de la page (en-tête `x-pathname` posé par le
    middleware) ; `i18n/request.ts` choisit les textes de la requête en conséquence.
  - Les textes « le client » passent de `messages/metier/event_agency.*.json` à
    `messages/vocabulary/clients.*.json`. Ils remplacent ceux du catalogue, qui parle des
    mariés.
- **Composants client**
  - Le cadre de l'app reste en place d'une page à l'autre : il reçoit toujours les textes
    du métier.
  - Les mises en page des pages d'événement (`app/event-vocabulary.tsx`) leur donnent ceux
    de l'événement quand ils diffèrent.
- **Cas particuliers**
  - La création d'un événement reçoit les libellés des deux vocabulaires.
  - La page publique d'invitation à l'espace client lit le vocabulaire de l'événement de
    l'invitation, sans rien révéler d'autre.
  - L'e-mail d'invitation dit « votre mariage » ou « votre événement ».
- **14 textes** de plus reçoivent une variante « client » : légende de l'agenda, colonnes
  « Mariage », « Mon mariage » de l'espace client, invitation, aide.
  - Restent tels quels : les essais guidés, dont l'événement fictif est bien un mariage, le
    nom du métier « Wedding planner » et la console Admin.

### Un catalogue de prestataires commun

- **Fichier** : `packages/starter-templates/src/vendor-families.json`, seul catalogue,
  11 familles et 36 types ; le catalogue propre à l'agence est retiré.
  - Fusions : « Musique et animation », « Technique et scène », « Accueil et sécurité »,
    « Papeterie et impression », « Transport et logistique ».
- **Types propres au mariage** (`weddingOnlyTypes`) : lieu de culte, robe de mariée, tenue du
  marié, officiant, voiture des mariés. Ils ne s'installent que si l'organisation a un type
  d'événement « les mariés ». Avec les types de départ, c'est le cas, sauf si elle a décoché
  le mariage au démarrage.
- **Organisations déjà installées** : elles gardent leurs familles. Le rangement de leurs
  types et les propositions de l'import prennent tout le catalogue.

### Table témoin `hello.greetings` supprimée

- Migration 0079 (annulable : le script recrée la table, vide).
- Les tests de `packages/db` portent sur les tables des modules. Le contrôle des rôles
  vérifie désormais toutes les tables métier : aucune n'appartient au rôle de l'app, et
  toutes ont la RLS active et forcée.

## Conséquences

- Une requête de plus sur la page d'un événement, pour lire le type, et deux sur celle d'un
  devis.
- Sur la page d'un événement dont le vocabulaire diffère du métier, les textes sont envoyés
  deux fois au navigateur : une fois pour le cadre, une fois pour la page.
- Un texte du catalogue qui parle des mariés doit avoir sa variante dans
  `vocabulary/clients.*.json` (contrôlé par `check:messages`).
- Un nouvel écran propre à un événement doit vivre sous l'une des adresses ci-dessus, pour en
  suivre le vocabulaire.
- Migrations 0079 et 0080 à appliquer avant de déployer l'image ; ordre d'annulation dans
  `docs/runbooks/restauration.md` § 4 bis.
