# ADR 0030 — Une aide qui forme (visites focus, tutoriels en faisant) et une recherche globale

- Statut : accepté
- Date : 2026-11-04
- Précise : l'aide des lots 1 à 4 (AIDE-01 à AIDE-04) et l'ADR 0029 (suivi par l'Admin)

## Contexte

Retours de la recette (04/11/2026) : l'aide ne formait pas. La visite guidée était une simple
fenêtre dont le bouton « Passer » attirait le clic, la reprise était peu visible, et rien ne
montrait concrètement à quoi servait une notion (un modèle, un échéancier…). Il manquait aussi une
recherche qui fouille toute l'application (« le mariage de Marion et Julien »). Maquettes validées
par Julien et la wedding planner pilote ; spécification : `docs/lots/lot-10-aide-recherche.md`.

## Décision

1. **Visite focus** (`packages/ui/focus-tour.tsx`) : l'élément expliqué est repéré par un attribut
   `data-tour` posé dans la page ; l'écran s'assombrit autour de lui. « Continuer » est le bouton
   principal, « Plus tard » un lien discret qui garde l'étape. Les positions sont posées par le
   CSSOM (`style.setProperty`), jamais par un attribut `style`, pour respecter la CSP sans style en
   ligne. Si l'élément n'est pas affiché (onglet fermé, menu replié en 375 px), la bulle s'affiche
   seule.
2. **Progression par compte** dans `hub.help_progress` (clé `tour:<écran>` ou
   `tutorial:<clé>`, état, étape, contexte), qui remplace `hub.user_tour_seen` (reprise des
   lignes existantes). Table d'identité sans donnée métier ; supprimée avec le compte.
3. **Tutoriels en faisant** (`lib/help/tutorials.ts`) : chaque tutoriel est un script d'étapes.
   « Créer l'exemple » fabrique un exemple fictif marqué démo (événement d'un type varié :
   anniversaire, séminaire, gala, baptême, mariage), à partir des modèles de départ
   (`packages/starter-templates/tutorial-examples.json`) ; l'utilisateur agit dans les **vrais
   écrans** ; « J'ai fait, vérifier » interroge le `service.ts` du module concerné. À la fin,
   l'exemple est supprimé (sauf ce que l'utilisateur garde : un modèle, une prestation) ; un
   tutoriel abandonné laisse un exemple purgé au bout de 24 h, comme l'essai guidé (AIDE-02). Le
   contexte du tutoriel ne garde que des identifiants.
4. **Propositions automatiques** : visite à la première ouverture d'un écran, invitation à un
   tutoriel à la première visite de son écran ; une préférence par navigateur (cookie
   `symbola_visites_auto`, sans donnée personnelle, réglable dans le centre d'aide) les coupe.
   Les parcours e2e la posent par défaut, sauf ceux de l'aide.
5. **Recherche globale** : le hub orchestre la recherche en appelant le `service.ts` de chaque
   module souscrit, chacun dans le contexte RLS de l'organisation ; pas d'index ni de moteur
   externe. Recherche insensible aux accents et à la casse sans extension PostgreSQL
   (`translate()` + `lower()` côté base, repli en JS côté terme, `@symbola/db/search`) ; chaque mot
   doit se trouver. Aide et écrans : articles et tutoriels traduits, selon les modules et le rôle.
   Les recherches ne sont pas journalisées (un mot cherché peut être un nom de client).
6. **Suivi Admin** (HUB-11) : progression de chaque compte d'équipe dans l'aide, dans le cadre de
   l'ADR 0029 (aucune donnée d'événement).

## Conséquences

- Une nouvelle visite = des textes dans « Tour.<clé> », des cibles dans `lib/help/tours.ts` et des
  attributs `data-tour` dans la page ; un nouveau tutoriel = un script, ses textes
  « Tutorials.<clé> » et, s'il lui faut un événement, un exemple dans les modèles de départ.
- La recherche lit les tables à chaque frappe (au plus 6 résultats par groupe) : suffisant pour le
  volume d'une agence ; un index plein texte reste possible plus tard sans changer les écrans.
- L'aide parle d'« événements » et de « clients » : elle n'est pas limitée aux mariages, même si
  le reste de l'interface garde pour l'instant le vocabulaire des mariés.
