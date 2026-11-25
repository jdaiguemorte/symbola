# H-IX — Interaction et formulaires (lot 68, phase 2)

Version 2, complétée après la coupure technique (remplace la version 1).

Abréviations des preuves :

- `A/` = `(captures hors dépôt)/nav/spec-IX-a/` : mes captures de la première séance (003 à 052) ;
- `B/` = `(captures hors dépôt)/nav/spec-IX-b/` : mes captures après la reprise (001 à 018, 053 à 059) ;
- `R/` = `(captures hors dépôt)/releve/` : captures et mesures du relevé.

Le dossier `nav/spec-IX/` d'origine a été en partie réécrit à la relance du navigateur : seules les
copies `A/` et `B/` font foi.

## 1. Ce que j'ai regardé

**Dans l'app, 1 440 × 900, compte Camille** : « Aujourd'hui » (coche « Fait », message, annulation,
rechargement) ; « Tâches » (liste, filtres cumulés, sélection groupée, menu « Reporter », clic sur
l'échéance, fenêtre « Modifier la tâche » avec erreur provoquée, formulaire « Tâches hors évènement »
envoyé vide puis rempli, suppression) ; fiche du mariage de référence (en-tête, « Prochaine action »,
panneau « Modifier les informations ») ; `/events/new` (envoi vide, brouillon retrouvé après
rechargement, création) ; fiche d'un évènement créé par moi (frise de statut, « Annuler
l'évènement… », sans confirmer) ; « Créer » de la barre du haut et sa fenêtre « Nouvelle tâche »
(envoi sans évènement) ; `/prestataires/nouveau` (envoi vide, adresse web fausse, création, rubrique
suivante) ; corbeille. **En 375 × 812** : `/events/new` et `/prestataires/nouveau`. **Compte
Martine** : `/import`, reprise de l'import en cours, « Continuer » sans avoir décidé, « Abandonner
l'import » jusqu'à la question (répondu non). **Lu sur les captures du relevé** : liste des
évènements, carnet, « Tâches » en 375 px, écran « Import terminé », pleine hauteur de la Synthèse et
de `/events/new`.

**Pas regardé** : la suppression d'un évènement et son retour depuis la corbeille (interdit de
supprimer) ; l'annulation effective d'un import terminé (le bloc « Annuler cet import » n'a pas été
ouvert) ; les étapes « Colonnes » et « Types » de l'assistant ; l'ajout d'une tâche depuis l'onglet
Rétroplanning ; l'archivage d'un prestataire ; les filtres du carnet en action ; la taille 911 × 512 ;
l'enregistrement automatique en cours de frappe (je n'ai vu que le brouillon retrouvé). Budget :
environ 85 commandes de navigateur en trois séances, dont 25 après la reprise.

**Traces laissées dans les espaces partagés** : chez Camille, un évènement « Essai-IX » (statut
Option), un prestataire « Essai IX Fleurs », et deux tâches du mariage de référence cochées faites
(« Organiser la dégustation finale », « Activer le mode Jour J »). Chez Martine, rien : l'import en
cours est intact.

## 2. Hypothèses

### H-IX-01 — Une tâche hors évènement se supprime sans confirmation, sans annulation, sans corbeille
- Écran et taille : `/taches`, bloc « Tâches hors évènement », 1 440 px
- Constat : un clic sur « Supprimer » fait disparaître la ligne aussitôt : aucun message, aucun « Annuler ». Le message « Tâche ajoutée. » de l'ajout précédent reste affiché au-dessus. La corbeille, ouverte ensuite, est vide.
- Preuve : `A/012.jpg` (avant), `A/013.jpg` (après), `B/015.jpg` (corbeille vide)
- Gravité présumée : bloque
- Qui bute : toute planner qui clique à côté de « Fait » (les deux boutons sont à 20 px l'un de l'autre) ; elle perd une tâche récurrente (TVA, assurance) et lit un message qui dit l'inverse.
- Principe candidat : toute suppression rend un message qui la nomme et un « Annuler » de dix secondes, sans exception.

### H-IX-02 — Dans l'assistant d'import, « Continuer » reste actif et ne répond rien
- Écran et taille : `/import/[id]/rapprochements`, 25 rapprochements à décider, 1 440 px
- Constat : « Continuer » est plein, vert, fixé en bas à droite. Cliqué, il rend le même écran, même adresse, défilement à 0, sans message nouveau. La raison (« L'import ne peut pas être confirmé tant qu'il en reste ») est dans un bandeau à 380 px au-dessus, déjà là avant le clic.
- Preuve : `B/057.jpg` (après le clic) ; `R/import/shots/import_importId_rapprochements--1440-haut.jpg` (avant : identique)
- Gravité présumée : freine
- Qui bute : la planner qui reprend son carnet ; elle clique le seul bouton plein, rien ne bouge, elle croit l'app en panne. La page fait 12 279 px : le bandeau sort vite de l'écran.
- Principe candidat : un bouton qui ne peut pas aboutir est grisé avec sa raison à côté, ou répond à l'endroit du clic.

### H-IX-03 — La fiche d'un évènement empile huit groupes de commandes avant le contenu, sans action principale
- Écran et taille : `/events/[id]`, 1 440 px, premier écran
- Constat : de haut en bas : barre du haut ; lien de retour ; liste « Type d'événement » et « Changer le type » (deux clics pour un réglage rare, une ligne entière à demeure) ; quatre boutons égaux (« Messages », « Écrire au client », « Voir comme Léa Martin », « Jour J ») ; frise à quatre étapes cliquables ; « Reporter l'évènement… » et « Annuler l'évènement… » ; huit onglets ; « Prochaine action » à 552 px. Aucun bouton plein. « Modifier les informations » est à 2 160 px.
- Preuve : `A/034.jpg` ; `R/camille/shots/events_id_--1440.jpg` ; relevé : 10 zones (`R/camille/releve.json`, clé `/events/[id]`)
- Gravité présumée : freine
- Qui bute : la planner qui ouvre la fiche vingt fois par jour ; celle qui veut corriger la date ou le lieu cherche « Modifier » en haut et ne le trouve pas.
- Principe candidat : l'en-tête d'un objet porte son nom, son statut, une action principale, « Modifier » et un menu « Autres actions » ; rien d'autre.

### H-IX-04 — « Modifier les informations » : six boutons d'enregistrement dans un seul panneau
- Écran et taille : `/events/[id]?onglet=apercu&modifier=infos`, 1 440 px
- Constat : chaque champ a son bouton plein : « Changer la date », « Enregistrer le fuseau », « Enregistrer le budget souhaité », « Enregistrer le lieu », puis « Enregistrer la fiche » et « Enregistrer les notes ». Quatre boutons pleins dans la première hauteur du panneau. Pas de « Annuler », une croix seule. « Changer la date » double « Reporter l'évènement… » de l'en-tête.
- Preuve : `A/038.jpg` ; libellés dans `R/camille/releve.json`, clé `/events/[id]?onglet=apercu&modifier`
- Gravité présumée : freine
- Qui bute : la planner qui corrige la date et le lieu d'un coup ; elle enregistre le lieu, ferme, et la date n'a pas changé.
- Principe candidat : un panneau d'édition, un seul « Enregistrer » en bas, « Annuler » à sa gauche.

### H-IX-05 — Les erreurs de saisie sont celles du navigateur, une à la fois, dans sa langue
- Écran et taille : `/taches`, `/events/new`, « Créer › Tâche », `/prestataires/nouveau`, 1 440 px
- Constat : sur les quatre formulaires, un envoi fautif affiche la bulle du navigateur (« Please fill out this field. », « Please select an item in the list. », « Please enter a URL. » dans le mien). Elle recouvre le libellé ou le bouton voisin. Sur `/events/new`, la page remonte et colle le champ fautif au bord haut, libellé hors de l'écran ; « Source du prospect », vide aussi, n'est pas signalée.
- Preuve : `A/009.jpg`, `A/040.jpg`, `B/006.jpg`, `B/008.jpg`, `B/011.jpg`
- Gravité présumée : freine
- Qui bute : la planner dont le navigateur n'est pas en français ; toute planner qui corrige deux champs en deux envois.
- Principe candidat : l'erreur est écrite par l'app, en français, sous le champ, toutes à la fois, le premier champ fautif visible avec son libellé.

### H-IX-06 — Trois formulaires pour créer une tâche, aucun ne fait tout, aucun n'est sur l'écran « Tâches »
- Écran et taille : `/taches`, « Créer › Tâche », 1 440 px
- Constat : le premier écran de « Tâches » n'a pas de bouton de création (seul « Réglages » en haut à droite). Le formulaire du bas, à 1 600 px, ne crée que des tâches sans évènement. « Créer › Tâche », dans la barre du haut, exige un évènement. Le troisième est dans le Rétroplanning de chaque fiche (non regardé).
- Preuve : `A/007.jpg`, `A/008.jpg`, `B/003.jpg`, `B/006.jpg`
- Gravité présumée : freine
- Qui bute : celle qui pense « j'ajoute une tâche » depuis la liste des tâches ; elle doit savoir d'avance si la tâche a un évènement pour choisir sa porte.
- Principe candidat : une liste porte en haut à droite le bouton qui crée un élément de cette liste, par un seul formulaire où l'évènement est facultatif.

### H-IX-07 — « Reporter », dans « Prochaine action », ne dit pas ce qu'il reporte
- Écran et taille : `/events/[id]` (Synthèse), 1 440 px
- Constat : « Reporter » est posé seul, à gauche, sous la troisième ligne (un contrat à faire signer, qui n'est pas une tâche). Il ouvre « Nouvelle date » et un bouton plein « Reporter la tâche », sans la nommer. Les « Fait » sont à droite, à 900 px de là. Plus haut, « Reporter l'évènement… » reporte tout le mariage.
- Preuve : `A/034.jpg`, `A/036.jpg`
- Gravité présumée : freine
- Qui bute : toutes ; on ne valide pas une date sans savoir pour quoi.
- Principe candidat : une action de ligne vit sur sa ligne ; un bouton hors ligne nomme son objet.

### H-IX-08 — Sept cibles par ligne de tâche, onze « Supprimer » rouges au premier regard
- Écran et taille : `/taches`, 1 440 px
- Constat : chaque ligne porte une case carrée (sélection, sans libellé), un rond (« Fait ») à 68 px, le titre (lien), l'échéance (cliquable), « Modifier », « Reporter ▾ », « Supprimer » cerclé de rouge. Le rouge, onze fois, est la couleur la plus présente de l'écran.
- Preuve : `A/007.jpg` ; relevé L1
- Gravité présumée : freine
- Qui bute : la planner pressée ; elle coche la case en croyant cocher la tâche. **Dépend de la couleur** : un orange de marque et le rouge de danger se disputeront sur chaque ligne.
- Principe candidat : une ligne montre une action, la plus fréquente, et un menu « ⋯ » ; « Supprimer » n'est jamais à demeure sur une ligne.

### H-IX-09 — La barre d'actions groupées pousse la liste de 74 px sous le curseur
- Écran et taille : `/taches?vue=toutes`, 1 440 px
- Constat : cocher une première case insère « 1 tâche sélectionnée » au-dessus du tableau ; toutes les lignes descendent de 74 px. Mon second clic, à l'emplacement de la deuxième case, est tombé à côté.
- Preuve : `A/018.jpg` (avant), `A/020.jpg` (après)
- Gravité présumée : freine
- Qui bute : celle qui sélectionne plusieurs tâches à la suite, soit tout usage de la sélection.
- Principe candidat : rien ne déplace le contenu sous le curseur ; une barre de sélection se pose dans un espace réservé ou par-dessus.

### H-IX-10 — Le menu « Reporter » ne se referme pas
- Écran et taille : `/taches`, 1 440 px
- Constat : une fois ouvert, ni Échap (trois fois), ni un clic ailleurs, ni l'ouverture de « Modifier la tâche » ne le referment. Il reste lisible à travers le voile de la fenêtre et masque « Modifier » et « Reporter » des deux lignes suivantes. Son champ « Choisir une date » est prérempli à la date déjà dépassée (20/11) : « Reporter à cette date » ne reporterait rien.
- Preuve : `A/022.jpg`, `A/026.jpg`, `A/027.jpg`
- Gravité présumée : freine
- Qui bute : toutes ; on ouvre par curiosité, on ne sait plus sortir sans choisir.
- Principe candidat : un menu se referme par Échap, par un clic dehors et à l'ouverture d'un autre calque ; une valeur par défaut n'est jamais sans effet.

### H-IX-11 — Annuler un évènement : bouton vert plein, sans sortie
- Écran et taille : `/events/[id]`, clic sur « Annuler l'évènement… », 1 440 px
- Constat : le lien rouge ouvre une carte entre la frise et les onglets, qui les pousse de 330 px. Le bouton d'exécution, « Annuler l'évènement », est plein et vert : la forme de l'action principale. La carte n'a ni « Ne pas annuler » ni croix.
- Preuve : `A/052.jpg`
- Gravité présumée : freine
- Qui bute : toutes ; le geste le plus lourd de la fiche a la forme la plus engageante, quand supprimer une tâche est cerclé de rouge. **Dépend de la couleur.**
- Principe candidat : une action lourde a une forme de danger, une phrase qui dit ce qui se passe, et un bouton de renoncement à côté.

### H-IX-12 — Import : trois traitements en lot aux libellés voisins, tous de même poids
- Écran et taille : `/import/[id]/rapprochements`, 1 440 px
- Constat : « Valider les 25 rapprochements proposés », « Créer les 25 lignes comme nouvelles » et, 80 px plus bas, hors du bandeau, « Tout accepter (25 propositions sûres) ». Trois boutons secondaires. Rien ne dit en quoi le premier et le troisième diffèrent, ni lequel est conseillé ; « créer comme nouvelles » ferait 25 doublons.
- Preuve : `B/057.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui réimporte son carnet ; un clic sur le mauvais bouton double tout son carnet.
- Principe candidat : devant un choix en lot, une option conseillée (bouton principal), les autres en retrait, et l'effet chiffré de chacune.

### H-IX-13 — Un import en cours ne se retrouve qu'en bas de `/import`, par un mot dans un tableau
- Écran et taille : `/import`, compte Martine, 1 440 px
- Constat : le premier écran montre un tutoriel (seul bouton plein : « Commencer le tutoriel ») et quatre cartes « Reprendre mes… ». Les deux imports en cours sont dans « Journal des imports », à 523 px de défilement ; leur reprise est le mot « Reprendre » dans la colonne « État ». « Reprendre » veut dire ici « continuer », et dans les cartes « importer ».
- Preuve : `B/054.jpg`, `B/055.jpg`
- Gravité présumée : freine
- Qui bute : la planner interrompue en pleine reprise ; elle revient, voit « Que voulez-vous reprendre ? » et recommence un import : d'où 25 doublons à décider.
- Principe candidat : un travail en cours s'annonce en haut de l'écran d'où on l'a lancé, avec un bouton « Continuer ».

### H-IX-14 — Créer un prestataire : la page devient une fenêtre « modifier », et la rubrique 2 est une impasse
- Écran et taille : `/prestataires/nouveau` puis `/prestataires/[id]?modifier=1&rubrique=trades`, 1 440 px
- Constat : « Créer, puis Métiers et étiquettes » quitte la page « Nouveau prestataire » pour une fenêtre posée sur la fiche, titrée « Essai IX Fleurs : modifier ». Aucun message ne dit que la fiche est créée. La rubrique 2 affiche « Aucun métier au carnet pour l'instant : ajoutez-en dans les réglages des prestataires. », sans lien ni champ. Quatre sorties : « Fermer », « Précédent », « Enregistrer et fermer », « Suivant : Coordonnées ».
- Preuve : `B/011.jpg`, `B/014.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui saisit son premier prestataire ; elle ne peut pas dire qu'il est fleuriste sans quitter la saisie.
- Principe candidat : un parcours en étapes garde le même cadre du début à la fin ; une liste vide dans un formulaire permet d'y ajouter sur place.

### H-IX-15 — « Créer le prospect » : le formulaire ne parle pas d'évènement
- Écran et taille : `/events/new`, 1 440 px
- Constat : on arrive par « Nouveau » dans « Évènements » ; l'écran s'intitule « Nouveau prospect », le bouton est « Créer le prospect », un champ obligatoire est « Source du prospect », placé après les champs facultatifs du second client.
- Preuve : `A/039.jpg`, `R/camille/shots/events_new--1440.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui reprend un mariage déjà signé ; elle doit le déclarer prospect, lui inventer une source, puis lui faire franchir les statuts.
- Principe candidat : le titre et le bouton d'un formulaire reprennent le mot du bouton qui y mène ; les champs obligatoires viennent d'abord.

### H-IX-16 — « Tâches » au téléphone : actions de ligne hors écran, deux filtres mêlés sur trois rangées
- Écran et taille : `/taches`, 375 px
- Constat : les six pastilles passent à la ligne sans égard pour leur groupe (« Tout le monde » et « Planner » sur une rangée, « Mariés » seul dessous). Le tableau est coupé à la quatrième colonne (« CA ») : « Modifier », « Reporter », « Supprimer » ne se voient pas sans défiler de côté. La première tâche arrive à 730 px.
- Preuve : `R/camille/shots/taches--375-haut.jpg` ; relevé L2 (40 cibles de moins de 44 px)
- Gravité présumée : freine
- Qui bute : la planner en rendez-vous, téléphone en main, qui veut reporter une tâche.
- Principe candidat : au téléphone, une ligne de liste est une carte : titre, date, coche, et un menu pour le reste.

### H-IX-17 — Quatre façons de demander confirmation
- Écran et taille : fiche d'évènement, assistant d'import, « Tâches », 1 440 px
- Constat : changer de statut : bandeau « Passer l'événement en… ? » sous la frise, « Confirmer » (bouton neutre) et « Annuler » (mot vert). Annuler un évènement : carte, bouton vert plein, pas de refus. Abandonner un import : carte en haut de page qui pousse tout de 199 px, « Oui, abandonner » (bouton neutre) et « Non, continuer » (lien). Supprimer une tâche : aucune question.
- Preuve : `A/050.jpg`, `A/052.jpg`, `B/058.jpg`, `A/013.jpg`
- Gravité présumée : gêne
- Qui bute : toutes ; il faut relire chaque question pour savoir quel bouton engage.
- Principe candidat : une seule fenêtre de confirmation : la question, la conséquence, le bouton d'action nommé par son verbe à droite, « Ne pas… » à sa gauche.

### H-IX-18 — « Annuler » a trois sens
- Écran et taille : transverse, 1 440 px
- Constat : « Annuler » défait la dernière action (message noir), sort d'un formulaire sans enregistrer (fenêtre de tâche, bandeau de statut), et annule un mariage (« Annuler l'évènement… ») ou un import (« Annuler cet import »). Dans le bandeau de statut, « Annuler » est à 73 px sous « Annuler l'évènement… ».
- Preuve : `A/003.jpg`, `A/027.jpg`, `A/050.jpg`, `R/repris/shots/import_importId_journal--1440.jpg`
- Gravité présumée : gêne
- Qui bute : la débutante, devant un mot qui peut tout défaire ou ne rien faire.
- Principe candidat : « Annuler » = défaire ce qui vient d'être fait ; « Fermer » pour sortir ; un mot métier pour l'évènement.

### H-IX-19 — « Reporter » a trois objets et trois formes, et un second nom
- Écran et taille : `/taches`, `/events/[id]`, 1 440 px
- Constat : « Reporter ▾ » (menu, ligne de tâche), « Reporter » (pastille, « Prochaine action »), « Reporter l'évènement… » (lien souligné). Dans la sélection groupée, le même geste s'appelle « Décaler de… ».
- Preuve : `A/022.jpg`, `A/034.jpg`, `A/020.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui apprend l'app.
- Principe candidat : un verbe, un geste, une forme ; l'objet est dit quand le verbe peut en viser deux.

### H-IX-20 — « Créer », en haut, n'offre ni évènement ni prestataire, et les écrans disent « Nouveau »
- Écran et taille : barre du haut, `/events`, `/prestataires`, 1 440 px
- Constat : « + Créer » (bouton à contour) ouvre « Prospect », « Tâche », « Dépense », « Devis », sous la mention « Raccourci : touche N ». Ni « Évènement », ni « Prestataire », ni « Contact ». Les écrans créent par « Nouveau ▾ » et « Nouveau prestataire » (boutons pleins), les formulaires par « Ajouter la tâche » et « Créer le prospect ».
- Preuve : `B/002.jpg`, `R/camille/shots/events--1440-haut.jpg`, `R/camille/shots/prestataires--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui veut créer un mariage depuis « Aujourd'hui » : le menu ne connaît que « Prospect ».
- Principe candidat : « Créer » liste les objets par le nom de leur écran ; un seul verbe de création dans toute l'app.

### H-IX-21 — Trois chemins pour changer une échéance, dont un caché
- Écran et taille : `/taches`, 1 440 px
- Constat : « Reporter ▾ », « Modifier », et un clic sur la date, qui devient un champ. Ce troisième chemin n'a pour signe qu'une icône de 12 px. À l'ouverture, les colonnes se recalent : le titre voisin passe de deux à trois lignes. Après Échap, la date reste encadrée.
- Preuve : `A/024.jpg`, `A/026.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui clique sur la ligne pour l'ouvrir et tombe dans un calendrier.
- Principe candidat : une valeur modifiable sur place le montre, et s'ouvre sans déplacer ses voisines.

### H-IX-22 — L'erreur de la fenêtre de tâche est loin du champ et emploie un autre mot
- Écran et taille : `/taches?tache=…`, « Modifier la tâche », 1 440 px
- Constat : le champ s'appelle « Tâche * ». Vidé puis enregistré : « Le libellé est obligatoire. » en bas, sous « * obligatoire », à 280 px du champ, qui ne change pas d'aspect.
- Preuve : `A/032.jpg`
- Gravité présumée : gêne
- Qui bute : toutes ; il faut relier « libellé » à « Tâche ».
- Principe candidat : l'erreur reprend le libellé du champ, s'affiche sous lui, et le champ est marqué.

### H-IX-23 — Deux filtres sur une rangée, sans séparation, sans compte, sans remise à zéro
- Écran et taille : `/taches`, 1 440 px
- Constat : « À faire / En retard / Toutes » et « Tout le monde / Planner / Mariés » sont six pastilles identiques, à 8 px d'intervalle, deux d'entre elles actives. Avec « Toutes » et « Mariés », le sous-titre dit toujours « 9 tâches à faire · 2 en retard » ; aucun « Tout afficher ».
- Preuve : `A/007.jpg`, `A/018.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui revient sur l'écran filtré et croit qu'il lui manque des tâches.
- Principe candidat : chaque groupe de filtres a son libellé ; l'écran dit combien de lignes il montre sur combien, et offre « Tout afficher ».

### H-IX-24 — Trois dessins de bascule, dont un qui imite le bouton principal
- Écran et taille : `/`, `/taches`, `/events`, 1 440 px
- Constat : « Liste / Calendrier », « Liste / Colonnes / Calendrier » et « À venir / Terminés / Archivés » marquent l'option active d'un fond vert plein, comme « Nouveau ». Les filtres de « Tâches » la marquent d'un fond vert pâle. « Mois / Semaine / Liste », sur « Aujourd'hui », ne marquent rien. Sur `/events`, trois fonds verts pleins dans le premier écran.
- Preuve : `B/002.jpg`, `A/007.jpg`, `R/camille/shots/events--1440-haut.jpg`
- Gravité présumée : gêne
- Qui bute : toutes ; sur « Aujourd'hui » on ne sait pas quelle vue on regarde, sur « Évènements » on ne sait pas quel vert est l'action. **Dépend de la couleur.**
- Principe candidat : une bascule, un dessin, option active toujours marquée, jamais avec le fond du bouton principal.

### H-IX-25 — Deux retours après action, à deux endroits, dont un qui ne s'efface pas
- Écran et taille : `/taches`, 1 440 px
- Constat : cocher une tâche rend un message noir, centré en bas de la fenêtre, dix secondes, avec « Annuler ». Ajouter une tâche hors évènement rend une pastille verte « Tâche ajoutée. » sous le bouton, sans annulation, encore là après une suppression, une coche et une annulation.
- Preuve : `A/012.jpg`, `A/013.jpg`, `A/014.jpg`, `A/016.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui cherche la confirmation là où elle l'a vue la fois d'avant.
- Principe candidat : un seul emplacement pour le retour après action, un seul dessin, effacé à l'action suivante.

### H-IX-26 — « Fait » : un bouton ici, un rond là ; « Ouvrir » et « Rouvrir »
- Écran et taille : `/`, `/events/[id]`, `/taches`, 1 440 px
- Constat : la même coche est un bouton « Fait » de 46 × 32 px sur « Aujourd'hui », de 48 × 44 px dans « Prochaine action », un rond vide dans « Tâches », un bouton « Fait » dans « Tâches hors évènement ». « Ouvrir » (voir une tâche confiée au client) et « Rouvrir » (remettre à faire) diffèrent d'une lettre.
- Preuve : `B/002.jpg`, `A/034.jpg`, `A/007.jpg`, `A/012.jpg`, `A/018.jpg`
- Gravité présumée : gêne
- Qui bute : toutes ; le geste le plus fréquent de l'app n'a pas de forme stable.
- Principe candidat : « marquer fait » est une coche, la même partout, à gauche de la ligne.

### H-IX-27 — Le danger n'a pas de forme stable
- Écran et taille : `/taches`, `/prestataires`, fiche d'évènement, 1 440 px
- Constat : « Supprimer » est cerclé de rouge dans la liste des tâches, neutre 400 px plus bas (là où il n'y a pas d'annulation), et « Supprimer l'évènement » est un petit lien vert en bas de la Synthèse. « Archiver », dans le carnet, est un lien noir souligné sous chaque nom. « Annuler l'évènement… » est un lien rouge.
- Preuve : `A/012.jpg`, `R/camille/shots/events_id_--1440.jpg`, `R/camille/shots/prestataires--1440-haut.jpg`, `A/034.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui se fie à la couleur pour mesurer le risque. **Dépend de la couleur.**
- Principe candidat : une action destructrice a une seule forme, proportionnée au risque réel.

### H-IX-28 — L'astérisque tombe seul sur une ligne ; trois conventions pour « obligatoire »
- Écran et taille : `/events/new`, `/taches`, « Créer › Tâche », 1 440 px
- Constat : « Type d'événement », « Prénom du premier marié » et « Source du prospect » ont leur « * » à la ligne, sous le libellé. Le second client écrit « (facultatif) » ; « Date », « Nom », « Lieu », « Ville » ne disent rien. « Tâches hors évènement » et « Nouvelle tâche » ne marquent aucun champ, alors que trois y sont obligatoires. « Nouveau prestataire » colle l'astérisque au libellé.
- Preuve : `A/039.jpg`, `A/008.jpg`, `B/003.jpg`, `B/008.jpg`
- Gravité présumée : gêne
- Qui bute : toutes ; un libellé de champ sur deux lignes en 1 440 px, hors seuil.
- Principe candidat : une seule convention : on marque la minorité, et la marque est collée au libellé.

### H-IX-29 — La fin de `/events/new` : bouton à 1 610 px, pas d'« Annuler », un bouton concurrent juste au-dessus
- Écran et taille : `/events/new`, 1 440 px
- Constat : la page fait 1 794 px pour neuf champs, tous larges de 576 px (la date et la ville comme le lieu ; la recherche de client dépasse de 92 px). « Créer le prospect » est en bas à gauche. Juste au-dessus, une astuce porte « Créer un modèle pour « Mariage » », plus large que lui. Ni « Annuler » ni lien de retour.
- Preuve : `R/camille/shots/events_new--1440.jpg`, `A/039.jpg`, `A/047.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui clique le premier bouton rencontré en fin de formulaire. Je suppose, sans l'avoir cliqué, qu'il quitte le formulaire.
- Principe candidat : la fin d'un formulaire ne porte que « Annuler » et le bouton principal ; la largeur d'un champ annonce ce qu'on y écrit.

### H-IX-30 — Le brouillon est retrouvé, mais « Reprendre » n'a pas l'air d'un bouton
- Écran et taille : `/events/new` après rechargement, 1 440 px
- Constat : « Brouillon du 25 novembre 2026 à 00:26 retrouvé. » ; « Reprendre » est un mot vert en gras, sans cadre ni soulignement ; « Effacer le brouillon », plus petit, est souligné. Les champs restent vides tant qu'on n'a pas cliqué. Après « Reprendre », les valeurs reviennent (vu : « Château d'essai »).
- Preuve : `A/044.jpg`, `A/047.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui revient après une coupure ; elle voit des champs vides et retape.
- Principe candidat : l'action attendue est un bouton ; le renoncement est le plus discret des deux.

### H-IX-31 — Après une création, aucune confirmation
- Écran et taille : `/events/new` puis `/events/[id]` ; `/prestataires/nouveau` puis fiche, 1 440 px
- Constat : la fiche de l'évènement créé s'ouvre sans message ; dans mon navigateur, à 894 px de défilement, au milieu de « Santé de l'évènement » (à confirmer en phase 3 : cela peut tenir à l'outil). Le prestataire créé ne reçoit pas de message non plus.
- Preuve : `A/048.jpg`, `B/014.jpg`
- Gravité présumée : gêne
- Qui bute : la débutante, qui ne sait pas si l'objet existe.
- Principe candidat : une création rend le même message que toute action, et ouvre l'objet en haut de page.

### H-IX-32 — « Rien à faire » et « Prochaine étape : envoyer le devis » l'un sous l'autre
- Écran et taille : `/events/[id]`, évènement neuf, 1 440 px
- Constat : « Prochaine action — Rien à faire pour le moment : tout est à jour. » est suivi du bandeau « Prochaine étape : envoyer le devis ». Son bouton « Préparer le devis » fait 909 px de large, texte à gauche ; « Plus tard » est un mot nu à droite.
- Preuve : `A/049.jpg`
- Gravité présumée : gêne
- Qui bute : toutes ; deux blocs répondent à la même question par non et par oui.
- Principe candidat : une seule « suite » par objet ; un bouton a la largeur de son libellé.

### H-IX-33 — La frise change le statut sans en avoir l'air, et confirme loin du clic
- Écran et taille : `/events/[id]`, 1 440 px
- Constat : les ronds de la frise sont des boutons (« Passer en… »), sans signe. Un clic sur l'étape 3 ouvre la question 175 px plus bas, boutons à 1 210 px du bord gauche, et pousse les onglets de 90 px. On peut sauter « Confirmé ».
- Preuve : `A/049.jpg`, `A/050.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui clique une étape pour en lire le détail.
- Principe candidat : un indicateur d'avancement se lit ; s'il agit, il le montre, et la question s'ouvre là où l'on a cliqué.

### H-IX-34 — La barre d'onglets est coupée sans le dire
- Écran et taille : `/events/[id]`, 1 440 px
- Constat : le septième onglet s'arrête à « Document », coupé par le bord ; le relevé compte huit onglets. Ni flèche ni fondu.
- Preuve : `A/049.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui cherche « Invités » et ne le voit pas.
- Principe candidat : une barre d'onglets tient dans la largeur, ou range le surplus dans « Plus ».

### H-IX-35 — Quatre cadres d'édition, quatre façons de sortir
- Écran et taille : `/taches?tache=…`, « Créer › Tâche », `/events/[id]?modifier=infos`, fiche de prestataire, 1 440 px
- Constat : « Modifier la tâche » : fenêtre centrée, « Fermer » en haut, « Annuler » et « Enregistrer » en bas à droite (deux mots pour sortir). « Nouvelle tâche » : « Fermer » en haut, « Ajouter la tâche » en bas à gauche, pas d'« Annuler ». Évènement : panneau à droite, sans voile, croix seule, six boutons. Prestataire : fenêtre large, « Précédent », « Enregistrer et fermer », « Suivant ».
- Preuve : `A/027.jpg`, `B/003.jpg`, `A/038.jpg`, `B/014.jpg`
- Gravité présumée : gêne
- Qui bute : toutes ; il faut réapprendre à sortir à chaque objet.
- Principe candidat : un seul cadre d'édition : titre, champs, « Annuler » et le bouton principal en bas à droite, croix en haut.

### H-IX-36 — « Nouveau prestataire » demande six réseaux sociaux avant le métier et le téléphone
- Écran et taille : `/prestataires/nouveau`, rubrique 1 sur 4, 1 440 px
- Constat : « Identité » aligne nom, SIRET, puis « Site web », « Instagram », « Facebook », « Pinterest », « LinkedIn », « X ». Le métier est en rubrique 2, le téléphone en 3. « abc » dans « Site web » est refusé par « Please enter a URL. » : il faut taper « https:// », que le champ montre en gris sans le fournir.
- Preuve : `B/008.jpg`, `B/011.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui note un fleuriste croisé sur un salon : nom, métier, téléphone ; elle tape « www.atelier.fr » et bute.
- Principe candidat : la première étape d'une création ne demande que ce qui identifie l'objet ; un champ d'adresse web accepte ce que l'on tape.

### H-IX-37 — Carnet : un champ de filtre réduit à un carré, rien pour appliquer ni remettre à zéro dans le premier écran
- Écran et taille : `/prestataires`, 1 440 px
- Constat : sous « Où ? », le champ fait 26 px de large ; « dans un rayon de » flotte sur un fond blanc à part. Cinq filtres sur deux rangées, sans bouton visible à leur suite. « À classer · 12 » est dit deux fois (pastille et bandeau). Le relevé liste une commande « Filtrer » que je n'ai pas située sur la capture ; filtres non essayés.
- Preuve : `R/camille/shots/prestataires--1440-haut.jpg` ; relevé L7
- Gravité présumée : gêne
- Qui bute : celle qui cherche un traiteur près du lieu : elle ne voit pas où écrire le lieu.
- Principe candidat : les filtres d'une liste tiennent sur une rangée, s'appliquent seuls, et montrent « Effacer » dès qu'un est actif.

### H-IX-38 — Les cartes de `/import` ne ressemblent pas à des commandes ; le seul bouton plein lance un tutoriel
- Écran et taille : `/import`, 1 440 px
- Constat : « Reprendre mes contacts », « … prestataires », « … événements », « Un autre fichier » sont quatre cartes de texte, sans bouton, flèche ni soulignement. Au-dessus, « Commencer le tutoriel » est plein. L'écran, titré « Importer des données », est rangé dans Paramètres › « Prestataires et données » › « Importer », à côté de « Reprendre un export ».
- Preuve : `B/054.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui arrive d'un autre outil : pour elle c'est le premier geste, pas un réglage, et rien n'a l'air cliquable.
- Principe candidat : une carte qui agit porte un bouton ; l'action principale d'un écran est sa tâche, pas son aide.

### H-IX-39 — « Annuler cet import » a la forme d'un détail à déplier
- Écran et taille : `/import/[id]/journal` (« Import terminé »), espace repris, 1 440 px
- Constat : sous le bilan, trois pastilles vertes de même dessin se suivent : « 3 colonnes gardées comme note », « Détails du journal (fichier, auteur, dates) », « Annuler cet import ». Rien ne dit jusqu'à quand l'annulation reste possible. « Revenir à mes prestataires » est donné deux fois (lien en haut, bouton). Bloc non ouvert.
- Preuve : `R/repris/shots/import_importId_journal--1440.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui vient d'importer 25 fiches de travers et cherche le retour en arrière.
- Principe candidat : l'annulation d'une opération en lot est un bouton nommé, avec son délai, près du bilan.

### H-IX-40 — Au téléphone, le bouton final est hors du pouce et les étapes passent avant le premier champ
- Écran et taille : `/events/new` et `/prestataires/nouveau`, 375 px
- Constat : `/events/new` fait 1 969 px ; « Créer le prospect » est tout en bas, rien n'est fixé. Sur `/prestataires/nouveau`, la liste des quatre rubriques occupe 220 px ; le premier champ arrive à 771 px sur 812. La recherche du haut est coupée (« Recher ») et montre « ⌘K ».
- Preuve : `B/017.jpg`, `B/018.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui saisit un prospect au téléphone après un appel.
- Principe candidat : au téléphone, le bouton principal d'un formulaire reste sous le pouce ; l'avancement tient en une ligne (« 1 sur 4 »).

### H-IX-41 — Le message d'annulation recouvre des commandes
- Écran et taille : `/`, 1 440 px
- Constat : après « Fait », le message noir (448 × 68 px) se pose à 740 px du haut, sur l'en-tête du calendrier : il masque les flèches de mois et « Aujourd'hui ». Texte d'environ 13 px. Après « Annuler », le message de retour tient sur deux lignes.
- Preuve : `A/003.jpg`, `A/016.jpg`
- Gravité présumée : détail
- Qui bute : celle qui enchaîne les coches et veut changer de mois.
- Principe candidat : le message d'annulation a une place réservée, toujours la même, hors des commandes.

### H-IX-42 — Tâches faites : trois marques, deux commandes pour un geste, un bouton rouge qui saute
- Écran et taille : `/taches?vue=toutes`, 1 440 px
- Constat : une tâche faite est barrée, porte « Faite » et un rond coché. Le rond coché et « Rouvrir » font la même chose. « Supprimer » passe de 1 273 px à 1 176 px d'abscisse selon la ligne.
- Preuve : `A/018.jpg`
- Gravité présumée : détail
- Qui bute : celle qui parcourt « Toutes ».
- Principe candidat : un état, une marque ; les actions de ligne gardent leur colonne.

### H-IX-43 — « Qui la réalise », « Responsable », « Qui s'en charge » ; « Priorité » sans effet visible
- Écran et taille : `/taches`, « Modifier la tâche », « Nouvelle tâche », 1 440 px
- Constat : la colonne « Qui la réalise » (sur deux lignes, valeurs « Planner », « Mariés ») devient « Responsable » dans la fenêtre et la sélection groupée, puis « Qui s'en charge » (« Vous », « Le client ») dans « Nouvelle tâche ». La fenêtre a un champ « Priorité » que la liste ne montre pas.
- Preuve : `A/007.jpg`, `A/020.jpg`, `A/027.jpg`, `B/003.jpg`
- Gravité présumée : détail
- Qui bute : celle qui règle une priorité et cherche son effet.
- Principe candidat : un champ porte le même nom et les mêmes valeurs dans la liste, les formulaires et les filtres ; un champ saisi se voit quelque part.

### H-IX-44 — Assistant d'import : « Retour / Continuer » ici, « Précédent / Suivant » là ; « Doublons », « rapprochements », « À vérifier »
- Écran et taille : `/import/[id]/rapprochements`, fenêtre du prestataire, 1 440 px
- Constat : l'assistant d'import avance par « Retour » et « Continuer », la fiche de prestataire par « Précédent » et « Suivant : Coordonnées ». L'étape 4 s'appelle « Doublons » dans la frise, « rapprochements » dans le texte, « À vérifier » dans le filtre. Dans la frise, « Colonnes » et « Types » sont soulignés, « Fichier » non. `/import` dit « Journal des imports », l'écran final « Historique des imports ».
- Preuve : `B/057.jpg`, `B/014.jpg`, `B/055.jpg`, `R/repris/shots/import_importId_journal--1440.jpg`
- Gravité présumée : détail
- Qui bute : celle qui suit l'aide et cherche le mot qu'elle vient de lire.
- Principe candidat : un parcours en étapes a une seule paire de verbes, et chaque étape un seul nom.

### H-IX-45 — « 6 points demandent votre attention » pour sept lignes
- Écran et taille : `/`, 1 440 px
- Constat : « À traiter en premier » liste 5 + 1 + 1 lignes et le sous-titre dit « 6 points ». Après une coche, 4 + 1 + 1 lignes, toujours « 6 points ».
- Preuve : `R/camille/shots/accueil--1440-haut.jpg`, `A/003.jpg`
- Gravité présumée : détail
- Qui bute : celle qui attend que le compteur baisse quand elle coche.
- Principe candidat : un compteur compte ce que l'écran montre, et bouge avec lui.

## 3. Principes de Design System recommandés

1. **Toute action se confirme au même endroit et s'annule dix secondes**, suppression comprise ; le message s'efface à l'action suivante.
2. **Un bouton répond toujours** : s'il ne peut pas aboutir, il est grisé avec sa raison à côté.
3. **Un formulaire, un « Enregistrer »** : en bas à droite, « Annuler » à sa gauche, dans un seul cadre d'édition pour toute l'app.
4. **L'erreur est écrite par l'app** : en français, sous le champ, avec le mot du libellé, toutes à la fois.
5. **Une ligne, une action visible, un menu** : « Supprimer » jamais à demeure ; « fait » est une coche, la même partout.
6. **Un verbe, un geste, une forme** : « Créer », « Reporter », « Annuler », « Supprimer », « Continuer » ont chacun un sens et un dessin ; l'objet est nommé quand il y a doute.
7. **Rien ne bouge sous le curseur** : barres, questions et champs en ligne s'ouvrent sans déplacer le contenu ; un calque se ferme par Échap et clic dehors.
8. **Une seule action principale par écran, et c'est la tâche de l'écran** : en haut à droite d'une liste pour créer, jamais un tutoriel, jamais une bascule de vue.
9. **Le danger a sa forme, à la mesure du risque réel**, et sa question : conséquence, verbe d'action, bouton de renoncement.
10. **Filtres et bascules : un dessin chacun**, groupe libellé, option active marquée, compte de ce qui est montré, « Tout afficher ».
