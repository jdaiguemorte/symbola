# Lot 10 — Une aide qui forme, et une recherche partout

Demandé par Julien après les essais du staging (04/11/2026) et validé avec la wedding planner
pilote sur maquettes (artifact « Symbola — aide et recherche (lot 10) »). Constat : les premières
minutes décident de l'adoption ; l'aide actuelle (visite en simple fenêtre, bouton « Passer » trop
tentant, reprise peu visible) ne forme pas. Ce lot fait de l'aide une **formation à l'usage, en
autonomie**, et ajoute une **recherche globale**.

## Décisions de Julien (04/11/2026)

- Maquettes validées : visite focus, tutoriel « en faisant », centre d'aide et progression,
  recherche globale, suivi dans l'Administration.
- **Pas seulement des mariages** : l'organisation événementielle couvre tout type d'événement.
  Les textes d'aide parlent d'« événement » et de « clients » ; les exemples fictifs des
  tutoriels varient (mariage, anniversaire, séminaire…) et viennent de fichiers de modèles de
  départ traduisibles (`packages/starter-templates`), jamais du code (CLAUDE.md § 2.5).
- La **visite focus** se lance d'elle-même à la première visite d'un écran.
- Les **9 tutoriels** sont tous proposés : de préférence à la première visite de l'écran ou de
  l'onglet concerné, et à tout moment depuis le centre d'aide.
- La recherche couvre : événements et clients, devis et factures, tâches et prestataires, aide
  et écrans.
- Le suivi Admin se fait **par compte d'équipe** (cadre de l'ADR 0029 : aucune donnée
  d'événement). Les recherches sans résultat ne sont **pas** suivies (un mot cherché peut être un
  nom de client).

## AIDE-05 — Visite focus

- **Quand** un utilisateur ouvre pour la première fois un écran qui a une visite, **alors** la
  visite démarre : le reste de l'écran s'assombrit, l'élément expliqué est mis en lumière, une
  bulle dit quoi faire (« étape 2 sur 4 »).
- Le bouton principal est « Continuer » (« Terminer la visite » à la dernière étape) ; « Plus
  tard » est un lien discret, et « Retour » revient à l'étape précédente.
- **Quand** il choisit « Plus tard », **alors** la visite garde son étape ; la barre d'aide
  propose « Reprendre la visite (étape N) » et la reprend à cette étape.
- Si l'élément expliqué n'est pas à l'écran (onglet fermé, petit écran), la bulle s'affiche
  seule au centre, sans mise en lumière.
- Accessibilité : la bulle est une boîte de dialogue modale (focus piégé, Échap = « Plus
  tard »), lisible au clavier et au lecteur d'écran ; en 375 px, la bulle occupe le bas de
  l'écran.

## AIDE-06 — Tutoriels en faisant

- Chaque tutoriel enseigne une notion en la pratiquant sur un **exemple fictif** : il crée les
  données d'exemple (marquées démo, comme l'essai guidé AIDE-02), fait réaliser l'opération à
  l'utilisateur, montre le résultat, puis propose de **supprimer** l'exemple (ou de garder ce qui
  sert de base, par exemple un modèle).
- Les 9 tutoriels : la fiche d'un événement ; à quoi sert un modèle de rétroplanning ; inviter les
  clients dans leur espace ; composer un devis et le faire signer ; facturer un acompte puis le
  solde ; simuler le budget d'un événement ; saisir son catalogue de prestations ; préparer le
  programme du jour J ; importer ses événements existants.
- **Quand** l'utilisateur ouvre pour la première fois l'écran ou l'onglet d'un tutoriel, **alors**
  une invitation lui propose « Découvrir en N minutes » (Commencer / Plus tard), sans bloquer
  l'écran. Un tutoriel commencé garde son étape et se reprend.
- Un tutoriel abandonné ne laisse aucune donnée d'exemple plus de 24 h (même purge que AIDE-02).
- Les exemples ne comptent jamais dans les statistiques, la recherche, les exports ni le RGPD.

## AIDE-07 — Centre d'aide et barre d'aide

- Le centre d'aide (menu « Aide ») montre la progression de la prise en main (« 4 sur 9 ») et,
  par module, chaque visite et tutoriel avec son état : Terminé (Revoir), En cours · étape N
  (Reprendre), À découvrir (Commencer). Un bouton « Continuer ma prise en main » lance le
  prochain conseillé.
- On y cherche dans les articles d'aide (FR/EN).
- Une barre d'aide reste en bas de chaque écran : progression, et reprise d'une visite ou d'un
  tutoriel en cours. Elle se replie ; repliée, elle ne cache rien d'utile en 375 px.

## AIDE-08 — Recherche globale

- Un champ de recherche est présent sur chaque écran de l'équipe ; il s'ouvre aussi par ⌘K /
  Ctrl+K.
- **Quand** on tape au moins 2 caractères, **alors** les résultats apparaissent, regroupés :
  Événements (noms des clients, nom de l'événement, lieu), Devis et factures (numéro, clients),
  Tâches et prestataires (intitulé, nom du prestataire), Aide et écrans (articles, tutoriels,
  écrans de l'app). Entrée ouvre le résultat choisi ; flèches pour choisir.
- La recherche ne lit que l'organisation de l'utilisateur (RLS) ; les données d'essai en sont
  exclues ; un module non souscrit n'apparaît pas (dégradation propre).
- Insensible aux accents et à la casse (« theo » trouve « Théo »).
- Un compte client (marié) n'a pas cette recherche ; l'Admin non plus (aucune donnée métier).

## HUB-11 — Suivi de la prise en main dans l'Administration

- Par organisation et par compte d'équipe : progression (N sur 9), tutoriels terminés, en cours
  (avec l'étape), dernière activité d'aide. Indicateurs globaux : progression moyenne, tutoriels
  terminés sur 30 jours, visites mises de côté.
- Aucune donnée d'événement, aucun mot cherché.

## Tests

- Unitaires : moteur de visite (étapes, reprise, élément absent), normalisation de la recherche.
- Intégration : progression par compte (visites et tutoriels), isolation entre organisations de
  la recherche, exclusion des essais, purge des exemples abandonnés, vue Admin sans donnée métier.
- e2e (ordinateur et 375 px, axe-core) : visite focus avec « Plus tard » puis reprise ; un
  tutoriel complet (modèle de rétroplanning) ; recherche par nom de client, numéro de devis et
  mot d'aide ; centre d'aide ; suivi Admin.
