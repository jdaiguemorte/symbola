# Maquettes du volet 1 : le transverse et « Tâches » (lot 68, phase 5)

Date : 25/11/2026, par Claude Code. Premier volet de l'ordre validé à la porte 2
([06-decisions-porte-2.md](06-decisions-porte-2.md), § 3). Cette note accompagne les maquettes ; elle
dit ce qui est proposé, ce que Julien doit trancher, et ce qui n'est pas traité. Aucun écran de l'app
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
  « Place dans le rétroplanning » et « Étape clé » ; « Supprimer » passe dans le menu du panneau ; le
  bouton plein est l'action de la tâche, « Marquer comme faite ».
- **Créer** : « Nouvelle tâche » en haut de l'écran ; le même panneau en mode création ; le premier
  champ est l'évènement, avec « Aucun évènement » en tête de liste ; la répétition n'apparaît que sans
  évènement. Le formulaire du bas de page disparaît.
- **Filtres** : Évènement, Qui s'en charge, Période, État ; un tri ; « 8 tâches à faire sur 42 » ;
  chaque filtre posé devient une pastille. Sur téléphone, un bouton « Filtres » ouvre un panneau du
  bas qui finit par « Voir les 2 tâches ».
- **Changer la date** : un seul nom et un seul petit panneau (raccourcis datés en clair et « Autre
  date »), depuis la ligne, le panneau et la sélection ; « Annuler » dans le message de retour.
  « Reporter » est rendu à l'évènement.
- **Sélection en lot** : on y entre par « Sélectionner » ; la barre d'actions flotte en bas sans
  pousser la liste ; sur téléphone, elle remplace la barre du bas et chaque choix s'ouvre en panneau du
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
  « Où en est-il ? » ; « je le reprends » mène à la reprise (« Continuer vers la reprise ») ; le
  client est un champ.
- **Recherche** : résultats rangés par type et comptés, réglages compris, Entrée ouvre le premier.
- **Téléphone (D4)** : barre du haut de 60 px (titre, recherche, créer, notifications, aide) ; barre
  du bas Aujourd'hui, Évènements, Tâches, Prestataires, Plus ; « Plus » en panneau du bas, « Se
  déconnecter » en dernier, à part.
- **Retour après action** : un message en bas à gauche du contenu (au-dessus de la barre du bas sur
  téléphone), un à la fois, avec « Annuler » en vrai bouton et une barre de temps ; dix secondes quand
  on peut défaire. Un catalogue des cas (défaire, supprimer, créer, copier, échec).
- **Danger** : trois niveaux (se défait : pas de question, « Annuler » et Corbeille ; touche des
  tiers : fenêtre avec la conséquence et « Garder … » ; ne se défait pas : une case à cocher en plus).
- **Erreur de saisie** : validation par Symbola, en français, sous le champ, avec le mot du libellé ;
  résumé en tête à partir de deux erreurs ; « * » avant l'envoi ; bouton jamais grisé sans raison.
- **Lexique** : un tableau des mots, un des verbes, un des mots incompris ; la colonne « On n'écrit
  plus » sert de liste de départ au contrôle automatique des textes (P-15).
- **États et teintes (répartition A, en rôles)** : un mot et une icône par état ; la couleur d'action
  (l'émeraude aujourd'hui, le bleu demain) ne porte que l'action et les liens : « Faite »,
  « Enregistré » et les bandeaux d'information passent en neutre ; l'attente d'un tiers et
  l'échéance proche (« Dans 4 jours », icône d'horloge) sont neutres, l'ambre quitte les listes ; le
  rouge ne dit que le vrai retard et n'habille plus « Supprimer ». L'orange n'apparaît dans aucune
  maquette : il est réservé au logo, aux illustrations et aux écrans vides.

## 3. Les choix laissés à Julien

| # | Question | Proposé dans les maquettes | Autre voie |
| --- | --- | --- | --- |
| M1 | Le panneau d'une tâche s'enregistre-t-il champ par champ ? | Oui, à la sortie de chaque champ, « Enregistré à 14 h 32 » ; seule la création a son bouton « Créer la tâche » (dans l'esprit de D7) | Un bouton « Enregistrer » en pied, comme aujourd'hui |
| M2 | Comment entre-t-on en sélection en lot ? | Par un bouton « Sélectionner » ; la case n'existe qu'en mode sélection (elle ne côtoie jamais « Fait ») | Case toujours visible en tête de ligne ; plus rapide pour les habitués, mais la confusion de C-35 revient |
| M3 | Sur l'accueil, une tâche confiée aux mariés garde-t-elle « Fait » ? | Oui : la planner coche après un appel ; la ligne reste la même partout | Pas d'action rapide pour ce qui attend un tiers ; le titre ouvre le panneau |
| M4 | Le nom du mariage, dans la ligne, est-il un lien ? | Non : texte simple ; le filtre « Évènement », l'en-tête de groupe (« Ouvrir la fiche ») et le menu « Ouvrir l'évènement » y mènent | Lien vers la fiche : une seconde cible par ligne, contre D10 |
| M5 | Quelle forme pour le message de retour ? | Fond encre, texte blanc, accent de nuit (jetons existants) : il se distingue des bandeaux de la page | Fond `primary-soft` de la règle « Messages » du lot 62, avec une ombre |
| M6 | « Annuler » seul garde-t-il le sens de « défaire » ? | Oui, et « Annuler l'évènement » garde toujours son complément, jamais à côté d'un « Annuler » seul | « Défaire » pour le message de retour |
| M7 | Le compte quitte-t-il le bas du menu latéral ? | Oui, pour un menu sous le prénom dans la barre du haut | Le garder en bas, replié |
| M8 | L'option active d'une bascule (« Liste / Calendrier ») | Pleine, en encre, texte blanc | Rester en émeraude, mais pleine (aujourd'hui fond pâle à 1,16:1) |
| M9 | La recherche du haut (C-12, « à trancher ») | Résultats par type, réglages compris, Entrée ouvre le premier | La laisser en l'état tant qu'aucun profil ne l'a essayée |
| M10 | Le seuil de « Bientôt » (état neutre, icône d'horloge) | Sept jours, à régler par organisation (aucune règle métier en dur, CLAUDE.md § 2) | Un autre seuil de départ |
| M11 | Chaque ligne du lexique (page 5) | Proposée ; les mots du budget, des prestataires, de la reprise et des Paramètres sont à confirmer dans leurs volets | Mot à mot |

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

## 6. Limites

- **Les maquettes n'ont pas été rejouées par les profils du panel.** Le cadrage prévoit que chaque
  maquette soit rejouée par les profils concernés avant d'être présentée ; ce volet est rendu sans ce
  rejeu, qui peut se faire avant la porte 3 ou à la demande de Julien (PC-06 et PC-03 en priorité).
  Bastien n'est pas un profil du panel : c'est le collègue fictif des maquettes, nommé ainsi pour ne
  pas se confondre avec le profil Hugo.
- Vérifié dans le navigateur aux deux tailles : aucune commande de moins de 44 px dans les cadres de
  375 px, aucun débordement de côté, aucun libellé de bouton sur deux lignes (contrôle par script sur
  les cinq pages, puis lecture à l'œil). Les titres de tâche peuvent passer sur deux lignes sur
  téléphone, c'est voulu.
- Pas de version aux couleurs du trio : les valeurs ne sont pas connues. La répartition A est
  appliquée en rôles aux jetons actuels ; la page 5 dit le rôle de chaque teinte. L'« À vérifier »
  et l'« Erreur » gardent leurs fonds d'alerte (règle du lot 62) : le crème ne leur servira pas.
- Quelques états « avant » n'ont pas de capture au relevé (panneaux, sélection, erreurs, menu
  « Reporter ») : ils sont décrits à partir des constats.

## 7. Ce que Julien valide à la porte 3 de ce volet

1. La ligne type d'une tâche, ses quatre formes et le panneau unique (pages 1 et 2), M1 à M4.
2. L'écran « Tâches » : création, filtres, « Changer la date », sélection, vides, tâches faites.
3. La barre du haut, « + Créer », « Nouvel évènement » (D8), la recherche (M9), la barre du bas (D4),
   M7.
4. Le message de retour (M5, M6), les trois niveaux de danger, l'erreur de saisie.
5. Le lexique, ligne par ligne (M11), et le tableau des états et des teintes, lu dans la
   répartition A (M8, M10).
6. Le rejeu des maquettes par le panel avant la porte 3 : oui ou non.

Une fois ce volet validé, ses règles de forme alimentent le Design System (phase 6) et les maquettes
du volet 2 (reprise et import) partent de la ligne type, du panneau et des messages fixés ici.
