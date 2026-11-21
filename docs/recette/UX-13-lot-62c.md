# Rejeu UX-13 — lot 62c, fiche d'évènement (SU-01, SC-03)

Le paquet 62c du lot 62 (`docs/lots/lot-62-ergonomie.md`) reprend quatre écrans de la fiche
d'évènement après le relevé du 20/11/2026 (`docs/audits/2026-11-20-releve-ergonomie.md`) :
programme du jour J, budget, mariés, rétroplanning.

- Date : 21/11/2026, en local, par Claude Code.
- Environnement : app compilée (`next start`, `NODE_ENV=test`), base neuve `symbola_lot62c`, jeu
  fictif chargé par `seed:recette` ; Camille (Atelier Camille R.), mariage de référence « Léa &
  Maxime » (EV-REF-01) : 28 séquences sur trois temps forts, 30 lignes de budget dans neuf
  catégories, quatre liens personnels, 42 tâches.
- Parcours automatisés : `e2e/ux-13-lot-62c-fiche-evenement.spec.ts` (quatre parcours, ordinateur
  en 1440 × 900 et 375 px, axe-core), et les parcours existants du programme et du budget adaptés à
  l'enregistrement groupé.

## Mesures, avant et après

Mêmes calculs que l'outil du relevé (`e2e/zz-releve-ergonomie.spec.ts`), sur le même évènement.
« Avant » : le relevé du 20/11. Une hauteur se lit en écrans (1440 × 900, puis 375 × 812).

| Écran | Mesure | Avant | Après | Cible du lot |
| --- | --- | --- | --- | --- |
| Programme du jour J | Hauteur en 1440 px | 6,9 | 4,2 (28 séquences) ; 3 au plus pour treize (vérifié par le parcours) | 3 au plus pour treize séquences |
| | Hauteur en 375 px | 11,2 | 7,6 | — |
| | Boutons principaux | 34 | 0 au repos, 1 quand des lignes attendent | 1 au plus |
| | « Enregistrer la ligne » | 28 | 0 (un seul « Enregistrer le programme ») | — |
| | Cibles de moins de 44 px en 375 px | 282 | 0 | 0 |
| | Heures de plus de 260 px | 5 | 0 | 0 |
| Budget de l'évènement | Hauteur en 1440 px | 6,9 | 4,6 | — |
| | Hauteur en 375 px | 17,4 | 4,8 | 8 au plus |
| | Boutons principaux | 11 | 0 au repos, 1 quand des lignes attendent | 1 au plus |
| | « Ajuster » | 9 | 0 (un seul « Enregistrer la répartition ») | 0 |
| | Cibles de moins de 44 px en 375 px | 33 | 0 | 0 |
| Mariés | Hauteur en 1440 px | 5,8 | 2,9 | 3 au plus |
| | Hauteur en 375 px | 8,3 | 5,9 | — |
| | Champs empilés en 1440 px | 13 | 4 | moins de 6 |
| | Champs courts trop larges | 6 | 0 | 0 |
| | Boutons principaux | 9 | 0 | 1 au plus |
| Rétroplanning | Cibles de moins de 44 px en 375 px | 44 | 0 | 0 |
| | Boutons principaux | 4 | 0 | 1 au plus |
| | Dates de plus de 260 px | 1 | 0 | 0 |

Aucun des quatre écrans ne déborde en 375 px ; axe-core ne relève aucune violation.

Deux précisions de lecture :

- Le bouton principal de la fiche est celui de la prochaine étape (bandeau du haut, quand il y en a
  une) ; « Enregistrer le programme », « Enregistrer le budget » et « Enregistrer la répartition »
  ne sont principaux que tant que des lignes attendent.
- L'outil du relevé compte aussi ce qui se trouve dans un panneau replié ; les 28 boutons sans
  libellé qu'il voit encore sur le programme sont les corbeilles des 28 lignes (une action de ligne
  de 44 px, nommée « Supprimer la ligne … » pour les lecteurs d'écran).

## Ce que fait Camille

| Écran | Ce qu'elle fait | Résultat |
| --- | --- | --- |
| Programme | Lit le programme | Un tableau par temps fort : début, fin, durée, séquence, lieu, qui ; deux actions par ligne. La diffusion, les PDF, l'agenda et l'import d'un chrono restent en tête de la carte |
| Programme | « Modifier » sur « Coiffure et maquillage », change le nom, ajoute une note interne | La ligne s'ouvre en place ; ouvrir une autre ligne referme celle-ci. La ligne refermée porte « Modifiée » |
| Programme | « Ajouter une séquence », saisit l'heure, 30 minutes, le nom | L'heure de fin se calcule ; la barre du bas dit « 2 lignes modifiées, pas encore enregistrées. » ; rien n'est écrit en base |
| Programme | « Annuler les modifications » | Le programme enregistré revient |
| Programme | Refait la saisie, « Enregistrer le programme » | « Programme enregistré : 2 lignes. » ; les deux lignes sont écrites ensemble. La note interne reste hors de la version diffusée |
| Programme | Change l'heure de début d'une seule séquence, enregistre | La fiche propose de décaler les séquences suivantes, comme avant (lot 30b) |
| Budget | Ouvre le budget | La simulation est repliée (les lignes existent) ; l'enveloppe et le tableau des lignes viennent en premier |
| Budget | « Modifier » sur deux lignes, change l'engagé, le libellé, le prestataire | Une ligne ouverte à la fois ; « 2 lignes modifiées, pas encore enregistrées. » |
| Budget | « Enregistrer le budget » | « Budget enregistré : 2 lignes. » ; reste à payer, écart et totaux se recalculent comme avant |
| Budget | Ouvre « Simulation et répartition par poste », change deux postes, « Enregistrer la répartition » | « Répartition enregistrée : 2 postes. » ; plus de liste à puces ni de « Ajuster » |
| Budget, téléphone | Fait défiler | Les catégories sont repliées (plus de douze lignes), leurs totaux en vue ; « Voir les 3 lignes » les déplie |
| Mariés | Lit les coordonnées | Léa et Maxime côte à côte ; e-mail et téléphone sur une ligne, l'adresse, puis code postal et ville |
| Mariés | Saisit un téléphone et une ville, enregistre | « Coordonnées enregistrées. » |
| Mariés | Regarde les liens | Une ligne par lien, ses actions à droite (« Voir comme … », « Renouveler », « Modifier », « Retirer ») ; « Créer le lien d'un prestataire » et « Demander une décision » s'ouvrent par leur bouton |
| Rétroplanning, téléphone | Coche « Choisir le traiteur », puis « Annuler » | La case fait 44 px ; cochée tout de suite, « Annuler » la rétablit (UX-07) |

## Écarts aux maquettes (D4)

- **Programme** : conforme à la planche. En plus : sur téléphone, une séquence tient en trois
  lignes (heures et actions, nom, lieu et intervenants) au lieu d'un tableau à faire défiler ; la
  colonne « Qui » donne les noms (les icônes seules ne se lisaient pas au toucher).
- **Budget** : pas de planche. Choix faits, à montrer à Julien : la simulation repliée quand le
  budget a des lignes ; sur téléphone, les catégories repliées au-delà de douze lignes.
- **Mariés** : pas de planche. Le lien d'un prestataire et la demande de décision s'ouvrent par un
  bouton (sans cela l'onglet tenait en 3,3 écrans, pour une cible de 3).

## Captures (jeu fictif, après)

- Programme : [1440 px](lot-62c/programme-1440.jpg), [ligne ouverte](lot-62c/programme-ligne-ouverte-1440.jpg), [375 px](lot-62c/programme-375.jpg).
- Budget : [1440 px](lot-62c/budget-1440.jpg), [ligne ouverte](lot-62c/budget-ligne-ouverte-1440.jpg), [375 px](lot-62c/budget-375.jpg).
- Mariés : [1440 px](lot-62c/maries-1440.jpg) ; rétroplanning et mariés en [375 px](lot-62c/retroplanning-maries-375.jpg).

## Non rejoué ici

- Les captures du centre d'aide (`pnpm help:captures`) ne sont pas régénérées : elles demandent le
  port 3000 et le fournisseur d'identité, tenus par les autres paquets pendant ce rejeu.
- Le port 3000 étant partagé entre les quatre paquets, les parcours ont tourné sur un autre port,
  avec une session de test ouverte en base ; la connexion par lien est rejouée par la CI.
