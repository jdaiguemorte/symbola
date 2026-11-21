# Lot 63e — Rapport de reprise des types combinés (jeu fictif, en local)

**Pour Julien, avant la production** (accord du 21/11 sur les migrations 0198 et 0199). Exigences
PRE-01, PRE-11, HUB-20 ; ADR 0105. Données entièrement fictives (`docs/recette/symbola-synthetic-users.json`
et le fichier du corpus `packages/testing/import-corpus/files/logiciel-tiers/prestataires.xlsx`).

## Ce qui a été rejoué (21/11/2026, poste local)

1. Base neuve, migrations jusqu'à 0195, **avec le code d'avant le lot** (branche `lot-63a-corrections-mots`) :
   - jeu fictif chargé (`seed:recette`) ;
   - Atelier Camille R. : types de départ posés, chaque fiche du jeu typée par sa catégorie, puis import
     du fichier du logiciel tiers (25 fiches) en gardant « Photographe & Vidéaste » sous son libellé,
     comme l'a fait la planner (#14) ;
   - Maison Belkacem Évènements : types de départ, deux types combinés créés à la main
     (« Photographe / vidéaste », « Officiante et décoratrice ») et cinq fiches.
2. **Code du lot 63e** : migrations 0198 et 0199 (`pnpm --filter @symbola/db migrate`). Chaque fiche
   typée garde son type comme métier principal : 25 couples (organisation, type) repris, aucune fiche
   ne perd son type.
3. Rapport : `pnpm --filter @symbola/app vendors:split-types` (rien n'est écrit).
4. Application : `pnpm --filter @symbola/app vendors:split-types -- --appliquer`, puis le rapport
   rejoué : « Aucun type combiné ».

## Rapport (étape 3), tel qu'affiché

```text
# Reprise des types combinés : rapport (rien n'est écrit)

## [Recette] Atelier Camille R. (7ec37e00-0000-4000-8000-000000000001)

- « Coiffure et maquillage » — 3 fiche(s) : renommé « Coiffure » ; ajoute « Maquillage » (créé)
- « Photographe & Vidéaste » — 1 fiche(s) : fusionné dans « Photographe » ; ajoute « Vidéaste »

## [Recette] Maison Belkacem Évènements (7ec37e00-0000-4000-8000-000000000002)

- « Coiffure et maquillage » — 0 fiche(s) : renommé « Coiffure » ; ajoute « Maquillage » (créé)
- « Photographe / vidéaste » — 2 fiche(s) : fusionné dans « Photographe » ; ajoute « Vidéaste »
- « Officiante et décoratrice » — 1 fiche(s) : fusionné dans « Officiant de cérémonie » ; ajoute « Décoration »

Total : 5 type(s) combiné(s), 7 fiche(s).
```

Lecture :

- « Coiffure et maquillage » était un **type de départ** : il n'y a pas de type « Coiffure » à part, il
  le devient (même identifiant, mêmes champs, même famille), et ses fiches reçoivent « Maquillage »,
  créé depuis le catalogue de départ. Chez Maison Belkacem, le type n'a aucune fiche : il est
  renommé, et « Maquillage » est créé pour que le carnet ressemble à celui d'une nouvelle
  organisation.
- « Photographe & Vidéaste », « Photographe / vidéaste » : fusionnés dans le « Photographe » existant
  (fusion du lot 16 : champs propres repris, journal `vendors.vendor_type.merged`, 3 événements
  écrits) ; « Vidéaste » existe déjà, il est ajouté aux fiches.
- « Officiante et décoratrice » : reconnu par la liste en données ; fusionné dans « Officiant de
  cérémonie », « Décoration » ajouté.

## Résultat (étape 4) : les fiches à plusieurs métiers

| Organisation | Fiche | Métiers (le principal en premier) |
|---|---|---|
| Atelier Camille R. | Beauté du Jour | Coiffure (principal), Maquillage |
| Atelier Camille R. | Coiff' Mariée | Coiffure (principal), Maquillage |
| Atelier Camille R. | Studio Éclat | Coiffure (principal), Maquillage |
| Atelier Camille R. | Clic & Déclic | Photographe (principal), Vidéaste |
| Maison Belkacem Évènements | Agence Prisme | Photographe (principal), Vidéaste |
| Maison Belkacem Évènements | Studio Reflets | Photographe (principal), Vidéaste |
| Maison Belkacem Évènements | Cérémonies d'Aline | Officiant de cérémonie (principal), Décoration |

Atelier Camille R. : 37 fiches, dont 4 à plusieurs métiers ; Maison Belkacem : 5 fiches, dont 3. Les
autres fiches gardent leur seul métier. Plus aucun type combiné dans les deux organisations.

Ce qui n'est **pas** scindé (synonymes d'un seul type) : « DJ / musiciens », « Faire-part et
papeterie », « Mobilier et vaisselle », « Sonorisation et lumière », « Tentes et chapiteaux », « Vins et
boissons », « Vidéo et écrans ». « Musique », type créé par la planner, reste tel quel.

## Sur le staging puis la production

Les mêmes gestes, après le déploiement (`docs/runbooks/deploiement.md`, § 0198-0199) : le rapport
(`--out /tmp/reprise-metiers.md`), **montré à Julien avant d'appliquer en production**, puis
`--appliquer`. Le rapport ne cite que des libellés de métiers et des nombres (aucune fiche, aucune
donnée personnelle) ; les noms de fiches du tableau ci-dessus viennent de la base locale fictive.
