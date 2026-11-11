---
version: alpha
name: Symbola
description: Jetons de design de la suite Symbola. Interface calme, éditoriale et précise, pensée pour le bureau du planner et le téléphone du terrain.
colors:
  primary: "#0F6E5C"
  on-primary: "#FFFFFF"
  primary-soft: "#E3F1EE"
  ground: "#F6F7F9"
  surface: "#FFFFFF"
  ink: "#14181F"
  ink-muted: "#5A6372"
  line: "#DDE1E7"
  attention: "#9A5B00"
  attention-soft: "#FBF0DC"
  critical: "#B3261E"
  critical-soft: "#FBE9E7"
  night: "#0E1217"
  night-surface: "#1A2029"
  night-line: "#2B3442"
  night-ink: "#F2F4F7"
  night-ink-muted: "#A9B3C1"
  night-accent: "#5FD3B8"
  on-night-accent: "#0E1217"
typography:
  display:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.01em
  title:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
  heading:
    fontFamily: Space Grotesk
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.35
  figure:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: '"tnum"'
  field-now:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.1
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
components:
  page:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    height: 44px
    padding: "{spacing.lg}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    height: 44px
    padding: "{spacing.lg}"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
  meta-text:
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
  status-pending:
    backgroundColor: "{colors.attention-soft}"
    textColor: "{colors.attention}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  status-late:
    backgroundColor: "{colors.critical-soft}"
    textColor: "{colors.critical}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  section-title:
    textColor: "{colors.ink}"
    typography: "{typography.heading}"
  page-title:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
  hero-title:
    textColor: "{colors.ink}"
    typography: "{typography.display}"
  key-figure:
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
  field-screen:
    backgroundColor: "{colors.night}"
    textColor: "{colors.night-ink}"
    typography: "{typography.field-now}"
  field-card:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-ink-muted}"
    rounded: "{rounded.lg}"
  divider:
    backgroundColor: "{colors.line}"
    height: 1px
  field-divider:
    backgroundColor: "{colors.night-line}"
    height: 1px
  field-action:
    backgroundColor: "{colors.night-accent}"
    textColor: "{colors.on-night-accent}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    height: 56px
---

# Symbola

## Overview

Symbola est l'outil de travail d'un organisateur d'évènements. L'interface s'efface devant l'évènement : calme, éditoriale, précise. Elle sert deux situations opposées. Au bureau, le planner lit beaucoup d'informations et agit vite. Sur le terrain, il regarde son téléphone d'une main, en plein soleil.

Le ton est celui d'un bon assistant : il dit ce qui presse, il ne décore pas. Une seule couleur porte l'action. Les autres couleurs ont un sens et un seul.

## Colors

- **Émeraude (`primary`, #0F6E5C)** : la seule couleur d'action. Boutons principaux, liens, élément actif, avancement. Sa version claire (`primary-soft`) sert de fond aux éléments actifs et aux confirmations.
- **Encre (`ink`, #14181F)** : texte et titres. `ink-muted` pour les informations secondaires. Les deux passent le contraste de 4,5:1 sur `surface` et `ground`.
- **Fond (`ground`, #F6F7F9) et surface (`surface`, #FFFFFF)** : le fond de page est gris très clair, les cartes sont blanches. `line` trace les bords et les séparateurs.
- **Ambre (`attention`, #9A5B00)** : ce qui attend quelqu'un. Décision du client en attente, échéance proche.
- **Rouge (`critical`, #B3261E)** : ce qui est en retard ou bloqué. Jamais pour décorer.
- **Nuit (`night`, #0E1217)** : le mode Jour J. Fond sombre, texte `night-ink`, accent `night-accent` pour l'action en cours. Contraste de 7:1 au moins sur l'écran principal.

Un statut ne repose jamais sur la couleur seule : il porte toujours un libellé, et une icône quand la place le permet.

## Typography

Deux familles. Space Grotesk pour les titres et les chiffres, Inter pour le texte et les libellés.

- `display` : titre d'accueil et grands écrans d'onboarding.
- `title` : titre de page et nom d'évènement.
- `heading` : titre de carte et de section.
- `body` et `body-strong` : texte courant, 15 px. Jamais en dessous de 13 px.
- `label` : libellés, statuts, métadonnées.
- `figure` : montants et compteurs, en chiffres tabulaires.
- `field-now` : la séquence en cours du mode Jour J.

Les montants s'écrivent avec une espace insécable avant le symbole de l'euro et une espace fine pour les milliers. Les dates s'écrivent en toutes lettres quand la place le permet.

## Layout

Grille de 4 px. Les espacements viennent de l'échelle `spacing`, de `xs` à `3xl`.

Au bureau : une barre latérale de 232 px et une zone de contenu de 1 120 px au plus. La barre latérale ne liste que les apps souscrites. Le contenu s'organise en cartes sur une ou deux colonnes.

Sur téléphone : une colonne, marges de 16 px, action principale ancrée en bas dans la zone du pouce, barre d'onglets de cinq entrées au plus. Toute cible tactile mesure 44 px au moins, 56 px en mode Jour J.

## Elevation & Depth

Pas d'ombre portée décorative. La profondeur vient du contraste entre `ground` et `surface` et d'un bord `line` de 1 px. Seuls les panneaux latéraux et les menus flottants portent une ombre légère, pour dire qu'ils sont au-dessus.

## Shapes

Coins arrondis sobres : `sm` pour les champs et les pastilles carrées, `md` pour les boutons, `lg` pour les cartes, `full` pour les statuts et les avatars. Les icônes sont au trait, 1,5 px, 20 px de côté.

## Components

- **Bouton principal** (`button-primary`) : un seul par écran. Il nomme l'action : « Envoyer le devis », pas « Valider ».
- **Bouton secondaire** (`button-secondary`) : fond blanc, bord `line`.
- **Carte** (`card`) : fond blanc, bord de 1 px en `line` (`divider`), coins `lg`, marge intérieure `xl`.
- **Statut** (`status-pending`, `status-late`) : pastille à libellé. Ambre pour « en attente d'un tiers », rouge pour « en retard ». Les statuts neutres utilisent `ground` et `ink-muted`.
- **Entrée de navigation active** (`nav-item-active`) : fond `primary-soft`, texte `primary`.
- **Chiffre clé** (`key-figure`) : montant ou compteur, toujours accompagné de son libellé en `label`.
- **Écran de terrain** (`field-screen`, `field-card`, `field-action`) : le mode Jour J, sombre, à gros caractères.

## Do's and Don'ts

- Faire : commencer chaque écran par la prochaine action.
- Faire : marquer d'une pastille « Partagé » tout ce que le client voit.
- Faire : garder un seul bouton principal par écran.
- Faire : écrire les libellés dans les mots du métier.
- Ne pas faire : employer une valeur de couleur, de taille ou d'espacement hors de ce fichier.
- Ne pas faire : signaler un statut par la couleur seule.
- Ne pas faire : ajouter un dégradé, une ombre décorative ou une illustration d'ambiance.
- Ne pas faire : empiler deux fenêtres modales.
