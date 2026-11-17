# Relevé du patron des écrans — liste, fiche, panneau latéral (UX-13, lot 39c, décision D13)

Date : 17/11/2026, par Claude Code. **Propositions validées par Julien le 17/11/2026** (« Je valide
le relevé UX-13 »). UX-13 veut, partout, la liste, puis la fiche, puis un panneau
latéral d'édition, avec les mêmes raccourcis, emplacements et libellés. Ce relevé borne le travail :
il dit quels écrans suivent déjà le patron et lesquels éditent encore en place.

## Raccourcis communs (faits au lot 39c)

| Touche | Effet | Où |
| --- | --- | --- |
| ⌘K ou Ctrl K | Rechercher, ou lancer une action (palette, HUB-12) | Tous les écrans de l'équipe |
| N | Créer (évènement, tâche, dépense, devis) | Tous les écrans de l'équipe (création rapide, lot 32b) |
| Échap | Fermer le panneau ou la fenêtre ouverte | Panneaux latéraux, fenêtres de confirmation |
| ? | Ouvrir l'aide de l'écran (ou le centre d'aide) | Tous les écrans de l'équipe |

Ils sont annoncés dans le centre d'aide (« Raccourcis clavier »).

## Écrans qui suivent le patron

- Modèles de rétroplanning et de programme : liste, fiche, panneau de création et de renommage.
- Carnet de prestataires : liste et carte, fiche en panneau.
- Paramètres des évènements, du carnet, des étiquettes : listes et panneaux d'édition.
- Rétroplanning d'un évènement : tableau des tâches, tâche en panneau (`?tache=`).

## Passages au panneau (faits au lot 39c, après validation)

| Écran | Avant | Maintenant |
| --- | --- | --- |
| Contacts (liste) | Création repliée dans la page | « Ajouter un contact » en tête de la liste ; le formulaire s'ouvre en panneau (`?nouveau=1`) |
| Fiche d'un contact | Coordonnées en formulaire dans la page | Lecture dans la page ; « Modifier la fiche », en tête de la section, ouvre le panneau (`?modifier=1`), enregistrement automatique gardé |
| Fiche d'un prestataire | Formulaire complet dans la page | Lecture (coordonnées, caractéristiques du type, évaluation, tarifs, note) ; « Modifier la fiche » ouvre le panneau (`?modifier=1`) |
| Fiche d'un évènement, synthèse | « Modifier les informations » replié dans la page | Le lien, en tête de la fiche d'identité, ouvre le panneau (`?modifier=infos`) |

Mêmes emplacements partout : « Créer » en tête de la liste, « Modifier » en tête de la section
qu'il modifie ; le panneau se ferme par « Fermer », Échap ou un clic hors de lui, et son état est
dans l'adresse (rechargement, retour arrière).

## Exceptions validées

| Écran | Pourquoi il garde la saisie dans la page |
| --- | --- |
| Budget d'un évènement | Tableur attendu par les planners ; le panneau sert à l'historique et aux pièces |
| Éditeur de devis | Un document en cours d'écriture, pas une fiche |
| Paramètres de l'organisation (entreprise, mentions, e-mails, messages) | Un réglage par page, sans liste |

## Suite

Un nouvel écran suit le patron (liste, fiche, panneau) ou s'ajoute aux exceptions, avec sa raison.
