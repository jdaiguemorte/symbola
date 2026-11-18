# Rejeu SC-02 — étapes 2 et 3 avec le module Rendez-vous (lot 46)

Cahier des charges, § 17, SC-02 « De la demande à l'acompte » (SU-01, SU-05, PAR-02, P0) :
« 2. Camille répond depuis un modèle et propose un rendez-vous. 3. Après le rendez-vous, elle
compose le devis. » Le lot 46 met le rendez-vous dans l'outil : Camille envoie l'adresse de sa page
de réservation, Léa réserve depuis son téléphone, Camille écrit le compte rendu et en tire une tâche
du mariage. Le devis de l'étape 3 est rejoué au lot 31a (`SC-02.md`).

## Lot 46 — 18/11/2026

- En local, par Claude Code : app de développement (`next dev`, port 3046), base dédiée
  `symbola_lot46` (migrations jusqu'à 0151, numérotées depuis 0156 à 0158), Mailpit. Chromium du panneau de navigation de
  Claude Code : Camille sur ordinateur, Léa en 375 px, sans session (cookie retiré).
- Personnes fictives équivalentes à SU-01 et SU-05 : l'organisation « Atelier Camille » (fiche
  entreprise remplie) et sa titulaire, créées par la fabrique de test ; Léa Martin réserve avec
  une adresse `@example.test`. Le chargeur du jeu fictif (`seed:recette`) n'ouvre pas le module
  Rendez-vous (fermé par défaut, ADR 0079) : il n'a pas servi ici.
- Module Rendez-vous ouvert pour l'organisation, comme le fera l'Exploitation.

| Étape | Rejouée par | Résultat |
| --- | --- | --- |
| 2a. Camille crée son premier type et sa page | Navigateur, ordinateur : menu « Rendez-vous » (juste après Contacts) › « Commencer » ; nom et durée seulement, « Créer le type » ; adresse proposée d'après le nom de l'organisation (`atelier-camille`), « Enregistrer la page » | Type créé avec ses deux champs, tout le reste par défaut (visio, prévenance 24 h, 60 jours, rappel 24 h) ; bien moins d'une minute ; page enregistrée, lien « Voir ma page de réservation » |
| 2b. Léa réserve depuis son téléphone, sans compte | Navigateur, 375 px, sans session : `/reserver/atelier-camille` ; un créneau du lendemain ; nom et e-mail ; « Réserver ce rendez-vous » | « Votre rendez-vous est confirmé » ; créneaux en puces de 44 px, semaine par semaine ; mention d'information sous le formulaire, au nom d'Atelier Camille |
| 2c. La confirmation | Mailpit | « Rendez-vous confirmé : Premier rendez-vous — Atelier Camille », à l'image de l'organisation, `invitation.ics` jointe, bouton « Reporter ou annuler » vers `/rdv#…` |
| 2d. Léa reporte, sans compte | Navigateur, 375 px : le lien de l'e-mail ; « Reporter », un autre créneau, « Confirmer le report » | Le jeton disparaît de l'adresse dès l'ouverture (`/rdv`) ; « C'est noté : votre rendez-vous est déplacé » ; le créneau d'origine reste proposé (le rendez-vous lui-même ne se gêne pas) |
| 2e. Camille le voit | Navigateur, ordinateur : « Aujourd'hui » | « Rendez-vous déplacé : Premier rendez-vous avec Léa Martin, au 20 novembre 2026 à 09:00 », lien vers la fiche |
| 3a. Compte rendu et tâche du mariage | Test d'intégration `appointments.integration.test.ts` (EVT-10) ; parcours `rdv-01-04-evt-10-rendez-vous` (CI) | Action « Envoyer trois lieux » au 10 mars : refusée tant que le rendez-vous n'est rattaché à aucun évènement ; rattachée, elle devient en un geste la tâche du mariage, avec son échéance et son responsable ; un second geste ne crée pas de doublon |

Mesures : pour Camille, deux champs et deux boutons avant de pouvoir envoyer son adresse ; pour
Léa, un créneau, deux champs et un bouton ; aucune ressaisie (le contact de Léa est créé par la
réservation, puis repris par l'option ou le rattachement à l'évènement).

Constats corrigés pendant le rejeu : les créneaux s'affichaient en liste verticale (puces ajoutées,
cadres des jours retirés pour garder toute la largeur à 375 px) ; « Semaine précédente » apparaissait
sur la première semaine ; « Créer une option » disparaissait sans explication quand l'organisation
n'a aucune source de prospects (renvoi vers les sources ajouté).

Non rejoué en local : les parcours Playwright (`rdv-01-04-evt-10-rendez-vous`, combinaisons
ARC-07 du module) — le port 3000 et le fournisseur d'identité local servaient aux sessions des lots
41 et 49 ; ils tournent en CI (job `e2e`). À rejouer par Julien sur le staging (portes 1 et 2), une
fois le module ouvert pour l'organisation de recette et la mention d'information relue par la DPO.
