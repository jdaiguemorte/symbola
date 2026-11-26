---
version: alpha
name: Symbola
description: Design System de la suite Symbola (ADR 0116) — jetons, règles de forme, composants, motifs de parcours et lexique. Interface calme, éditoriale et précise, pensée pour le bureau du planner et le téléphone du terrain.
colors:
  primary: "#0F6E5C"
  on-primary: "#FFFFFF"
  primary-soft: "#E3F1EE"
  primary-strong: "#0B5A4B"
  ground: "#F6F7F9"
  surface: "#FFFFFF"
  ink: "#14181F"
  ink-muted: "#5A6372"
  line: "#DDE1E7"
  line-strong: "#838C99"
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
  reading:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.55
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
elevation:
  float: "0 8px 24px rgba(20, 24, 31, 0.12)"
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
    borderColor: "{colors.line-strong}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    height: 44px
    padding: "{spacing.lg}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.critical}"
    borderColor: "{colors.critical}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    height: 44px
    padding: "{spacing.lg}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: 44px
  field-error:
    borderColor: "{colors.critical}"
    textColor: "{colors.critical}"
    typography: "{typography.label}"
  floating-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
  tab-active:
    textColor: "{colors.ink}"
    borderColor: "{colors.primary}"
    typography: "{typography.body-strong}"
  toggle-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
  filter-chip:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  meta-text:
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
  status-neutral:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  status-pending:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  status-check:
    backgroundColor: "{colors.attention-soft}"
    textColor: "{colors.attention}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  status-late:
    backgroundColor: "{colors.critical-soft}"
    textColor: "{colors.critical}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  notice-info:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line}"
    rounded: "{rounded.md}"
  notice-check:
    backgroundColor: "{colors.attention-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  notice-error:
    backgroundColor: "{colors.critical-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  feedback-toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: 56px
  feedback-toast-secondary:
    textColor: "{colors.night-ink-muted}"
    typography: "{typography.label}"
  feedback-toast-action:
    textColor: "{colors.night-accent}"
    borderColor: "{colors.night-accent}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 44px
  feedback-toast-failure:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.critical}"
    rounded: "{rounded.md}"
  task-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line}"
    height: 60px
  task-title-link:
    textColor: "{colors.ink}"
    borderColor: "{colors.line-strong}"
    typography: "{typography.body-strong}"
  object-window:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    width: 860px
  window-short:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    width: 560px
  menu:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.lg}"
  menu-item-danger:
    textColor: "{colors.critical}"
    typography: "{typography.body}"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  stepper-done:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  stepper-next:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line-strong}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
  progress-bar:
    backgroundColor: "{colors.line}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: 6px
  save-bar:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.ink}"
  selection-bar:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.ink}"
  bottom-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    borderColor: "{colors.line}"
    height: 72px
  bottom-bar-active:
    textColor: "{colors.primary}"
    borderColor: "{colors.primary}"
  empty-state:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line-strong}"
    rounded: "{rounded.lg}"
  origin-mark:
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
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

**Ce fichier est le Design System de Symbola** (ADR 0116, porte 4 du lot 68). Il réunit les jetons (ADR 0057, inchangés), les règles de forme, les composants et leurs états, les motifs de parcours et le lexique. Il est tiré des 33 maquettes validées du lot 68 (`docs/maquette/lot-68/`) ; sa page de référence, `docs/maquette/lot-68/34-design-system-reference.html`, montre chaque composant et ses états en 1 440 et en 375 px. La liste de contrôle des autres écrans est dans `docs/audits/2026-11-ux-parcours/13-design-system.md`.

Comment le lire :

- Chaque règle cite entre parenthèses ce qui la fonde : un constat de l'audit (`C-nn`, `docs/audits/2026-11-ux-parcours/04-synthese.md`), un principe (`P-nn`, même fichier, § 7), une décision de la porte 2 (`D2` à `D11`) ou un choix des maquettes (`M1` à `M13`, `R1` à `R18`, `A1` à `A7`, `E1` à `E9`, `V1` à `V14`, `B1` à `B17`, `G1` à `G16`, notes `07` à `12` du même dossier). Les règles des lots 61 à 63 encore valables gardent leur numéro de lot.
- Quand une maquette récente contredit une règle plus ancienne, la maquette l'emporte (décision de Julien du 26/11/2026), à condition qu'aucune fonction majeure ne disparaisse.
- Les valeurs écrites dans les maquettes hors des jetons (une taille de 26 px, un gris #FAFBFC, une ombre vers le haut) ne sont pas des règles : un écran réalisé emploie le jeton le plus proche (voir « Ne pas faire »).
- Les couleurs de la marque passeront à un trio bleu vif, orange et crème. Leurs valeurs ne sont pas connues : ce fichier n'en donne aucune et fixe seulement les rôles (§ « Colors », « La future marque »).

## Colors

Une teinte, un sens (P-21, C-83). La répartition suit l'option **A, « orange de marque seulement »**, retenue à la porte 2 (`06-decisions-porte-2.md`, § 6) et appliquée en rôles aux jetons actuels.

- **Émeraude (`primary`, #0F6E5C)** : la couleur d'action, et rien d'autre. Bouton principal, lien, entrée active du menu, onglet ouvert, case cochée, interrupteur ouvert, focus. Sa version claire (`primary-soft`) ne sert plus qu'au fond de l'entrée active du menu ; sa version foncée (`primary-strong`) marque le survol et l'appui. Elle ne dit jamais « fait », « enregistré », « réussi » ni « avancé » : ni statut, ni titre de tâche, ni barre d'avancement, ni bandeau d'information, ni option active d'une bascule (porte 2, § 6 ; page 5 des maquettes ; M8). Un lien est toujours souligné (C-83).
- **Encre (`ink`, #14181F)** : texte et titres ; titre-lien d'un objet dans une liste, souligné d'un trait `line-strong` (C-83, page 5) ; option active d'une bascule ou d'un filtre, pleine, texte blanc (M8) ; fond du message de retour (M5) ; étape franchie d'une frise, barre d'avancement, ligne suivante d'une page de reprise (volets 2 et 3) ; bord haut des barres d'enregistrement et de sélection (M2). `ink-muted` pour les informations secondaires. Les deux passent le contraste de 4,5:1 sur `surface` et `ground`.
- **Fond (`ground`, #F6F7F9) et surface (`surface`, #FFFFFF)** : le fond de page est gris très clair, les cartes sont blanches. `ground` sert aussi de fond aux pastilles neutres, au bandeau d'information (bordé de `line`) et à la ligne survolée d'un menu. `line` trace les bords des cartes et les séparateurs. `line-strong` trace le bord des champs et des boutons secondaires : 3:1 au moins sur `surface` et `ground`, comme l'exige WCAG 2.2 AA pour un composant.
- **Ambre (`attention`, #9A5B00)** : **ce que la planner doit regarder ou compléter elle-même**. « À vérifier : » (un doublon possible, un chevauchement, une valeur déduite), « À compléter » (un mariage repris, une heure de fin manquante) (volet 2, page 9 ; volet 3, page 17). **L'ambre ne dit plus l'attente d'un tiers ni l'échéance proche** : elles deviennent neutres, avec leur mot et leur icône (porte 2, § 6 ; page 5). Il ne sert plus à « Mariés » ni à « Priorité haute ».
- **Rouge (`critical`, #B3261E)** : le vrai retard (« En retard de 4 jours » et « ! »), une pièce expirée (V9), une erreur (« Erreur : »), et le danger : le bouton de danger (fond blanc, bord et texte rouges) et l'entrée de danger d'un menu « ⋯ », seule et en dernier. **Jamais sur une commande répétée à chaque ligne** (C-34) ; jamais pour une date d'import ni pour une valeur absente (P-01, P-02) ; jamais « À trouver » en rouge (V12). Le compteur du menu (« 2 en retard ») reste rouge, parce qu'il compte des retards.
- **Nuit (`night`, #0E1217)** : le mode Jour J. Fond sombre, texte `night-ink`, accent `night-accent` pour l'action en cours. Contraste de 7:1 au moins sur l'écran principal. Deux jetons de nuit servent aussi au message de retour, sur l'encre : `night-accent` pour son bouton (9,7:1) et `night-ink-muted` pour son texte secondaire (8,4:1) (M5).

Un statut ne repose jamais sur la couleur seule : il porte toujours un mot, et une icône quand la place le permet (P-21, C-83). Il se lit en noir et blanc.

### Un sens, une teinte

| Sens | Mot | Icône | Teinte | Fondement |
| --- | --- | --- | --- | --- |
| Action : bouton principal, lien, entrée active, onglet ouvert | le verbe de l'action | — | `primary` | P-08, P-21 |
| Titre-lien d'un objet dans une liste | son nom | — | `ink`, souligné `line-strong` | C-83, C-38 |
| En retard | « En retard de N jours » | « ! » | `critical`, pastille `critical-soft` | C-34, page 5 |
| Pièce expirée | « Expirée le 31 oct. » | « ! » | `critical` | V9 |
| Bientôt (échéance dans le seuil, 7 jours au départ, réglable) | « Dans N jours » | horloge | neutre (`ink`, `ink-muted`) | M10, G9 |
| Attend quelqu'un (les mariés, un prestataire) | « Attend les mariés » | la personne (initiales) | neutre | porte 2 § 6, A4 |
| Fait | « Faite le 25 nov. » | coche | neutre, ligne en `ink-muted` sans barré | M11, page 5 |
| Option active d'une bascule, filtre posé | l'option ; le filtre et « × » | — | `ink` plein, texte blanc ; pastille `ground` | M8, C-83 |
| À vérifier, à compléter | « À vérifier : », « À compléter » | « ! » | `attention`, fond `attention-soft` | volet 2, lot 62 |
| Erreur | « Erreur : » | « ! » | `critical`, fond `critical-soft` | P-18, lot 62 |
| Information | la phrase | « i » | neutre bordé (`ground` et `line`) | page 5, A15 |
| Partagé avec le client | « Partagé » | œil | neutre | règle existante |
| Repris d'un fichier | « Repris » ; « Repris le 24 nov. de 4 fichiers » | document | neutre (`origin-mark`) | volet 2, page 9 |
| Valeur absente | « non renseigné » | — | `ink-muted` | P-02, P-06 |
| Avancement | « 14 sur 20 » | — | barre `ink` sur `line` | volet 3, E7 |

### La future marque : rôles, sans valeurs

Le trio bleu vif, orange et crème remplacera l'émeraude et le fond. Les valeurs sont à donner par Julien. Ce qui est déjà fixé, quelles qu'elles soient (porte 2, § 6 ; synthèse, § 8) :

- **Le bleu prend le rôle de `primary`** et de lui seul : action, liens, entrée active, onglet ouvert, focus. Ni statut positif, ni avancement, ni bandeau. Pour les boutons et les liens, une nuance assez foncée pour 4,5:1 avec un texte blanc et sur le fond ; un bleu « vif » clair ne sert qu'au logo (H-MA-17).
- **L'orange reste au logo, aux illustrations et aux écrans vides.** Jamais dans une liste, jamais sur un bouton, jamais comme couleur de texte sur fond clair. S'il porte du texte, c'est une encre foncée sur l'orange (H-MA-17, H-VI-16). Il ne se confond ni avec l'ambre de « À vérifier » ni avec le rouge du retard : chaque état garde son mot et son icône.
- **Le crème sert de fond de page et de bandeau d'information.** Jamais de fond d'alerte : « À vérifier » et « Erreur » gardent leurs fonds. Sur un fond crème, un bandeau d'information se lit par son bord et son icône, pas par sa teinte.
- **Ce qui ne change pas** : l'encre et ses rôles (bascules, message de retour, frise, avancement), le rouge du retard et du danger, les jetons de nuit du Jour J.
- **À recalculer sur les vraies valeurs** : tous les contrastes de `design-tokens.test.ts`, celui de `night-accent` sur l'encre si l'accent du message de retour suit le bleu, le bord des champs sur le crème, l'ambre et l'orange côte à côte.

## Typography

Deux familles. Space Grotesk pour les titres et les chiffres, Inter pour le texte et les libellés.

- `display` : titre d'accueil et grands écrans d'onboarding.
- `title` : titre de page, nom d'un évènement ou d'un prestataire dans son en-tête, titre de la barre du haut du téléphone.
- `heading` : titre de carte, de section, de fenêtre, d'état vide et de bulle de visite.
- `body` et `body-strong` : texte courant, 15 px. Jamais en dessous de 13 px.
- `reading` : 18 px, la page de réponse des invités (lot 49, INV-03) : des personnes de tout âge,
  sur un téléphone d'entrée de gamme, y répondent sans compte (corps de 18 px au moins).
- `label` : libellés, statuts, métadonnées, pastilles, message secondaire.
- `figure` : montants et compteurs, en chiffres tabulaires.
- `field-now` : la séquence en cours du mode Jour J.

Les montants s'écrivent avec une espace insécable avant le symbole de l'euro et une espace fine pour les milliers (« 21 650,50 € », jamais « 21650,50 € », C-56). Les dates s'écrivent en toutes lettres quand la place le permet ; dans une ligne, en abrégé (« sam. 21 nov. »), avec leur état en clair dessous (« En retard de 4 jours », « Dans 4 jours ») (D3). Une espace insécable précède « ? », « : », « ; » et « ! » : aucun signe seul en début de ligne (volet 2). Un titre peut passer sur deux lignes sur téléphone ; un libellé de bouton, jamais.

## Layout

Grille de 4 px. Les espacements viennent de l'échelle `spacing`, de `xs` à `3xl`.

**Au bureau** : une barre latérale de 232 px et une zone de contenu de 1 120 px au plus. La barre latérale ne liste que les modules souscrits, puis un filet, puis « Paramètres » et « Aide » tenus en bas ; « Tous les modules » passe dans « Abonnement et modules » et le menu du compte, « Tutoriels » dans « Aide » (G11). Sous 640 px de haut, ses lignes se resserrent à 44 px sans espace : à 911 × 512 (portable à 150 %), toutes les entrées restent dans la fenêtre (C-82). La barre du haut (recherche, « + Créer », notifications, « ? », compte) reste fixe au défilement (C-12) ; le compte y est un menu sous le prénom (M7) ; sous 760 px de barre, l'aide de la recherche devient « Rechercher… » (M7). Le contenu s'organise en cartes sur une ou deux colonnes.

**Sur téléphone** : une colonne, marges de 16 px. Une barre du haut de 60 px (titre ou « ← retour », recherche, créer, notifications, aide) ; une barre du bas de cinq entrées : Aujourd'hui, Évènements, Tâches, Prestataires, Plus (D4, C-84). L'action principale est ancrée en bas, dans la zone du pouce, au-dessus de la barre du bas. Le contenu passe avant les filtres : une liste montre sa première ligne dans le premier écran, ses filtres derrière un bouton « Filtres » (C-81). Aucun défilement de côté du contenu : un tableau devient des cartes (P-20, C-77, C-78) ; seule une barre d'onglets défile de côté, dans sa barre (E3).

**Entre les deux** (sous 1 100 px de large) : une rubrique des Paramètres s'ouvre sans son menu, avec « ‹ Paramètres · groupe » (G7) ; le panneau d'aide se pose par-dessus, de toute la hauteur (B14) ; ce qui ne tient pas dans une barre d'onglets passe dans « Plus ▾ », l'onglet ouvert restant visible (E3).

Toute cible mesure 44 px au moins, sur téléphone comme à l'ordinateur ; 56 px en mode Jour J (voir S1 dans la note 13). Une fenêtre fait au plus la hauteur de l'écran moins 32 px ; son contenu défile entre l'en-tête et les boutons (G12).

## Elevation & Depth

Pas d'ombre portée décorative. La profondeur vient du contraste entre `ground` et `surface` et d'un bord `line` de 1 px. Seuls les panneaux, les fenêtres, les menus flottants, le panneau du bas du téléphone et le message de retour portent une ombre légère (`elevation.float`), pour dire qu'ils sont au-dessus. Les barres collées en bas (enregistrement, sélection) se détachent par un bord haut de 2 px en `ink`, sans ombre (voir S2 dans la note 13). Un fond assombri (encre à 35 %, comme aujourd'hui dans l'app ; voir S3 dans la note 13) n'accompagne que les fenêtres, le panneau du bas et la visite guidée.

## Shapes

Coins arrondis sobres : `sm` pour les champs, les pastilles carrées et le bouton du message de retour, `md` pour les boutons, les bascules, les bandeaux et le message de retour, `lg` pour les cartes, les fenêtres, les menus et le panneau du bas, `full` pour les statuts, les filtres posés, les étapes de frise et les avatars. Les icônes sont au trait, 1,5 px, 20 px de côté (16 px dans une ligne, 22 px dans la barre du bas). Le menu « ⋯ » est trois points, jamais une roue ni un chevron.

## Règles de forme

Les règles de D10 et des principes, valables sur tout écran. Elles servent de liste de contrôle (note 13, § 2).

1. **Une action principale par écran**, et c'est la tâche de l'écran : jamais un tutoriel, jamais une bascule de vue, jamais « Importer » (P-08 ; C-22, C-29, C-75). Elle nomme l'action : « Envoyer le devis », pas « Valider ». Sur un écran vide, l'état vide la porte seul (P-05, C-69, B9).
2. **Trois zones d'action au plus à 1 440 px, deux à 375 px** : une cible de maquette et un signal d'alarme, pas une règle de refus (D10, A2 ; C-19, C-22).
3. **L'en-tête d'un objet tient en 200 px** : retour, nom, faits sur une ligne, statut dit une fois, une action, un menu « ⋯ » ; tous les onglets visibles, l'ouvert marqué (P-09 ; C-22, C-23, C-48, C-80 ; E4).
4. **Une ligne de liste a une cible, une action rapide et un menu.** La cible est le nom (un titre-lien), l'action rapide est un bouton nommé (« Fait », « Ajouter à un mariage… », « Relancer… »), le reste est au menu « ⋯ ». Une seule case, et seulement en mode sélection. Rien de destructeur répété à chaque ligne (P-10 ; C-19, C-34, C-35, C-44 ; D10).
5. **Un objet a un nom, une ligne type et une seule fenêtre**, les mêmes partout ; son nom est un lien vers sa fiche, dans les deux sens (P-11 ; C-38, C-16 ; D3).
6. **Fermer ramène d'où l'on vient**, à sa place ; un écran ouvert depuis un objet garde « ← son nom » (P-12 ; C-11, C-16 ; A3).
7. **Le danger a trois niveaux**, à la mesure du risque (P-17 ; C-08 ; M6) : se défait (pas de question, « Annuler » et Corbeille) ; touche des tiers (fenêtre, conséquence, « Garder … ») ; ne se défait pas (en plus, une case à cocher).
8. **Toute action a son retour au même endroit**, avec « Annuler » pendant dix secondes quand elle se défait (P-16 ; C-09, C-17 ; M5). Un bouton répond toujours, ou dit pourquoi il ne peut pas : jamais grisé sans raison (M13, G8).
9. **Un champ obligatoire est marqué avant l'envoi** : « * » en encre dans le libellé, « * obligatoire » sous le formulaire, l'attribut `required` (lot 63 ; C-04 ; P-18).
10. **Les erreurs sont écrites par Symbola**, en français, sous ce qui est en cause, avec le mot du libellé, en disant quoi faire et où aller ; la saisie reste ; à partir de deux erreurs, un résumé en tête (P-18 ; C-04, C-60 ; M13).
11. **Une valeur absente se dit « non renseigné »**, jamais déduite, jamais « — » ni « 0,00 € » ; ce qui vient d'être créé ou importé n'est jamais « en retard » ; un import ne crée ni retard ni relance (P-01, P-02, P-06 ; C-53, C-55, C-63, C-67 ; D5, B7).
12. **Un compteur compte ce que l'écran montre** : « 8 tâches à faire sur 42 », « 4 sur 7 » ; l'annonce avant une action et le compte rendu après disent les mêmes nombres avec les mêmes mots (P-07, P-13 ; C-20, C-56, C-58 ; A1).
13. **Distinguer « rien encore », « rien avec ces filtres » et « tout est fait »** : trois textes, jamais « tout est à jour » quand il n'y a rien (P-05 ; C-15, C-37, C-55).
14. **Rien n'est coché d'avance sur un fait** (TVA, statut, paiement, mariages en cours) ; un choix de goût ou de métier peut l'être (M13, R5, B4).
15. **Une aide à la fois, proposée, jamais imposée** ; elle décrit ce que l'écran montre (P-19 ; C-01, C-02, C-05 ; D2).
16. **Sur téléphone et à 150 %, rien ne déborde** ni ne se superpose ; le contenu passe avant la navigation (P-20 ; C-77 à C-82, C-84).
17. **Un état se lit sans la couleur** ; un lien se reconnaît sans survol (P-21 ; C-83).
18. **Un bouton dit sa portée** quand elle n'est pas évidente : ce mariage, ou vos futurs mariages, ou toute l'agence (P-22 ; G14, G8).
19. **Enregistrer selon le cas** (D7, M1, G8 ; C-75) : un réglage isolé s'enregistre seul et le dit à côté de lui (« ✓ Enregistré ») ; un formulaire à champs liés et la fenêtre d'un objet ont un seul « Enregistrer », toujours visible, et « Fermer » demande « Fermer sans enregistrer ? » s'il reste des changements.
20. **La planner pilote** : Symbola prépare, la planner décide et envoie. Aucun bouton de relance automatique, aucun libre-service pour le client (M3, V14 ; ADR 0110).
21. **Le même geste des deux côtés d'un lien**, avec le même formulaire : rattacher un prestataire depuis le carnet ou depuis le mariage, créer une tâche depuis « Tâches » ou depuis la fiche (P-14 ; C-41, C-46 ; V8, V10).
22. **Les mots du lexique, et eux seuls** (P-15 ; § « Lexique »).

## Components

Chaque composant : son rôle, son anatomie, ses états, sa forme sur téléphone, et ce qui le fonde. Les composants nouveaux du lot 68 sont marqués « (lot 68) ».

### Commandes

- **Bouton principal** (`button-primary`) : un seul par écran (règle 1). Il nomme l'action : « Envoyer le devis », « Créer la tâche ». États : repos, survol (`primary-strong`), appui, focus (anneau de 3 px en `primary`, décalé de 1 px), en cours (« Envoi… », le libellé reste lisible). Jamais grisé sans raison : un clic sans les champs voulus écrit l'erreur sous la question (M13).
- **Bouton secondaire** (`button-secondary`) : fond blanc, bord `line-strong`. Les autres actions de l'écran.
- **Bouton de danger** (`button-danger`, lot 62) : fond blanc, bord et texte `critical`, pour ce qui détruit ou annule. Jamais l'allure du bouton principal ; toujours à côté d'un bouton de renoncement nommé (« Garder l'évènement ») (C-08, M6).
- **Lien** : texte `primary` souligné. Un bouton qui n'a pas l'allure d'un bouton (« fantôme ») ne sert qu'aux suites secondaires d'un bloc (« Tout afficher », « Les revoir »).
- **Bouton à menu** (lot 63) : « Nouveau ▾ », « + Créer » : une courte liste de choix, chacun avec une phrase qui dit ce qu'il fait (C-03).
- **Menu « ⋯ »** (lot 68) : bouton de 44 px, trois points, nom accessible « Plus d'actions pour <objet> ». Il ouvre une liste de 44 px par ligne ; chaque ligne qui ne s'explique pas seule a sa phrase dessous ; les lignes qui ouvrent une fenêtre finissent par « … ». Ordre : les actions courantes ; puis, après un filet, la section « Réglages » de l'écran (G14) ; puis, après un filet et en dernier, l'action de danger en `critical` (« Supprimer la tâche », « Annuler l'évènement… »), seule de sa couleur. Échap ou un clic ailleurs le ferme, le focus revient au bouton. **Sur téléphone**, il s'ouvre en panneau du bas, le nom de l'objet en tête (page 15). Fondement : D10, P-10, C-19, C-34, C-22.
- **Action rapide d'une ligne** (lot 68) : un bouton secondaire nommé, d'une seule taille sur tout l'écran (C-19) ; 44 px de haut. « Fait » devient « Faite » (pastille neutre à coche) le temps d'« Annuler », puis la ligne quitte la liste (D1).
- **Actions de ligne** (lot 62) : libellés courts ou icônes de 44 px. Le nom de l'objet va dans le nom accessible, pas dans le libellé visible.

### Choisir, filtrer, trier

- **Bascule** (lot 68, M8) : deux à quatre options côte à côte (« Liste · Calendrier », « Moi · L'agence »). L'option active est **pleine, en encre, texte blanc** (`toggle-active`) et porte `aria-pressed` ; les autres, texte `ink` sur blanc, dans un cadre `line-strong`. La règle vaut pour toutes les bascules et tous les filtres actifs de l'app. Sur téléphone, chaque option fait 44 px de haut. Fondement : C-83 (vert pâle à 1,16:1), M8.
- **Barre de filtres** (lot 63, lot 68) : chaque filtre a son libellé au-dessus et la même hauteur (44 px) ; un lieu et son rayon forment un seul contrôle (« Où ? », 170 px au moins, V4) ; les filtres nomment l'objet parent, la personne, la période (« Évènement », « Qui s'en charge », « Période », « Catégorie », « État ») (P-13 ; C-32, C-33, C-43). Dessous, une ligne de compte qui dit combien sur combien et l'ordre (« 8 tâches à faire sur 42 · 2 en retard », « 2 fiches sur 48, par distance ») ; « Grouper par » quand la liste se groupe (volet 1). Chaque filtre posé devient une **pastille** (`filter-chip`) avec « × » (nom accessible « Retirer le filtre … »), et « Effacer les filtres » dès qu'un filtre est actif. **Sur téléphone** : la liste d'abord ; un raccourci (« Mes tâches ») et un bouton « Filtres · 2 » qui ouvre un panneau du bas réglé sur les filtres en cours et finit par « Voir les 4 tâches » (C-81).
- **Pastilles de familles** (volet 4) : une pastille comptée par famille non vide, les métiers de la famille choisie en second rang, « À classer · 37 » à côté et non en double de « Tous » (D9, V4, V6).
- **Tri** : un en-tête de colonne qui trie le dit (flèche et nom accessible), et le tri en cours est écrit dans la ligne de compte (V5).
- **Interrupteur** : fond `line-strong`, `primary` quand il est ouvert ; son état est aussi écrit (« En marche », « Coupé ») (G8, G10).
- **Choix** (cartes de réponse) : une réponse par carte, son titre et ce qu'elle produit (« Le reste à payer passe à 18 775,00 € ») ; rien de coché d'avance sur un fait (M13, R5).

### Lignes et listes

- **Ligne type d'une tâche** (`task-row`, lot 68, D3) : 60 px de haut au moins. Le **titre**, seule cible, en encre souligné de gris (`task-title-link`), ouvre la fenêtre de la tâche ; l'évènement (texte simple) ; l'échéance et son état en toutes lettres (« sam. 21 nov. » puis « En retard de 4 jours » et « ! », ou « Dans 4 jours » et l'horloge) ; « Qui s'en charge » (initiales et « Vous », un prénom, « Les mariés ») ; l'action rapide « Fait » ; le menu « ⋯ » (« Changer la date… », « Confier à… », « Ouvrir l'évènement », puis « Supprimer la tâche »). Plus de case sans libellé, de rond, ni de trois boutons par ligne (C-34, C-35). États : à faire, bientôt, en retard, attend les mariés, faite (ligne en `ink-muted`, « Faite » à la place de « Fait », « Annuler » dans le message de retour), sélectionnée (une case de 44 px en tête, en mode sélection seulement), repris sans tâche (voir États). Quatre formes :
  - **« Tâches »** : toutes les colonnes ;
  - **fiche d'un évènement** : sans la colonne Évènement ;
  - **allégée** (« Aujourd'hui ») : sans menu ; le nom du mariage y est un lien séparé du titre, de 44 px sur téléphone (M4) ; quand un tiers est attendu, son contact sous le titre, le téléphone qui appelle sur téléphone (A4) ; l'action rapide selon le cas : « Fait », « Relancer… », rien pour un paiement (A3, V14) ; une tâche confiée aux mariés garde « Fait » (M3) ;
  - **téléphone** : trois étages (titre sur deux lignes au plus ; évènement et personne ; échéance et état), « Fait » de 44 px à droite, menu « ⋯ » de 44 px (C-77).
- **Ligne d'un prestataire** (volet 4, V1) : le nom (cible, ouvre la fiche) et dessous le contact et son téléphone ; métier et ville ; « Avec vous » ; évaluation ; pièces (un mot et une forme) ; « Ajouter à un mariage… » ; menu « ⋯ » (Ouvrir la fiche, Appeler, Écrire, Modifier, puis « Archiver… »). Sur téléphone, une carte, le téléphone en lien de 44 px (C-44).
- **Ligne d'un poste du budget** (volet 4, V12) : la première cellule porte le poste (qui ouvre sa fenêtre), le prestataire (lien vers sa fiche), où il en est en mots et ses pièces ; une action rapide quand il y a quelque chose à faire ; Prévu, Réel (et l'écart dessous), Réglé (et le reste dessous), Prochaine échéance ; un menu « ⋯ ». Sur téléphone, une carte par poste, quatre montants libellés sur deux colonnes, l'action rapide en bouton de toute la largeur (V13, C-78).
- **Liste éditable** (lot 62, G8) : un tableau, une ligne par élément. La ligne s'ouvre en place, une seule à la fois ; « Monter », « Descendre », « Supprimer… » au menu « ⋯ » de la ligne. Les réglages s'enregistrent à la sortie de la ligne ; le programme et le budget ont un seul « Enregistrer », dans la barre d'enregistrement, qui dit le nombre de lignes modifiées. Jamais un bouton d'envoi par ligne.
- **Ligne d'étape d'un parcours** (volet 2, page 6 ; volet 5, page 28) : un numéro rond (plein en encre quand c'est fait), le titre et sa phrase, l'état en mots et par une forme (fait, en cours, à faire, pas de fichier), l'action. La ligne suivante, seule, porte le bouton plein et un trait d'encre à gauche (R1, R4).

### Fenêtres et panneaux

- **Fenêtre** (lot 63, ADR 0107) : toute modification, courte ou longue, et les confirmations. Dialog natif en modal : fond assombri, focus piégé, Échap ferme (avec la même garde que « Fermer »). Jamais deux fenêtres empilées.
  - **Courte** (`window-short`, 560 px au plus) : une colonne. Confirmations, « Changer la date », « Ajouter à un mariage… », danger.
  - **Longue** (`object-window`, 860 px) : la fenêtre d'un objet (ci-dessous) et « Modifier les informations » : deux colonnes, ou des rubriques à gauche ; « Suivant » ou « ligne suivante » pour enchaîner sans y obliger.
  - **Sur téléphone** : une page entière, « ← <écran d'origine> » en haut à gauche, les mêmes rubriques l'une sous l'autre, les boutons collés en bas.
- **Fenêtre d'un objet** (lot 68, D3, M1) : la forme unique d'une tâche (et de tout objet qui a une ligne type), ouverte de partout (« Aujourd'hui », « Tâches », la fiche, la recherche) avec les mêmes mots. En-tête : le nom de l'objet en titre, son évènement en lien (P-11), son état ; le menu « ⋯ » de l'objet (dont « Supprimer la tâche », en dernier) et « Fermer ». Corps : deux colonnes, l'essentiel à gauche (« Qui s'en charge », échéance, « Place dans le rétroplanning »), le reste à droite (catégorie, note). Pied : « Fait » à gauche ; « Fermer » et « Enregistrer » (le bouton plein) à droite. **Un seul « Enregistrer »** (M1, **remplace ici l'enregistrement à chaque rubrique de l'ADR 0107**) : avec des changements, « Fermer », la croix et Échap demandent « Fermer sans enregistrer ? » (« Revenir à la tâche », « Fermer sans enregistrer », « Enregistrer et fermer »). En création, le même corps, l'évènement en premier champ avec « Aucun évènement » en tête de liste, et « Créer la tâche ». Fermer rend la ligne d'où l'on venait (A3).
- **Panneau latéral** (lot 63, ADR 0107) : les réglages d'un écran et la consultation rapide, au-dessus de l'écran, qui ne bouge pas. Il s'ouvre par la section « Réglages » du menu « ⋯ » de l'écran (la roue quitte les en-têtes, G14) : « Réglages de « Tâches » », « Pour cet écran » nomme les rubriques qui le concernent, « Voir dans les Paramètres » garde « ‹ Retour à Tâches ». Jamais pour une modification longue. Sur téléphone, il prend l'écran et dit « Retour à <écran> ».
- **Panneau du bas** (`sheet`, lot 68, téléphone seulement) : le menu « ⋯ », « Plus », les filtres, les choix d'une action en lot. Une poignée, un titre, des lignes de 52 px ; il finit par son bouton (« Voir les 4 tâches ») ou, pour « Plus », par « Se déconnecter » en encre, à part (D4, M2).
- **Petit panneau des dates** (lot 68, C-36) : « Changer la date… » depuis la ligne, la fenêtre et la sélection : des raccourcis datés en clair (« Demain, jeu. 26 nov. », « Dans une semaine, mer. 2 déc. ») et « Autre date ». Un seul nom pour ce geste.
- **Panneau d'aide** (lot 68, B14) : 420 px, rangé à droite, l'écran resserré à côté (sous 1 100 px, posé par-dessus, de toute la hauteur, jamais coupé ; sur téléphone, plein écran). Titre « Aide · <écran> » ; dans l'ordre : « Revoir la visite de cet écran », « Sur cet écran » (ou « Pour commencer » à l'écran vide), les questions qui s'ouvrent en place, « Une autre question ? » (recherche dans les articles sans quitter l'écran), les liens. Le « ? » d'une fenêtre ouvre l'aide de la fenêtre ; la saisie reste.

### Retour, messages, erreurs

- **Message de retour** (`feedback-toast`, lot 68, M5) : après chaque action, **en bas à gauche de la zone de contenu** (sur téléphone : au-dessus de la barre du bas, de toute la largeur moins 16 px de chaque côté). **Un seul à la fois** : l'action suivante le remplace. Fond `ink`, texte blanc ; une coche blanche en tête ; dessous, en `night-ink-muted`, l'objet ou la suite (« Léa & Maxime, Inès & Paul ») ; à droite, un bouton bordé en `night-accent` qui dit ce qu'il fait (« Annuler », « Ouvrir sa fiche », « Voir ses tâches », « Réessayer ») ; une croix « Fermer le message » ; une barre de temps de 3 px en `night-ink-muted`. Dix secondes quand on peut défaire, cinq sinon ; le temps s'arrête sous la souris ou le focus ; `aria-live="polite"`. Il ne couvre ni « Fait », ni l'action principale, ni la barre du bas. Le texte commence par ce qui s'est passé, puis l'objet : « Tâche faite : Choisir le fleuriste », « 3 tâches décalées de 7 jours », « Tâche supprimée : … · Elle reste dans la Corbeille des Paramètres », « Évènement créé · Avec 42 tâches et son budget » (P-07). **Échec** (`feedback-toast-failure`) : fond blanc, bord `critical`, « Erreur : la tâche n'a pas été enregistrée · Connexion perdue. Votre saisie est gardée. » et « Réessayer » (page 4). Fondement : C-09, C-17, P-16, M5, M6.
- **Bandeau en place** (lot 62, lot 68) : dans la page, au-dessus de ce qu'il concerne. Le texte dit d'abord ce que c'est. **Information** (`notice-info`) : fond neutre bordé, icône « i » ; plus jamais sur le fond de la couleur d'action (A15). **À vérifier** (`notice-check`) : « À vérifier : » sur `attention-soft`, avec la suite. **Erreur** (`notice-error`) : « Erreur : » sur `critical-soft`, avec ce qu'il faut faire. Composants existants `ErrorNotice` et `AttentionNotice`. Un bandeau qui ne demande rien ne passe pas avant le travail du jour (C-18) : seule une alerte qui bloque se met en tête d'« Aujourd'hui » (plafond d'e-mails, rappels arrêtés, demande RGPD).
- **Erreur de saisie** (lot 68, P-18) : validation par Symbola (`noValidate`, messages des schémas Zod partagés client et serveur), jamais la bulle du navigateur (C-04). Sous le champ en erreur : bord `critical` de 2 px, « ! » et le message, avec le mot du libellé (« Indiquez l'échéance de la tâche ») ; à partir de deux erreurs, un résumé en tête (« Erreur : 2 champs à remplir », liens vers les champs) ; focus au premier champ en erreur ; la saisie reste ; le format attendu est écrit (« jj/mm/aaaa »). Dans un assistant, l'erreur se met sous la question (M13). Pour un import, sous la ligne en cause, avec où aller (« Ce fichier est un programme : le déposer à la ligne « Programme » ») (C-60).
- **Champ obligatoire** (lot 63) : « * » dans le libellé (`RequiredMark`), « * obligatoire » sous le formulaire (`RequiredLegend`), et l'attribut `required` sur le champ. L'astérisque est en encre, jamais en rouge. Un nouvel écran sans astérisque fait échouer `app/ui/required-mark.test.ts`.
- **Enregistré** (lot 68, G8) : à côté d'un réglage isolé, « ✓ Enregistré » en `ink-muted` pendant cinq secondes ; en cas d'échec, « Erreur : non enregistré · Réessayer » à la même place.

### Barres

- **Barre du haut** (lot 68) : fixe ; à l'ordinateur 68 px (recherche, « + Créer », notifications, « ? », compte sous le prénom) (C-12, M7) ; sur téléphone 60 px (titre, recherche, créer, notifications, aide).
- **Barre du bas du téléphone** (`bottom-bar`, lot 68, D4) : 72 px ; Aujourd'hui, Évènements, Tâches, Prestataires, Plus ; chaque entrée, icône de 22 px et mot, 56 px de haut ; l'entrée ouverte en `primary`, un trait de 3 px au-dessus et le mot en gras (`bottom-bar-active`) ; un compteur rouge pour les retards seulement (« Tâches 2 »).
- **Barre d'enregistrement** (`save-bar`, lot 68, D7, G8) : pour un formulaire à champs liés et pour la liste éditable du programme et du budget. Collée en bas de la zone de contenu (de toute la largeur sur téléphone, au-dessus de la barre du bas), toujours visible, bord haut de 2 px en `ink`. Elle dit l'état en mots à gauche : « Aucune modification », « 2 champs modifiés : adresse, téléphone », « Enregistré à 14 h 32 » ; à droite, « Enregistrer … » (le bouton plein de l'écran) et, avec des changements, « Revenir à la version enregistrée ». Jamais grisée : sans changement, « Enregistrer » répond « Rien à enregistrer ».
- **Barre de sélection** (`selection-bar`, lot 68, M2) : on y entre par « Sélectionner » ; collée au bas de la liste sans la pousser (C-40), de toute sa largeur, bord haut de 2 px en `ink`, « 3 tâches sélectionnées » en tête en `heading`, puis les actions en boutons de taille normale (« Fait », « Changer la date… », « Confier à… », « Supprimer… » en dernier) et « Fermer la sélection ». Sur téléphone, elle remplace la barre du bas et chaque choix s'ouvre en panneau du bas.

### En-têtes, onglets, frise

- **En-tête d'un objet** (lot 68, P-09, page 15) : « ← Évènements » ; le nom en `title` ; une ligne de faits (« Samedi 12 juin 2027 · Manoir des Aulnes · 120 invités ») ; la frise sur une ligne ; à droite une action (« Écrire aux mariés » ; à J-7, « Ouvrir le Jour J ») et le menu « ⋯ ». Le type et la source passent dans « Informations ». 130 px du retour au bas de la frise, 191 px onglets compris (mesuré à 1 440 px). En défilant, une barre fine garde nom, date, statut et onglets. Sur téléphone : pas de bouton dans l'en-tête, l'action en tête du menu ; « Les étapes » ouvre la frise complète en panneau du bas ; onglets à 224 px du haut (C-80).
- **Onglets** (`tab-active`) : l'ouvert en gras, souligné de 3 px en `primary`, `aria-selected` ; chacun avec son nombre utile en `label` (« 6 sur 9 », « 2 en retard » en `critical`). Tous tiennent à 1 440 px ; à l'ordinateur étroit, « Plus ▾ » ; sur téléphone, la barre défile de côté avec une flèche de 44 px, l'onglet ouvert amené dans le cadre ; changer d'onglet garde la barre en haut (C-23, C-80, E3).
- **Frise d'étapes** (lot 68, E1, E2) : quatre étapes (« Une demande en cours », « Signé, en préparation », « Jour J », « Clôturé »), **en lecture** : un rond plein en encre et une coche pour une étape franchie, un anneau d'encre et le mot en gras pour l'étape en cours, un rond bordé `line-strong` pour la suite ; la date sous chaque étape franchie (« le 3 mars »). Quand une étape se franchit à la main, un bouton secondaire nommé au bout de la frise (« Le contrat est signé… », « Clôturer l'évènement… ») et sa question juste dessous. **Reporté** et **Annulé** remplacent la frise par une ligne d'état et leur seule suite (« Fixer la nouvelle date… », « Rétablir l'évènement… », niveau 2). **Archivé** : une ligne « Archivé · lecture seule ». Le statut n'est dit qu'une fois (C-27). La même forme sert à l'assistant d'import (étape en cours en encre, voir S6).
- **Barre d'avancement** (`progress-bar`) : 6 px, `ink` sur `line`, toujours avec son compte en mots (« 14 sur 20 ») ; jamais pleine pour dire « terminé » sans montant (H-MI-11).

### États d'un écran : vide, rempli, repris

- **État vide** (`empty-state`, lot 68, B9, page 24) : un gabarit, dans cet ordre : un titre qui dit ce qui viendra, une phrase et un exemple, **la seule action principale de l'écran**, l'autre voie en ligne à part (la reprise : « Vous le suivez déjà dans un autre logiciel ou un tableur ? Reprendre ses fichiers »), l'aide (le mariage d'exemple, l'aide de l'écran). Tant que l'écran est vide : ni filtres, ni vues, ni exports, ni charge, ni calendrier vide ; les commandes de l'en-tête passent au menu « ⋯ » ; aucune visite ni invitation à un tutoriel. Un prérequis manquant devient l'action (« Compléter votre fiche entreprise » sur « Devis et factures ») (C-15, C-69).
- **Trois textes vides** (P-05) : rien encore (« Pas encore de tâche ») ; rien avec ces filtres (« 0 tâche sur 42 avec ces filtres · Effacer les filtres ») ; tout est fait ou passé (« Toutes les tâches de la semaine sont faites · Les revoir »). « Tout est à jour » n'apparaît que si quelque chose a été fait (C-37, C-55).
- **Rempli** : rien entre le titre et le travail du jour, sauf une alerte qui bloque (C-18) ; les compteurs disent « N sur M » (règle 12).
- **Repris** (lot 68, volet 2) : un objet venu d'un fichier porte l'étiquette neutre « Repris » dans les listes, et un filtre « Origine » ; sa fiche dit « Repris le 24 nov. de 4 fichiers · Voir la reprise » et montre un bloc **« À compléter après la reprise »** (`notice-check`) : une ligne par point (montants, contrats non signés, tâches, heures du programme, liens des mariés, invités), chacune avec son bouton ; une fois tout fait, « Reprise complétée le … », puis le bloc disparaît au bout de sept jours (R9). La santé ne rend pas d'avis sur zéro tâche (« Pas encore de tâches : pas d'avis ») ; « D'où viennent ces valeurs ? » montre à la demande le fichier de chaque valeur (`origin-mark`, R7). Une liste qui contient un mariage repris sans tâches le signale : « À vérifier : « Juliette & Romain » n'a pas encore de tâches · Reprendre la liste de votre tableur · Partir d'un modèle Symbola ».
- **Interrompu** : un parcours laissé en plan se retrouve à sa ligne avec « Continuer » (page de reprise, assistant de démarrage : « Votre espace n'est pas tout à fait prêt · 2 questions sur 5 restent · Continuer les questions ») (B1, R1).

### Premiers pas et aide

- **Assistant pas à pas** (lot 63f, ADR 0103 ; lot 68, B1 à B6) : une question par écran, les étapes à gauche (en ligne sur téléphone) avec leur coche, « Continuer » à droite (Entrée), collé en bas sur téléphone, « Précédent » à gauche. Chaque étape s'enregistre ; rien n'est bloquant. Deux usages :
  - **l'assistant de démarrage** s'ouvre seul à la première connexion de la titulaire ; cinq questions au plus ; un seul bouton, « Continuer » : « Passer » disparaît, une réponse « Je ne sais pas encore » en tient lieu quand il le faut (B5) ; interrompu, une ligne sur l'accueil (B1) ; la fin propose un seul premier pas, selon les réponses, puis les réponses et ce qu'elles ont préparé, chacune avec son lien (B6) ;
  - **l'assistant « L'essentiel »** (fiche de l'entreprise avant le premier devis) est gardé tel quel, avec « Passer cette étape » et « Finir plus tard » dessous (volet 5, § 3 bis).
- **Ligne « Découvrir cet écran en 1 minute »** (lot 68, D2, B11) : sous l'en-tête, aux trois premières venues ou jusqu'à ce qu'elle soit ouverte ou fermée ; jamais sur un écran vide ; aucun bouton plein ; une croix « Ne plus proposer ».
- **Visite guidée** (lot 63f, ADR 0104 ; lot 68, D2, B10, B12) : proposée, jamais imposée, sauf celle de l'accueil, une fois, à la fin de l'assistant. Fond assombri, la zone expliquée reste claire et encadrée, une bulle à côté : « N sur M », un titre, deux phrases avec les mots de l'appareil (« Touchez » sur téléphone), « Précédent », « Suivant » ou « Terminer », et une croix « Fermer la visite » à chaque bulle (elle remplace « Passer la visite »). Trois ou quatre bulles par visite, texte dans `tours.json`. Focus dans la bulle, Échap ferme. Sur téléphone, la bulle est ancrée en bas, la zone encadrée reste visible. « Revoir la visite de cet écran » est la première ligne du « ? ».
- **Panneau du tutoriel** (lot 63f, ADR 0104) : à droite sur ordinateur (il pousse le contenu), en bas sur téléphone ; ses étapes cochées, l'étape en cours, « Réduire » et « Quitter le tutoriel ». Il suit la navigation dans l'exemple. Les tutoriels suivent le parcours choisi à l'assistant (D6, B15) ; plus de pastille « 0/11 » au menu (C-10).

### Réglages

- **En-tête d'une rubrique** (lot 68, G8) : le libellé du menu en titre, une phrase (ce que la rubrique règle et où cela se voit), la portée (« Pour toute l'agence », « Pour vous seule ») et qui la change (« titulaire »).
- **Liste de réglages** (lot 61) : une seule carte, une ligne par réglage. À gauche, ce que fait le réglage (titre, une phrase, pastille d'état) ; à droite, ses commandes ; dessous, son détail. En colonne quand la place manque. Jamais une carte par réglage. Chaque réglage s'enregistre seul et le dit (« ✓ Enregistré ») (D7).
- **Formulaire en ligne** (lot 61) : quelques champs courts et leur bouton sur une même ligne, alignés à gauche, le bouton en secondaire. Sa règle dit sa direction (`flex-row`) : un formulaire est en colonne par défaut (lot 62). Un nombre de jours ou de points est un champ court, jamais un champ de toute la largeur.
- **Formulaire en grille** (lot 62) : les champs d'une fiche sur deux ou trois colonnes, regroupés par sens (identité, adresse, contact), une seule colonne sur téléphone. Un nombre, une date ou un code est un champ court. Jamais six champs empilés sur un même bord. Avec des champs liés, la barre d'enregistrement (D7).
- **Valeur à copier** (lot 61) : le champ en lecture seule et son bouton « Copier » côte à côte ; les étapes à suivre, numérotées, juste dessous.
- **Rubriques d'un écran long** (lot 62) : au-delà de trois écrans de haut, un sommaire d'ancres en tête, ou des onglets quand chaque rubrique a son adresse.

### Autres

- **Carte** (`card`) : fond blanc, bord de 1 px en `line` (`divider`), coins `lg`, marge intérieure `xl`.
- **Panneau flottant** (`floating-panel`) : panneau, menu ou fenêtre, surface qui porte une ombre (`elevation.float`).
- **Statut** (`status-neutral`, `status-pending`, `status-check`, `status-late`) : pastille à mot, avec icône. Neutre pour l'attente d'un tiers, « bientôt », « fait », « partagé », « repris » ; ambre pour « à vérifier » ; rouge pour « en retard » et « expirée ». **`status-pending` passe de l'ambre au neutre** (porte 2, § 6).
- **Entrée de navigation active** (`nav-item-active`) : fond `primary-soft`, texte `primary` en gras, `aria-current="page"` ; le gras dit l'état sans la couleur (voir S4).
- **Chiffre clé** (`key-figure`) : montant ou compteur, toujours accompagné de son libellé en `label` ; « non renseigné » quand la valeur manque.
- **Provenance** (`origin-mark`, volet 2) : une marque neutre (icône de document et nom du fichier), jamais une teinte d'état.
- **Glisser-déposer** (lot 63) : geste d'ordinateur, toujours doublé d'un bouton (« Déplacer vers… ») pour le clavier et le téléphone. La zone qui accepte la pièce se marque (bord pointillé) pendant le geste.
- **Zone de dépôt** (lot 63) : une seule, toujours en tête de l'écran, même après le premier fichier ; elle demande ce qu'est le document avant de l'envoyer ; un fichier déposé au mauvais endroit est reconnu et envoyé à sa ligne (C-60).
- **Écran de terrain** (`field-screen`, `field-card`, `field-action`) : le mode Jour J, sombre, à gros caractères, cibles de 56 px.

## Motifs de parcours

Les enchaînements que l'on retrouve d'un module à l'autre. Un nouvel écran les reprend tels quels.

- **Créer** (D8, M12, M13 ; C-03, C-25) : « Nouvel … » en haut de l'écran ouvre le formulaire ; le même formulaire par « + Créer », avec le contexte écrit (« Tâche pour Léa & Maxime ») ; le bouton d'envoi dit « Créer … » ; le message de retour propose d'y aller (« Ouvrir sa fiche », « Voir ses tâches »). « Nouvel évènement » pose « Où en est-il ? » à deux réponses, aucune cochée ; la reprise est une ligne à part dessous. Le client est un champ, pas un type.
- **Ouvrir, modifier, revenir** (D3, A3, P-12) : le nom ouvre l'objet ; une tâche s'ouvre dans sa fenêtre par-dessus l'écran ; un prestataire ou un évènement s'ouvre sur sa fiche ; « Fermer » ou « ← » rend l'écran d'où l'on venait, à la même ligne.
- **Changer la date** (C-36) : un nom, un petit panneau, depuis la ligne, la fenêtre et la sélection ; « Annuler » dans le message de retour. « Reporter » est rendu à l'évènement entier.
- **Agir sur plusieurs** (M2, V5) : « Sélectionner », les cases, la barre de sélection, chaque action et son message de retour avec « Annuler » (« 3 tâches décalées de 7 jours »).
- **Faire, puis retrouver** (D1, C-17) : « Fait », la ligne « Faite » le temps d'« Annuler » ; ensuite « Rouvrir » dans « État : Faites » (triées par date de fin, avec qui et quand) ; « 3 tâches faites aujourd'hui · Les revoir » sur l'accueil.
- **Supprimer, annuler, retirer** (P-17, M6, R6) : niveau 1, 2 ou 3 selon le risque ; « Annuler » seul ne veut dire que défaire ; renoncer se dit « Garder … ».
- **Rattacher des deux côtés** (P-14, V8 ; C-41) : « Ajouter à un mariage… » depuis le carnet (fenêtre courte : mariage, poste proposé, « En comparaison » ou « Retenu », rien de coché) ; « Ajouter… » depuis le poste (panneau des fiches du métier d'abord, « Chercher dans tout le carnet ») ; même formulaire de création des deux côtés (V10).
- **Relancer** (V14, M3, ADR 0110 ; C-50) : « Relancer… » ouvre une fenêtre en deux temps : « Le joindre » (contact, téléphone qui appelle, message type visible, « Copier le message », « Ouvrir dans ma messagerie »), puis « Noter ce que vous avez fait » (comment, le, me le rappeler, note). La ligne dit aussitôt « dernière relance : aujourd'hui, par e-mail ». Symbola n'envoie rien.
- **Reprendre un mariage en cours** (R1 à R18 ; C-51 à C-66) : une page par mariage, six lignes dans l'ordre (carnet, mariage, budget, prestataires retenus, liste « à faire », programme), chacune avec son état ; « Je n'ai pas ce fichier » règle une ligne ; l'assistant **demande au lieu de rejeter** (le mariage visé, le statut d'un paiement, le type, « Où en est-il ? », ce qu'il faut faire des échéances passées), chaque réponse avec son résultat chiffré, et « Ce que Symbola a compris » à côté ; « Vérifier » et le bilan disent les mêmes nombres ; le bilan dit ce qui n'a pas été repris ; « Retirer cet import… » (niveau 2) avec sa date limite ; « Abandonner cet import… » à chaque étape. La fin compte ce qui reste et mène à la fiche, jamais « tout est à jour ».
- **Partager un document incomplet** (R13, D5) : « Partager… » ouvre d'abord une fenêtre qui dit ce qui manque ; « Compléter d'abord » est l'action principale ; partager reste permis.
- **Premier jour** (B1 à B11, D2, D6) : l'assistant de démarrage, sa fin et son seul premier pas, l'accueil vide et sa seule action, la visite de l'accueil (trois bulles), puis les autres visites proposées par la ligne « Découvrir cet écran ».
- **Chercher** (M9, G13 ; C-12, C-74) : un seul champ, en haut ; résultats rangés par type et comptés, chacun disant où il mène ; le premier surligné, Entrée l'ouvre, les flèches choisissent ; les réglages trouvés par leur nom, leur phrase et des synonymes ; les actions après les résultats, seulement si elles répondent au texte (A15 bis).
- **Régler depuis un écran** (G14, ADR 0107) : la section « Réglages » du menu « ⋯ », le panneau « Réglages de « … » », sa portée dite (« Ne change pas les postes de « Léa & Maxime » »), le retour à l'écran.

## Lexique

Un mot par objet, une graphie, un verbe par geste (P-15 ; C-85 à C-90). Le français fait foi ; les mots anglais suivent dans les fichiers de traduction (C1). La colonne « On n'écrit plus » nourrit le contrôle automatique des textes (`packages/i18n/src/lexique.test.ts`, lot 70g), qui fonctionne en cliquet.

### Les rôles et les personnes

| On écrit | On n'écrit plus | Règle | Fondement |
| --- | --- | --- | --- |
| Vous ; le prénom d'un collègue (« Bastien ») | Planner, Planner principal comme valeur | La personne connectée se lit « Vous » ; un collègue, par son prénom, partout où une tâche, un évènement ou une relance a quelqu'un | C-85, C-32 |
| titulaire | Propriétaire, owner | Le rôle de qui a ouvert l'espace et le règle ; dit dans les Paramètres et sur les rubriques qu'elle seule change (« titulaire ») | G1, lexique page 5 |
| collaborateur, collaboratrice | Membre, Planner comme rôle | Le rôle d'un membre de l'équipe ; dit dans les Paramètres seulement | lexique page 5 (voir S7) |
| comptable | — | L'accès du cabinet comptable, en lecture | rôle existant (voir S7) |
| les mariés ; le terme choisi pour un autre type (« les parents », « le client ») | Mariés sur un baptême, le contact, Interlocuteurs, Tâche confiée au client | Le mot suit le réglage « Types d'évènements et termes des clients » ; dans un filtre qui mêle tous les évènements : « les clients » | C-85, G3 |
| prestataire ; invité | — | Les tiers, qui n'ont pas de compte : ils ouvrent un lien personnel | UX-11, ADR 0053 |
| Exploitation | Admin, administration | L'équipe qui exploite Symbola ; elle n'a aucun accès aux données métier | SEC-09, ADR 0029 |
| Qui s'en charge | Qui la réalise, Responsable (d'une tâche) | Un seul libellé pour la personne d'une tâche, en colonne, en filtre et dans la fenêtre | C-38 |
| Avec les mariés ; Attend les mariés | Tâche confiée au client | « Avec les mariés » à la création ; « Attend les mariés » seulement une fois leur espace ouvert | B8 |

### Les objets

| On écrit | On n'écrit plus | Règle | Fondement |
| --- | --- | --- | --- |
| évènement | événement | Une seule graphie, partout | C-89 |
| Tâches (menu, onglet de la fiche, filtres) | Rétroplanning comme nom d'onglet | Le rétroplanning est le modèle qui fabrique les tâches ; on le cite comme tel (« rétroplanning « Mariage classique » ») | C-39, M11 |
| Place dans le rétroplanning ; Étape clé | Rang et jalon | Dans la fenêtre d'une tâche | C-90 |
| Hors évènement | Tâches hors évènement (formulaire à part) | Une tâche sans évènement est une tâche comme une autre | C-31 |
| Programme ; moment ; Ponctuel | Programme du jour J, séquence, chrono | « Jour J » ne nomme plus que l'étape et l'écran du terrain ; un moment sans fin est « Ponctuel » | E6, R15, R12, C-90 |
| Veille, Jour J, Lendemain, puis la date | trois « Jour J » | Les journées d'un programme, la date complète à côté | R11 |
| Une demande en cours ; Signé, en préparation ; Jour J ; Clôturé | Prospect, Option, Confirmé, En préparation comme étapes visibles | Les quatre étapes de la frise et les réponses de « Où en est-il ? » (les statuts peuvent rester en base) | E1, M12, C-25 |
| poste (du budget) | ligne du budget, ligne, prestation | « 6 postes retenus sur 9 » | C-86, V12 |
| en comparaison ; Retenu | Pressenti | « Mettre en comparaison » et « Retenir », expliqués en tête du panneau | V7, C-49 |
| famille (de métiers) ; métier | type (de prestataire) | Les pastilles du carnet : familles, puis métiers ; « Tous les métiers » | V4, G4 |
| pièces ; assurances et pièces | documents administratifs | Ce qu'un prestataire fournit (assurance, Kbis) | V9, G4 |
| Venu par | Source du prospect, Outil actuel | Comment le client est arrivé ; « non renseigné » s'il manque | volet 3, C-64 |
| non renseigné | « — », « 0,00 € » pour une valeur absente, Type à préciser | Partout | P-02, C-55, C-64 |
| Repris ; À compléter | Champs importés | Ce qui vient d'un fichier, et ce qu'il reste à compléter | volet 2 |
| Doublon possible | rapprochement, ressemblance 63 %, propositions sûres | Avec ce qui rapproche les deux en mots | C-57, C-90 |
| Ce qui n'a pas été repris ; lignes à corriger | rapport des écarts, lignes rejetées | Vérifier, bilan | C-90 |
| Alertes du matin | le radar, Alerte du radar | « Chaque matin, Symbola cherche les risques des évènements à venir » | C-90 |
| Temps bloqué autour de l'évènement | Plage occupée | Paramètres, rendez-vous | C-90 |
| fichier de sauvegarde Symbola | JSON | Export, restauration | C-90 |
| Tous les modules ; ce que comprend votre abonnement | Apps, vos modules | | C-10, C-90 |
| Paramètres (le lieu) ; Réglages de « … » (le panneau d'un écran) ; Régler … | Réglages pour ouvrir les Paramètres | « Paramètres » nomme le menu et ses rubriques ; « Réglages » ne nomme que la section du menu « ⋯ » et le panneau d'un écran | C-87, C-11, G14 |
| Vos données | Prestataires et données (pour l'export, la corbeille, l'historique) | La page de ce qui n'est pas un réglage | G5, C-73 |
| Reprendre et importer | Importer (dans les Paramètres) | La page d'import | G6 |
| Ce téléphone | PUSH | Notifications | G16, C-76 |
| article ; visite ; tutoriel ; mariage d'exemple ; aide | Essai guidé, exemple de 24 h, rubrique d'aide | Les quatre dispositifs d'aide et leur unité | B13, B16, C-10 |

### Les verbes : un geste, un verbe

| Verbe | Ce qu'il veut dire, et lui seul | Ce qu'il remplace | Fondement |
| --- | --- | --- | --- |
| Nouvel … / Nouvelle … | Ouvre le formulaire de création : « Nouvelle tâche », « Nouvel évènement » | Nouveau seul, Créer un évènement sur l'état vide | C-03 |
| Créer … | Envoie ce formulaire : « Créer la tâche » ; et le menu global « + Créer » | Valider, Enregistrer à la création | C-03 |
| Ajouter … à … | Rattacher une chose qui existe, ou une pièce : « Ajouter à un mariage… » | Ajouter pour créer | C-03, V8 |
| Modifier | Ouvre un formulaire pour changer plusieurs champs ; un geste sur un champ porte son nom (« Changer la date… », « Confier à… », « Renommer ») | Changer pour ouvrir un formulaire | C-87 |
| Enregistrer | Garde les changements d'une fenêtre ou d'un formulaire lié | — | M1, D7 |
| Changer la date… | Déplacer l'échéance d'une ou plusieurs tâches | Reporter (tâche), Décaler de… | C-36 |
| Reporter l'évènement… | Changer la date d'un évènement entier | — | C-87, E5 |
| Annuler (seul) | Défaire la dernière action, dans le message de retour, et rien d'autre ; ne ferme jamais une fenêtre | Annuler pour fermer | M6, C-87 |
| Annuler l'évènement… | Toujours avec son complément ; on renonce par « Garder l'évènement » | — | M6, C-08 |
| Rétablir l'évènement… | Rendre vie à un évènement annulé (il revient en demande en cours) | Réactiver | M6 |
| Fermer | Sortir d'une fenêtre ou d'un panneau ; avec des changements, « Fermer sans enregistrer ? » | Annuler, Retour, la croix seule | M1, C-87 |
| Supprimer | L'objet part dans la Corbeille ; « Annuler » dix secondes ; il revient depuis la Corbeille | — | C-08 |
| Retirer de … | Défaire un lien, l'objet reste ailleurs : « Retirer du mariage » ; « Retirer cet import… » | Retirer sans complément, Annuler cet import | C-87, R6 |
| Archiver… | Sortir des listes ; rien n'est effacé | — | C-87 |
| Fait · Rouvrir | Les deux gestes de l'état d'une tâche, partout | le rond, la case « Fait », Marquer comme faite | C-35, M11 |
| Relancer… | Ouvre la fenêtre « Le joindre », puis « Noter » | Noter une relance | V14, C-50 |
| Mettre en comparaison · Retenir | Proposer un prestataire sur un poste, ou le choisir | Comparer, Pressenti | V7 |
| Reprendre un mariage en cours | Faire entrer dans Symbola un mariage suivi ailleurs | Reprendre pour continuer, restaurer, commencer | C-88 |
| Continuer · Restaurer une sauvegarde · Commencer | Reprendre là où l'on s'est arrêté ; remettre une sauvegarde Symbola ; ouvrir le questionnaire la première fois | en cours · Reprendre, Reprendre un export, Reprendre le questionnaire | C-88 |
| Abandonner cet import… | Quitter un import en cours ; rien n'a été écrit | Abandonner l'import (lien) | volet 2 |
| Partager… | Donner un document aux tiers ; dit d'abord ce qui manque | — | R13 |
| Garder … | Renoncer à une action de danger, en nommant l'objet | Annuler, Non | M6 |

## Do's and Don'ts

- Faire : commencer chaque écran par la prochaine action.
- Faire : marquer d'une pastille « Partagé » tout ce que le client voit.
- Faire : garder un seul bouton principal par écran.
- Faire : écrire les libellés dans les mots du métier, ceux du lexique.
- Faire : dire « non renseigné » plutôt que deviner une valeur.
- Faire : redire dans le message de retour ce qui s'est passé, sur quoi, et combien.
- Faire : vérifier chaque écran à 1 440, 911 × 512 et 375 px (note 13, § 2).
- Ne pas faire : employer une valeur de couleur, de taille ou d'espacement hors de ce fichier, même si une maquette l'emploie.
- Ne pas faire : signaler un statut par la couleur seule.
- Ne pas faire : mettre la couleur d'action sur un statut, une coche, une barre d'avancement ou un bandeau.
- Ne pas faire : répéter un bouton rouge à chaque ligne.
- Ne pas faire : griser un bouton sans dire pourquoi.
- Ne pas faire : cocher d'avance une réponse sur un fait.
- Ne pas faire : ajouter un dégradé, une ombre décorative ou une illustration d'ambiance.
- Ne pas faire : empiler deux fenêtres modales.
- Ne pas faire : ajouter un bouton de relance automatique ou un libre-service pour le client.
