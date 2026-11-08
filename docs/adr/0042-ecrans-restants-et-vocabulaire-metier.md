# ADR 0042 — Écrans restés à l'ancien motif ; vocabulaire selon le métier

- Statut : accepté
- Date : 2026-11-08
- Précise : [0039](0039-aide-un-seul-bouton-et-tiroir.md) (structure d'écran commune)
- Stories : HUB-20 et HUB-21 (lot 16, spécification `docs/lots/lot-16-reprise-ux.md`)

## Décision

### HUB-20 — écrans restés à l'ancien motif

- **Fiche devis** : en-tête commun.
  - Le statut et la version passent dans un badge (« Envoyé — version 1 »).
  - L'événement et sa date vont en sous-titre.
  - « Télécharger le PDF » devient une action de l'en-tête.
  - « Envoyer » et « Nouvelle version » restent dans leurs sections : leur formulaire dépend de
    l'état du devis.
- **Budget détaillé** (`/budget/<id>`) : ce n'est pas un doublon de l'onglet Budget de la fiche.
  Il porte la simulation de répartition (BUD-01), que l'onglet n'a pas, et il est gardé.
  - Il reçoit l'en-tête commun, avec « Retour à la fiche de l'événement ».
  - Ses chiffres clés passent en grille.
  - Les montants sont formatés selon la langue.
- **Encaissements, e-reporting, RGPD, profil** : rien à changer. Ces écrans avaient déjà le
  titre et l'aide de la structure commune (HUB-19), sans action d'en-tête : `PageHeader` ne
  s'impose que là où il y a des actions (ADR 0039).
- **Paramètres** : le titre de la page est la rubrique ouverte (« Entreprise et TVA ») ; le
  menu des rubriques fait partie de la structure.
- **Accueil** :
  - l'agenda montre 3 mois par défaut ; « Voir l'année » affiche 12 mois, et le choix est
    retenu ;
  - « Bonjour depuis Symbola » partira avec le module témoin `hello`, retiré par ARC-01, qui
    reprend aussi le test de dégradation HUB-03-03.
- **Liste des événements** : l'« Essai guidé » quitte le haut de la liste pour « ⋯ Plus
  d'options », où pointe le repère de la visite guidée ; le centre d'aide le propose
  toujours.

### HUB-21 — vocabulaire selon le métier

La spécification prévoyait des messages ICU `select` sur le métier. Retenu à la place : des
**textes propres au métier**, qui surchargent le catalogue au chargement des messages.

- Fichiers : `packages/i18n/src/messages/metier/event_agency.{fr,en}.json`, fusionnés par
  `withMetierMessages` dans `apps/symbola/i18n/request.ts`.
- Champ d'application : une agence événementielle, et un métier « autre », lisent « les
  clients » et « le premier contact » ; une wedding planner garde le catalogue tel quel.
- Raisons :
  - aucun des 50 appels concernés ne change ;
  - les textes restent des données traduisibles ;
  - un futur métier n'est qu'un fichier de plus.
- Contrôle : `check:messages` vérifie la parité FR/EN des surcharges et que chaque clé existe
  au catalogue.
- La console Admin n'est pas concernée : elle n'appartient à aucune organisation.

## Conséquences

- Une requête de plus par page pour lire le métier de l'organisation (mise en cache le temps de
  la requête). La réserve de connexions partagée d'ARC-01 l'allégera.
- Un texte du catalogue qui nomme les mariés doit avoir sa variante dans
  `event_agency.*.json`. Un test unitaire vérifie qu'aucun texte d'agence ne parle de mariés.
