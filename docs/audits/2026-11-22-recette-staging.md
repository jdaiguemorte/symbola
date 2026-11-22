# Recette staging du 22/11/2026 (version 69186b1, lots 63 et 64) — premiers retours de Julien

Document de travail du lot 65. Maquettes : `docs/maquette/Recette-staging-22-11.html` (M14 à M16).

## 1. Corrigé dans le lot 65 (sans question de conception)

| # | Retour | Cause dans le code | Correction |
|---|---|---|---|
| 1 | Réglages des devis, « Clients professionnels » : deux libellés se superposent. | `label.field-fit` est en `flex: none` : il prend la largeur de son texte, sans retour à la ligne, et déborde sur la colonne voisine. | Un `field-fit` ne dépasse jamais sa case (`max-width: 100%`) et peut rétrécir : le texte revient à la ligne. |
| 2 | Champs décalés dans une même rangée (délais des devis, Paramètres › Mentions et logo). | Le champ suit son libellé ; un libellé de deux lignes descend son champ. | Dans un formulaire en grille, le libellé occupe la hauteur de la case, texte en haut, champ en bas : les champs d'une rangée s'alignent (hors cases à cocher et radios). |
| 3 | « ? » dans le panneau des réglages : un second panneau par-dessus (« millefeuille »). | Le panneau des réglages est rendu hors du contexte d'aide de l'app : `ScreenHelp` y ouvrait son propre tiroir. | Dans le panneau, l'aide est un bloc repliable en tête du panneau. |
| 4 | « Aujourd'hui » : après « Relancer », le titre s'écrase (un mot par ligne). | Le message de confirmation s'élargit dans la colonne des actions (`auto`). | Avec un message, l'action passe sous l'élément, sur toute la largeur. |

## 2. À repenser : maquettes à valider avant le code

### 2.1 Choisir et comparer les prestataires d'un poste (M14)

Constats :
- **Choix** : dans « Choisir un prestataire… » (lot 63c, `vendor-choice.tsx`), cliquer un nom le **retient d'office** ; la comparaison n'est qu'un lien en bas de la liste ; sans taper un nom, on ne voit que peu de fiches.
- **Changer d'avis** : une fois retenu, la ligne ne propose ni « Changer de prestataire » ni « Ne plus retenir » ; il faut supprimer la ligne.
- **Détail** : un clic sur la ligne ouvre (`?poste=…`) un bloc **en bas de la page** : réglages du poste, prévu, icône, champs importés, consultation. On perd sa place, et l'ensemble est mal organisé.

Proposition (M14) :
- Choisir propose **deux gestes**, « Comparer » et « Retenir ». La liste montre **tout le carnet du métier**, avec « Voir tout le carnet ».
- La ligne s'ouvre en **grande fenêtre**, comme le prévoit l'ADR 0107. Elle a cinq rubriques : Prestataires, Montants, Échéancier, Documents, Réglages du poste. Un bouton « Poste suivant » permet d'enchaîner.
- La rubrique « Prestataires » montre la **comparaison côte à côte** : statut, devis, disponibilité, historique, dernière relance, note. Elle propose « Retenir », « Écarter », puis, une fois un prestataire retenu, « Changer de prestataire » et « Ne plus retenir ».
- Le bloc du bas de page disparaît.

### 2.2 Aujourd'hui (M15)

- La liste du haut se limite à **7 éléments au plus**, triés par priorité puis par délai. Un clic sur un élément l'ouvre.
- **Revu par Julien le 22/11** : tout ce qui remonte n'est pas une tâche (les relances, par exemple, ne sont pas dans Tâches). La liste se découpe donc **par nature**, chaque partie avec son nombre, ses premiers éléments et son propre lien :
  - Tâches → « Tâches » ;
  - Relances et messages à envoyer → leur page, ou l'évènement concerné si elle n'existe pas ;
  - Paiements à encaisser ou à vérifier → « Encaissements » ;
  - Décisions et signatures attendues → l'évènement concerné.

  Une partie vide n'apparaît pas. Le total reste de 7 lignes au plus, réparties par priorité.
- Le calendrier passe **sous la liste, sur toute la largeur**. Il se feuillette mois par mois, et propose Mois, Semaine et Liste, avec le composant du calendrier des évènements. On le voit sans défiler.

### 2.3 Relance d'un prestataire (M16)

- Aujourd'hui, « Relancer » inscrit une relance, puis ouvre la messagerie de la planner sur un message prérempli (`mailto`), qu'elle n'a pas vu. S'il n'y a pas d'adresse, un message le dit.
- Julien : relancer depuis l'app est risqué. Ce qu'il faut, c'est **déclarer qu'on a relancé**.
- Proposition : **« Noter une relance »** ouvre une fenêtre qui demande comment la relance a été faite (téléphone, e-mail, SMS, de vive voix), la date, une note facultative et la date du rappel. Le message type reste **à copier**, jamais envoyé ni ouvert d'office. L'élément quitte « Aujourd'hui » jusqu'au rappel.

## 3. Reporté

- **Reprise des types combinés** (63e) : le plan confond les métiers quand un type porte un ancien rattachement erroné (« Maquillage » rattaché au métier de départ Coiffure, chez Recette Symbola). Le correctif est à faire **avant la production** : ne pas suivre le rattachement d'un type quand son libellé désigne un autre métier. Sans gêne sur le staging (Julien, 22/11).

## 4. Questions

1. **M14** : les cinq rubriques de la fenêtre d'un poste te conviennent-elles ? Faut-il garder une vue « Comparer » à part, ou la comparaison dans la fenêtre suffit-elle ?
2. **M16** : on garde le message type à copier, ou on le retire complètement ?

## 5. Décisions du 22/11

- Maquettes M14 à M16 **validées**, avec la retouche de M15 (priorités découpées par nature, un lien par partie).
