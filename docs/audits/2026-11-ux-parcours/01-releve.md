# Relevé des écrans — audit UX des parcours (lot 68, phase 1)

Date : 24 et 25/11/2026, par Claude Code. Ce relevé mesure et capture les écrans du périmètre du
lot 68 ([cadrage](../../lots/lot-68-audit-ux-parcours.md)). Il ne juge pas : il donne aux
spécialistes (phase 2) et au panel (phase 3) la même base de faits. Il ne change aucun écran.

## 1. Méthode

- **App** : `main` avec le lot 67 (commit `ea4fcef8`, PR #180), compilée, servie en local. Aucun
  serveur réel.
- **Outil** : `apps/symbola/e2e/zz-releve-ergonomie.spec.ts` (hors suite), complété pour ce lot. Il
  suit les liens depuis les adresses de départ, garde les écrans du périmètre, et relève chaque écran
  en 1 440 × 900, en 375 × 812 et en 911 × 512 (1 366 px à 150 %). Il ne remplit ni n'envoie aucun
  formulaire. Un panneau ouvert par l'adresse (`?tache=`, `?fiche=`, `?modifier=`, `?nouveau=`) et
  une vue (`?vue=`) comptent pour un écran.
- **Captures** : pleine hauteur et première hauteur d'écran, aux trois tailles. Elles restent hors
  du dépôt et se régénèrent (§ 7) ; onze preuves sont versées dans `preuves/`.

### Jeu de données

| État | Compte fictif | Contenu |
| --- | --- | --- |
| Rempli | Camille Roussel, « Atelier Camille R. » | Jeu fictif de recette : quatre évènements, dont le mariage de référence (42 tâches, budget, 12 prestataires) |
| Volume | Nadia Belkacem, « Maison Belkacem Évènements » | Jeu fictif : 65 évènements et prospects, six membres |
| Vide | Clémence Aubry, « Atelier Clémence A. » | Espace prêt (démarrage terminé), sans aucune donnée |
| Repris | Martine Vasseur, « Atelier Martine V. » | Un mariage repris par les écrans d'import, depuis les fichiers fictifs du dépôt (`packages/testing/import-corpus/files/logiciel-tiers`) : fiche d'évènement en PDF, carnet de prestataires en tableur, prestataires retenus en PDF, programme du jour J en PDF |
| Inscription | Une adresse neuve | Compte tout juste créé, avant l'assistant de démarrage |

**Dates décalées.** Le jeu fictif situe ses scénarios au lundi 05/04/2027. Chargé tel quel, il ne
montre fin novembre 2026 ni retard ni échéance : « Aujourd'hui » serait vide. Pour ce relevé, toutes
ses dates sont reculées de 133 jours (19 semaines, les jours de la semaine sont gardés) : la date de
référence tombe le lundi 23/11/2026 et le mariage de référence le samedi 30/01/2027. Le fichier du
dépôt n'est pas modifié.

Les modules Invités, Rendez-vous et Plans de salle sont ouverts dans les quatre espaces, comme sur
un espace complet.

### Ce que mesure la grille

| Mesure | Ce que l'outil compte | Seuil du cadrage |
| --- | --- | --- |
| Zones d'action | Groupes de commandes dans la première hauteur d'écran : les actions de ligne d'une liste font une zone, un formulaire une zone, une barre (onglets, filtres, outils) une zone ; le reste est regroupé par voisinage | Trois en 1 440 px, deux en 375 px |
| Boutons principaux | Boutons et liens au fond de la couleur principale | Un seul |
| Sur deux lignes | Libellés dont un même texte passe à la ligne : boutons, onglets, en-têtes de colonne, titres de ligne, libellés de champ, pastilles ; le menu latéral est compté à part | Aucun en 1 440 px |
| Liens sans signe | Liens ni soulignés, ni d'une autre couleur que le texte voisin, ni en forme de bouton | Aucun |
| Cliquable sans rôle | Éléments au curseur « main » qui ne sont ni lien, ni bouton, ni champ | Aucun |
| Cibles de moins de 44 px | Boutons, listes, champs et liens en forme de bouton, en 375 px | Aucune |
| Aide | Le « ? » ouvre l'aide de l'écran, ou renvoie au centre d'aide | Aide de l'écran |
| État vide | Bloc d'état vide, et s'il porte une action | Action, exemple, aide |

**Limites de l'outil.**

- Le compte des boutons principaux inclut l'option active d'une bascule (« Liste / Calendrier »),
  qui a le même fond qu'un bouton principal : l'œil la lit de même.
- Les zones d'action sont un regroupement géométrique : deux barres de filtres côte à côte comptent
  pour deux, un panneau ouvert ajoute ses zones à celles de l'écran derrière lui.
- L'outil ne voit ni l'ordre de lecture, ni le sens d'un libellé, ni un état d'erreur (aucun
  formulaire n'est envoyé) : les spécialistes les relèveront en phase 2.
- Un champ de date s'affiche au format du navigateur d'essai, pas au format français : ce n'est pas
  un constat.

## 2. Ce que disent les mesures

294 relevés d'écran, aucun en erreur : 99 écrans dans l'espace rempli (31 dans les quatre modules,
58 dans les Paramètres, 10 pour l'aide, le démarrage et le transverse), 80 dans l'espace vide, 98
dans l'espace repris, 10 dans l'agence, 2 à l'inscription, 3 dans l'assistant d'import ; le carnet
de l'espace rempli a été relevé deux fois. Environ 1 500 captures, 110 Mo, hors dépôt.

| Critère du cadrage | Quatre modules (31 écrans) | Paramètres (58 écrans) |
| --- | --- | --- |
| Plus de trois zones d'action en 1 440 px | 28 écrans | 4 écrans |
| Plus de deux zones d'action en 375 px | 25 écrans | voir ci-dessous |
| Un seul bouton principal | 7 écrans ; aucun sur 9, plusieurs sur 15 | 30 écrans ; aucun sur 16, plusieurs sur 12 |
| Au moins un libellé sur deux lignes en 1 440 px, hors menu | 21 écrans | 4 écrans |

- **Zones d'action.** La fiche d'un évènement en compte 10 sur la Synthèse et le Programme, 9 sur
  « Budget et prestataires » et le Rétroplanning ; une tâche ouverte en panneau porte le total à 18.
  « Aujourd'hui » et le carnet de prestataires en comptent 6, « Tâches » 5, la liste des évènements 4.
- **Bouton principal.** « Aujourd'hui » n'en a aucun. La liste des évènements en montre 4, le
  carnet 2, « Tâches » 2 (dont l'option active de la bascule « Liste / Calendrier »).
- **Sur deux lignes.** Le cas le plus fréquent est le titre d'une tâche : 9 titres sur 11 dans « À
  faire », 32 sur 42 dans « Toutes », dans `/taches` comme dans le Rétroplanning. L'en-tête
  « Qui la réalise » passe à la ligne sur 10 écrans. Dans le menu latéral, « Tâches · 2 en retard »
  tient sur deux lignes sur 94 écrans ; dans le menu des Paramètres, « Relances de devis et de
  paiement » sur 10.
- **Affordance.** Dans « Tâches » et le Rétroplanning, les titres des tâches sont des liens sans
  signe (11 par écran) et chaque ligne du tableau réagit au clic sans être ni lien ni bouton (11 à
  42 lignes).
- **Téléphone.** En 375 px, « Tâches » compte 40 cibles de moins de 44 px (133 dans « Toutes »),
  le carnet 22. Dans les Paramètres, 55 écrans sur 58 n'ont **aucune commande du réglage dans le
  premier écran** : le menu des Paramètres passe avant.
- **Longueur.** Avec 65 évènements, « Aujourd'hui » fait 5,7 hauteurs d'écran en 1 440 px et 9,8 en
  375 px ; la liste des évènements 5,3 et 8. Dans l'espace repris, le carnet (25 fiches) fait 7,8
  hauteurs en 375 px.
- **Aide.** Le « ? » ouvre l'aide de l'écran sur 96 écrans sur 99 ; les trois autres sont les pages
  du centre d'aide.
- **Écran vide.** Dans l'espace vide, 7 écrans sur 22 (hors Paramètres) portent un état vide
  balisé, 6 avec une action. « Aujourd'hui » n'en porte pas.
- **Un verbe par geste.** Pour créer : « Ajouter » sur 36 écrans, « Créer » sur 17, « Nouveau » ou
  « Nouvelle » sur 10. Pour modifier : « Modifier » sur 21, « Changer » sur 16, « Renommer » sur 2.
  Pour supprimer : « Supprimer » sur 16, « Retirer » sur 6. Pour sortir : « Annuler » sur 16,
  « Fermer » sur 3. Pour valider : « Enregistrer » sur 35, « Appliquer » sur 1. Reste à dire, en
  phase 2, lesquels de ces écarts ont un sens.

## 3. Premières lectures, à confirmer

Lues par Claude Code sur une douzaine de captures. Ce sont des amorces pour les spécialistes, pas
des constats : aucune n'a encore été confrontée au panel.

| # | Écran | Ce que montre la capture | Preuve |
| --- | --- | --- | --- |
| L1 | Tâches, 1 440 px | Le titre d'une tâche tient sur deux lignes dans une colonne étroite, alors que la moitié de la ligne est vide ; l'en-tête « Qui la réalise » aussi. Trois boutons par ligne (« Modifier », « Reporter », « Supprimer ») : 33 boutons pour onze tâches. | [taches-1440](preuves/taches-1440.jpg) |
| L2 | Tâches, 375 px | Le tableau défile de côté et coupe sa quatrième colonne ; un titre de tâche prend quatre lignes ; la première tâche arrive en bas du premier écran, après deux rangées de filtres. | [taches-375](preuves/taches-375.jpg) |
| L3 | Fiche d'évènement, 1 440 px | Avant le contenu : lien de retour, liste « Type d'évènement » et « Changer le type », quatre boutons, frise de statut, « Reporter » et « Annuler », huit onglets. La « Prochaine action » commence à 550 px. | [fiche-evenement-1440](preuves/fiche-evenement-1440.jpg) |
| L4 | Fiche d'évènement | Dans « Prochaine action », « Reporter » et « Voir 4 de plus » sont empilés à gauche, loin des boutons « Fait » alignés à droite. | [fiche-evenement-1440](preuves/fiche-evenement-1440.jpg) |
| L5 | Aujourd'hui, 1 440 px | Trois familles (tâches, relances, paiements), chacune avec son lien « Voir… » à droite et ses boutons de ligne (« Fait », « Ouvrir », « Noter une relance ») ; chaque titre est aussi un lien. | [aujourdhui-1440](preuves/aujourdhui-1440.jpg) |
| L6 | Menu latéral | La pastille « 2 en retard » de « Tâches » passe sur deux lignes ; « Créer une autre organisation » aussi. | [aujourdhui-1440](preuves/aujourdhui-1440.jpg) |
| L7 | Carnet de prestataires, 1 440 px | Le filtre « Où ? » montre un champ réduit à un carré et « dans un rayon de » décalé sur un fond blanc. « À classer · 12 » apparaît deux fois (pastille et bandeau). « Non placé sur la carte » et « Archiver » se répètent sous chaque nom. | [prestataires-1440](preuves/prestataires-1440.jpg) |
| L8 | Paramètres, 375 px | Toute rubrique s'ouvre sur le menu des Paramètres, qui occupe plus que le premier écran ; le réglage demandé est plus bas. Le champ de recherche du haut est coupé (« Recher »). | [parametres-notifications-375](preuves/parametres-notifications-375.jpg) |
| L9 | Aujourd'hui, espace vide | Un espace neuf lit « Rien ne presse : tout est à jour. » : aucune invitation à créer le premier évènement, aucun exemple. | [aujourdhui-vide-1440](preuves/aujourdhui-vide-1440.jpg) |
| L10 | Tâches, espace vide | « Aucune tâche à faire : tout est à jour. » pour une planner qui n'a encore rien créé ; l'action proposée, « Voir les évènements », a la forme d'un bouton secondaire, et le seul bouton principal de l'écran est « Ajouter la tâche » des tâches hors évènement. | [taches-vide-1440](preuves/taches-vide-1440.jpg) |

## 4. Repris ou créé : premières lignes de la matrice

Observé sur le mariage repris (« Léa & Hugo », 12/06/2027, fichiers fictifs du corpus), à côté du
mariage de référence créé par le jeu fictif. Ce ne sont pas encore des jumeaux : voir § 6.

| Élément | Mariage créé | Mariage repris | À instruire |
| --- | --- | --- | --- |
| Par où l'on reprend | — | Trois endroits : Paramètres › Prestataires et données › Importer (fiche du mariage, carnet), onglet « Budget et prestataires » (PDF des prestataires retenus), onglet « Programme du jour J » (PDF du programme) | Une entrée « reprendre un mariage en cours » ([import-accueil](preuves/import-accueil-1440.jpg)) |
| Frise de statut | « En préparation », trois étapes datées (du jour du chargement du jeu fictif) | « Confirmé », daté du jour de l'import ; « Option » sans date | La date d'une étape reprise |
| Avant les onglets | Rien | Bandeau « Prochaine étape : créer les liens des mariés », bouton principal sur toute la largeur | Ce que la fiche propose à un mariage déjà avancé ([fiche-reprise](preuves/fiche-reprise-retroplanning-1440.jpg)) |
| Rétroplanning | 42 tâches | « 0 tâche faite sur 0 », « Aucun modèle de rétroplanning pour l'instant » | Reprendre ou générer les tâches d'un mariage en cours |
| Tâches (`/taches`) | 11 à faire, 2 en retard | État vide « tout est à jour » | Idem |
| Budget et prestataires | 6 lignes pourvues sur 9 | 11 sur 11 après la reprise du PDF | Montants absents du PDF : ce que la ligne affiche |
| Boutons de la fiche | « Voir comme Léa Martin » présent | Absent (aucun lien créé) | — |
| Doublons à l'import | — | Un second import du même carnet : 25 rapprochements à décider, trois boutons de traitement en lot aux libellés proches, « Continuer » en bas alors que l'import ne peut pas être confirmé | Une décision par défaut lisible ([import-rapprochements](preuves/import-rapprochements-1440.jpg)) |

## 5. Mesures par écran

Colonne « Sur deux lignes en 1 440 » : six nombres, dans l'ordre bouton, onglet, colonne, titre de
ligne, champ, pastille.

### Aujourd'hui — espace rempli (Camille), 3 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 6 | 1 | 1 | 0 | 4/0/0/0/0/0 | 2 | 1 | 0 | 3 |
| `/?vue=liste` | 6 | 1 | 1 | 0 | 0/0/0/0/0/0 | 2 | 0 | 0 | 3 |
| `/?vue=semaine` | 6 | 1 | 1 | 0 | 1/0/0/0/0/0 | 2 | 0 | 0 | 3 |

### Évènements — espace rempli (Camille), 17 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/events` | 4 | 5 | 4 | 4 | 0/0/0/0/0/0 | 7 | 4 | 4 | 7 |
| `/events/[id]` | 10 | 7 | 4 | 6 | 0/0/0/2/0/0 | 3 | 0 | 0 | 0 |
| `/events/[id]?onglet=apercu` | 10 | 7 | 4 | 6 | 0/0/0/2/0/0 | 3 | 0 | 0 | 0 |
| `/events/[id]?onglet=apercu&modifier` | 16 | 12 | 8 | 12 | 0/0/0/2/0/0 | 3 | 1 | 0 | 0 |
| `/events/[id]?onglet=budget` | 9 | 7 | 4 | 1 | 1/0/1/2/0/0 | 2 | 0 | 9 | 9 |
| `/events/[id]?onglet=devis` | 7 | 7 | 4 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/events/[id]?onglet=documents` | 6 | 7 | 4 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 1 |
| `/events/[id]?onglet=invites` | 6 | 7 | 4 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/events/[id]?onglet=maries` | 7 | 7 | 4 | 0 | 8/0/0/0/3/0 | 15 | 0 | 0 | 0 |
| `/events/[id]?onglet=programme` | 10 | 7 | 4 | 1 | 0/0/0/0/5/0 | 2 | 0 | 0 | 0 |
| `/events/[id]?onglet=programme&importer` | 10 | 7 | 4 | 1 | 0/0/0/0/5/0 | 2 | 0 | 0 | 0 |
| `/events/[id]?onglet=retroplanning` | 9 | 7 | 4 | 0 | 0/0/1/32/0/0 | 43 | 11 | 42 | 17 |
| `/events/[id]?onglet=retroplanning&tache` | 18 | 11 | 10 | 3 | 0/1/1/32/0/0 | 45 | 11 | 42 | 17 |
| `/events/[id]?onglet=retroplanning&vue=a-faire` | 9 | 7 | 4 | 0 | 0/0/1/9/0/0 | 13 | 11 | 11 | 17 |
| `/events/[id]?onglet=retroplanning&vue=en-retard` | 9 | 7 | 4 | 0 | 0/0/1/2/0/0 | 4 | 2 | 2 | 8 |
| `/events/[id]?onglet=retroplanning&vue=toutes` | 9 | 7 | 4 | 0 | 0/0/1/32/0/0 | 43 | 11 | 42 | 17 |
| `/events/new` | 1 | 1 | 1 | 1 | 0/0/0/0/0/0 | 2 | 0 | 0 | 0 |

### Tâches — espace rempli (Camille), 5 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/taches` | 5 | 5 | 5 | 2 | 0/0/1/9/0/0 | 12 | 11 | 11 | 40 |
| `/taches?tache` | 9 | 9 | 9 | 3 | 0/0/1/9/0/0 | 12 | 11 | 11 | 41 |
| `/taches?vue=a-faire` | 5 | 5 | 5 | 2 | 0/0/1/9/0/0 | 12 | 11 | 11 | 40 |
| `/taches?vue=en-retard` | 5 | 5 | 5 | 2 | 0/0/1/2/0/0 | 3 | 2 | 2 | 13 |
| `/taches?vue=toutes` | 5 | 5 | 5 | 2 | 0/0/1/32/0/0 | 42 | 11 | 42 | 133 |

### Prestataires — espace rempli (Camille), 6 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/prestataires` | 6 | 4 | 3 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 22 |
| `/prestataires/[id]` | 1 | 0 | 0 | 6 | 0/0/0/0/0/0 | 2 | 0 | 0 | 3 |
| `/prestataires/[id]?modifier` | 4 | 3 | 3 | 7 | 1/0/0/0/0/0 | 2 | 0 | 0 | 3 |
| `/prestataires/nouveau` | 2 | 2 | 2 | 1 | 1/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/prestataires?fiche` | 7 | 5 | 3 | 3 | 0/0/0/0/0/0 | 0 | 1 | 0 | 22 |
| `/prestataires?vue=carte` | 6 | 4 | 3 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 12 |

### Premiers pas et aide — espace rempli (Camille), 6 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/aide` | 4 | 4 | 3 | 1 | 115/0/0/0/0/0 | 115 | 0 | 0 | 0 |
| `/aide/ecrans/[key]` | 0 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/aide/tutoriels/[key]` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/demarrage/essentiel` | 2 | 2 | 2 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/demarrage/pret` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/tutoriels` | 2 | 1 | 1 | 0 | 2/0/0/0/0/0 | 10 | 0 | 0 | 0 |

### Transverse — espace rempli (Camille), 3 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/apps` | 1 | 1 | 1 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/notifications` | 3 | 3 | 3 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 3 |
| `/recherche` | 0 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |

### Reprise — espace rempli (Camille), 1 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/import` | 1 | 0 | 0 | 0 | 4/0/0/0/0/0 | 4 | 0 | 0 | 0 |

### Paramètres — espace rempli (Camille), 58 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/budget/parametres` | 4 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/devis/catalogue` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/devis/e-reporting` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/devis/exports-comptables` | 1 | 0 | 0 | 1 | 0/0/0/0/0/0 | 2 | 0 | 0 | 0 |
| `/devis/modeles` | 2 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/devis/modeles-contrat` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/devis/modeles-proposition` | 1 | 0 | 0 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/devis/parametres` | 1 | 0 | 0 | 1 | 0/0/0/0/3/0 | 7 | 0 | 0 | 0 |
| `/devis/parametres/archive` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/devis/parametres/documents` | 3 | 0 | 0 | 3 | 0/0/0/0/0/0 | 2 | 0 | 0 | 2 |
| `/devis/relances` | 1 | 0 | 0 | 1 | 0/0/0/0/2/0 | 3 | 0 | 0 | 0 |
| `/events/modeles` | 3 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/events/modeles-evenement` | 0 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/events/modeles-programme` | 3 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/events/modeles-programme?nouveau` | 4 | 2 | 2 | 2 | 0/0/0/0/0/0 | 0 | 1 | 0 | 1 |
| `/events/modeles?nouveau` | 4 | 2 | 2 | 2 | 0/0/0/0/0/0 | 0 | 1 | 0 | 1 |
| `/events/parametres` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 19 |
| `/events/parametres/contact` | 1 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/events/parametres/etapes` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/events/parametres/listes-jour-j` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/events/parametres/plages-occupees` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 2 | 0 | 0 | 1 |
| `/events/parametres/prestataires-par-lien` | 1 | 0 | 0 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/events/parametres/questionnaires` | 3 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/events/parametres/regimes` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 2 | 0 | 0 | 19 |
| `/events/parametres/repas` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/events/parametres/sources` | 4 | 0 | 0 | 2 | 0/0/0/0/0/0 | 1 | 0 | 0 | 1 |
| `/events/parametres/taches` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/events/parametres/termes` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/events/parametres/types` | 1 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/abonnement` | 0 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/adresse-envoi` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/automatisations` | 2 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 10 |
| `/parametres/automatisations/rappel-jour-j` | 1 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/corbeille` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/emails` | 1 | 0 | 0 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/parametres/emails/[kind]` | 1 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/emails/marque` | 1 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/envois` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/parametres/equipe` | 3 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/export` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/parametres/fermeture` | 2 | 0 | 0 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/parametres/journal` | 1 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/parametres/messages` | 3 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/notifications` | 1 | 0 | 0 | 2 | 0/0/0/0/0/0 | 14 | 0 | 0 | 0 |
| `/parametres/radar` | 1 | 0 | 0 | 1 | 0/0/0/0/2/0 | 0 | 0 | 0 | 0 |
| `/parametres/relances` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/parametres/reprise` | 0 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/parametres/stockage` | 0 | 0 | 0 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/prestataires/parametres` | 3 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/prestataires/parametres/etiquettes` | 2 | 0 | 0 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/prestataires/parametres/pieces` | 3 | 0 | 0 | 2 | 0/0/0/0/0/0 | 2 | 0 | 0 | 4 |
| `/prestataires/parametres/trajet` | 1 | 0 | 0 | 1 | 0/0/0/0/2/0 | 0 | 0 | 0 | 0 |
| `/profil` | 2 | 0 | 0 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/rendez-vous/disponibilites` | 2 | 0 | 0 | 7 | 0/0/0/0/0/0 | 0 | 0 | 0 | 12 |
| `/rendez-vous/reglages` | 3 | 0 | 0 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/rgpd` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/securite` | 2 | 2 | 2 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |

### Espace prêt et vide (Clémence), 22 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 3 | 0 | 2 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/?vue=liste` | 2 | 0 | 2 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/?vue=semaine` | 3 | 0 | 2 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/aide` | 4 | 4 | 3 | 1 | 115/0/0/0/0/0 | 115 | 0 | 0 | 0 |
| `/aide/ecrans/[key]` | 0 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/aide/tutoriels/[key]` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/apps` | 1 | 1 | 1 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/demarrage/essentiel` | 2 | 2 | 2 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/demarrage/pret` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/events` | 5 | 5 | 4 | 4 | 0/0/0/0/0/0 | 6 | 0 | 0 | 8 |
| `/events/new` | 2 | 2 | 1 | 1 | 0/0/0/0/0/0 | 3 | 0 | 0 | 1 |
| `/import` | 1 | 0 | 0 | 0 | 4/0/0/0/0/0 | 4 | 0 | 0 | 0 |
| `/notifications` | 1 | 1 | 1 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/prestataires` | 6 | 4 | 3 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 9 |
| `/prestataires/nouveau` | 2 | 2 | 2 | 1 | 1/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/prestataires?vue=carte` | 6 | 4 | 3 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 11 |
| `/recherche` | 0 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/taches` | 6 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/taches?vue=a-faire` | 6 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/taches?vue=en-retard` | 6 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/taches?vue=toutes` | 5 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/tutoriels` | 2 | 1 | 1 | 0 | 2/0/0/0/0/0 | 10 | 0 | 0 | 0 |

### Espace repris par import (Martine), 40 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 4 | 1 | 1 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/?vue=liste` | 3 | 1 | 1 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/?vue=semaine` | 4 | 1 | 1 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/aide` | 4 | 4 | 3 | 1 | 115/0/0/0/0/0 | 115 | 0 | 0 | 0 |
| `/aide/ecrans/[key]` | 0 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/aide/tutoriels/[key]` | 1 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/apps` | 1 | 1 | 1 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/demarrage/essentiel` | 2 | 2 | 2 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/demarrage/pret` | 2 | 0 | 0 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 1 |
| `/events` | 4 | 5 | 4 | 4 | 0/0/0/0/0/0 | 6 | 1 | 1 | 7 |
| `/events/[id]` | 9 | 6 | 4 | 6 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/events/[id]?onglet=apercu` | 9 | 6 | 4 | 6 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/events/[id]?onglet=apercu&modifier` | 15 | 12 | 8 | 12 | 0/0/0/0/0/0 | 1 | 1 | 0 | 0 |
| `/events/[id]?onglet=budget` | 9 | 6 | 4 | 2 | 0/0/1/0/0/0 | 2 | 0 | 11 | 13 |
| `/events/[id]?onglet=devis` | 9 | 6 | 4 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/events/[id]?onglet=documents` | 8 | 6 | 4 | 2 | 0/0/0/0/0/0 | 1 | 0 | 0 | 1 |
| `/events/[id]?onglet=invites` | 7 | 6 | 4 | 2 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/events/[id]?onglet=maries` | 7 | 6 | 4 | 1 | 0/0/0/0/0/0 | 4 | 0 | 0 | 0 |
| `/events/[id]?onglet=programme` | 10 | 6 | 4 | 2 | 0/0/0/0/5/0 | 4 | 0 | 0 | 0 |
| `/events/[id]?onglet=programme&importer` | 10 | 6 | 4 | 2 | 0/0/0/0/5/0 | 4 | 0 | 0 | 0 |
| `/events/[id]?onglet=retroplanning` | 10 | 6 | 4 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 6 |
| `/events/[id]?onglet=retroplanning&vue=a-faire` | 10 | 6 | 4 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 6 |
| `/events/[id]?onglet=retroplanning&vue=en-retard` | 10 | 6 | 4 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 6 |
| `/events/[id]?onglet=retroplanning&vue=toutes` | 10 | 6 | 4 | 1 | 0/0/0/0/0/0 | 1 | 0 | 0 | 6 |
| `/events/new` | 1 | 1 | 1 | 1 | 0/0/0/0/0/0 | 2 | 0 | 0 | 0 |
| `/import` | 1 | 0 | 0 | 0 | 4/0/0/1/0/0 | 5 | 2 | 0 | 0 |
| `/import/[importId]/journal` | 3 | 2 | 1 | 1 | 0/0/0/1/0/0 | 1 | 0 | 0 | 1 |
| `/notifications` | 1 | 1 | 1 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/prestataires` | 6 | 4 | 2 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 56 |
| `/prestataires/[id]` | 1 | 1 | 0 | 6 | 0/0/0/0/0/0 | 0 | 0 | 0 | 3 |
| `/prestataires/[id]?modifier` | 4 | 4 | 3 | 7 | 1/0/0/0/0/0 | 0 | 0 | 0 | 3 |
| `/prestataires/nouveau` | 2 | 2 | 2 | 1 | 1/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/prestataires?fiche` | 7 | 5 | 3 | 3 | 0/0/0/0/0/0 | 0 | 1 | 0 | 56 |
| `/prestataires?vue=carte` | 6 | 4 | 2 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 23 |
| `/recherche` | 0 | 0 | 0 | 0 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/taches` | 6 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/taches?vue=a-faire` | 6 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/taches?vue=en-retard` | 6 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/taches?vue=toutes` | 5 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/tutoriels` | 2 | 1 | 1 | 0 | 2/0/0/0/0/0 | 10 | 0 | 0 | 0 |

### Agence, 65 évènements (Nadia), 10 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 3 | 0 | 2 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/?vue=liste` | 2 | 0 | 2 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/?vue=semaine` | 3 | 0 | 2 | 0 | 0/0/0/0/0/0 | 1 | 0 | 0 | 0 |
| `/events` | 4 | 5 | 4 | 4 | 0/0/0/0/0/0 | 72 | 65 | 65 | 7 |
| `/prestataires` | 6 | 4 | 3 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 9 |
| `/prestataires?vue=carte` | 6 | 4 | 3 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 11 |
| `/taches` | 6 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/taches?vue=a-faire` | 6 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/taches?vue=en-retard` | 6 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |
| `/taches?vue=toutes` | 5 | 4 | 4 | 2 | 0/0/0/0/0/0 | 0 | 0 | 0 | 7 |

### Inscription : démarrage, 2 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/demarrage` | 1 | 1 | 1 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |
| `/demarrage/essentiel` | 2 | 2 | 2 | 1 | 0/0/0/0/0/0 | 0 | 0 | 0 | 0 |

### Assistant d'import, import en cours (Martine), 3 écrans

| Écran | Zones 1440 | Zones 375 | Zones zoom | Boutons principaux | Sur deux lignes en 1440 (bouton/onglet/colonne/ligne/champ/pastille) | Sur deux lignes en 375 | Liens sans signe | Cliquable sans rôle | Cibles < 44 px en 375 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/import/[importId]/colonnes` | 5 | 4 | 4 | 1 | 0/0/8/1/0/0 | 10 | 0 | 0 | 0 |
| `/import/[importId]/rapprochements` | 6 | 4 | 4 | 21 | 0/0/0/0/0/0 | 11 | 0 | 0 | 66 |
| `/import/[importId]/types` | 5 | 3 | 3 | 1 | 0/0/1/6/0/0 | 9 | 0 | 0 | 0 |

## 6. Ce que le relevé ne couvre pas

- **Jumeaux.** Le mariage repris n'est pas le mariage de référence : la comparaison porte sur la
  forme des écrans, pas sur les valeurs. Pour le parcours L68-PC-09, les fichiers d'export du
  mariage de référence sont à produire avec les générateurs du corpus
  (`packages/testing/import-corpus/generate_*.py`).
- **Imports non rejoués.** Les 600 contacts, le budget en tableur et les tâches (« Un autre
  fichier »).
- **Assistant d'import.** Trois étapes mesurées (types, colonnes, rapprochements). « Lignes »,
  « Écarts » et « Vérifier et confirmer » renvoient à l'étape en cours tant qu'elle n'est pas
  franchie : elles ont été capturées pendant la préparation (9 images), pas mesurées.
- **Espaces préparés par l'outil de test.** L'espace vide et l'espace repris ont été créés par
  l'aide des parcours (`readyOrganization`), sans passer par l'assistant de démarrage. Ce que
  l'assistant installe (modèles de départ) peut y manquer : « Aucun modèle de rétroplanning » est à
  revérifier sur un espace né d'une vraie inscription, en phase 3.
- **Démarrage.** Deux écrans relevés (première question, « L'essentiel ») ; la suite demande des
  réponses, que l'outil ne donne pas.
- **Agence.** Le jeu fictif donne à l'agence 65 évènements et prospects mais **ni tâche ni
  prestataire** : « Tâches » et le carnet y sont vides. Les parcours L68-PC-03, 05 et 06 de SU-02,
  SU-03 et L68-SU-C demandent un complément de données.
- **Fiches de modèle.** Aucun modèle de rétroplanning, de programme, de message ni de questionnaire
  dans les espaces relevés : leurs fiches ne sont pas atteintes.
- **Visites guidées.** L'ouverture automatique des visites est coupée pendant le relevé ; elles se
  verront en phase 3.
- **États d'erreur**, messages après action, annulation : hors de portée de l'outil.

## 7. Rejouer le relevé

Socle de dev démarré, base migrée, jeu fictif chargé, app servie :

```bash
cd apps/symbola
RELEVE_DIR=/tmp/releve RELEVE_ZOOM=1 pnpm exec playwright test e2e/zz-releve-ergonomie.spec.ts --project desktop
```

Réglages : `RELEVE_EMAIL` (compte fictif), `RELEVE_SCOPE` (motif des adresses à garder),
`RELEVE_START` (adresses de départ), `RELEVE_ORIGIN` et `RELEVE_SESSION` (app servie sur un autre
port que celui du fournisseur d'identité : jeton d'une session ouverte en base).
