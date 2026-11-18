# Revue d'accessibilité — page de réponse des invités (lot 49)

Complète la revue des parcours P0 du lot 40c (`accessibilite.md`, NFR-17, UX-14) : le RSVP lui
était renvoyé. Personas : SU-10 (Jeanne, 71 ans, grande police, gestes imprécis), SU-11 (Antoine,
lecteur d'écran).

## Revue de Claude Code (18/11/2026, en local)

- **axe-core** (WCAG 2.0, 2.1 et 2.2, A et AA) : 0 défaut sur la page à remplir, la confirmation et
  la rubrique « Invités » du portail, en 375 px et en taille ordinateur (`e2e/inv-01-04`, rejeu
  SC-07). Défaut corrigé pendant la revue : `aria-required` posé sur un `fieldset` (non permis) ;
  remplacé par `required` sur les boutons radio.
- **Texte** : corps de 18 px partout sur la page (jeton `reading` de `DESIGN.md`), titres plus
  grands ; aucun texte sous 18 px (contrôle par script).
- **Cibles** : chaque bouton et chaque choix fait au moins 44 px de haut (contrôle par script).
- **Structure** : un titre par question (« Qui sera présent ? », puis un titre par temps fort,
  « Régimes et allergies », « Hébergement et transport », « Vos données ») ; chaque choix de
  présence est un groupe nommé « Dîner — Jeanne (vous) » ; chaque case a son libellé ; l'accord
  aux régimes est le libellé même de sa case.
- **Clavier seul** : tout le parcours se fait avec Tab, Espace et Entrée ; après l'envoi, le focus
  va au titre « Merci, votre réponse est enregistrée » (lu aussitôt).
- **Messages** : erreurs en `role="alert"`, confirmations en `role="status"`.
- **Sans compte ni champ libre** ; aucune adresse e-mail demandée ; aucune animation.

## À faire par Julien : VoiceOver (dix minutes, iPhone)

Avec un lien de test du jeu fictif (staging, porte 1) :

1. Ouvrir le lien reçu par SMS ; VoiceOver lit « Léa et Maxime vous invitent à leur mariage ».
2. Rotor « Titres » : les questions s'enchaînent dans l'ordre.
3. Rotor « Commandes de formulaire » : chaque groupe annonce le temps fort et la personne, chaque
   bouton « Oui, présent » ou « Non, absent ».
4. Avant l'accord, les cases des régimes sont annoncées « estompées » ; cocher l'accord les rend
   actives.
5. « Envoyer ma réponse » : la confirmation est lue sans chercher.
6. « Modifier ma réponse », puis « Je ne souhaite pas que mes données soient conservées » : la
   demande de confirmation est lue.

Consigner ici la date, l'appareil et chaque obstacle rencontré.
