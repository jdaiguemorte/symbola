# Le portail des mariés au lecteur d'écran — liste de contrôle (UX-14, NFR-17)

Lot 40c (décision D19, ADR 0078). Dix minutes, par Julien, à chaque version qui touche le portail.
Le RSVP s'y ajoutera au lot 49.

## Préparer

- Un lien de mariés du jeu fictif (staging, ou poste local avec `seed:recette`) : fichier des
  comptes et des liens, hors du dépôt.
- **iPhone** : Réglages › Accessibilité › VoiceOver (ou triple clic sur le bouton latéral si le
  raccourci est réglé). Balayer à droite ou à gauche : élément suivant ou précédent. Toucher deux
  fois : activer. Rotor (deux doigts qui tournent) : titres, liens, boutons.
- **Mac** (Safari) : Cmd + F5. Ctrl + Option + flèche droite : élément suivant ; Ctrl + Option +
  espace : activer ; Ctrl + Option + U : rotor.

## Contrôler

Cocher chaque ligne ; noter ce qui accroche, avec l'écran et ce que VoiceOver a dit.

| # | Ce qu'on fait | Ce qu'on doit entendre ou obtenir |
| --- | --- | --- |
| 1 | Ouvrir le lien des mariés | Le nom de l'organisation (ou son logo, lu par son nom), puis le titre de la page |
| 2 | Rotor › Titres | Les titres de la page, dans l'ordre de l'écran ; un seul titre de niveau 1 |
| 3 | Parcourir l'accueil élément par élément | Le compte à rebours, l'avancement et « vos trois prochaines actions » se lisent dans l'ordre, chacun compréhensible sans voir l'écran |
| 4 | Cocher une tâche des mariés | Le bouton annonce la tâche et son état (« coché » / « non coché ») ; après l'activation, l'état change et un message l'annonce |
| 5 | Ouvrir le budget | Les trois chiffres sont lus avec leur intitulé (pas un nombre seul) |
| 6 | Rotor › Liens | Chaque lien dit où il mène (aucun « cliquez ici », aucun lien sans nom) |
| 7 | Une image (logo, document) | Elle a un nom utile, ou elle est ignorée si elle ne fait que décorer |
| 8 | Un message d'erreur ou de confirmation | Il est annoncé sans qu'on ait à le chercher |
| 9 | Zoom du texte au maximum (iPhone : Réglages › Affichage et luminosité › Taille du texte) | Le portail se lit sans texte coupé ni défilement de côté |
| 10 | Revenir en haut et relire | Rien n'est lu deux fois, rien de caché n'est lu |

## Après

Consigner la date, l'appareil, la version (SHA) et le résultat dans `docs/recette/accessibilite.md`,
section « Lecteur d'écran ». Un point qui accroche devient une correction avant la version suivante.
