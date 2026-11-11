# Lot 13 — Refonte UX : des écrans qui montrent l'essentiel, une aide qui montre l'écran

Retours de la recette du 06/11/2026 (Julien, après le lot 12). Constat : « en termes d'UX, j'ai
beaucoup de mal à m'en sortir ». Trop de sections qui se déplient vers le bas, des écrans de
réglage touffus, des contrôles de tailles différentes, une aide en longues listes de définitions,
des tutoriels qu'on peut lancer tous en même temps et sans ordre, une Administration pauvre.

Maquettes validées : artefact « Refonte UX Symbola »
(<https://claude.ai/artifact/KXrZ7gDgsSr13T7DCzwzeg>). Décision structurante : ADR 0033.
Les imports depuis l'outil actuel, prévus en lot 13, passent au **lot 14** (décision de Julien : pas de
petits travaux d'UX avant la refonte globale, imports après).

## Décisions de Julien (06/11/2026)

- **A.** Tutoriels : l'ordre du parcours est **conseillé**, jamais bloquant.
- **B.** Parcours des tutoriels validé : 1 préparer son activité (catalogue, carnet de
  prestataires) ; 2 préparer ses modèles (rétroplanning, programme, simulation de budget) ;
  3 premier événement (fiche, devis comparés) ; 4 vendre et facturer (devis signé, acompte et
  solde) ; 5 avec les mariés (espace clients). L'import n'est pas dans le parcours (lot 14).
- **C.** Aide sur l'écran : les repères s'affichent **d'office à la première ouverture** d'un
  écran, ensuite **seulement au clic** sur « ? ».
- **D.** Vignettes du centre d'aide : **captures réelles** de l'app.
- **E.** Pas d'étape « Acompte reçu » dans la frise du statut.
- **F.** Import et Données personnelles restent dans les Paramètres (groupe « Données »).
- **G.** Délais du bloc « À traiter » de l'accueil = **réglages de l'organisation** (par défaut :
  relancer un devis envoyé après 7 jours, un prospect sans nouvelle après 14 jours).
- **H.** La console Admin affiche **l'état de la dernière sauvegarde**, signalé par le script de
  sauvegarde.

## Règles communes (s'appliquent à toutes les stories)

1. L'essentiel d'emblée : aucun contenu principal replié par défaut.
2. Le détail s'ouvre **dans un panneau latéral** à droite (sur téléphone : en plein écran), la
   liste reste visible ; plus de formulaire qui déroule vers le bas.
3. Une page par sujet, avec menu latéral ; une page ne dépasse pas deux hauteurs d'écran.
4. Contrôles d'une même barre : même hauteur (38 px), libellés au-dessus, même taille de texte ;
   listes = tableaux à colonnes alignées.
5. Une seule chose à la fois : un tutoriel en cours, un menu ouvert, une prochaine action.
6. Montrer plutôt que décrire ; textes écrits pour quelqu'un déjà connecté.

Chaque étape est livrée en une PR (tests, 375 px, axe-core), mise sur le staging pour recette.

## Étape 1 — Socle commun et liste des événements

### L13-HUB-14 — Composants communs

- Panneau latéral (`SidePanel`) : s'ouvre à droite, se ferme par « Fermer », Échap ou clic
  hors du panneau, rend le focus à l'élément qui l'a ouvert, plein écran sous 720 px ; son état
  est dans l'adresse (lien partageable, retour arrière du navigateur).
- Barre de filtres (`FilterBar`) : contrôles de 38 px alignés, filtrage à la saisie (sans bouton
  « Filtrer »), état dans l'adresse.
- Tableau de liste (`ListTable`) : colonnes alignées, ligne entière cliquable au clavier et à la
  souris, actions alignées à droite.

### L13-EVT-18 — Liste des événements

- **Quand** elle ouvre « Événements », **alors** la barre de filtres (recherche, statut, source,
  année) a des contrôles de même taille.
- **Quand** elle choisit une année, **alors** seules sont proposées les années où elle a des
  événements, plus l'année en cours et la suivante (plus jamais 1 ou −1).
- Les filtres s'appliquent à la saisie ; « À venir · n » / « Terminés · n » en sélecteur.

## Étape 2 — Accueil

### L13-HUB-15 — Accueil : l'agenda et ce qui attend

- La liste « Premiers pas » et la barre d'aide permanente disparaissent (l'assistant de
  démarrage du lot 12 couvre les premiers pas).
- Bloc **« À traiter »** : devis envoyés sans réponse depuis plus de N jours, prospects sans
  nouvelle depuis plus de M jours, acomptes attendus dans les 15 jours ; chacun mène à sa fiche.
- N et M sont des réglages de l'organisation (défauts : 7 et 14 jours, valeurs de départ dans
  les données, pas dans le code).
- **Quand** un tutoriel est en cours, **alors** une pastille « Reprendre le tutoriel · étape x
  sur y » s'affiche en bas à droite ; sinon rien.
- Tests : délais simulés avec une horloge (veille, jour même, passage à l'heure d'hiver).

## Étape 3 — Paramètres

### L13-HUB-16 — Paramètres en rubriques

- Un menu latéral en quatre groupes : Mon entreprise (Entreprise et TVA, Équipe, Mon compte) ;
  Événements (Lignes du budget, Sources et motifs, Rétroplanning, Programme du jour J,
  Répartition du budget, Délais de relance) ; Ventes (Catalogue, Devis et factures,
  E-reporting) ; Prestataires et données (Types de prestataires, Importer, Données
  personnelles). Seules les rubriques des modules souscrits apparaissent (dégradation propre).
- Une adresse par rubrique ; la roue crantée d'un écran métier mène à la bonne rubrique ; les
  anciennes adresses redirigent.
- Toutes les listes suivent le tableau aligné ; ajouter ou modifier une ligne ouvre le panneau
  latéral ; l'ordre se change par glisser-déposer (et au clavier).
- Sur téléphone : la liste des rubriques, puis la page de la rubrique.

## Étape 4 — Fiche événement

### L13-EVT-19 — Frise du statut et prochaine étape

- La frise horizontale Prospect → Devis envoyé → Confirmé → Réalisé remplace les boutons :
  chaque étape franchie affiche sa date (historique des statuts), l'étape en cours est mise en
  avant ; « Marquer perdu… » est un lien à part qui demande le motif.
- Un clic sur une autre étape demande confirmation puis change le statut.
- Bandeau **« Prochaine étape »** selon l'état : envoyer le devis (prospect), appliquer le
  rétroplanning (confirmé sans tâches), préparer le programme (confirmé, programme vide à
  moins de 3 mois), inviter les mariés (confirmé sans accès client) ; « Plus tard » le masque
  pour cet événement.
- Vue d'ensemble : quatre chiffres (budget prévu, lignes réservées, tâches en retard, devis
  signé) ; le détail d'une ligne du budget s'ouvre en panneau latéral.

## Étape 5 — Prestataires

### L13-PRE-12 — Liste et carte côte à côte

- Sur ordinateur, liste à gauche et carte à droite ; survoler une fiche met son repère en avant
  et inversement ; le lieu de l'événement ciblé est un repère distinct.
- Types en pastilles avec leur nombre ; barre de filtres (recherche, autour de, distance, déjà
  retenus) filtrant à la saisie.
- La fiche s'ouvre en panneau latéral ; la recherche reste en place.
- Sur téléphone : bascule « Liste » / « Carte ».
- Les réglages du carnet partent dans Paramètres › Types de prestataires.

## Étape 6 — Aide et tutoriels

### AIDE-10 — Page Tutoriels en parcours

- Une page « Tutoriels » au menu, avec le compteur (« 3/10 »), distincte de l'aide.
- Tuiles groupées par étape du parcours (décision B) : verte avec une coche une fois faite,
  entourée quand elle est en cours, « Conseillé ensuite » pour la suivante ; jamais bloquée
  (décision A).
- **Quand** elle lance un tutoriel alors qu'un autre est en cours, **alors** une fenêtre propose
  « Le terminer d'abord » ou « L'abandonner et commencer celui-ci » ; jamais deux en cours.

### AIDE-11 — Aide sur l'écran par repères

- Le bouton « ? » de chaque écran pose des repères numérotés sur les éléments réels ; un clic
  sur un repère (ou sur la liste des repères) explique l'élément et estompe le reste.
- **Quand** elle ouvre un écran pour la première fois, **alors** les repères s'affichent
  d'office une fois ; ensuite seulement au clic sur « ? » (décision C).
- Les repères remplacent les visites focus et les textes d'aide en fenêtre (AIDE-05, AIDE-01) ;
  « parcourir les repères dans l'ordre » remplace la visite.
- Accessibles au clavier ; le texte des repères est dans les fichiers de traduction.
- Les écrans sans repères gardent un bouton « ? » identique, qui ouvre le même panneau avec le
  seul texte d'aide de l'écran (plus de bulle qui se déplie dans la page).
- Le centre d'aide affiche « Repères vus » ou « À découvrir » par écran ; plus d'étape « mise de
  côté » ni de pastille « Reprendre la visite ».

### AIDE-12 — Centre d'aide par écran, avec captures réelles

- Une vignette par écran, groupées par module, avec la capture réelle de l'écran et ses repères
  (décision D) ; chaque fiche : capture annotée, puis questions fréquentes.
- Recherche dans l'aide (pas dans les données).
- Les captures sont produites par un script Playwright sur des données fictives (ADR 0033) :
  `pnpm --filter @symbola/app help:captures` (socle démarré), 24 écrans de l'équipe ; les écrans
  de l'Admin et des mariés n'ont pas de capture (ils montreraient une organisation).
- Chaque public ne voit que ses écrans : l'équipe ceux de ses modules (données personnelles :
  titulaire seulement), l'Admin la console, les mariés leur espace. Les écrans d'avant la
  connexion n'ont leur aide que sur leur écran.

### AIDE-13 — Textes d'aide réécrits

- Tous les textes d'aide (FR/EN) sont relus pour quelqu'un déjà connecté, sur l'écran où il se
  trouve. L'aide de l'écran de connexion n'apparaît que sur l'écran de connexion ; « Connexion »
  devient « Mon compte et la sécurité » (mot de passe, téléphone de double authentification,
  équipe).

## Étape 7 — Administration

Livrée en deux PR : **7a** (sauvegarde signalée, menu de la console, vue d'ensemble, Santé
détaillée, écran Organisations séparé) et **7b** (organisations en tableau avec panneau,
pagination des écrans Organisations, Comptes, Prise en main et Activité).

### L13-HUB-17 — Console d'Administration

- Menu latéral distinct (sombre) : Vue d'ensemble, Organisations, Comptes, Prise en main,
  Activité, Santé, Réglages de la suite.
- Vue d'ensemble : état des services, organisations actives, comptes d'équipe, comptes
  connectés sur 30 jours, événements créés ce mois, bloc « À faire » (invitations expirées,
  double authentification non configurée, dernière sauvegarde), tendance sur 6 mois.
- « Prise en main » et « Organisations » paginées (constat de l'étape 6b : avec plusieurs
  milliers d'organisations, l'écran actuel qui les affiche toutes se fige dans le navigateur) ;
  l'indicateur « visites mises de côté » disparaît (les repères n'ont plus d'étape).
- Comptes, Prise en main et Activité : recherche par nom de l'organisation et 20 organisations
  par page (les indicateurs restent calculés sur toutes) ; une action d'assistance ramène à la
  même recherche et à la même page.
- Organisations en tableau, avec recherche par nom et 20 par page ; une ligne ouvre un panneau : modules souscrits, comptes, prise en
  main. Toujours aucune donnée métier (ADR 0029) ; test : l'Admin n'accède à aucune donnée
  métier par ces écrans.

### L13-HUB-18 — Dernière sauvegarde signalée

- Le script de sauvegarde (`infra/backup/backup.sh`) enregistre chaque exécution (début, fin,
  résultat, taille) dans la table `hub.backup_runs` (ADR 0033).
- La console affiche la dernière sauvegarde (« Faite à 03:12 », ou « Échec » / « Aucune depuis
  plus de 26 h » en alerte).
- Le signal ne fait jamais échouer la sauvegarde (base arrêtée, migration absente) ; seul le
  script écrit dans la table (rôle d'administration), le rôle applicatif ne fait que lire.
- L'Admin arrive directement sur la console après sa connexion.

## Tests

- Chaque story a son fichier de tests (`describe('L13-HUB-14 — …')`), critères en `it`.
- e2e (ordinateur et 375 px, axe-core) pour chaque étape ; les parcours existants sont adaptés.
- Isolation : nouvelle table `hub.backup_runs` (lecture Admin uniquement), réglages de délais
  par organisation (A ne lit pas B).
