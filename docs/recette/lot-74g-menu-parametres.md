# Rejeu du lot 74g — le menu des Paramètres et le menu latéral (G1, G2, G5, G7, G11, G12)

Paquet 74g du lot 74 (`docs/lots/lot-74-premiers-pas-aide-parametres.md`, § 6.7 ; pages 29 et 31 des
maquettes du lot 68).

- Date : 28/11/2026, en local, par Claude Code.
- Environnement : app compilée (`next build`, puis `next start` sur le port 3074, `NODE_ENV=test`),
  base neuve `symbola_lot74g` (bootstrap et migrations de `main`), organisations fictives créées par
  le parcours (« Atelier 74g … »), sessions ouvertes en base (`lib/test-fixtures/session.ts`) : le
  fournisseur d'identité local ne connaît que le port 3000.
- Parcours automatisé : `apps/symbola/e2e/lot-74g-menu-parametres.spec.ts`, à 1 440 × 900,
  911 × 512, 375 et 360 px, axe-core : **22 parcours sur 22 passent**.
- Les parcours qui jouent la connexion (SC-10 à 150 %, et les parcours mis à jour qui passent par
  `signIn`) tournent en CI.

## Ce qui est mesuré

| Critère (§ 6.7) | Mesure | Résultat |
| --- | --- | --- |
| 1. Accueil : huit groupes, 38 rubriques | Cartes et lignes de l'accueil, tous modules ouverts | 8 groupes, 38 rubriques, « Vos données » à part, aux quatre tailles |
| 1. Un groupe d'un module non souscrit disparaît | Sans Devis ni Rendez-vous | « Devis et factures » et « Rendez-vous » absents |
| 1. « titulaire » | Rubriques que l'équipe lit sans les changer | Prestataires par lien, adresse d'envoi, automatismes, radar |
| 2. Anciennes adresses | Table des 53 entrées et 12 sous-écrans (Vitest) ; redirections en navigateur | Toutes s'ouvrent ; `termes`, `contact`, `repas` et `/budget/parametres` mènent à leur bloc ; `/parametres#tva-debits` et `#informations-professionnel` à leur rubrique |
| 3. Titre = libellé du menu | Les 38 rubriques, mot pour mot | 38 sur 38 (« Tous les modules » garde son titre quand il tient lieu d'« Abonnement et modules », sans libre-service) |
| 4. Menu latéral à 911 × 512 | Chaque lien du menu, par script | Tous dans la fenêtre, 44 px de haut ; « Paramètres » puis « Aide » en bas |
| 5. Premier réglage dans le premier écran | Les 38 rubriques, aux quatre tailles | 35 sur 38 à 911 × 512, 37 sur 38 à 375 et 360 px ; écarts ci-dessous |
| 5. Titre à 150 px au plus sur téléphone | Les 38 rubriques à 375 et 360 px | 38 sur 38 (titre à 124 px) |
| 6. « Vos données » | Titulaire, puis membre de l'équipe | Huit lignes et « Fermer l'espace » en dernier ; un membre : corbeille, e-mails envoyés, comptabilité |
| 7. Fenêtres | « Plages occupées » à 911 × 512 et 375 px | Hauteur de l'écran moins 32 px au plus |
| Abus | Membre sur une rubrique de la titulaire ; module non souscrit ; Comptable ; isolation | Même réponse qu'avant, aucune commande ; aucune erreur ; Comptable renvoyé à `/comptable` ; chaque titulaire ne lit que son espace |

## Écarts

- **Premier réglage sous le premier écran** (critère 5), avant le passage de la rubrique au patron :
  « Équipe et accès » à 911 × 512 (74h), « Demandes : étapes et formulaire de contact » à 911 × 512
  (74i), « Adresse d'envoi et réponses » à 911 × 512, 375 et 360 px (74j). Un texte d'introduction ou
  une carte d'information précède le premier réglage ; l'en-tête d'une ligne du patron les remonte.
  Le parcours les nomme : la liste ne peut que diminuer.
- **« Modèles d'évènement »** n'a aucune commande tant qu'il est vide (un modèle se crée depuis la
  fiche d'un évènement).
- **150 px sur téléphone** : mesuré sur le titre ; le premier réglage est dans le premier écran.
- **Captures du centre d'aide** : la capture « settings » (fiche de l'entreprise) n'a pas été
  régénérée ; l'écran n'a perdu que ses deux onglets.
