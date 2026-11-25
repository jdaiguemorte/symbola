# Décisions de la porte 2 — audit UX des parcours (lot 68)

Date : 25/11/2026. Décisions de Julien sur les constats de la [synthèse](04-synthese.md), prises une
par une. Ce fichier fait foi pour les maquettes et pour le lot de corrections simples ; en cas
d'écart avec la synthèse, c'est lui qui gagne.

## 1. Points vérifiés dans l'app, sans décision

| # | Question | Ce que montre la vérification | Suite |
| --- | --- | --- | --- |
| D1 (C-17) | « Annuler » rend-il la tâche cochée à sa place dans l'agence ? | Oui. Rejoué sur un espace d'agence neuf : l'accueil repasse de 10 à 11 points, la tâche revient en tête sous le même mariage, et la base le confirme. « Annuler » disparaît après dix secondes ; ensuite la tâche se rouvre par « Rouvrir » dans « Tâches › Toutes », à 8 000 px de défilement sur 13 000. La tâche vue sous « Inès & Paul » est une autre tâche : l'agence d'essai est faite de trois copies du même mariage. | Pas un défaut d'annulation. À traiter en maquette : retrouver une tâche faite par erreur une fois le délai passé (P-16). Le message « (Today.source.vendors) » existe dans les textes et reste dans les corrections simples ; il n'a pas été revu à l'écran |
| D9 (C-47) | Le carnet se filtre-t-il par métier une fois les fiches classées ? | Oui, d'après le code de `apps/symbola/app/prestataires/page.tsx` : une pastille par famille non vide, les métiers de la famille choisie en second rang, un filtre par étiquette. Les espaces d'essai sont des copies sans modèles de départ : aucun métier, donc douze fiches « À classer ». Lu dans le code, pas vu à l'écran | Défaut du jeu d'essai. Question gardée pour la maquette : un carnet tout juste importé arrive-t-il « À classer » en entier, donc sans filtre le premier jour ? |
| C-82 | Le menu latéral est-il coupé à 911 × 512 (portable à 150 %) ? | Oui, mesuré : la fenêtre s'arrête à 512 px, « Apps » est à 557, « Paramètres » à 605, « Tutoriels » à 653, « Aide » à 701 | Passe de « à trancher » à « confirmé » (mesure d'outil) |

## 2. Désaccords tranchés

| # | Décision | Ce qu'elle engage |
| --- | --- | --- |
| D2 (C-01) | Les visites guidées sont **proposées, pas imposées**. | À la première venue sur un écran, une ligne discrète « Découvrir cet écran en 1 minute », que l'on ouvre ou que l'on ferme. « Revoir la visite » toujours présent sous le « ? ». Une seule visite reste automatique : celle de l'accueil, au premier jour |
| D3 (C-38) | **Une seule forme pour une tâche.** | Une ligne type (titre cliquable, une action rapide « Fait », un menu pour le reste) et un seul panneau, le grand, repris sur « Aujourd'hui », « Tâches », le Rétroplanning et le téléphone, avec les mêmes mots. Sur l'accueil, la ligne peut être allégée |
| D4 (C-84) | Le menu du téléphone est **refait en barre du bas**. | Aujourd'hui, Évènements, Tâches, Prestataires, et « Plus » pour le reste |
| D5 (C-63) | Le programme repris d'un PDF **n'est pas bon à diffuser tel quel**. | Une heure que le fichier ne donne pas reste vide et se dit « non renseignée », jamais déduite. Chaque journée prend sa date pour nom. Le bilan de l'import liste ce qui n'est pas repris (l'annuaire) et propose de le reprendre dans le carnet. Tant que des heures manquent, le programme porte « à compléter » avant tout partage |
| D6 (C-70) | **Deux parcours de tutoriels** selon la réponse à l'assistant de démarrage. | « Je reprends mes mariages en cours » : l'import d'abord, puis compléter un mariage repris, puis le reste. « Je pars de zéro » : créer un mariage, son rétroplanning, ses prestataires, puis devis et factures. La page garde sa forme ; les devis ne sont en tête dans aucun des deux |
| D7 (C-75) | Enregistrement des réglages : **les deux selon le cas**. | Un réglage isolé (interrupteur, liste) s'enregistre seul et l'affiche (« Enregistré » à côté du champ). Un formulaire à champs liés (adresse, mentions, coordonnées bancaires) s'enregistre par un bouton toujours visible en bas de l'écran |
| D8 (C-25, C-03) | **Une seule entrée « Nouvel évènement »**, avec la question « Où en est-il ? ». | Réponses : demande en cours ; signé, en préparation ; déjà en cours chez moi, je le reprends (mène à la page de reprise). Le statut choisi règle ce qui est créé avec. « + Créer » ouvre le même formulaire. « Pour un client existant » devient un champ, non un troisième type |
| D10 (C-22, C-19) | Le seuil de trois zones d'action est une **cible de maquette appuyée sur des règles de forme**. | Trois reste la cible affichée et un signal d'alarme, pas une règle de refus. Le Design System portera les règles de forme : une action principale par écran, un en-tête d'objet tenu en 200 px, une ligne de liste à une cible, une action rapide et un menu |
| D11 | **C-54 et C-62 retenus** pour la maquette de la reprise ; **C-65 reporté**. | C-54 : la liste « à faire » d'un tableur entre par la page de reprise. C-62 : l'aperçu des prestataires retenus, et l'alerte quand le fichier nomme un autre couple que celui de la fiche. C-65 (contacts repris) : hors des maquettes de ce lot, à reprendre quand « Contacts » sera refait, doublons par nom compris |

## 3. Périmètre et ordre des maquettes

Le périmètre du [§ 9 de la synthèse](04-synthese.md) est validé : huit volets, chaque écran montré
avant et après, en 1 440 et en 375 px, vide, rempli et repris. Ordre validé :

1. Transverse et « Tâches », ensemble : la ligne type d'une tâche conditionne l'accueil, la fiche et le téléphone.
2. Reprise et import : parcours central, six des douze constats bloquants.
3. Aujourd'hui, Évènements, Prestataires, Premiers pas et aide, Paramètres.

Les autres modules restent hors périmètre, sauf leurs points d'entrée. Le Design System ne s'écrit
qu'après la validation des maquettes (porte 3).

## 4. Corrections simples

Les dix-huit corrections sans maquette du § 9 de la synthèse partent dans un lot de réalisation à
part, lancé sans attendre le Design System. Le lot 68 reste un lot d'audit : il ne change aucun
écran.

## 5. Conduite des travaux

Julien lance les maquettes et le lot de corrections depuis des sessions séparées, sur un modèle plus
léger que celui de l'audit.

## 6. Reste ouvert

- Les couleurs (§ 8 de la synthèse) : répartition des rôles du futur trio bleu, orange, crème, et
  valeurs exactes des trois teintes.
- Les points « à vérifier dans l'app avant maquette » et « sur un vrai navigateur français » du § 9
  de la synthèse, hors D1, D9 et C-82 réglés ci-dessus.
