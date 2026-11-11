# Lot 25b — Jetons de `DESIGN.md` et composants de base

**Statut** : spécification validée par Julien le 11/11/2026 (« Oui, les deux » : D1 oui, D2 a).
Branche `lot-25b-jetons-design`. Aucun changement de parcours ni de schéma : l'app
change d'apparence, pas de comportement.

## Contexte

Julien a adopté `DESIGN.md` (décision Q13, ADR 0057). Le cahier des charges (§ 5, « Langage
visuel ») exige que les jetons de design vivent dans ce fichier et qu'**aucun écran n'emploie une
valeur hors jeton**. Le lot passe avant les lots 26 à 32, pour ne pas construire les nouveaux
écrans deux fois.

**Constat du 11/11/2026** (`apps/symbola/app/globals.css`, 2 592 lignes) :

- tout le style passe par cette feuille (644 `@apply`) ; les écrans n'emploient aucune couleur
  ni taille arbitraire dans leurs composants : changer la feuille suffit à changer l'app ;
- les jetons actuels sont ceux de l'ADR 0025 : sauge, terracotta, lin, ivoire, Fraunces ;
- plusieurs valeurs sont hors jeton : 87 tailles et rayons entre crochets (`text-[15px]`,
  `rounded-[12px]`), les tailles par défaut de Tailwind (`text-sm` = 14 px), 4 ombres
  décoratives, une centaine de pas d'espacement hors de l'échelle (2, 6, 10, 14, 20 px), et des
  textes de 8 à 11 px, sous le minimum de 13 px.

**Ce que doit garantir le lot** : l'app prend la charte de `DESIGN.md` ; chaque couleur, police,
taille, rayon, ombre et espacement de la feuille de style vient d'un jeton ; un écart est refusé
automatiquement, à la compilation ou par un test.

**Exigences** : § 5 « Langage visuel » (aucune valeur hors jeton), UX-14 et NFR-17 (contrastes
WCAG 2.2 AA), ADR 0057.

## Partie A — Police Space Grotesk

Space Grotesk (titres et chiffres) remplace Fraunces ; Inter reste pour le texte. Comme
aujourd'hui (ADR 0025), le fichier est servi par l'app : `apps/symbola/app/fonts/`, sous-ensemble
latin, poids variables, avec sa licence OFL. Aucun appel à un service de polices. Fraunces et sa
licence sont retirées. Voir la décision D1.

## Partie B — Les jetons dans le thème, et seulement eux

Dans `@theme`, les familles par défaut de Tailwind sont vidées (couleurs, tailles de texte,
rayons, ombres, polices), puis seuls les jetons de `DESIGN.md` sont déclarés :

- **couleurs** : `primary`, `on-primary`, `primary-soft`, `ground`, `surface`, `ink`, `ink-muted`,
  `line`, `attention`, `attention-soft`, `critical`, `critical-soft` et les jetons de nuit
  (`night`…, posés pour le mode Jour J du lot 30) ;
- **texte** : `display`, `title`, `heading`, `body`, `body-strong`, `label`, `figure` (chiffres
  tabulaires), `field-now`, avec leur interlignage et leur graisse ;
- **rayons** : `sm` 6 px, `md` 10 px, `lg` 16 px, `full` ;
- **espacements** : l'échelle de 4 px de `DESIGN.md` (4, 8, 12, 16, 24, 32, 48 px).

Effet : un `@apply bg-sauge` ou `text-sm` ne compile plus. La feuille ne peut employer que des
jetons.

## Partie C — La feuille de style migrée

Correspondance appliquée à toute la feuille, puis relue écran par écran sur les captures :

| Aujourd'hui | Devient |
| --- | --- |
| ivoire (fond de page), lin clair | `ground` |
| carte (blanc) | `surface` |
| encre, encre douce | `ink` |
| texte atténué | `ink-muted` |
| sauge (action, lien, actif) et ses teintes | `primary`, `primary-soft` (et le survol, D2) |
| terracotta (erreur, retard) et ses teintes | `critical`, `critical-soft` |
| ambre (en attente) | `attention`, `attention-soft` |
| bleu (information) | neutre : `ground` et `ink-muted` (`DESIGN.md` : une couleur, un sens) |
| lin (bords, séparateurs) | `line` ; bord des champs et des boutons secondaires : D2 |
| 15 et 16 px, `text-base` | `body` |
| 14 px et moins, `text-sm` | `label` (13 px au minimum) |
| rayons 8 à 12 px | `md` ; 16 px | `lg` |
| ombres décoratives (cartes, messages) | retirées ; panneaux latéraux et menus flottants : D2 |
| pas d'espacement hors échelle | pas le plus proche de l'échelle |

Mise en page : barre latérale de 232 px, contenu de 1 120 px au plus (`DESIGN.md`, « Layout »).
Icônes : 20 px, trait de 1,5 px. Logo provisoire : couleur `primary`.

## Partie D — Composants de base

Les classes existantes prennent les jetons sans changer de nom, pour ne pas toucher aux écrans :
boutons (l'envoi d'un formulaire est le bouton principal, ADR 0025), carte, pastilles de statut
(`badge-*` : en attente → `attention`, en retard ou erreur → `critical`, neutre → `ground` et
`ink-muted`), entrée de navigation active (`primary-soft` et `primary`), titres. S'ajoutent, pour
les lots 26 à 32 : chiffre clé (`figure` et son libellé), statut « en retard », titre de héros.

## Partie E — Garde-fous testés

- **`DESIGN.md` et le thème disent la même chose** : un test lit l'en-tête de `DESIGN.md`
  (couleurs, tailles, rayons, espacements) et le compare au bloc `@theme`, dans les deux sens.
  Un jeton changé d'un côté seulement fait échouer la CI (ADR 0057 : un écart est un défaut).
- **Aucune valeur hors jeton dans la feuille** : un test refuse, hors du bloc `@theme`, une
  couleur écrite en dur, une taille, un rayon ou une ombre entre crochets, et un pas
  d'espacement hors de l'échelle.
- **Contrastes** : un test calcule le contraste de chaque paire de jetons employée (texte sur
  fond, bord de champ sur fond) et exige 4,5:1 pour le texte et 3:1 pour les bords de
  composants (WCAG 2.2 AA, critères 1.4.3 et 1.4.11).

Contrastes calculés le 11/11/2026 : `ink` sur `surface` 17,8:1 ; `ink-muted` sur `surface`
6,1:1 et sur `ground` 5,7:1 ; `primary` sur `surface` 6,2:1 ; blanc sur `primary` 6,2:1 ;
`primary` sur `primary-soft` 5,3:1 ; `attention` sur `attention-soft` 4,8:1 ; `critical` sur
`critical-soft` 5,6:1 ; texte de nuit 17,1:1. **`line` sur `surface` : 1,3:1**, trop pâle pour
le bord d'un champ (D2).

## Partie F — Captures et vérification

- Les 36 captures du centre d'aide sont régénérées (`pnpm --filter @symbola/app help:captures`)
  et relues une à une.
- Les parcours bout en bout et leurs contrôles axe-core passent sans changement de sélecteur.
- Lint, types, tests, frontières de modules.

## Hors périmètre

- Les PDF : devis et factures suivent l'image de l'organisation (ADR 0046) ; le programme du
  jour J suivra avec les écrans du lot 30.
- Le mode Jour J (lot 30) : ses jetons sont posés, ses écrans viendront.
- Les règles d'écran de `DESIGN.md` (un seul bouton principal par écran, la prochaine action en
  tête, pastille « Partagé ») : appliquées écran par écran par les lots qui les refont (26 à 32).

## Décisions de Julien (11/11/2026 : D1 oui, D2 a)

- **D1 — Télécharger Space Grotesk.** Le fichier de police latin à poids variables (environ
  30 Ko) depuis Google Fonts, et sa licence OFL depuis le dépôt officiel de la police sur GitHub.
  Ils sont versionnés dans le dépôt, comme Inter aujourd'hui ; le navigateur n'appelle jamais
  Google. **Recommandation : oui.**
- **D2 — Trois jetons à ajouter à `DESIGN.md`**, qui ne prévoit pas ces cas :
  - `line-strong` `#838C99` : bord des champs et des boutons secondaires (3,4:1 sur `surface`,
    3,2:1 sur `ground`), exigé par WCAG 2.2 AA ; `line` reste pour les cartes et séparateurs ;
  - `primary-strong` `#0B5A4B` : survol et appui du bouton principal et des liens (8,1:1) ;
  - `elevation` : l'ombre légère des panneaux latéraux et des menus flottants
    (`0 8px 24px rgba(20, 24, 31, 0.12)`), seule ombre permise.

  (a) Les ajouter à `DESIGN.md`. (b) Bords des champs en `ink-muted` (6,1:1, plus sombres),
  survol dérivé de `primary` par le navigateur, ombre sans jeton. **Recommandation : (a).** La
  source reste unique et complète ; l'interface garde son calme.

## Découpage

A, B et C dans un même commit (le thème vidé impose la migration de la feuille), puis D, E et F.
Une pull request.
