# H-IA — Architecture de l'information et navigation (lot 68, phase 2)

Version 2 (complète). Une coupure technique a fermé mon navigateur en cours de route ; la version 1
a été écrite avant la reprise, puis complétée avec 25 commandes de navigateur.

## 1. Ce que j'ai regardé

**Dans l'app, en 1 440 × 900.** Espace rempli (`camille.roussel+spec@exemple.test`) : Aujourd'hui, le
menu « Créer », la recherche du haut (six recherches : « photographe », « Haddad », « relance »,
« import », « reprendre », « Léa »), une tâche ouverte depuis Aujourd'hui puis depuis `/taches`, la fiche
du mariage « Léa & Maxime » (onglets Rétroplanning, Budget et prestataires, Documents), les quatre
boutons « Réglages » (Rétroplanning, Budget et prestataires, Tâches, carnet), « Importer » depuis le
budget d'un mariage, le panneau d'un poste du budget, le carnet, l'aperçu et la fiche complète d'un
prestataire, le menu des Paramètres et son champ « Chercher un réglage ». Compte tout neuf
(`spec-IA-1@exemple.test`) : l'accueil avant le questionnaire, l'assistant de démarrage jusqu'à la
question 5, l'écran « Votre espace est prêt », l'accueil après. Espace repris
(`martine.vasseur@exemple.test`) : l'accueil seulement.

**Dans le relevé.** Captures de l'espace rempli (`accueil`, `parametres`, `events`, `events_id_`, `apps`,
`tutoriels`, `parametres_notifications` en 375 px, `accueil` en 375 px), de l'espace vide (`accueil`,
`demarrage_pret`), de l'inscription (`demarrage`), et les mesures du § 5.

**Dans le code.** `settings-menu.ts`, les libellés `SettingsMenu`, `Search`, `Palette`, `Onboarding` de
`fr.json`, la liste des onglets de `app/events/[id]/page.tsx`.

**Pas regardé.** La palette ouverte au clavier (⌘K) ; le menu « Nouveau » de la liste des évènements ;
le menu latéral replié et le tiroir « Menu » du téléphone ; la cloche ; `/aide` ; les onglets Synthèse,
Programme, Mariés, Invités dans l'app (Synthèse vue par la capture du relevé) ; la taille 911 × 512 ;
l'agence ; les écrans de l'assistant d'import après le choix du fichier ; la fiche du mariage repris.
Mes commandes dans l'app sont toutes en 1 440 px : les constats en 375 px viennent des captures du relevé.

Abréviations des preuves :
- **NAV/** = `(captures hors dépôt)/nav/spec-IA/` ; `s1/` = première session (espace rempli), `s2/` = seconde session (compte neuf, espace repris).
- **REL/** = `(captures hors dépôt)/releve/`.

## 2. Hypothèses

### H-IA-01 — Deux onglets de la fiche sont hors de vue, et l'onglet ouvert peut ne pas se voir
- Écran et taille : `/events/[id]`, espace rempli, 1 440 × 900
- Constat : la fiche a huit onglets ; la barre s'arrête à « Mariés » (bord droit à 1 343 px sur 1 364). « Documents » et « Invités » sont au-delà, sans flèche ni fondu. Sur `?onglet=documents`, aucun onglet n'est marqué actif : seul un trait de quelques pixels dépasse à droite.
- Preuve : NAV/s1/047.jpg (onglet Documents ouvert, aucun onglet actif visible) ; NAV/s1/045.jpg ; `app/events/[id]/page.tsx` lignes 529 à 544 (huit onglets)
- Gravité présumée : bloque
- Qui bute : toute planner qui cherche le plan de table ou la liste des invités : elle ne sait pas que ces onglets existent ; celle qui y arrive par un lien ne sait plus où elle est. Dépend de la couleur : l'onglet actif n'est signalé que par un trait vert fin et un texte plus foncé.
- Principe candidat : une barre d'onglets montre tous ses onglets à la largeur de travail, ou dit combien il en reste ; l'onglet ouvert est toujours visible.

### H-IA-02 — L'assistant de démarrage ne propose jamais de reprendre des mariages en cours
- Écran et taille : `/demarrage?etape=5` puis `/demarrage/pret`, compte tout neuf, 1 440 × 900
- Constat : la question 5 demande « Que voulez-vous remplacer par Symbola ? » (« Un tableur », « Un autre logiciel de gestion »…) et promet : « Ce qui vous fera gagner le plus de temps passera en premier. » Après avoir coché « Un autre logiciel de gestion », l'écran « Et maintenant ? » n'offre que « Créer mon premier évènement » et « Explorer avec un exemple ». Ni le mot « importer », ni « reprendre ».
- Preuve : NAV/s2/demarrage-q5.jpg ; NAV/s2/demarrage-pret.jpg ; `fr.json`, `Onboarding.ready` (deux choix seulement)
- Gravité présumée : bloque (le parcours de reprise n'a pas de début)
- Qui bute : la planner qui arrive d'un autre outil avec quatre mariages en cours : elle vient de le dire, et on lui propose de saisir « mon premier évènement ».
- Principe candidat : une réponse donnée à l'assistant change la suite proposée ; un parcours central est offert dès le premier écran utile.

### H-IA-03 — La reprise a au moins six portes, aucune ne les liste toutes, et l'écran d'import en oublie une
- Écran et taille : `/events`, `/prestataires`, `/events/[id]?onglet=budget`, `/import`, recherche, 1 440 × 900
- Constat : « Importer » est un bouton de la liste des évènements, du carnet et de l'onglet « Budget et prestataires » ; ce dernier porte aussi « Reprendre les prestataires retenus (PDF) » ; l'onglet Programme a le sien (relevé) ; le menu des Paramètres a « Importer » ; la recherche a l'action « Importer un fichier ». L'écran d'import écrit : « Deux PDF sont repris ailleurs : les fiches d'évènement, par leur tuile ci-dessus, et le programme » : le PDF des prestataires retenus n'y est pas.
- Preuve : REL/camille/shots/events--1440-haut.jpg ; NAV/s1/060.jpg ; NAV/s1/045.jpg ; NAV/s1/052.jpg et le texte de la page ; NAV/s1/022.jpg
- Gravité présumée : freine
- Qui bute : la planner qui a quatre fichiers d'export : aucun écran ne lui dit l'ordre, ni que la liste est complète.
- Principe candidat : un parcours central a une porte unique qui liste toutes ses étapes, même si chaque étape vit ailleurs.

### H-IA-04 — Un espace neuf lit « Rien ne presse : tout est à jour », sans rien pour commencer ni reprendre
- Écran et taille : `/`, compte tout neuf après le questionnaire, et espace vide, 1 440 × 900
- Constat : sous « aucun évènement en cours · rien ne presse », le bloc « À traiter en premier » dit « Rien ne presse : tout est à jour. », puis un calendrier vide. Aucune action de création, aucun lien vers l'import. Le menu latéral n'a pas d'entrée « Importer » : elle est dans Paramètres › « Prestataires et données ».
- Preuve : NAV/s2/accueil-neuf.jpg et le texte de la page ; REL/vide/shots/accueil--1440-haut.jpg
- Gravité présumée : freine
- Qui bute : la planner qui a fermé l'écran « Votre espace est prêt » sans créer d'évènement : elle n'a plus d'invitation nulle part.
- Principe candidat : l'accueil d'un espace sans évènement propose deux actions : créer, ou importer ce que l'on a déjà.

### H-IA-05 — Après la reprise d'un mariage, « Aujourd'hui » affiche douze urgences nées de l'import
- Écran et taille : `/`, espace repris, 1 440 × 900
- Constat : « 1 évènement en cours · 12 points demandent votre attention ». Les sept lignes visibles sont « Contrat de <prestataire> à faire signer », toutes « Depuis le 24 novembre 2026 », avec « Noter une relance ». Les douze prestataires viennent du PDF des prestataires retenus ; la date est commune aux douze (celle de la reprise, à confirmer). Rien ne dit que ces points viennent d'un import.
- Preuve : NAV/s2/accueil-martine.jpg
- Gravité présumée : freine
- Qui bute : la planner dont les contrats sont signés depuis des mois : son premier « Aujourd'hui » est faux douze fois, et elle doit traiter chaque ligne une à une.
- Principe candidat : ce qui vient d'un import porte la marque « repris le… » et se règle en une fois (« déjà signé pour tous »).

### H-IA-06 — « Importer », depuis le budget d'un mariage, dépose la planner dans les Paramètres, sans retour
- Écran et taille : `/events/[id]?onglet=budget` → `/import?type=budget_lines&evenement=…`, 1 440 × 900
- Constat : la page s'ouvre dans les Paramètres (menu latéral sur « Paramètres », rubrique « Importer »), défilée de 692 px. En haut : une carte de tutoriel, puis quatre tuiles dont « Reprendre mes contacts » est encadrée alors que l'on importe des lignes de budget. Aucun lien « Retour à Léa & Maxime ».
- Preuve : NAV/s1/052.jpg et le texte de la page (« Les lignes iront dans l'évènement « Léa & Maxime » », aucun lien de retour)
- Gravité présumée : freine
- Qui bute : la planner qui reprend un mariage : elle part de la fiche, arrive dans les réglages de l'espace, et retrouve son mariage par le menu.
- Principe candidat : une action lancée depuis un objet reste dans cet objet, ou garde en haut un lien de retour qui le nomme.

### H-IA-07 — « Réglages », sur le budget d'un mariage, modifie les lignes de tous les futurs évènements
- Écran et taille : `/events/[id]?onglet=budget`, bouton « Réglages », 1 440 × 900
- Constat : le bouton ouvre un panneau « Lignes du budget par défaut » (« Chaque nouvel événement reçoit ces lignes »), avec « Modifier » et « Retirer » sur chaque ligne. Rien, sur le bouton, ne dit que l'on quitte « Léa & Maxime » pour un réglage de l'espace. Dans le même onglet, le poste a une étape « Réglages du poste » qui, elle, porte sur ce mariage.
- Preuve : NAV/s1/055.jpg (panneau) ; NAV/s1/058.jpg (« 5 Réglages du poste »)
- Gravité présumée : freine (risque d'erreur : retirer une ligne par défaut en croyant retirer celle du mariage)
- Qui bute : la planner qui veut ajouter ou retirer un poste pour ce mariage : elle lit les mêmes noms (« Traiteur », « Photographe ») et croit agir sur le mariage.
- Principe candidat : un bouton dit sa portée (« ce mariage » ou « tous les nouveaux évènements ») ; le mot « Réglages » seul est réservé au menu.

### H-IA-08 — La recherche du haut ne trouve aucun réglage
- Écran et taille : barre du haut, tout écran, 1 440 × 900
- Constat : « relance » rend une tâche et l'écran « Aujourd'hui », mais ni « Relances des prospects » ni « Relances de devis et de paiement ». « reprendre » rend « Aucun résultat… Essayez un nom de client, un numéro de devis ou un mot comme « TVA » », alors que « Reprendre un export » est une rubrique et « Reprendre mes événements » une tuile.
- Preuve : NAV/s1/018.jpg ; NAV/s1/keep-reprendre.jpg
- Gravité présumée : freine
- Qui bute : la planner qui ne sait pas dans lequel des cinq groupes est un réglage et tape son nom dans le seul champ présent partout.
- Principe candidat : la recherche globale trouve tout ce que le menu nomme : écrans, réglages, actions.

### H-IA-09 — Ouvrir une tâche depuis « Aujourd'hui » fait quitter « Aujourd'hui », sans chemin de retour
- Écran et taille : `/` → `/events/[id]?onglet=retroplanning&tache=…`, 1 440 × 900
- Constat : le titre d'une tâche d'« À traiter en premier » ouvre la fiche du mariage, onglet Rétroplanning, avec le panneau « Modifier la tâche ». « Fermer » laisse sur le Rétroplanning, vue « Toutes » (42 tâches, page de 5 220 px, tâches faites de mars 2026 en tête). Le seul lien de retour dit « ← Tous les événements ».
- Preuve : NAV/s1/032.jpg (panneau) ; NAV/s1/033.jpg (après « Fermer »)
- Gravité présumée : freine
- Qui bute : la planner qui traite ses urgences du matin : après chaque tâche, retour à « Aujourd'hui » par le menu.
- Principe candidat : fermer un panneau ramène à l'écran d'où il a été ouvert.

### H-IA-10 — « Tâches » ne se filtre pas par mariage, et le nom du mariage n'y est pas un lien
- Écran et taille : `/taches`, 1 440 × 900
- Constat : deux rangées de filtres (« À faire / En retard / Toutes », « Tout le monde / Planner / Mariés »), aucune par évènement. « Léa & Maxime », en gris sous chaque titre, n'ouvre pas le mariage : un clic dessus ouvre la tâche. Le seul lien vers le mariage est dans le panneau.
- Preuve : NAV/s1/070.jpg ; NAV/s1/073.jpg (clic sur le nom du mariage : adresse `/taches?…&tache=…`)
- Gravité présumée : freine
- Qui bute : la planner à plusieurs mariages et l'agence : la liste transverse ne se réduit pas à un mariage.
- Principe candidat : dans une liste transverse, le nom de l'objet parent est un lien et un filtre.

### H-IA-11 — Le groupe « Événements » des Paramètres : dix-huit rubriques de six natures
- Écran et taille : menu des Paramètres, 1 440 × 900
- Constat : dans l'ordre : Lignes du budget, Sources et motifs, Types d'événements, Plages occupées, Termes des clients, Étapes du pipeline, Formulaire de contact, Questionnaires, Rétroplanning, Catégories des tâches, Programme du jour J, Modèles d'évènement, Listes du jour J, Régimes et allergies, Types de repas, Prestataires par lien, Répartition du budget, Relances des prospects. Le budget est en 1re et 17e place, la prospection en 2e, 6e, 7e et 18e ; aucun sous-titre ; la liste dépasse les 900 px.
- Preuve : NAV/s1/039.jpg (liste coupée à « Prestataires par lien ») ; `settings-menu.ts` lignes 59 à 99
- Gravité présumée : freine
- Qui bute : toutes ; d'abord celle qui vient régler une seule chose et lit dix-huit lignes.
- Principe candidat : sept rubriques au plus par groupe ; au-delà, des groupes nommés d'après les écrans de travail (Prospects, Budget, Tâches, Jour J, Invités).

### H-IA-12 — « Créer » ne crée ni évènement ni prestataire
- Écran et taille : barre du haut, 1 440 × 900
- Constat : le menu propose « Prospect », « Tâche », « Dépense », « Devis ». Pas « Évènement », « Prestataire », « Contact » ni « Rendez-vous ». « Prospect » ouvre « Nouveau prospect » à quatre champs, sans statut. La liste des évènements a son propre bouton plein « Nouveau ▾ », le carnet « Nouveau prestataire » : trois mots pour créer.
- Preuve : NAV/s1/004.jpg ; NAV/s1/005.jpg ; REL/camille/shots/events--1440-haut.jpg ; NAV/s1/060.jpg
- Gravité présumée : freine
- Qui bute : la planner qui veut saisir un mariage déjà signé : le seul « Créer » présent partout ne connaît que le prospect.
- Principe candidat : le bouton global de création propose chaque objet que le menu latéral liste, dans l'ordre du menu, avec le même verbe que les écrans.

### H-IA-13 — Dans le budget d'un mariage, le nom du prestataire ne mène pas à sa fiche
- Écran et taille : `/events/[id]?onglet=budget`, 1 440 × 900
- Constat : « Maison Haddad », « Domaine des Tilleuls », « Studio Lumière » sont du texte noir sous le poste ; le poste, lui, est un lien souligné. Dans le panneau, « MAISON HADDAD » est un en-tête de colonne et « Déjà travaillé ensemble : 1 évènement » un texte. Pour le téléphone du traiteur, il faut le menu « Prestataires » ou la recherche. Le chemin inverse existe : la fiche du prestataire a un lien « Léa & Maxime » qui ouvre l'onglet du budget.
- Preuve : NAV/s1/045.jpg ; NAV/s1/058.jpg ; NAV/s1/067.jpg (lien retour vers le mariage)
- Gravité présumée : freine
- Qui bute : la planner au téléphone avec un client, qui veut appeler le traiteur du mariage ouvert.
- Principe candidat : le nom d'un objet qui a une fiche est toujours un lien vers cette fiche, dans les deux sens.

### H-IA-14 — Au-dessus des onglets, 510 px qui reviennent sur les huit onglets
- Écran et taille : `/events/[id]`, 1 440 × 900
- Constat : lien de retour, titre et statut, ligne de quatre faits, « Type d'événement » avec liste et « Changer le type », quatre boutons (« Messages », « Écrire au client », « Voir comme Léa Martin », « Jour J »), frise de cinq étapes, « Reporter l'évènement… » et « Annuler l'évènement… ». La barre d'onglets est à 511 px, le contenu à 552 px. Ce bloc revient à chaque changement d'onglet.
- Preuve : REL/camille/shots/events_id_--1440-haut.jpg ; NAV/s1/033.jpg
- Gravité présumée : freine
- Qui bute : toutes, à chaque onglet : il reste 350 px de travail sur 900.
- Principe candidat : l'en-tête d'une fiche tient en 160 px ; ce qui sert une fois (type, reporter, annuler) va dans un menu.

### H-IA-15 — Sur téléphone, chaque réglage s'ouvre sur le menu des Paramètres
- Écran et taille : `/parametres/notifications`, espace rempli, 375 × 812 (capture du relevé)
- Constat : le premier écran montre « Menu », la barre du haut, « Chercher un réglage », puis dix rubriques de « Mon entreprise », « Notifications » surlignée. Le réglage lui-même commence sous les 812 px. Le relevé compte 55 écrans de réglage sur 58 dans ce cas.
- Preuve : REL/camille/shots/parametres_notifications--375-haut.jpg ; relevé § 2 (« Téléphone »)
- Gravité présumée : freine (sur téléphone)
- Qui bute : la planner en déplacement qui suit un lien vers un réglage et croit être revenue au sommaire.
- Principe candidat : sur téléphone, le contenu passe avant la navigation ; le menu d'une section se replie en une ligne « Paramètres › Notifications ».

### H-IA-16 — La même tâche s'ouvre dans deux panneaux différents selon l'entrée
- Écran et taille : `/taches?tache=…` et `/events/[id]?onglet=retroplanning&tache=…`, 1 440 × 900
- Constat : depuis « Tâches », « Modifier la tâche » est une fenêtre de 576 px à quatre champs, avec « Léa & Maxime · Ouvrir le rétroplanning de l'évènement ». Depuis la fiche, le même titre coiffe une fenêtre de 860 px à quatre sections (« La tâche », « Rang et jalon », « Pièces jointes », « Commentaires de l'équipe »), sans le nom du mariage.
- Preuve : NAV/s1/073.jpg ; NAV/s1/032.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui cherche les pièces jointes d'une tâche depuis « Tâches » : elles n'y sont pas, rien ne dit qu'elles existent ailleurs.
- Principe candidat : un objet a un seul panneau, le même partout ; ce qui change selon l'entrée, c'est le lien de retour.

### H-IA-17 — « Tâches » et « Rétroplanning » : deux noms et quatre comptes pour le même objet
- Écran et taille : menu latéral, `/`, `/taches`, `/events/[id]`, 1 440 × 900
- Constat : la même liste s'appelle « Tâches » dans le menu, « Rétroplanning » dans la fiche. Les comptes diffèrent sans explication : « Tâches (5) » sur Aujourd'hui, « 9 tâches à faire » sur `/taches`, « 31 sur 42 tâches faites » sur la Synthèse (relevé du 24), « 33 tâches faites sur 42 » sur le Rétroplanning (le 25, après des gestes d'autres spécialistes peut-être).
- Preuve : NAV/s1/008.jpg ; NAV/s1/070.jpg ; NAV/s1/033.jpg ; REL/camille/shots/events_id_--1440.jpg
- Gravité présumée : gêne
- Qui bute : la débutante, qui se demande si le rétroplanning est autre chose que ses tâches ; celle qui compare « 5 » et « 9 ».
- Principe candidat : un objet a un nom ; sa vue dans un parent s'appelle « <objet> de <parent> » ; un compte dit ce qu'il compte.

### H-IA-18 — « Réglages » de « Tâches » et du Rétroplanning ouvre les modèles, pas les catégories
- Écran et taille : `/taches` et `/events/[id]?onglet=retroplanning`, bouton « Réglages », 1 440 × 900
- Constat : les deux boutons ouvrent le même panneau « Modèles de rétroplanning » (`/reglages/modeles`). La colonne « Catégorie » affiche « — » sur chaque ligne et la rubrique « Catégories des tâches » existe, mais le panneau n'y mène pas. De même, « Réglages » du carnet n'ouvre que « Familles et types de prestataires », pas Étiquettes, Trajets ni Pièces.
- Preuve : NAV/s1/076.jpg ; NAV/s1/037.jpg ; NAV/s1/062.jpg ; NAV/s1/039.jpg (menu)
- Gravité présumée : gêne
- Qui bute : la planner qui veut créer ses catégories après avoir vu la colonne vide.
- Principe candidat : le bouton de réglages d'un écran ouvre tous les réglages de cet écran, et seulement eux.

### H-IA-19 — Du panneau de réglages aux Paramètres, le mariage est perdu
- Écran et taille : `/reglages/modeles?retour=event` → `/events/modeles`, 1 440 × 900
- Constat : « Ouvrir tous les réglages » remplace la fiche par la page des Paramètres ; aucun lien ne ramène au mariage (le retour du navigateur le fait, en deux fois). Ouvrir directement l'adresse du panneau envoie sur `/events/modeles`.
- Preuve : NAV/s1/039.jpg ; NAV/s1/043.jpg (adresse rendue : `/events/modeles`) ; journal des commandes : retour 1 → panneau, retour 2 → fiche
- Gravité présumée : gêne
- Qui bute : la planner qui règle un modèle au milieu d'un dossier, puis cherche le dossier.
- Principe candidat : un écran ouvert depuis un autre garde un lien « Retour à <nom> » ; une adresse rouverte rend le même écran.

### H-IA-20 — Le libellé du menu et le titre de l'écran ne sont pas les mêmes mots
- Écran et taille : menu latéral, menu des Paramètres, titres, 1 440 × 900
- Constat : « Prestataires » → « Carnet de prestataires » ; « Rétroplanning » → « Modèles de rétroplanning » ; « Lignes du budget » → « Lignes du budget par défaut » ; « Types de prestataires » → « Familles et types de prestataires » ; « Importer » → « Importer des données ». La recherche nomme un écran « Sources, motifs et budget », libellé absent du menu.
- Preuve : NAV/s1/060.jpg ; NAV/s1/039.jpg ; NAV/s1/055.jpg ; NAV/s1/062.jpg ; NAV/s1/052.jpg ; NAV/s1/010.jpg
- Gravité présumée : gêne
- Qui bute : celle qui suit une aide ou une collègue (« va dans Modèles de rétroplanning ») et cherche ces mots dans le menu.
- Principe candidat : le titre d'un écran reprend mot pour mot l'entrée qui y mène.

### H-IA-21 — « Relances des prospects » et « Relances de devis et de paiement » : deux groupes, un mot, un troisième sens
- Écran et taille : menu des Paramètres et Aujourd'hui, 1 440 × 900
- Constat : la première est la dernière rubrique d'« Événements » (`/parametres/relances`), la seconde est dans « Ventes » (`/devis/relances`) et tient sur deux lignes. Sur Aujourd'hui, « Relances et messages » et « Noter une relance » portent sur un prestataire : un troisième sens, sans rubrique.
- Preuve : NAV/s1/080.jpg (les deux rubriques, la seconde sur deux lignes) ; NAV/s1/008.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui veut changer un délai de relance et ouvre la mauvaise rubrique.
- Principe candidat : deux rubriques voisines par le sens sont voisines dans le menu, et leur libellé commence par ce qui les distingue.

### H-IA-22 — « Prestataires et données » réunit le carnet, l'import, le RGPD et la fermeture de l'espace
- Écran et taille : menu des Paramètres, 1 440 × 900
- Constat : quatre rubriques du carnet (Types, Étiquettes, Estimation des trajets, Pièces), puis Importer, Données personnelles, Journal d'activité, Exporter mes données, Reprendre un export, Fermer l'espace, Stockage. Sept ne sont pas des réglages. « Fermer l'espace » est à 44 px de « Reprendre un export ».
- Preuve : NAV/s1/052.jpg (groupe ouvert)
- Gravité présumée : gêne
- Qui bute : la planner qui cherche l'import (elle ne pense pas « Prestataires ») ; la titulaire qui cherche son export.
- Principe candidat : les Paramètres ne contiennent que des réglages ; importer, exporter, corbeille et journaux ont leur propre entrée.

### H-IA-23 — « Reprendre » désigne trois gestes sans rapport
- Écran et taille : `/import`, menu des Paramètres, accueil d'un compte neuf, 1 440 × 900
- Constat : les tuiles disent « Reprendre mes contacts / prestataires / événements » sous le titre « Importer des données » ; dans le même menu, « Reprendre un export » restaure un export Symbola dans un espace vide ; sur l'accueil, « Reprendre le questionnaire » continue le démarrage. Dans le budget, « Importer » et « Reprendre les prestataires retenus (PDF) » sont côte à côte.
- Preuve : NAV/s1/052.jpg ; NAV/s1/045.jpg ; texte de l'accueil du compte neuf (« il reste 5 questions. Reprendre le questionnaire »)
- Gravité présumée : gêne
- Qui bute : la planner qui arrive avec « un export » de son ancien outil : « Reprendre un export » lui parle, et ce n'est pas le bon.
- Principe candidat : un verbe pour un geste : « Importer » pour tout fichier venu d'ailleurs, un autre mot pour restaurer une sauvegarde Symbola, « Continuer » pour un questionnaire.

### H-IA-24 — Dix rubriques de modèles dans trois groupes, dont quatre ne s'appellent pas « Modèles »
- Écran et taille : menu des Paramètres, 1 440 × 900
- Constat : « Modèles d'e-mails », « Modèles de messages » (Mon entreprise) ; « Questionnaires », « Rétroplanning », « Programme du jour J », « Modèles d'évènement », « Listes du jour J » (Événements) ; « Modèles de devis », « de contrat », « de proposition » (Ventes). « Programme du jour J » est aussi, mot pour mot, un onglet de la fiche.
- Preuve : REL/camille/shots/parametres--1440.jpg ; NAV/s1/039.jpg ; `fr.json`, `SettingsMenu`
- Gravité présumée : gêne
- Qui bute : la planner qui prépare ses modèles : elle ne sait pas combien il y en a, ni que « Rétroplanning » en est un.
- Principe candidat : toute rubrique de modèles commence par « Modèles de » ; les modèles se voient ensemble.

### H-IA-25 — « Mon entreprise » porte la Corbeille, un journal et le Radar ; les journaux sont à trois endroits
- Écran et taille : menu des Paramètres, 1 440 × 900
- Constat : onze rubriques : Entreprise et TVA, Mon compte, Notifications, Automatisations, Radar des risques, Équipe, Modèles d'e-mails, Adresse d'envoi, Journal des envois, Modèles de messages, Corbeille. « Journal des envois » est ici, « Journal d'activité » dans « Prestataires et données », « Journal des imports » au bas de la page d'import. « Mon compte », personnel, est entre deux réglages de l'entreprise.
- Preuve : REL/camille/shots/parametres--1440.jpg ; texte de NAV/s1/052.jpg (« Journal des imports »)
- Gravité présumée : gêne
- Qui bute : la planner qui a supprimé un évènement par erreur et cherche la corbeille ; celle qui veut savoir si un e-mail est parti.
- Principe candidat : ce qui est personnel (compte, notifications) est séparé de ce qui vaut pour l'espace ; les journaux sont au même endroit.

### H-IA-26 — Dans les Paramètres, deux champs de recherche côte à côte
- Écran et taille : `/parametres` et toute rubrique, 1 440 × 900
- Constat : « Chercher un réglage » (204 px, à gauche) et « Rechercher un événement, un devis, une tâche, une aide… » (576 px) sont sur la même ligne, à 45 px l'un de l'autre. Le premier ne cherche que le nom des rubriques : « logo » vide le menu, alors que « Mentions et logo » est un onglet d'« Entreprise et TVA ».
- Preuve : NAV/s1/080.jpg ; NAV/s1/084.jpg (recherche « logo »)
- Gravité présumée : gêne
- Qui bute : la planner pressée, qui tape dans le plus grand champ et conclut que le réglage n'existe pas.
- Principe candidat : un seul champ de recherche par écran ; un filtre local a la forme d'un filtre.

### H-IA-27 — Le panneau d'un poste du budget n'a pas d'adresse
- Écran et taille : `/events/[id]?onglet=budget`, poste « Traiteur », 1 440 × 900
- Constat : le panneau « Traiteur · poste 2 sur 9 » s'ouvre sans changer l'adresse (`?onglet=budget`), alors que le panneau d'une tâche écrit `&tache=…` et l'aperçu d'un prestataire `?fiche=…`. Recharger ou envoyer le lien ferme le poste.
- Preuve : NAV/s1/058.jpg et son adresse ; adresses de NAV/s1/032.jpg et NAV/s1/065.jpg
- Gravité présumée : gêne
- Qui bute : l'agence, où l'on s'envoie des liens ; la planner qui recharge la page.
- Principe candidat : tout panneau qui montre un objet écrit cet objet dans l'adresse.

### H-IA-28 — L'aperçu d'un prestataire ne dit pas pour quels mariages il travaille
- Écran et taille : `/prestataires?fiche=…`, 1 440 × 900
- Constat : le panneau (400 px) montre le contact, le téléphone (sur deux lignes : « 01 99 00 » / « 01 01 »), l'e-mail et « Ouvrir la fiche complète ». Les mariages ne sont que dans la fiche complète (« Historique avec vous »). Dans la liste, chaque fiche affiche « Non placé sur la carte » et « Archiver », mais ni métier ni mariage.
- Preuve : NAV/s1/065.jpg ; NAV/s1/067.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui parcourt son carnet pour savoir qui est pris quand.
- Principe candidat : l'aperçu d'un objet montre d'abord ce à quoi il est rattaché, puis ses détails.

### H-IA-29 — La barre du haut part avec la page
- Écran et taille : toutes les pages longues, 1 440 × 900
- Constat : la recherche, « Créer », la cloche et le « ? » défilent avec le contenu : à 44 px de défilement ils sont rognés, à 380 px ils ne sont plus à l'écran. La fiche d'un mariage fait 2 455 à 5 220 px, celle d'un prestataire 3 830 px.
- Preuve : NAV/s1/008.jpg (44 px, barre rognée) ; NAV/s1/045.jpg (380 px, barre absente)
- Gravité présumée : gêne
- Qui bute : la planner au milieu d'un rétroplanning de 42 tâches, qui veut chercher ou ouvrir l'aide de l'écran.
- Principe candidat : la recherche, la création et l'aide restent à l'écran quel que soit le défilement.

### H-IA-30 — Les résultats de recherche ne disent pas ce qu'ils sont, et se répètent
- Écran et taille : recherche du haut, 1 440 × 900
- Constat : « photographe » rend, sous « Tâches et prestataires », quatre lignes titrées « Photographe », sous-titrées « Léa & Maxime », « Baptême », « Mariage », « Anniversaire » : rien ne dit que ce sont des postes de budget. « Haddad » rend deux fois le traiteur. « import » rend « Importer un fichier / Action », « Importer ses événements existants / Tutoriel » et « Importer des données / Écran de l'application ». Rien ne s'affiche tant que l'on n'a pas tapé.
- Preuve : NAV/s1/010.jpg ; NAV/s1/014.jpg ; NAV/s1/022.jpg ; NAV/s1/008.jpg (champ actif, aucune suggestion)
- Gravité présumée : gêne
- Qui bute : la planner qui cherche son photographe et obtient quatre « Photographe » sans nom.
- Principe candidat : chaque résultat porte son type en clair (Tâche, Poste du budget, Fiche du carnet, Réglage) ; une destination n'apparaît qu'une fois.

### H-IA-31 — « Jour J » trois fois, et trois portes vers les messages, dans le haut de la fiche
- Écran et taille : `/events/[id]`, 1 440 × 900
- Constat : un bouton « Jour J », l'étape 4 « Jour J » de la frise, l'onglet « Programme du jour J ». « Messages » et « Écrire au client » voisinent ; la Synthèse a plus bas « Échanges avec le contact » et « Répondre ».
- Preuve : REL/camille/shots/events_id_--1440-haut.jpg ; REL/camille/shots/events_id_--1440.jpg
- Gravité présumée : gêne
- Qui bute : la débutante, qui ne sait pas lequel des trois « Jour J » ouvre le déroulé.
- Principe candidat : dans une même vue, un mot ne nomme qu'une destination.

### H-IA-32 — La Synthèse empile onze blocs et redit les autres onglets
- Écran et taille : `/events/[id]?onglet=apercu`, 1 440 px, pleine hauteur (3 718 px, capture du relevé)
- Constat : Prochaine action, Santé de l'évènement, Les 14 prochains jours, Équipe, Plage occupée, Fiche d'identité, Temps forts, Rendez-vous et comptes rendus, Échanges avec le contact, Fil d'activité, Supprimer l'évènement. « Prochaine action » et « Les 14 prochains jours » listent des tâches du Rétroplanning ; « 6 lignes pourvues sur 9 » est aussi dans l'onglet du budget et dans sa pastille « 6/9 ».
- Preuve : REL/camille/shots/events_id_--1440.jpg ; NAV/s1/045.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui cherche le lieu ou les interlocuteurs : « Fiche d'identité » est le sixième bloc, vers 2 100 px.
- Principe candidat : une synthèse tient en deux hauteurs d'écran et renvoie aux onglets au lieu de les recopier.

### H-IA-33 — Les libellés des onglets ne répondent pas à ceux du menu latéral
- Écran et taille : `/events/[id]` et menu latéral, 1 440 × 900
- Constat : menu « Devis et factures » / onglet « Mes devis et factures » ; menu « Prestataires » / onglet « Budget et prestataires » ; menu « Tâches » / onglet « Rétroplanning » ; menu « Contacts » / onglet « Mariés ». Aucune paire ne partage le même mot. Le budget, lui, n'a aucune entrée de menu : la page « Apps » doit l'expliquer (« Où la trouver : dans chaque évènement : onglet « Budget et prestataires » »).
- Preuve : NAV/s1/045.jpg ; REL/camille/shots/apps--1440-haut.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui passe de la vue d'ensemble au dossier et doit traduire.
- Principe candidat : l'onglet d'une fiche reprend le nom du module qu'il filtre.

### H-IA-34 — Une carte de tutoriel passe avant le titre et prend la forme du bouton principal
- Écran et taille : `/prestataires`, `/events/modeles`, `/import`, 1 440 × 900
- Constat : au-dessus du titre, une carte « Découvrir en N minutes » avec le bouton plein « Commencer le tutoriel ». Sur le carnet, le tutoriel proposé est « Comparer plusieurs devis pour une ligne du budget », qui ne se fait pas dans le carnet. L'écran a alors deux boutons pleins.
- Preuve : NAV/s1/060.jpg ; NAV/s1/039.jpg ; NAV/s1/052.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui revient chaque jour : la carte repousse le titre de 150 px. Dépend de la couleur : deux boutons de la couleur principale sur l'écran.
- Principe candidat : l'aide d'un écran ne prend ni la couleur ni la place de l'action principale, et porte sur cet écran.

### H-IA-35 — La fiche d'un prestataire : 3 830 px sans sommaire, deux « Historique »
- Écran et taille : `/prestataires/[id]`, 1 440 × 900
- Constat : neuf blocs à la suite (Historique avec vous, Historique des collaborations, Coordonnées et caractéristiques, Coordonnées bancaires, Pièces, Note interne, Plaquettes et RIB, Point sur la carte, Archiver). Les deux premiers titres se confondent ; le RIB a deux blocs. Le lien de retour dit « Retour au carnet », sans flèche, quand la fiche d'un évènement dit « ← Tous les événements ».
- Preuve : NAV/s1/067.jpg et le texte de la page
- Gravité présumée : gêne
- Qui bute : la planner qui cherche l'attestation d'assurance : cinquième bloc.
- Principe candidat : une fiche de plus de deux hauteurs d'écran a des onglets ou un sommaire ; toutes les fiches ont le même lien de retour.

### H-IA-36 — Dans « Tutoriels », l'import est le dernier, hors parcours
- Écran et taille : `/tutoriels`, 1 440 px, pleine hauteur (capture du relevé)
- Constat : cinq étapes numérotées (« Préparer votre activité », « Préparer vos modèles », « Votre premier événement », « Vendre et facturer », « Avec les mariés »), puis « Autres tutoriels » : « Importer ses événements existants », seul, en bas de page. L'« ordre conseillé » est celui d'une planner qui part de zéro.
- Preuve : REL/camille/shots/tutoriels--1440.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui reprend des mariages : son tutoriel est le onzième, et « Votre premier événement » ne la concerne pas.
- Principe candidat : l'aide de démarrage a deux chemins, « je commence » et « j'arrive d'un autre outil ».

### H-IA-37 — Deux carnets, « Contacts » et « Prestataires », séparés dans le menu
- Écran et taille : menu latéral et `/import`, 1 440 × 900
- Constat : « Contacts » est la 4e entrée, « Prestataires » la 6e, « Rendez-vous » entre les deux. L'import a une tuile pour chacun, et celle des contacts précise que « les lignes de vos prestataires peuvent être écartées ». La recherche range les uns sous « Contacts », les autres sous « Tâches et prestataires ».
- Preuve : NAV/s1/008.jpg (menu) ; NAV/s1/052.jpg (tuiles) ; NAV/s1/030.jpg et NAV/s1/014.jpg (groupes de résultats)
- Gravité présumée : gêne
- Qui bute : la planner dont l'ancien outil n'a qu'un carnet d'adresses : elle doit choisir une tuile avant de savoir.
- Principe candidat : deux listes de personnes sont voisines dans le menu, et l'import dit laquelle reçoit quoi avant de demander le fichier.

### H-IA-38 — Quatre entrées d'aide, et « Apps » qui sert de plan du site
- Écran et taille : menu latéral, barre du haut, `/apps`, 1 440 × 900
- Constat : « Tutoriels 0/11 », « Aide », le « ? » de la barre, les cartes « Découvrir en N minutes », plus les visites guidées. « Apps » liste sept modules tous « Activée », chacun avec « Où la trouver » et « Ouvrir » : c'est la seule page qui dit où sont le budget et les invités.
- Preuve : NAV/s1/008.jpg ; NAV/s1/060.jpg ; REL/camille/shots/apps--1440-haut.jpg
- Gravité présumée : gêne
- Qui bute : la débutante, qui ne sait pas laquelle des quatre aides ouvrir ; celle qui cherche le budget dans le menu.
- Principe candidat : une entrée « Aide » dans le menu, une aide de l'écran dans la barre ; le menu suffit à trouver chaque module.

### H-IA-39 — Trois façons de fermer un panneau
- Écran et taille : panneaux, 1 440 × 900
- Constat : « Fermer » en texte vert (tâche, poste : deux fois dans le poste, en haut et en bas), « × » (aperçu de prestataire), « Fermer le panneau » (réglages).
- Preuve : NAV/s1/032.jpg ; NAV/s1/058.jpg ; NAV/s1/065.jpg ; NAV/s1/037.jpg
- Gravité présumée : détail
- Qui bute : personne ne bloque ; chacune réapprend le geste à chaque panneau.
- Principe candidat : une seule commande de fermeture, au même endroit, pour tous les panneaux.

### H-IA-40 — La pastille « 2 en retard » casse l'entrée « Tâches » du menu
- Écran et taille : menu latéral, tout écran, 1 440 × 900
- Constat : « Tâches » puis une pastille rouge « 2 en / retard » sur deux lignes, dans une colonne de 200 px ; « Créer une autre organisation » sur deux lignes ; l'adresse du compte coupée (« …@exemple.tes ») sans moyen de la lire.
- Preuve : NAV/s1/008.jpg ; mesure du relevé (94 écrans)
- Gravité présumée : détail
- Qui bute : l'œil : c'est le seul élément rouge du menu, et il est mal formé. Dépend de la couleur : avec un orange de marque, l'alerte et l'accent se disputeront la même place.
- Principe candidat : une pastille de menu est un nombre ; son sens est sur l'écran qu'elle annonce.

### H-IA-41 — Le panneau de réglages propose trois boutons pour créer un modèle, et coupe « Retirer »
- Écran et taille : `/reglages/modeles` et `/reglages/evenements`, panneau de 560 px, 1 440 × 900
- Constat : « Nouveau modèle » (plein, en haut), « Créer un modèle » (dans l'état vide), « Charger le modèle de départ » (dessous). Dans « Lignes du budget par défaut », le lien « Retirer » est coupé à « Reti » par le bord droit.
- Preuve : NAV/s1/037.jpg ; NAV/s1/055.jpg
- Gravité présumée : détail
- Qui bute : la débutante devant l'état vide : « Nouveau » ou « Créer » ?
- Principe candidat : dans un état vide, l'action de l'état vide est la seule action de création visible.

### H-IA-42 — « Aucun modèle de rétroplanning pour l'instant » sur un mariage de 42 tâches
- Écran et taille : `/events/[id]?onglet=retroplanning`, espace rempli, 1 440 × 900
- Constat : sous « 33 tâches faites sur 42 · 2 en retard », la phrase « Aucun modèle de rétroplanning pour l'instant. Modèles de rétroplanning » parle des réglages de l'espace, pas de ce mariage.
- Preuve : NAV/s1/033.jpg
- Gravité présumée : détail
- Qui bute : la planner qui lit « aucun » à côté de ses 42 tâches.
- Principe candidat : un message sur l'espace ne s'affiche pas dans un objet qui n'en a pas besoin.

### H-IA-43 — Sur téléphone, la recherche montre « Recher » et un raccourci clavier
- Écran et taille : barre du haut, 375 × 812 (captures du relevé)
- Constat : le champ fait 127 px ; son texte est coupé à « Recher » ; la pastille « ⌘K » y reste affichée, sur un appareil sans clavier.
- Preuve : REL/camille/shots/accueil--375-haut.jpg ; REL/camille/shots/parametres_notifications--375-haut.jpg
- Gravité présumée : détail
- Qui bute : la planner sur téléphone, qui ne lit pas ce que le champ cherche.
- Principe candidat : sur téléphone, la recherche est une icône qui ouvre un champ pleine largeur ; aucun raccourci clavier affiché.

### H-IA-44 — Une visite guidée démarre sous un panneau ouvert par un lien
- Écran et taille : `/events/[id]?onglet=retroplanning&tache=…`, première venue sur la fiche, 1 440 × 900
- Constat : arrivée par une tâche d'Aujourd'hui, la fiche montre le panneau « Modifier la tâche » et, derrière lui, la barre d'onglets cerclée de vert par la visite « Les onglets » (1 sur 5), dont la bulle n'apparaît qu'à la fermeture du panneau.
- Preuve : NAV/s1/032.jpg (cercle vert derrière le panneau) ; NAV/s1/033.jpg (bulle « 1 sur 5 » après « Fermer »)
- Gravité présumée : détail
- Qui bute : la débutante, qui ferme sa tâche et reçoit une visite qu'elle n'a pas demandée.
- Principe candidat : une visite guidée ne démarre que sur un écran sans panneau ouvert, et jamais au milieu d'un geste.

## 3. Principes de Design System recommandés

1. **Un objet, un nom, partout.** Le même mot dans le menu, le titre de l'écran, l'onglet de la fiche, la recherche et l'aide. Un mot ne nomme qu'une destination dans une même vue.
2. **Un parcours central a une porte unique.** La reprise d'un mariage se propose dans l'assistant de démarrage, sur l'accueil d'un espace vide et dans « Créer » ; cette porte liste toutes les étapes, où qu'elles vivent.
3. **On revient d'où l'on vient.** Fermer un panneau ramène à l'écran d'origine ; un écran ouvert depuis un objet garde « ← <nom de l'objet> » ; une seule commande de fermeture, au même endroit.
4. **Un bouton dit sa portée.** « Ce mariage » ou « tous les nouveaux évènements » se lit sur le bouton. « Réglages » seul est réservé au menu ; le bouton de réglages d'un écran ouvre tous les réglages de cet écran.
5. **Le nom d'un objet est un lien vers sa fiche**, dans les deux sens (du mariage au prestataire, du prestataire au mariage) ; dans une liste transverse, le parent est aussi un filtre.
6. **Tout ce qui est nommé se trouve.** Un seul champ de recherche, qui couvre évènements, tâches, prestataires, réglages, actions et aide ; chaque résultat dit son type ; une destination n'apparaît qu'une fois.
7. **La navigation tient à l'écran.** Tous les onglets visibles et l'onglet actif marqué ; en-tête de fiche de 160 px au plus ; recherche, création et aide fixes ; sur téléphone, le contenu avant le menu.
8. **Les Paramètres ne contiennent que des réglages.** Sept rubriques au plus par groupe, des groupes nommés comme les écrans de travail ; importer, exporter, corbeille et journaux ont leur propre entrée ; le personnel est séparé de l'espace.
9. **Tout panneau a une adresse**, et une adresse rouverte rend le même écran, avec son contexte.
10. **Un verbe pour un geste.** « Importer » pour un fichier venu d'ailleurs, « Créer » pour un objet neuf, « Fermer » pour un panneau ; « Reprendre » ne sert qu'à une chose.
