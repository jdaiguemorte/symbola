# ADR 0025 — Charte graphique et socle visuel (Tailwind CSS, structure d'écran)

- Statut : accepté
- Date : 2026-11-03
- Complète : CLAUDE.md § 3 (UI : Tailwind CSS + shadcn/ui), [0019](0019-generation-pdf-react-pdf.md)

## Contexte

Les lots 0 à 6 ont livré des écrans fonctionnels et testés, mais en HTML brut : Tailwind et
shadcn/ui, prévus par la stack, n'avaient jamais été installés. Au premier essai sur le staging
(03/11/2026), Julien a jugé l'interface inutilisable pour une recette. La charte manquait aussi
au PRD (« logo et couleurs Symbola », question ouverte).

Julien a validé une direction « élégant et chaleureux » sur maquette (Artifact « Charte graphique
Symbola ») : fond ivoire, vert sauge pour agir, terracotta pour signaler, Fraunces pour les titres,
Inter pour le texte, logo provisoire de deux anneaux entrelacés.

## Décision

1. **Tailwind CSS v4** (`tailwindcss`, `@tailwindcss/postcss`, `postcss`), configuration dans la
   feuille `apps/symbola/app/globals.css` (`@theme` : couleurs, polices, rayons). Dépendances
   ajoutées avec l'accord de Julien, ainsi que `clsx`, `tailwind-merge` et
   `class-variance-authority` (`packages/ui`, outils de shadcn/ui) et `lucide-react` (icônes du
   menu). Les primitives Radix de shadcn/ui n'ont pas été nécessaires : menus et aides restent en
   HTML natif (`<details>`, boutons).
2. **Une couche de base qui habille le HTML sémantique** : titres, formulaires (champs de 44 px,
   libellé au-dessus), boutons (l'envoi d'un formulaire est l'action principale, un formulaire
   d'un seul bouton est une action secondaire), tableaux, listes de définitions, messages
   (`role="alert"` terracotta, `role="status"` sauge), aide « ? » et visite guidée. Les écrans
   existants prennent la charte sans réécriture ; quelques classes de composants (`card`,
   `item-list`, `toolbar`, `tabs`, `filters`, `badge-*`, `event-list`) structurent les écrans
   les plus chargés.
3. **Structure d'écran commune** (`app/app-shell.tsx`, dans le layout racine) : menu latéral pour
   la planner et l'Admin, replié derrière un bouton « Menu » sur téléphone ; en-tête simple pour un
   marié ; écran centré pour la connexion. Le menu reprend les liens et les règles d'affichage de
   l'ancien accueil (modules souscrits, rôle), avec les mêmes libellés.
4. **Polices** Fraunces et Inter servies par l'app (`next/font/google`, téléchargées au build) :
   aucun appel du navigateur de la planner vers Google (RGPD, CSP).
5. **Aucun attribut `style` dans le HTML rendu côté serveur** : la CSP stricte (`style-src`
   avec nonce, `middleware.ts`) le refuse ; les quelques styles en ligne existants (pastilles de
   statut, écarts du budget) sont devenus des classes. Les contrastes de la palette respectent
   WCAG AA (vérifiés par axe-core dans les parcours e2e).

## Conséquences

- Un nouvel écran est lisible sans effort de style s'il reste en HTML sémantique ; une classe de
  composant suffit pour les mises en page particulières.
- Les parcours e2e qui passaient par les liens de l'accueil passent désormais par le menu ; sur
  téléphone, ils ouvrent d'abord le menu (`openMenu`, `clickMenuLink` et `logout` dans
  `apps/symbola/e2e/helpers.ts`). Un lien de la page qui porte un nom proche d'un lien du menu
  (« Budget » / « Modèles de budget ») se cible dans `main`, avec un nom exact.
- Le logo est provisoire ; un vrai logo remplacera le SVG de `app-shell.tsx` et la planche de
  charte. Les PDF (ADR 0019) gardent pour l'instant leur mise en page, à aligner sur la charte
  (couleurs, polices embarquées) dans un second temps.
