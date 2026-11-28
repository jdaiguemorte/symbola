# Rejeu du lot 74f — le centre d'aide et les tutoriels (PC-08 ; C-07, C-10, D6, L74-D8)

Paquet 74f du lot 74 (`docs/lots/lot-74-premiers-pas-aide-parametres.md`, § 6.6 ; pages 27 et 28 des
maquettes du lot 68).

- Date : 28/11/2026, en local, par Claude Code.
- Environnement : app compilée (`next build`, puis `next start` sur le port 3746, `NODE_ENV=test`), base neuve
  `symbola_lot74f` (bootstrap et migrations de `main`), organisations fictives créées par les parcours, sessions
  ouvertes en base : le fournisseur d'identité local ne connaît que le port 3000.
- Parcours automatisés, à l'ordinateur et à 375 px, axe-core : `e2e/lot-74f-centre-aide.spec.ts` (16 sur 16) et
  les parcours mis à jour `lot-13-centre-aide`, `lot-13-tutoriels`, `lot-10-aide`, `aide-01-03-04`,
  `lot-20-retours-recette`, `lot-18-retours-recette`, `hub-09-10-demarrage`, `lot-72b-aujourdhui`,
  `onb-01-02-onboarding` : tous passent.

## Ce qui est mesuré

| Critère (§ 6.6) | Mesure | Résultat |
| --- | --- | --- |
| 1. Les phrases de la planner rendent leur article | 15 phrases FR (dont « importer mes contacts », « reprendre mon tableau excel », « qu'est-ce que le SIRET »), 5 EN, fautes de frappe, aucune réponse (Vitest, vrais textes) | 15 sur 15 ; « import » met « Reprendre et importer » en tête ; « parrainer une consœur » : aucune réponse, les sujets |
| 2. Deux hauteurs d'écran à 1 440 × 900, rien de coupé | Hauteur de la page, largeur de chaque ligne | Sous 1 800 px ; aucun libellé coupé ; « Chercher » seul bouton plein |
| 3. Le parcours suit la réponse, « Changer de parcours » le garde | « Oui, j'ai des mariages en cours », puis le changement, rechargé | « Je reprends… » puis « Je pars de zéro », gardé ; une collègue garde le sien |
| 4. Une étape se coche par le geste fait | Un premier mariage créé | « 1 étape faite sur 4 » sur l'accueil, dans « Aide » et dans « Tutoriels » |
| 5. Aucune pastille, « article » partout | Menu latéral et barre du téléphone ; textes de l'aide | Aucune pastille ; « Tutoriels » s'ouvre depuis « Aide » ; « fiche » ne désigne plus un article |
| Abus | Sans Rendez-vous ni Invités ; nom d'un mariage d'une autre organisation ; Admin ; membre | Ni réponse, ni sujet, ni adresse (404) ; aucune réponse ; l'Admin ne lit que la console ; un membre ne lit pas les articles de la titulaire |
| HUB-12 : moins de 500 ms | Index et 15 recherches (Vitest) | Bien en dessous |

## Non rejoué en local

- SC-10 à 150 % et les parcours qui jouent la connexion par le fournisseur d'identité : en CI.
- Les captures du centre d'aide (`help:captures`) : la spécification ne les demande pas à ce paquet ; à refaire
  avec le 74e (les visites du 74d ont aussi changé).
