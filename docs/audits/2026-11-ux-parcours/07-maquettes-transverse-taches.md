# Maquettes du volet 1 : le transverse et « Tâches » (lot 68, phase 5)

Date : 25/11/2026, par Claude Code. Premier volet de l'ordre validé à la porte 2
([06-decisions-porte-2.md](06-decisions-porte-2.md), § 3). Cette note accompagne les maquettes ; elle
dit ce qui est proposé, ce que Julien a tranché à la porte 3 (§ 3), et ce qui n'est pas traité. Aucun écran de l'app
n'est modifié et `DESIGN.md` n'est pas touché : le Design System s'écrit après la porte 3.

## 1. Les livrables

Cinq pages HTML autonomes dans [`docs/maquette/lot-68/`](../../maquette/lot-68/index.html), à ouvrir dans un
navigateur depuis le dépôt (les captures « avant » sont lues dans [`preuves/`](preuves/)) :

| Page | Contenu | Constats |
| --- | --- | --- |
| [1. La ligne type et son panneau](../../maquette/lot-68/01-taches-ligne-et-panneau.html) | La ligne type et ses quatre formes ; « Aujourd'hui », la fiche, le téléphone ; le panneau unique | C-34, C-35, C-38, C-39, C-77, C-90 ; D3 |
| [2. L'écran « Tâches »](../../maquette/lot-68/02-taches-ecran.html) | Rempli ; créer avec ou sans évènement ; filtres ; « Changer la date » ; sélection en lot ; vide, tout fait, sans résultat, mariage repris ; tâches faites | C-31, C-32, C-33, C-36, C-37, C-40 ; D1 |
| [3. Barres et « + Créer »](../../maquette/lot-68/03-transverse-barres.html) | Barre du haut fixe et menu du compte ; « + Créer » ; « Nouvel évènement » et « Où en est-il ? » ; recherche ; barre du bas du téléphone et « Plus » | C-03, C-12, C-13, C-81, C-84 ; D4, D8 |
| [4. Retour, danger, erreur](../../maquette/lot-68/04-transverse-retours.html) | Le message de retour et ses cas ; trois niveaux de danger ; l'erreur de saisie | C-04, C-08, C-09 |
| [5. Lexique, états, teintes](../../maquette/lot-68/05-transverse-mots-etats.html) | Mots des objets, verbes, mots incompris ; chaque état avec son mot, son icône, sa teinte | C-83, C-85 à C-90 |

Chaque maquette montre l'écran d'aujourd'hui (capture du relevé, ou description quand le relevé n'a
pas de capture de cet état) à côté de l'écran proposé, en 1 440 et en 375 px, et les états vide,
rempli et repris quand ils diffèrent. Sous chacune : les constats traités et les règles de forme de
D10 (zones d'action, action principale, ligne à une cible, une action rapide et un menu). Les cadres
d'ordinateur sont réduits pour tenir côte à côte ; le bouton « L'un sous l'autre, taille réelle » les
montre à 1 440 px.

Forme : jetons actuels de `DESIGN.md` seulement, aucune teinte du futur trio ; la répartition des
couleurs retenue à la porte 2, **A, « orange de marque seulement »** ([06, § 6](06-decisions-porte-2.md)),
est appliquée en rôles (voir § 2) ; polices Inter et
Space Grotesk si elles sont installées, sinon celles du système (aucune ressource externe) ; données
fictives (agence « Atelier Roussel », Camille et son collègue Bastien, quatre mariages).

## 2. Ce qui est proposé

**Tâches.**

- **Une ligne type** (D3) : le titre, seule cible, ouvre le panneau ; l'évènement, l'échéance avec
  son état en toutes lettres (« En retard de 5 jours », « Dans 4 jours »), qui s'en charge ; une
  action rapide « Fait », bouton nommé ; un menu « ⋯ » (« Changer la date… », « Confier à… »,
  « Ouvrir l'évènement », puis « Supprimer », à part). Plus de case sans libellé, de rond, ni de trois
  boutons par ligne. Quatre formes : « Tâches », fiche (sans la colonne Évènement), « Aujourd'hui »
  (sans menu), téléphone (trois étages, commandes de 44 px).
- **Un seul panneau** : la fenêtre longue de `DESIGN.md` (860 px, deux colonnes), ouverte de partout,
  en page entière sur téléphone. Un seul libellé, « Qui s'en charge » ; « Rang et jalon » devient
  « Place dans le rétroplanning » et « Étape clé » ; « Supprimer » passe dans le menu du panneau. Pied : « Fait » à
  gauche, « Fermer » et « Enregistrer » (le bouton plein) à droite ; « Fermer » demande « Fermer sans
  enregistrer ? » s'il reste des changements (M1).
- **Créer** : « Nouvelle tâche » en haut de l'écran ; le même panneau en mode création ; le premier
  champ est l'évènement, avec « Aucun évènement » en tête de liste ; la répétition n'apparaît que sans
  évènement. Le formulaire du bas de page disparaît.
- **Filtres** : Évènement, Qui s'en charge, Période, Catégorie, État ; « Grouper par » (mois,
  évènement, qui s'en charge) ; « 8 tâches à faire sur 42 » ; chaque filtre posé devient une
  pastille. « En retard » groupé par personne donne les retards de toute l'équipe sur un écran. Sur
  téléphone, « Mes tâches » en un toucher, et un bouton « Filtres » ouvre un panneau du bas qui finit
  par « Voir les 4 tâches ».
- **Changer la date** : un seul nom et un seul petit panneau (raccourcis datés en clair et « Autre
  date »), depuis la ligne, le panneau et la sélection ; « Annuler » dans le message de retour.
  « Reporter » est rendu à l'évènement.
- **Sélection en lot** : on y entre par « Sélectionner » ; la barre d'actions se colle au bas de la
  liste sans la pousser, bordée d'encre, le nombre de tâches choisies en tête (M2) ; sur téléphone, elle remplace la barre du bas et chaque choix s'ouvre en panneau du
  bas.
- **Vide** : trois textes (rien encore, tout est fait, aucun résultat) ; dans l'espace neuf, l'état
  vide porte la seule action principale. **Repris** : un mariage repris sans tâches est signalé dans la
  liste, « À vérifier : », avec « Reprendre une liste » (vers la page de reprise, D11/C-54) et
  « Partir d'un modèle ».
- **Onglet** : il s'appelle « Tâches » dans la fiche comme dans le menu ; le rétroplanning est cité
  sous le titre avec son modèle.
- **D1** : « État : Faites » trie par date de fin, la plus récente en tête, avec qui et quand, et
  « Rouvrir » à la place de « Fait » ; on y arrive aussi par « 3 tâches faites aujourd'hui · Les
  revoir » sur l'accueil et par le panneau d'une tâche faite.

**Transverse.**

- **Barre du haut** fixe au défilement ; le compte passe dans un menu sous le prénom (le menu latéral
  perd 200 px) ; « Apps » devient « Tous les modules ».
- **« + Créer »** : Nouvel évènement, Tâche, Prestataire, Contact, Devis, Dépense, chacun avec une
  phrase, et le contexte écrit (« Tâche pour Léa & Maxime »). **D8** : « Nouvel évènement » pose
  « Où en est-il ? », à deux réponses, aucune cochée d'avance ; la reprise est une ligne à part,
  « Reprendre ses fichiers » (M12, M13) ; le client est un champ.
- **Recherche** : résultats rangés par type et comptés, Entrée ouvre le premier ; les réglages
  viennent au volet « Paramètres » (M9).
- **Téléphone (D4)** : barre du haut de 60 px (titre, recherche, créer, notifications, aide) ; barre
  du bas Aujourd'hui, Évènements, Tâches, Prestataires, Plus ; « Plus » en panneau du bas, « Se
  déconnecter » en dernier, à part.
- **Retour après action** : un message en bas à gauche du contenu (au-dessus de la barre du bas sur
  téléphone), un à la fois, avec « Annuler » en vrai bouton, en accent de nuit, et une barre de temps ; dix secondes quand
  on peut défaire. Un catalogue des cas (défaire, supprimer, créer, copier, échec).
- **Danger** : trois niveaux (se défait : pas de question, « Annuler » et Corbeille ; touche des
  tiers : fenêtre avec la conséquence et « Garder … » ; ne se défait pas : une case à cocher en plus).
- **Erreur de saisie** : validation par Symbola, en français, sous le champ, avec le mot du libellé ;
  résumé en tête à partir de deux erreurs ; « * » avant l'envoi ; bouton jamais grisé sans raison.
- **Lexique** : un tableau des mots, un des verbes, un des mots incompris ; la colonne « On n'écrit
  plus » sert de liste de départ au contrôle automatique des textes (P-15).
- **États et teintes (répartition A, en rôles)** : un mot et une icône par état ; la couleur d'action
  (l'émeraude aujourd'hui, le bleu demain) ne porte que l'action et les liens : « Faite »
  et les bandeaux d'information passent en neutre ; l'attente d'un tiers et
  l'échéance proche (« Dans 4 jours », icône d'horloge) sont neutres, l'ambre quitte les listes ; le
  rouge ne dit que le vrai retard et n'habille plus « Supprimer ». L'orange n'apparaît dans aucune
  maquette : il est réservé au logo, aux illustrations et aux écrans vides.

## 3. Les décisions de Julien (porte 3, 25/11/2026)

Julien a tranché M1 à M13 un par un le 25/11/2026, dans la session d'audit. Ses mots sont entre
guillemets quand ils s'écartent de la proposition. Les maquettes sont corrigées en conséquence.

| # | Question | Décision | Dans les maquettes |
| --- | --- | --- | --- |
| M1 | Le panneau d'une tâche s'enregistre-t-il champ par champ ? | **Non.** « je préfère un bouton enregistrer sur cette maquette mais le reste est très bien » | Pied du panneau : « Fait » à gauche, « Fermer » et « Enregistrer » à droite ; avec des changements, « Fermer », la croix et Échap demandent « Fermer sans enregistrer ? » (« Revenir à la tâche », « Fermer sans enregistrer », « Enregistrer et fermer »). « … enregistrée à 14 h 32 · Annuler la modification » est retiré. Sur téléphone, « ← Tâches » joue le rôle de « Fermer » (page 1) |
| M2 | Comment entre-t-on en sélection en lot ? | **Par le bouton « Sélectionner »**, avec une réserve : « si sur téléphone, le menu est visible, sur desktop, le bandeau est moins évident pour les choix » | À l'ordinateur, la barre se colle au bas de la liste, de toute sa largeur, bord d'encre et ombre, « 3 tâches sélectionnées » en tête, boutons de taille normale (page 2). Validée sans essai par le panel : « Ok pour la barre. » (Julien, 25/11) |
| M3 | Sur l'accueil, une tâche confiée aux mariés garde-t-elle « Fait » ? | **Oui.** Aucun bouton de relance : « la relance est à la main de la wedding planner, on ne rajoute pas de bouton » | Inchangé ; la règle est écrite sous « Aujourd'hui » (page 1) |
| M4 | Le nom du mariage, dans la ligne, est-il un lien ? | **Sur « Aujourd'hui » seulement**, séparé du titre, cible de 44 px sur téléphone ; texte simple dans « Tâches » et dans la fiche | Ligne allégée d'« Aujourd'hui » à 1 440 et 375 px (pages 1 et 3) ; le lien d'en-tête du panneau reste (P-11) |
| M5 | Quelle forme pour le message de retour ? | **Bandeau sombre**, comme proposé | Fond `ink` (#14181F), texte blanc ; « Annuler » en `night-accent` (#5FD3B8) : **9,7:1** sur l'encre ; texte secondaire en `night-ink-muted` (#A9B3C1) : **8,4:1** (il était en #C9D0DA, hors jetons) ; la coche reste blanche (page 4) |
| M6 | « Annuler » seul garde-t-il le sens de « défaire » ? | **Oui.** « Annuler l'évènement » toujours en entier, « Garder l'évènement » pour renoncer | Règle écrite page 4 et au lexique ; « Vous pourrez le rétablir depuis sa fiche » vérifié contre l'app (voir les contrôles ci-dessous) |
| M7 | Le compte quitte-t-il le bas du menu latéral ? | **Oui**, pour un menu sous le prénom dans la barre du haut | Contrôlé à 911 px de large (C-82) : la barre fait 679 px, le texte d'aide de la recherche passait sur trois lignes et sortait de la barre. Corrigé : sous 760 px de barre, il devient « Rechercher… ». Recherche, « Créer », notifications, aide et compte tiennent alors sans rien couper, toutes de 44 px de haut, le compte finissant à 631 px (page 3) |
| M8 | L'option active d'une bascule | **En encre**, pleine, texte blanc ; la règle vaut pour toutes les bascules et tous les filtres actifs | Écrit au tableau des états (page 5) |
| M9 | La recherche du haut (C-12) | **Maquette validée comme cible, en deux temps** : la barre fixe et le type des résultats avec ce volet ; la recherche dans les réglages au volet « Paramètres » | Écrit en tête de la maquette (page 3) |
| M10 | Le seuil de « Bientôt » | **Sept jours, réglable par organisation**, rangé dans une rubrique existante des Paramètres (à choisir au volet « Paramètres »), sans écran de réglage neuf | Écrit au tableau des états (page 5) |
| M11 | Le lexique (page 5) | **Validé, avec deux corrections** : le panneau d'une tâche dit « Fermer » (M1) ; « Fait » est le seul libellé du geste, dans le panneau, sur la ligne et en lot (plus de « Marquer comme faite ») | Lignes « Annuler (seul) », « Fermer » et « Fait · Rouvrir » réécrites ; « Fait » partout. L'onglet de la fiche s'appelle « Tâches » : « Tâches convient pour le nom d'onglet » (Julien, précision du 25/11) |
| M12 | La troisième réponse de « Où en est-il ? » (D8) | **Deux réponses seulement** (« Une demande en cours », « Signé, en préparation ») ; la reprise sort de la liste, en ligne à part dessous : « Vous le suivez déjà dans un autre logiciel ou un tableur ? Reprendre ses fichiers » | Page 3, à 1 440 et 375 px. Retenue **sans essai par le panel** : « Lance ta ligne à part sans essai panel » (Julien, précision du 25/11) |
| M13 | Une réponse cochée d'avance dans « Où en est-il ? » | **Aucune.** « Créer l'évènement » reste actif ; cliqué sans réponse, il écrit sous la question « Choisissez où en est cet évènement » (pas de bouton grisé muet) | Page 3, état « cliqué sans réponse » à 1 440 px |

**Les trois contrôles demandés par Julien, et leur résultat :**

1. **Contraste d'« Annuler » sur le bandeau sombre (M5)** : `night-accent` #5FD3B8 sur `ink`
   #14181F, **9,7:1** (seuil WCAG AA : 4,5:1 pour le texte, 3:1 pour le bord du bouton). Le texte
   secondaire, en `night-ink-muted` #A9B3C1, est à **8,4:1**. Tenu.
2. **Barre du haut à 911 px de large (M7, C-82)** : la barre mesure 679 px à côté du menu latéral
   de 232 px. Au premier contrôle, le texte d'aide de la recherche passait sur trois lignes et
   sortait de la barre : **non tenu**. Corrigé : sous 760 px de barre, il devient « Rechercher… ».
   Recherche, « Créer », notifications, aide et compte tiennent alors sur une ligne, sans rien
   couper ; toutes les commandes font 44 px de haut et la dernière finit à 631 px. **Tenu après
   correction.** Seule la barre a été mesurée : le contenu des écrans à cette largeur (le tableau
   d'une fiche, par exemple) relève de chaque volet.
3. **« Vous pourrez le rétablir depuis sa fiche » (M6), contre l'app** : la phrase est vraie en
   partie, mais « tout revient comme avant » était faux.
   - La fiche d'un évènement annulé a un bouton « Réactiver (repasse en Option) »
     (`app/events/[id]/change-status-form.tsx`, `reactivateEvent` dans `modules/events/service.ts`) :
     on peut donc le rétablir depuis sa fiche.
   - L'évènement revient en « Option », c'est-à-dire en demande en cours, et non à son statut d'avant
     (`canSetStatus` dans `modules/events/lifecycle.ts` : depuis « Annulé », seule « Option » est
     permise).
   - Les liens des clients et des prestataires ne sont pas révoqués : ils sont refusés tant que
     l'évènement est annulé, et se rouvrent quand il est rétabli.
   - À l'annulation, l'app annonce aussi : les rappels s'arrêtent, les factures d'acompte
     programmées ne partent plus, les factures déjà émises restent avec un avoir proposé pour
     chacune. Les « 11 tâches mises de côté » de la maquette n'existaient pas dans l'app.

   La fenêtre de la page 4 dit maintenant ce que fait l'app : « il revient comme demande en cours,
   à confirmer de nouveau », le lien qui se rouvre, les rappels et les acomptes, l'avoir. Mot retenu
   par Julien : « On garde la maquette pour rétablir. » L'app s'y accordera au lot de réalisation,
   « rétablir » à la place de « Réactiver ». Non vérifié : ce que deviennent, au rétablissement, les rappels et les acomptes
   programmés.

**Ce qui reste :**

1. M12 est retenue sans essai par le panel, à la demande de Julien : la ligne « Reprendre ses
   fichiers » n'a été essayée par aucun profil.
2. La rubrique des Paramètres qui portera le seuil de « Bientôt » (M10) et la recherche dans les
   réglages (M9) : au volet « Paramètres ».

## 4. Ce que les maquettes supposent hors de l'écran

À spécifier au lot de réalisation, pas à décider ici :

- **Des collègues dans « Qui s'en charge »** (C-32) : aujourd'hui une tâche n'a pour responsable que
  « Planner », « Mariés » ou un prestataire. Changement de données dans le module des tâches.
- **« Faite le » et « Par »** pour trier et afficher les tâches faites (D1) : à vérifier dans le
  schéma ; à ajouter sinon.
- **La Corbeille pour une tâche supprimée** (C-08) : la Corbeille des Paramètres existe ; la tâche
  y entre-t-elle ? À vérifier dans le code.
- **La validation par Symbola** des formulaires (C-04, P-18) : messages écrits par l'app à la place
  de la bulle du navigateur.
- **Les textes de conséquence** d'« Annuler l'évènement » sont des exemples : à caler sur ce que fait
  vraiment l'annulation.
- **« Partir d'un modèle » sur un mariage repris** sans mettre en retard les échéances passées
  (P-01) : règle à écrire avec le volet reprise.

## 5. Constats du volet non traités, et pourquoi

| Constat | Pourquoi | Où il sera traité |
| --- | --- | --- |
| C-01, C-02, C-05, C-06, C-07, C-10 (visites, aide, tutoriels) | Ce sont les constats du volet « Premiers pas et aide » (D2, D6) ; seul « Apps » est renommé ici, au lexique | 3e vague, « Premiers pas et aide » |
| C-11 (bouton « Réglages » des écrans) | Le sort de ce bouton est une question des Paramètres. Les maquettes de « Tâches » ne le montrent plus et mettent le lien vers le modèle de rétroplanning dans la phrase ; à confirmer | 3e vague, « Paramètres » |
| C-13 | Correction simple (lot de corrections) ; la maquette montre « 2 en retard » sur une ligne et l'adresse du compte lisible | Lot de corrections |
| C-14 (vue d'agence) | Relève d'« Aujourd'hui » ; le filtre « Qui s'en charge » en donne la base dans « Tâches » | 3e vague, « Aujourd'hui » |
| C-17 (« (Today.source.vendors) ») | Correction simple | Lot de corrections |
| C-78, C-79, C-80 | Écrans du budget, des Paramètres et de la fiche ; la barre d'onglets de la fiche n'est qu'esquissée ici | 3e vague, volets concernés |
| C-82 (menu coupé à 150 %) | En partie : le compte quitte le menu latéral (200 px gagnés) ; la mesure à 911 × 512 est à refaire sur la maquette du volet « Paramètres », qui traite aussi le panneau d'aide coupé | 3e vague, « Paramètres » |
| C-86, C-88 (mots du budget, « Reprendre ») | Proposés au lexique, à confirmer avec les écrans des volets « Prestataires » et « Reprise » | 2e et 3e vagues |
| C-89 (« événement ») | Correction simple déjà partie ; le lexique la rappelle | Lot de corrections |
| Vue « Calendrier » de « Tâches » | Acquis (garde les filtres, liste par jour sur téléphone) ; pas de constat | — |
| Points « à vérifier dans l'app » de C-36 (menu « Reporter » coupé, fenêtre « Modifier » du Rétroplanning) | Non revérifiés : la proposition supprime ces deux chemins | — |

## 6. Rejeu par le panel

Le 25/11/2026, à la demande de Julien, six passages, un agent par profil, avec le protocole de la
phase 3 adapté à des écrans statiques : chaque profil ne reçoit que sa fiche, un parcours en étapes
et les captures des écrans « Proposé », sans les textes d'explication ni l'écran d'aujourd'hui.
Journaux et correspondance des captures : [03-panel/rejeu-volet-1/](03-panel/rejeu-volet-1/README.md).

| Parcours | Profil | Taille | Notes des étapes | Abandons | Mesures |
| --- | --- | --- | --- | --- | --- |
| PC-06 Tâches | Valérie (L68-SU-C) | 1 440 | 2 · 1 · 2 · 3 · 3 · 2 · 2 | Aucun | Liste d'une personne en deux gestes : tenue ; même forme dans « Tâches » et la fiche : en partie |
| PC-06 Tâches | Camille (SU-01) | 375, puis 1 440 | 2 · 3 · 2 · 3 · 3 · 2 | Aucun | Liste d'une personne : non tenue sur téléphone, tenue sur ordinateur ; même forme : tenue |
| PC-03/PC-06 téléphone | Hugo (SU-03) | 375 | 3 · 3 · 1 · 2 · 2 · 2 · 2 | Aucun | Par quoi commencer en trente secondes : tenue ; deux gestes : en partie |
| PC-03 Lundi matin | Nadia (SU-02) | 1 440 | 3 · 3 · 2 · 1 · 2 · 3 | Aucun | Trente secondes : tenue ; deux gestes : en partie ; qui est en retard dans l'équipe : non tenue |
| Transverse, premiers pas | Clémence (L68-SU-D) | 375 | 2 · 2 · 1 · 2 · 3 · 2 · 2 | Aucun | Action nommée en dix secondes : tenue sauf après la création |
| Transverse, revenir en arrière | Sophie (SU-04) | 1 440 | 2 · 3 · 2 · 2 · 2 · 2 · 3 | Aucun | Revenir en arrière : en partie ; aucun message incompris : tenue ; aucun mot anglais : tenue |

À comparer à la phase 3 sur les mêmes gestes : créer une tâche sans évènement passe de 0 (Valérie,
Camille) à 3 et 2 ; filtrer par évènement de 0 à 1 (la catégorie manquait) ; « Fait » puis
« Annuler » reste à 3 ; aucune note 0, aucun abandon.

**Ce qui a plu** (plusieurs profils) : « Fait » puis « Annuler » ; les raccourcis de « Changer la
date » ; « Changer la date de 3 tâches » ; la création sans évènement et sa phrase « TVA,
assurance » ; les messages d'erreur sous le champ, qui gardent la saisie ; « Faites » puis
« Rouvrir » ; « Garder l'évènement » ; le menu « + Créer » qui dit le contexte ; la recherche rangée
par type.

**Corrigé dans les maquettes après le rejeu** (commit suivant 7d81ea1f) :

| Ce qu'a relevé le panel | Profils | Correction |
| --- | --- | --- |
| Pas de vue « en retard, par personne » | Valérie, Nadia | « Grouper par » (mois, évènement, qui s'en charge) remplace « Trier par » ; nouvelle maquette « En retard, par personne » (page 2, Filtrer) |
| Pas de filtre « Catégorie » (constat C-33, oublié) | Valérie | Cinquième filtre, à l'ordinateur, dans la fiche et sur téléphone |
| Sur téléphone, voir ses tâches demande quatre gestes ; le panneau des filtres arrive pré-réglé | Hugo, Camille | « Mes tâches » sur la liste et en tête du panneau ; le panneau s'ouvre sur les réglages en cours |
| Compteurs qui ne se recoupent pas ; pastille « 2 » inchangée après un report ; retards affichés dans un espace neuf ; « 90 jours avant le jour J » faux | Camille, Nadia, Clémence | Données des maquettes remises en cohérence (8 + 34 = 42, fiche à 20 tâches, pastille à 1 après le report, aucune pastille dans un espace neuf, « 195 jours ») |
| La tâche cochée par erreur absente des tâches faites ; « Par » ambigu | Nadia, Valérie | « Choisir le fleuriste » en tête des faites ; colonne « Cochée par » |
| Une réponse cochée d'avance dans « Où en est-il ? » ; « je le reprends » mal compris ; « rétroplanning » non expliqué | Sophie, Clémence | Aucune réponse cochée ; troisième réponse « Suivi dans un autre logiciel ou un tableur » ; « la liste des tâches se crée aujourd'hui ». Depuis la porte 3 : deux réponses et une ligne « Reprendre ses fichiers » à part (M12, M13) |
| Après la création, statut faux et pas de suite | Clémence | Statut « Signé, en préparation » ; « Voir ses tâches » dans le message |
| Dans l'espace neuf, « Nouvelle tâche » en bouton plein alors que les tâches naissent d'un évènement | Clémence | « Nouvel évènement » en action principale de l'état vide |
| L'annulation d'un évènement ne dit pas si l'on peut revenir en arrière ; « leur lien » flou | Sophie, Clémence | « Vous pourrez le rétablir depuis sa fiche » ; « leur lien personnel » ; tâches « mises de côté » (texte à caler sur le comportement réel) |
| Panneau : « Enregistré » ne dit pas quoi, pas d'« Annuler » ; « Fermer » collé au bouton plein | Sophie | « Note enregistrée à 14 h 32 · Annuler la modification » ; plus de « Fermer » en pied. Remplacé à la porte 3 : « Fermer » et « Enregistrer », avec « Fermer sans enregistrer ? » (M1) |
| « Annuler 10 s » pris pour un bouton ; tâche à supprimer mal nommée | Hugo | Le panneau nomme la tâche en titre ; « Supprimer la tâche » seul |
| « catégorie et note plus bas » ne mène nulle part ; « Reprendre une liste » ambigu | Camille | « + Ajouter une catégorie ou une note » ; « Reprendre la liste de votre tableur », « Partir d'un modèle Symbola » |
| « Échap » ; « Elle quitte la liste dans 6 secondes » | Sophie | « Un clic ailleurs ferme » ; « « Annuler » reste 10 secondes ; ensuite, « Rouvrir » » |
| « Se déconnecter » en gris, pris pour un bouton éteint | Clémence | En encre, séparé |
| Recherche : où mène Entrée | Nadia | Aide sous la liste : « Entrée ouvre le résultat surligné · flèches pour choisir » (M9 tranché à la porte 3) |

**Non corrigé, et pourquoi** :

- « Contacts » et « Prestataires » semblent faire la même chose dans « Plus » (Hugo) : question des
  volets « Prestataires » et « Contacts » (C-65 reporté, D11).
- « Vous » désigne la personne connectée ; un assistant qui joue Hugo sur l'espace de Camille s'y
  perd : biais du test, pas de l'écran.
- La fiche n'a pas « Grouper par » (Valérie) : elle groupe par mois ; à voir au volet « Évènements ».
- Vues enregistrées (Valérie) : nouvelle fonction, hors des maquettes ; proposée comme suite au lot
  de réalisation si Julien la veut.
- À 360 px (Hugo), les titres longs et la barre du bas seraient justes : à mesurer sur l'écran réel.

## 7. Limites

- Le rejeu est fait sur des captures statiques : les profils disent où ils cliqueraient, sans
  cliquer. Comme en phase 3, les profils et l'auteur des maquettes sont des agents du même modèle :
  leurs jugements ne sont pas indépendants. Sophie a jugé à 1 440 px ce qu'elle verrait à 911 px.
  Bastien n'est pas un profil du panel : c'est le collègue fictif des maquettes, nommé ainsi pour ne
  pas se confondre avec le profil Hugo.
- Vérifié dans le navigateur aux deux tailles : aucune commande de moins de 44 px dans les cadres de
  375 px, aucun débordement de côté, aucun libellé de bouton sur deux lignes (contrôle par script sur
  les cinq pages, puis lecture à l'œil). Les titres de tâche peuvent passer sur deux lignes sur
  téléphone, c'est voulu. Refait après les corrections de la porte 3, aux deux tailles : mêmes
  résultats ; la barre du haut mesurée en plus à 911 px (§ 3, M7).
- Pas de version aux couleurs du trio : les valeurs ne sont pas connues. La répartition A est
  appliquée en rôles aux jetons actuels ; la page 5 dit le rôle de chaque teinte. L'« À vérifier »
  et l'« Erreur » gardent leurs fonds d'alerte (règle du lot 62) : le crème ne leur servira pas.
- Quelques états « avant » n'ont pas de capture au relevé (panneaux, sélection, erreurs, menu
  « Reporter ») : ils sont décrits à partir des constats.

## 8. La porte 3 de ce volet

**Volet 1 validé par Julien le 25/11/2026.** Il a tranché M1 à M13 (§ 3) sur les maquettes des
pages 1 à 5 et les corrections du rejeu (§ 6), puis répondu aux précisions : onglet « Tâches »,
M12 sans essai par le panel, « rétablir » retenu (« On garde la maquette pour rétablir. »), barre de
sélection à l'ordinateur acceptée (« Ok pour la barre. »). Les trois contrôles demandés sont faits
(fin du § 3). Restent seulement les points renvoyés à d'autres volets ou au lot de réalisation,
listés après eux.

Ce volet validé, ses règles de forme alimentent le Design System (phase 6) et les maquettes
du volet 2 (reprise et import) partent de la ligne type, du panneau et des messages fixés ici.
