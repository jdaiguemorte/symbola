# ADR 0057 — Charte graphique : `DESIGN.md`

- Statut : accepté (décision Q13 a de Julien du 11/11/2026) ; mise en œuvre au lot 25b, puis
  écran par écran
- Date : 2026-11-11
- Remplace : [0025](0025-charte-graphique-et-socle-visuel.md) pour la palette et les polices,
  qui restent en vigueur jusqu'au lot 25b.
- Exigences : UX (§ 5 de `docs/CAHIER_DES_CHARGES.md`), WCAG 2.2 AA (Q11).

## Contexte

L'ADR 0025 a posé Tailwind CSS, la couche de base sur le HTML sémantique, les polices Fraunces et
Inter et une palette sauge et terracotta. Julien a adopté `DESIGN.md` (racine du dépôt) : une
interface « calme, éditoriale et précise », polices Space Grotesk et Inter, couleur principale
émeraude `#0F6E5C`, et un thème de nuit pour le Jour J.

## Décision

1. **`DESIGN.md` est la source des jetons** : couleurs (dont le thème de nuit), typographie,
   espacements, rayons. Le code les reprend dans `@theme` (`apps/symbola/app/globals.css`) et
   `packages/ui` ; un écart entre les deux est un défaut.
2. **Gardé de l'ADR 0025** : Tailwind CSS v4, `packages/ui`, la couche de base sur le HTML
   sémantique, les champs de 44 px, les messages `role="alert"` et `role="status"`.
3. **Polices auto-hébergées** (`next/font/local`, comme aujourd'hui) : aucun appel à un service
   de polices externe.
4. **Contrastes WCAG 2.2 AA** vérifiés par axe-core (Q11, lot 40b pour l'audit complet).
5. **Lot 25b avant les lots 26 à 32** : jetons et composants de base d'abord, pour ne pas
   construire les nouveaux écrans deux fois.

## Conséquences

- Les écrans existants changent d'apparence au lot 25b, sans changer de structure.
- Les captures du centre d'aide sont à régénérer après le lot 25b.
