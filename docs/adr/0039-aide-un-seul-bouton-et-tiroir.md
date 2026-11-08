# ADR 0039 — Aide : un seul « ? » dans la barre du haut, un tiroir qui pousse le contenu

- Statut : accepté
- Date : 2026-11-08
- Précise : [0033](0033-refonte-ux-panneaux-et-aide-par-reperes.md) (aide par repères)
- Story : HUB-19 (lot 16, spécification `docs/lots/lot-16-reprise-ux.md`, décisions A et B
  validées par Julien le 08/11/2026)

## Contexte

Audit du 08/11/2026 (`docs/audits/2026-11-08-audit-complet.md`, U3 et A1). Le « ? » changeait de
place d'un écran à l'autre :
- à droite du titre sur 7 écrans ;
- seul sous le titre, à gauche, sur une quarantaine d'autres.

Le panneau d'aide recouvrait ce qu'il expliquait, ses repères masquaient des libellés, il ne
rendait pas le focus à la fermeture, et l'invitation à un tutoriel s'affichait par-dessus le
contenu.

## Décision

1. **L'écran déclare son aide, il ne pose plus de bouton.** `<ScreenHelp>` et `<PageTour>`
   gardent leur forme et transmettent titre, texte et repères au contexte d'aide
   (`app/help-context.tsx`). Un seul `<HelpButton>`, dans une barre du haut commune
   (`.app-topbar`, recherche à gauche, « ? » à droite), ouvre un seul panneau. Ce montage vaut
   pour les trois structures d'écran : équipe, Admin et mariés.
2. **Écran sans aide déclarée** : le « ? » mène au centre d'aide. **Hors de l'app** (connexion,
   double authentification, invitation : pas de barre du haut), le « ? » reste dans la page.
   Une seule aide par écran : celle d'une section (exports RGPD) devient un court paragraphe.
3. **Un tiroir, pas un calque.**
   - Sur ordinateur (1 024 px et plus), il occupe la droite sur toute la hauteur (380 px) et
     le contenu se décale.
   - Sur téléphone et tablette, il s'ouvre en bas de l'écran (60 % de la hauteur) et le
     contenu défile au-dessus.
   - Écart assumé avec la spécification, qui prévoyait le plein écran sur téléphone : en
     plein écran, le panneau cacherait les éléments que ses repères désignent.
4. **Accessibilité** : à la fermeture (bouton ou Échap), le focus revient au « ? ». Les noms
   accessibles ne changent pas (« Aide sur cet écran », « Aide : <écran> »).
5. **Repères hors du libellé**, et replacés quand le tiroir décale le contenu :
   - élément étroit (onglet, bouton) : centré au-dessus de lui ;
   - bloc large : dans sa marge gauche ;
   - sans marge (téléphone) : dans son coin haut droit.
6. **Invitation à un tutoriel** (AIDE-06, lot 10) : toujours proposée à la première visite de
   son écran, mais **dans la page**, sous la barre du haut, et non plus par-dessus le
   contenu. Écart assumé avec la spécification, qui l'envoyait vers l'accueil : la règle
   « au bon endroit, au bon moment » du lot 10 reste valable.
7. **En-tête commun `PageHeader`** (`app/ui/page-header.tsx`) : titre, badge de statut,
   sous-titre, actions à droite. Les écrans qui ont des actions dans leur en-tête l'utilisent
   (devis, tâches, carnet, fiche événement, console Admin, organisations). Les écrans qui
   n'ont qu'un titre gardent leur `<h1>` : le rendu est identique. Les autres composants
   prévus par la spécification (`Stepper`, `ActionBar`, `StatusBadge`, `EmptyState`) seront
   créés avec les écrans qui s'en servent (assistant d'import IMP-11, écrans de HUB-20), pas
   avant.

## Conséquences

- Le « ? » est au même endroit sur tous les écrans de l'app. Un parcours e2e le mesure sur
  dix écrans, en ordinateur et en 375 px.
- Les parcours e2e existants qui ouvrent l'aide restent valables : mêmes noms, mêmes rôles.
- Quand le tiroir s'ouvre sur ordinateur, le « ? » se décale avec le reste de l'écran. Il
  reste en surbrillance tant que l'aide est ouverte.
- Les captures du centre d'aide sont à régénérer (`help:captures`).
