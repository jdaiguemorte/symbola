# Lot 74 — Réaliser les volets 5 et 6 des maquettes : « Premiers pas et aide » et « Paramètres »

**Statut** : **spécification à valider par Julien**. Elle change les schémas `hub` et `events`
(migrations 0244 à 0246) et le parcours P0 PAR-01 (le premier quart d'heure, SC-01). Aucun code n'est
écrit avant sa validation. Décisions L74-D1 à L74-D12 (§ 9) : L74-D1 à L74-D6 tranchées le 27/11 ;
les autres restent à trancher.
**Branche de la spécification** : `lot-74-premiers-pas-aide-parametres` (une PR vers `main`, ce
fichier et `docs/QUESTIONS.md` seulement). Chaque paquet aura ensuite sa branche `lot-74<x>-…` et sa PR.
**Date** : 27/11/2026, par Claude Code.

Sources, dans l'ordre où elles font foi :

1. `docs/audits/2026-11-ux-parcours/06-decisions-porte-2.md` (D2, D6, D7 ; C-82 confirmé) ;
2. `docs/audits/2026-11-ux-parcours/11-maquettes-premiers-pas-aide.md` (B1 à B17, **tranchés par
   Julien le 26/11** : « tout en proposition, on garde B1 à B17 ») et son § 4 ;
3. `docs/audits/2026-11-ux-parcours/12-maquettes-parametres.md` (G1 à G16, **retenus par défaut,
   non confirmés un par un**, voir § 0) et son § 4 ;
4. les maquettes `docs/maquette/lot-68/22-premiers-pas-assistant.html` à `28-aide-tutoriels.html`
   (volet 5) et `29-parametres-menu.html` à `33-parametres-bouton-reglages.html` (volet 6) ;
5. `DESIGN.md`, réécrit par la phase 6 du lot 68 (PR #193, ADR 0116) : il porte déjà les formes de
   ces deux volets (visite proposée, panneau d'aide de 420 px, assistant à un seul « Continuer »,
   barre d'enregistrement, section « Réglages » du menu « ⋯ », menu latéral à pied tenu) ; ce lot les
   applique, il ne le réécrit pas. Les points S1 à S15 de la note 13 (porte 4) sont cités ici
   « DS-S1 » à « DS-S15 » pour ne pas les confondre avec les décisions L74-D de ce lot ;
6. `docs/lots/lot-70-taches-et-transverse.md` et `docs/lots/lot-71-reprise-et-import.md` (lu sur
   `origin/lot-71-reprise-et-import`, pas encore dans `main`) pour ce qu'ils laissent à ce lot ;
7. `docs/CAHIER_DES_CHARGES.md` pour les exigences.

Règle de lecture (Julien, 26/11) : les propositions des maquettes récentes priment sur les décisions
antérieures qu'elles contredisent, à condition qu'aucune fonction majeure ne disparaisse ; les
inventaires des § 3 bis des notes 11 et 12 le vérifient, et ce lot les reprend comme critères.

Fichiers sous `apps/symbola/` sauf mention ; `fr` = `packages/i18n/src/messages/fr.json`.

---

## 0. Le statut des choix G1 à G16 (volet 6)

**Ce qui est établi** :

- La note 11 (volet 5) écrit : « Décision de Julien, le 26/11/2026 : « tout en proposition, on garde
  B1 à B17 » » et sa porte 3 dit « Volet validé par Julien le 26/11/2026 ». **B1 à B17 sont
  tranchés.**
- La note 12 (volet 6) écrit au contraire : « Les seize choix ci-dessous sont donc retenus tels que
  proposés, **sauf avis contraire de Julien** » et, à sa porte 3 : « Les seize choix G1 à G16 sont
  retenus par défaut selon la règle du 26/11/2026. Julien peut en renverser un en citant son
  numéro. » Elle ne rapporte aucune parole de Julien sur G1 à G16.
- La PR #191 (volet 6) a été fusionnée le 26/11 **sans aucun commentaire ni revue** ; ses commits ne
  parlent que de « choix G1 à G16 » retenus par défaut. La note 13 (Design System) s'appuie sur eux
  sans dire non plus qu'ils ont été confirmés.

**Conclusion** : G1 à G16 sont retenus **par la règle générale** du 26/11 (« les propositions des
nouvelles maquettes sont retenues par défaut »), pas par une décision de Julien sur chacun. C'est la
**décision L74-D1** (§ 9), posée en premier. **Tranché le 27/11 par Julien : « je confirme S1 tes 16
recommandations »** ; G1 à G16 sont acquis tels que proposés. Dans cette spécification, chaque critère d'acceptation qui
repose sur un choix G est marqué **(G…)** ; si Julien en renverse un, les critères marqués de ce
numéro sont réécrits avant le code, et la maquette corrigée.

---

## 1. Ce qui change pour la planner, en clair

Une fois le lot livré, Camille, qui ouvre son espace pour la première fois, verra :

**Les premiers pas (volet 5)**

- **L'assistant de démarrage s'ouvre tout seul** à sa première connexion, avant tout autre écran ; plus
  de bandeau « Reprendre le questionnaire » avant de l'avoir commencé. S'il est interrompu, l'accueil
  le dit d'une ligne : « Votre espace n'est pas tout à fait prêt · 2 questions sur 5 restent ».
- **Cinq questions au plus, une par écran, un seul bouton « Continuer »** ; « Passer » disparaît.
  Une question nouvelle : « Avez-vous déjà des mariages en cours ? ». La question des outils ne vient
  qu'après « Oui » (« Où les suivez-vous aujourd'hui ? »). La TVA se demande avec les mots des devis
  (« Vos devis portent-ils la TVA ? », avec « Je ne sais pas encore »). Aucune réponse n'est cochée
  d'avance sur un fait (TVA, mariages en cours, outils) ; le métier et les types restent proposés.
  Le nombre de mariages par an quitte l'assistant et devient un champ de la fiche de l'entreprise.
- **« Votre espace est prêt » propose un seul premier pas** selon les réponses : « Créer votre premier
  mariage » (je pars de zéro), « Reprendre un mariage en cours » (un tableur ou un logiciel), « Entrer
  un mariage en cours » (sur papier). Dessous, ce que les réponses ont préparé, chacun avec son lien ;
  « Ouvrir un mariage d'exemple » en second.
- **Le premier mariage ne naît plus en retard.** En le créant « Signé, en préparation », la fenêtre
  annonce « 8 tâches tombent avant aujourd'hui » ; une étape 2 les liste : pour chacune « Déjà fait »
  ou « À faire », rien de coché ; les tâches « à faire » sont réparties sur les semaines qui viennent ;
  une tâche sans réponse est créée « à dater », jamais en retard. Les tâches du modèle données aux
  mariés se lisent « Avec les mariés », et « Attend les mariés » seulement une fois leur espace ouvert.
- **Un écran vide dit ce qui viendra et propose une seule action** ; ni filtres, ni exports, ni
  visite tant qu'il est vide. « Devis et factures » vide commence par « Compléter votre fiche
  entreprise » ; le bandeau de l'accueil sur la fiche disparaît.
- **Un seul mariage d'exemple** (30 jours, supprimable) ; l'« Essai guidé » de 24 heures disparaît
  en tant que tel, son contenu passe dans l'exemple.

**L'aide (volet 5)**

- **Les visites guidées sont proposées, pas imposées** (D2). Seule celle de l'accueil se lance seule,
  une fois, à la fin de l'assistant (trois bulles). Ailleurs, une ligne discrète « Découvrir cet
  écran en 1 minute » sous l'en-tête, aux trois premières venues, jamais sur un écran vide. Chaque
  bulle a une croix « Fermer la visite ». « Tâches » reçoit sa visite.
- **Le « ? » ouvre un panneau rangé à droite**, l'écran resserré à côté, en blocs : la visite, « Sur
  cet écran », les questions fréquentes qui s'ouvrent en place, « Une autre question ? » qui cherche
  dans l'aide sans quitter l'écran, puis les liens. Le « ? » d'une fenêtre répond à ses champs
  (« Qu'est-ce que le SIRET ? ») sans rien faire perdre de la saisie.
- **Le centre d'aide tient en deux écrans** (au lieu de 12 000 px) ; sa recherche comprend une
  phrase (« importer mes contacts »), dit ce qu'elle a compris et donne une meilleure réponse lisible
  sans l'ouvrir. Un seul mot : « article ».
- **Deux parcours de tutoriels** (D6) selon la réponse à « Avez-vous déjà des mariages en cours ? » :
  la reprise d'abord, ou la création d'abord ; les devis ne sont en tête d'aucun. « Pour bien
  démarrer » (accueil, Aide) et ce parcours ne font qu'une liste. Plus de pastille « 0/11 » au menu.

**Les Paramètres (volet 6)**

- **« Paramètres » ouvre une page d'accueil** : huit groupes ouverts, 38 rubriques au lieu de 53
  entrées, chacune avec une phrase qui dit ce qu'elle règle. Plus de groupes à déplier. (G1, G2)
- **Les rubriques jumelles sont fondues ou renommées** : « Budget : postes de départ et
  répartition », « Types d'évènements et termes des clients », « Demandes : étapes et formulaire de
  contact », « Invités : régimes et repas » ; « Messages types : ce que vous envoyez » contre
  « E-mails automatiques : ce que Symbola envoie ». (G3, G4)
- **« Vos données », une page à part** pour ce qui n'est pas un réglage : copie de toutes vos
  données, reprise d'une copie, corbeille, historiques, demandes sur les données personnelles,
  stockage, comptabilité ; « Fermer l'espace » seul, en bas. « Importer » devient « Reprendre et
  importer », hors des Paramètres. (G5, G6)
- **Chaque écran de réglage suit le même patron** (D7) : un en-tête qui dit ce qu'il règle et pour
  qui (« Pour toute l'agence » ou « Pour vous seule ») ; un réglage isolé s'enregistre seul et
  affiche « ✓ Enregistré » à côté de lui ; un formulaire à champs liés (la fiche, les mentions,
  l'adresse d'envoi…) s'enregistre par un bouton dans une barre collée en bas, toujours visible, qui
  dit ce qui a changé. (G8)
- **Le seuil de « Bientôt »** se règle dans « Tâches : catégories et échéances » (sept jours au
  départ, de 1 à 30). **Le radar coupé** dit depuis quand, par qui, et ce que cela change. (G9, G10)
- **Le menu latéral tient dans la fenêtre** à 911 × 512 : les modules, puis « Paramètres » et « Aide »
  tenus en bas ; « Tous les modules » passe dans « Abonnement et modules » et le menu du compte,
  « Tutoriels » dans « Aide ». Sur téléphone et à 150 %, une rubrique s'ouvre seule, son premier
  réglage dans le premier écran. (G11, G12)
- **Une seule recherche** : celle du haut trouve aussi les réglages, par leur nom, leur contenu et des
  synonymes (« copie de mes données », « assurance »). « Chercher un réglage » disparaît. (G13)
- **La roue « Réglages » quitte les en-têtes** : le menu « ⋯ » de l'écran a une section « Réglages »
  dont chaque ligne dit ce qu'elle règle et pour qui (« Postes de départ de vos futurs mariages… · Ne
  change pas les postes de « Léa & Maxime » ») ; le panneau ouvert dit « Pour cet écran ». (G14)

Ce qui **ne change pas** : l'assistant « L'essentiel » (six étapes, « Finir plus tard ») ; le déroulé
d'un tutoriel et son panneau latéral ; le contenu de chaque réglage (aucun réglage ne disparaît, § 3
bis de la note 12) ; le menu du rôle Comptable ; l'écran d'Exploitation « Prise en main ».

---

## 2. Exigences et constats traités

| Élément des maquettes | Exigences du cahier des charges | Constats et décisions |
| --- | --- | --- |
| Assistant d'abord, cinq questions, « Continuer » seul (page 22) | HUB-09 (questionnaire qui configure l'espace), UX-02, UX-04, UX-10, UX-14 | C-68 ; D6 ; B1 à B5 |
| Fin de l'assistant selon la réponse (page 22) | HUB-09, HUB-10, PAR-01, UX-01 | C-68, C-67 ; D6, D8 ; R3, I5 (lot 71) ; B6, B13 |
| Premier mariage à l'heure (page 23) | EVT-01, EVT-05, CHR-01, CHR-02, DAT-07, UX-06 | C-67 ; D8 ; M12, M13 ; B7, B8 ; A11 (lot 70), I3 (lot 71) |
| État vide type (page 24) | UX-08, UX-12, ARC-07 | C-69, C-15 ; P-05 ; B9 |
| Mariage d'exemple unique | HUB-10, ARC-13, DAT-10 | C-10 ; B13 |
| Visites proposées (page 25) | HUB-11 (visite de trois à cinq étapes, rejouable, relancée depuis le menu d'aide) | C-01, C-02, C-06 ; D2 ; B10, B11, B12, B17 |
| Aide de l'écran (page 26) | HUB-11, UX-08 (aide de trente secondes), UX-14, NFR-19 | C-05, C-06, C-82 (panneau) ; B14 |
| Centre d'aide (page 27) | HUB-11, HUB-12, UX-10 | C-07, C-10 ; P-15 ; B16 |
| Tutoriels et « Pour bien démarrer » (page 28) | HUB-11 (liste de prise en main) | C-70, C-10 ; D6 ; B15 |
| Accueil des Paramètres, groupes, jumelles (page 29) | UX-12, UX-13, ARC-06, ARC-07, HUB-06 | C-71, C-72 ; P-22 ; G1 à G4, G16 |
| « Vos données », « Reprendre et importer » (page 29) | HUB-13, HUB-14, HUB-16, HUB-17, RGP-11 | C-73, C-59 ; G5, G6 ; I6 (lot 71) |
| Patron d'un écran de réglage (page 30) | UX-09 (rien ne se perd), UX-13, UX-07, HUB-20 à HUB-24 | C-75, C-76 ; D7 ; G8, G15 |
| Seuil de « Bientôt » (page 30) | UX-06, CHR-05 | M10 ; G9 |
| Radar coupé (page 30) | GC-02 (radar), HUB-15 | A6 (lot 72, volet 3) ; G10 |
| Téléphone et 150 % (page 31) | UX-05, NFR-19 (zoom 200 % sans perte), SC-10 (joué à 150 %) | C-79, C-82 ; D4 ; G11, G12 |
| Recherche des réglages (page 32) | HUB-12 (moins de 500 ms, limitée aux droits) | C-74 ; M9 (second temps) ; G13 |
| Section « Réglages » du menu « ⋯ » (page 33) | UX-13, ARC-07 | C-11 ; P-12, P-22 ; G14 |

Constats du volet 6 laissés aux corrections simples (note 12, § 6) et repris ici seulement comme
contrôle, puisque ce lot repasse sur tous les écrans de réglage : C-76 (« {{terme_clients}} »,
« Devis signéImmédiat », « PUSH », « ZIP », « JSON ») et le chevauchement « Monter » / « Descendre »
de « Catégories des tâches » à 1 440 px.

---

## 3. L'app d'aujourd'hui, en bref

Relevé dans le code de `main` (2342f79e), sans lancer l'app.

**Premiers pas.**

- Un compte neuf arrive sur `/demarrage` (`app/auth/callback/route.ts:36`), un compte existant sur
  `/` ; une organisation créée en plus va aussi sur `/demarrage` (`app/organisation-actions.ts:44`).
  Le middleware ne force rien : la titulaire qui quitte l'assistant trouve l'accueil et ses deux
  bandeaux (`app/page.tsx:83, 87, 132-141`).
- Cinq questions (`app/demarrage/question-forms.tsx:30-85`), valeurs proposées dans
  `packages/starter-templates/src/onboarding.json` (`wedding_planner`, `franchise`, `11_to_25`, aucun
  outil) ; « Passer » (`intent=skip`) garde la valeur proposée (`actions.ts:82-121`).
- Réponses dans `hub.organization_profiles` (`packages/db/src/schema/hub.ts:329-356`) : `metier`,
  `metier_precision`, `vat_regime`, `annual_event_volume` (lu nulle part), `replaced_tools` (ne sert
  qu'à ordonner une liste dont les règles sont vides, `lib/onboarding/checklist.ts:42`), `setup_step`,
  `setup_completed_at`. La TVA datée va dans `hub.vat_regime_changes`.
- `/demarrage/pret` : récapitulatif et `FirstEventForm` (évènement toujours confirmé, case du
  rétroplanning cochée, première source de la liste) ; `exploreExampleAction`. Le lot 71b (I5) y pose
  déjà R3 (bouton principal selon les outils).
- `events.event_tasks.due_date` est **obligatoire** (`schema/events.ts:513`) : une tâche « à dater »
  n'existe pas aujourd'hui. Le lot 71a ajoute `done_date_known` (0220).
- Trois évènements fictifs : essai guidé 24 h (`demo-event.json`, `startEventsTrial`,
  `modules/events/service.ts:3323`), exemple 30 jours (`example-event.json`, `startExampleEvent`,
  `:3357`), évènement de tutoriel 24 h (`tutorial-examples.json`, `:3385`) ; un seul actif à la fois ;
  purge horaire (`lib/demo-purge.ts`).
- « Pour bien démarrer » : deux éléments (`lib/onboarding/checklist.ts`), disparaît une fois fini.

**Aide.**

- Six visites (`packages/starter-templates/src/tours.json` : accueil 4 bulles, liste 5, fiche 5,
  carnet 4, catalogue 3, paramètres du budget 3), automatiques à la première venue si le cookie
  `symbola_visites_auto` ne dit pas « 0 » (`lib/help/page-tour.ts`, `lib/help/preferences.ts`) ;
  « vue » gardée par personne dans `hub.help_progress` (clé `tour:<clé>`, `status`, `step`,
  `context jsonb`). Bulle : `packages/ui/src/guided-tour.tsx` (Précédent, Suivant, Terminer, Passer).
  `markTourSeen`, `hasSeenTour` et `markTourSeenAction` ne sont appelés nulle part.
- `app/help-bar.tsx` : la carte « Découvrir en N minutes » et la pastille « Reprendre ».
- « ? » : `app/help-button.tsx`, `app/screen-help.tsx` (155 fichiers l'emploient),
  `packages/ui/src/help-drawer.tsx` (titre, paragraphe, « Revoir la visite », bloc propre). Largeur
  380 px (`--spacing-help-panel`, `globals.css:96`) ; **sous 1 024 px, une feuille en bas de 60 % de
  la hauteur** (`globals.css:1923-1931`), d'où les 169 px mesurés à 911 × 512.
- 125 fiches d'écran (`lib/help/screens.ts`), dont 40 avec capture et 40 avec des questions
  fréquentes (`Help.<clé>.faq`) ; 85 sans.
- Centre d'aide (`app/aide/page.tsx`, `aide-search.tsx`) : recherche côté client par sous-chaîne sans
  accents (`foldSearchText`, `packages/db/src/search.ts:9`) ; vignettes par rubrique.
- Tutoriels : 11 (`lib/help/catalog.ts`), parcours `JOURNEY` en six étapes, l'import en dernier
  (`lib/help/journey.ts`) ; pastille « n/11 » (`app/app-shell.tsx:609-626`).
- Captures : 40 images dans `public/aide/captures/`, par `pnpm --filter @symbola/app help:captures`
  (`captures/help.captures.ts`).

**Paramètres.**

- `app/settings-menu.ts` : 53 rubriques en cinq groupes (Mon entreprise 12, Événements 18,
  Rendez-vous 2, Ventes 10, Prestataires et données 11), filtrées par modules et par rôle ;
  `SETTINGS_MENU_HREFS` ; `isSettingsPath` dans `app/settings-paths.ts:19-22`.
- `app/settings-nav.tsx` : groupes repliables, « Chercher un réglage » qui ne compare que les
  libellés (`settings-search.ts:32`).
- 53 écrans et 12 sous-écrans ; **presque tous s'enregistrent par un formulaire classique**, souvent
  plusieurs par écran ; `AutosaveList` sur sept listes ; `AutoSaveForm` sur **aucun** écran de
  réglage ; `DraftKeeper` sur les messages types seulement. Inventaire complet au § 6.3.
- Rôles : `requireOwner` (`lib/guards.ts:69`) masque l'écran pour l'équipe sur dix rubriques ; quatre
  autres restent lisibles par l'équipe, contrôles désactivés ; chaque action refait le contrôle
  `role === "owner"` côté serveur.
- `hub.automations` (`hub.ts:1584-1607`) n'a ni date ni auteur de coupure (`resumed_at` seulement).
- `events.planning_health_settings.soon_days` existe (0214, lot 70a) ; `setTaskSoonDays`
  (`modules/events/planning.ts:174`) n'est appelé par aucun écran.
- Menu latéral : « Apps » (titulaire), « Paramètres » et la pastille RGPD, « Tutoriels » et sa
  pastille, « Aide » (`app-shell.tsx:583-630`) ; aucune règle `@media (max-height: …)` dans
  `globals.css`.
- Recherche du haut (`lib/search/run-search.ts`) : 23 écrans indexés (`lib/search/screens.ts`), dont
  une quinzaine de réglages, par leur nom ; **les 53 rubriques ne sont pas indexées**.
- `SettingsLink` (la roue) : neuf usages ; `app/reglages/panels.ts` : cinq clés de panneau.

---

## 4. Ce qui touche les données, les contrats et les événements

Chaque migration a son retour arrière dans `packages/db/drizzle-rollback/` (ADR 0036) et ne touche que
le schéma de son module (DAT-09). Dernière migration de `main` : **0217** ; le lot 71 réserve 0218 à
0223, le lot 72 0224 à 0233, le lot 73 0234 à 0243. **Ce lot prend 0244 à 0246** ; numéros à
reprendre au moment du code. La validation de cette spécification vaut accord pour toucher les
schémas `hub` et `events` (règle du § 8 de `CLAUDE.md`).

### 4.1 Migrations

| N° | Fichier | Ce qu'elle fait | Pourquoi |
| --- | --- | --- | --- |
| 0244 | `0244_lot74a_hub_onboarding_answers.sql` | `hub.organization_profiles` : ajoute `has_ongoing_events text` nullable (`yes`, `no`) et `vat_answer_pending boolean not null default false`. Aucune valeur par défaut sur les réponses de fait. **Étape de données** : aucune (les espaces déjà préparés gardent leurs réponses ; `has_ongoing_events` nul y vaut « parcours non choisi », voir L74-D8) | B3 (la question nouvelle choisit la fin de l'assistant et le parcours de D6) ; B5 (« Je ne sais pas encore » garde la franchise en base, comme aujourd'hui, et pose un drapeau relu par l'étape « Devis et factures » et par « L'essentiel ») |
| 0245 | `0245_lot74b_events_task_due_date_known.sql` | `events.event_tasks.due_date_known boolean not null default true`. Une tâche « à dater » garde une date technique (la date de l'évènement) pour ne casser ni les tris, ni la contrainte `NOT NULL`, ni les lectures existantes ; la marque dit qu'elle n'est pas une échéance | B7 : « une tâche sans réponse est créée « à dater », comptée à part et jamais en retard ». Même choix que `done_date_known` du lot 71a (0220) ; l'autre voie (rendre `due_date` nullable) est écartée (L74-D3, tranchée le 27/11) |
| 0246 | `0246_lot74h_hub_automations_paused.sql` | `hub.automations` : ajoute `paused_at timestamptz` et `paused_by uuid` (nullables ; les deux nuls quand l'automatisme est en marche). **Étape de données** : aucune ; aucune donnée réelle n'existe encore (L74-D6, tranchée) | G10 et A6 : « Coupé depuis le 12 novembre par Camille · aucune alerte n'arrive dans « À traiter en premier » » |

**Pas de migration** pour :

- **le seuil de « Bientôt »** : la colonne existe (0214) ; ce lot fait l'écran ;
- **la ligne « Découvrir cet écran »** : le nombre de venues et la fermeture de la ligne se gardent
  dans `hub.help_progress` (clé `tour:<clé>`, `status = 'postponed'`, `context` = `{ "offers": n,
  "closedAt": … }`), table déjà déclarée par personne. À vérifier au code qu'aucune contrainte de la
  base ne s'y oppose ; sinon, arrêt et question (une migration 0247 de `hub` serait alors nécessaire) ;
- **le volume annuel** : la colonne `annual_event_volume` reste, montrée dans la fiche (G15) ;
- **les fusions de rubriques** et le nouveau menu : aucun changement de données, seulement des
  écrans et des redirections ;
- **les synonymes** (centre d'aide et réglages) : des fichiers de données traduisibles dans
  `packages/starter-templates/src/` (`help-synonyms.json`, `settings-synonyms.json`), au format de
  `import-synonyms.json` ; ni base, ni service extérieur ;
- **le mariage d'exemple unique** : `is_demo` et `demo_expires_at` suffisent ; `demo-event.json`
  et `example-event.json` se fondent en un fichier.

### 4.2 Contrats (`packages/contracts`)

Changements **compatibles** (ajouts) :

- le profil de l'organisation (`service-contract` du hub) gagne `hasOngoingEvents`
  (`"yes" | "no" | null`) et `vatAnswerPending` ;
- le type d'une tâche gagne `dueDateKnown` ; l'état d'échéance calculé (`dueState`, lot 70a) gagne
  `undated`, jamais en retard ; les filtres « En retard » et les compteurs l'écartent ;
- la création d'un évènement avec modèle (`events` service) accepte, pour les tâches dont l'échéance
  tombe avant aujourd'hui, une réponse par tâche (`done`, `todo`, `undated`) et une période de
  répartition (2, 4 ou 8 semaines) ;
- un automatisme gagne `pausedAt` et `pausedBy`.

Rien d'incompatible. **Aucun nouvel événement `domain_events`** : les réponses de l'assistant, la
coupure d'un automatisme et les réglages s'écrivent dans leur module ; le journal d'activité garde ce
qu'il garde aujourd'hui (HUB-16).

### 4.3 Droits et isolation (SEC-10 à SEC-13)

- **Chaque écran de réglage refait le contrôle côté serveur**, comme aujourd'hui : la nouvelle forme
  (« ✓ Enregistré », barre d'enregistrement) change l'écran, jamais le contrôle. Un réglage
  « titulaire » reste lisible par l'équipe et le dit dans la portée de l'en-tête ; son action refuse
  un membre par la même erreur qu'un objet inexistant.
- **Les rubriques fondues gardent les droits de chaque bloc** : dans « Budget : postes de départ et
  répartition », modifier une ligne de départ reste réservé à la titulaire (aujourd'hui
  `events/parametres`, `sortable-budget-lines.tsx:136`), la répartition non ; dans « Demandes :
  étapes et formulaire de contact », les deux blocs restent à la titulaire.
- **La recherche des réglages** ne rend que ce que la personne peut ouvrir : une rubrique d'un module
  non souscrit n'est jamais rendue ; une rubrique « titulaire » est rendue à l'équipe avec la
  mention « titulaire » (elle est lisible) ; le Comptable ne reçoit aucun réglage, seulement ses
  écrans (HUB-12).
- **Le panneau « Réglages » d'un écran** ne s'ouvre que par une clé d'écran connue
  (`SETTINGS_PANELS`) ; « Voir dans les Paramètres » passe le retour par une clé (`SETTINGS_BACK_KEYS`),
  jamais un nom ni une adresse libre (pas de redirection ouverte).
- **L'assistant de démarrage** reste réservé à la titulaire (`app/demarrage/page.tsx:24-31`) ; la
  redirection de première connexion ne vaut que pour elle.
- **La recherche du centre d'aide** ne garde ni ne journalise le texte tapé (SEC-20) ; elle tourne
  sur les textes de l'aide, filtrés par modules et rôle comme aujourd'hui (`screensFor`).
- L'Admin d'exploitation n'a accès à aucune de ces données (SEC-09) ; « Prise en main » ne change pas.

### 4.4 Registre RGPD (`privacy.registry.yaml`)

| Table | Champ | Catégorie | Règle |
| --- | --- | --- | --- |
| `hub.organization_profiles` | `has_ongoing_events`, `vat_answer_pending` | technique, sans personne | Réponses de l'organisation ; exportées avec le profil (HUB-13), reprises par une copie Symbola |
| `hub.automations` | `paused_by` | identifiant | Membre qui a coupé l'automatisme, jamais son nom ; l'identifiant d'un accès retiré ne désigne plus personne ; effacé avec l'organisation |
| `hub.help_progress` | `context` (venues de la ligne « Découvrir ») | technique, par personne | Déjà déclarée par personne ; aucune valeur saisie ; effacée avec le compte |
| `events.event_tasks` | `due_date_known` | technique | — |

Le contrat `privacy/v1` du hub et d'`events` couvre ces colonnes ; aucune catégorie nouvelle à porter
à la fiche du DPO.

---

## 5. Le découpage en paquets

Douze paquets, les deux volets dans des paquets distincts (74a à 74f pour « Premiers pas et aide »,
74g à 74l pour « Paramètres »). Chacun laisse l'app cohérente, a sa PR, ses tests et son rejeu ciblé.

| Paquet | Contenu | Dépend de | Migrations |
| --- | --- | --- | --- |
| **74a** L'assistant et sa fin | Assistant d'abord, cinq questions, « Continuer » seul, question des mariages en cours, TVA en mots des devis ; « Votre espace est prêt » à trois issues ; ligne de l'accueil « Votre espace n'est pas tout à fait prêt » | **71b** fusionné (fin de l'assistant, R3, I5 : mêmes fichiers `app/demarrage/pret/*`) | 0244 |
| **74b** Le premier mariage, à l'heure | Rétroplanning annoncé dans « Nouvel évènement », étape 2 des échéances passées, « à dater », « Avec les mariés » | **70e** fusionné (fenêtre « Nouvel évènement ») ; **71a** (`done_date_known`) et **71c** (composant des échéances passées, I3) fusionnés ; 74a | 0245 |
| **74c** États vides et mariage d'exemple | Gabarit généralisé, trois textes vides, commandes de l'en-tête au menu « ⋯ », « Compléter votre fiche entreprise » dans « Devis et factures », un seul mariage d'exemple | **70d** (état vide de « Tâches ») ; les paquets des lots 72 et 73 qui refont la liste des évènements et le carnet (L74-D10) | — |
| **74d** Les visites proposées | Accueil automatique une fois, ligne « Découvrir cet écran », bulles à trois ou quatre, croix, visite de « Tâches », « Revoir la visite » en tête du « ? » | 74a (la visite attend la fin de l'assistant) ; **70c** et **70d** (cibles de la visite de « Tâches ») | — |
| **74e** L'aide de l'écran | Panneau de 420 px rangé à droite, posé par-dessus sous 1 100 px, plein écran sur téléphone ; blocs ; questions fréquentes ; « Une autre question ? » ; aide des fenêtres | 74f pour la recherche intégrée (ou une recherche simple d'abord, voir § 6.5) | — |
| **74f** Centre d'aide et tutoriels | Recherche par phrase et synonymes, meilleure réponse ; sujets ; deux parcours (D6) ; « Pour bien démarrer » fondu ; pastille retirée ; « Tutoriels » sous « Aide » | 74a (la réponse qui choisit le parcours) | — |
| **74g** Le menu des Paramètres et le menu latéral | Accueil des Paramètres, huit groupes, 38 rubriques, menu du groupe, rubrique seule sur téléphone et sous 1 100 px, « Vos données », redirections, menu latéral à pied tenu, menu du compte | **70e** et **70f** fusionnés (barre du haut, menu du compte, « Plus ») | — |
| **74h** Le patron et la première vague | Composants du patron (en-tête, « ✓ Enregistré », barre d'enregistrement) ; groupes « Votre entreprise » et « Vous » ; seuil de « Bientôt » ; automatismes et radar | 74g ; **70b** (fusionné : message de retour, erreur sous le champ) | 0246 |
| **74i** Deuxième vague | Groupes « Évènements », « Tâches, programme et jour J », « Budget et prestataires », dont les quatre fusions | 74h | — |
| **74j** Troisième vague | Groupes « Devis et factures », « Messages et automatismes » (hors automatismes, faits en 74h), « Rendez-vous » ; sous-écrans | 74h (peut avancer en parallèle de 74i : autres fichiers) | — |
| **74k** La recherche des réglages | Index des rubriques, contenu et synonymes dans la recherche du haut ; ouverture à la ligne trouvée | **70e** fusionné (recherche typée, premier temps) ; 74g (noms des rubriques) | — |
| **74l** Le bouton « Réglages » des écrans | Section « Réglages » du menu « ⋯ », panneau « Pour cet écran », portée, retour | 74g ; le menu « ⋯ » de chaque écran (volets 3 et 4 : lots 72 et 73, voir L74-D10) | — |

**Conduite proposée** (règle « aller plus vite ») : 74g dès que 70e et 70f sont fusionnés, puis 74h,
puis 74i et 74j en parallèle, 74k et 74l à la suite ; en même temps, côté aide, 74f et 74e (qui ne
dépendent d'aucun paquet non fusionné, sauf la réponse de 74a pour le parcours), puis 74a dès que
71b est fusionné, 74d, 74b, 74c. Un seul paquet à la fois touche `app/app-shell.tsx` et
`app/globals.css` (74g, puis 74e).

### 5.1 Ce qui dépend des paquets des lots 70 et 71 pas encore fusionnés

État au 27/11 : dans `main`, 70a (#190) et 70b (#189) ; le lot 71 n'a que sa spécification (branche
`lot-71-reprise-et-import`, pas encore fusionnée) ; 70c est en cours ; **70e est codé dans une
branche locale non poussée** (note du dossier partagé, `lot-70e-etat.md`).

| Paquet d'un autre lot | Ce que ce lot en attend | Fichiers partagés |
| --- | --- | --- |
| 70c Ligne type et panneau | Les cibles de la visite de « Tâches » (74d) ; « Avec les mariés » sur la ligne (74b) | `lib/help/tours.ts`, `tours.json` (70c met à jour les étapes ; 74d les réécrit) |
| 70d Écran « Tâches » | L'état vide de « Tâches » au gabarit (74c) ; la sortie de la roue de « Tâches » (déjà prévue au 70) | `app/taches/page.tsx` |
| 70e Barre du haut et « + Créer » | La fenêtre « Nouvel évènement » (74b) ; la recherche typée (74k) ; le menu du compte (74g : « Vos données », « Tous les modules ») ; « Tous les modules » au menu latéral, que 74g retire (G11) | `app/app-shell.tsx`, `app-sidebar.tsx`, `globals.css` (`@media (max-height: 640px)` posé par 70e pour le menu latéral), `lib/search/run-search.ts`, `app/search-box.tsx`, `app/events/new-event-menu.tsx`, `new/*` |
| 70f Le téléphone | « Plus › Paramètres » (74g) ; la barre du bas sous la barre d'enregistrement (74h) | `app/app-sidebar.tsx`, `globals.css` |
| 70g Lexique | Le contrôle en cliquet : ce lot retire les exceptions « Réglages », « vos modules », « JSON », « ZIP », « PUSH », « Apps » restants, « fiche » pour un article d'aide, « Essai guidé » | `packages/i18n/src/lexique.test.ts`, `lexique-exceptions.json`, `fr.json` |
| 71a Socle de la reprise | `done_date_known` pour « Déjà fait » sans date de fin (74b) | `modules/events/*` |
| 71b Page de reprise et ses portes | La fin de l'assistant (R3, I5) que 74a complète ; « Reprendre et importer » (I6) que 74g sort des Paramètres | `app/demarrage/pret/page.tsx`, `pret/actions.ts`, `app/settings-menu.ts`, `app/import/page.tsx` |
| 71c L'assistant qui demande | Le composant « échéances déjà passées » (I3) que 74b reprend ou complète (L74-D2) | `modules/events/template-rules.ts`, composant de la question |
| 71f Fiche d'un mariage repris | Le tutoriel « Compléter un mariage repris » (74f, L74-D8) joue sur une fiche reprise | — |

### 5.2 Ce qui dépend des lots 72 et 73 (spécifications en cours)

- **Le menu « ⋯ » des écrans** (volets 3 et 4) porte la section « Réglages » de 74l ; tant qu'un écran
  n'a pas son menu, sa roue reste (L74-D10).
- **L'accueil refait** (volet 3, page 13) porte la ligne « Votre espace n'est pas tout à fait prêt »
  (74a) et la ligne « Pour bien démarrer » du parcours (74f) ; sans lui, elles se posent sur l'accueil
  actuel.
- **La liste des évènements et le carnet refaits** portent leurs états vides (74c) ; ce lot fournit le
  gabarit et les textes, les lots 72 et 73 les posent s'ils passent avant.
- **Le radar coupé sur l'accueil** (A6, volet 3) et sa rubrique (G10, 74h) disent la même chose avec
  les mêmes mots.

---

## 6. Les paquets en détail

Pour chaque paquet : l'écart entre l'app et la maquette, fichier par fichier ; les critères
d'acceptation (chacun devient un `it`) ; les tests. Les `describe` portent l'identifiant de
l'exigence (`describe('HUB-09 — Questionnaire d'accueil : la question des mariages en cours', …)`).

### 6.1 Paquet 74a — L'assistant et sa fin (page 22)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/auth/callback/route.ts:36`, `middleware.ts`, `app/page.tsx:83, 132-136` | Compte neuf vers `/demarrage` ; ensuite rien ne le ramène ; bandeau « Terminez la préparation… Reprendre le questionnaire » sur l'accueil, même avant de commencer | Tant que `setup_completed_at` est nul, la **titulaire** qui ouvre l'accueil est menée à la question où elle s'est arrêtée, une fois par session ; si elle revient à l'accueil depuis l'assistant, une ligne : « Votre espace n'est pas tout à fait prêt · {n} questions sur 5 restent, environ 1 minute · Continuer les questions ». Le bandeau disparaît. Une collègue voit le message actuel (« La titulaire prépare votre espace ») |
| `packages/starter-templates/src/onboarding.json` | Valeurs proposées : `franchise`, `11_to_25` | Métier et types gardés ; plus aucune valeur pour la TVA, le volume, les mariages en cours, les outils |
| `app/demarrage/question-forms.tsx`, `page.tsx`, `actions.ts` | Cinq questions dont TVA et volume ; « Continuer » et « Passer » | Q1 métier (inchangée) ; Q2 types (inchangée) ; **Q3 « Avez-vous déjà des mariages en cours ? »** (« Oui », « Non, je pars de zéro ») ; Q4 « Où les suivez-vous aujourd'hui ? » (les cinq cases, la même colonne `replaced_tools`), **seulement après « Oui »** ; Q5 « Vos devis portent-ils la TVA ? » (« Non », « Oui », « Je ne sais pas encore ») ; le volume sort. « Question n sur 5 » (ou « sur 4 » après « Non ») et sa barre ; « Question précédente » ; un seul « Continuer », collé en bas sur téléphone et sous 640 px de haut ; sans réponse, « Choisissez une réponse » sous la question (forme du lot 70b) |
| `app/demarrage/actions.ts:104` (`changeVatRegime`) | `franchise` ou `assujetti` daté | « Non » → franchise ; « Oui » → assujetti ; « Je ne sais pas encore » → franchise, `vat_answer_pending = true` (tranché L74-D4 : aucun devis envoyé tant qu'elle n'a pas choisi) |
| `app/demarrage/pret/page.tsx`, `first-event-form.tsx`, `pret/actions.ts` | Récapitulatif ; formulaire « Créer mon premier évènement » ; « Explorer avec un exemple » ; après 71b : R3 | **Un seul bouton plein** selon Q3 et Q4 : « Non » → « Créer votre premier mariage » (ouvre « Nouvel évènement », 74b) ; « Oui » + tableur ou logiciel → « Reprendre un mariage en cours » (page de reprise, 71b) ; « Oui » + papier, traitement de texte ou agenda seulement → « Entrer un mariage en cours » (« Nouvel évènement » réglé sur « Signé, en préparation »). Dessous, « Préparé pour vous » : chaque réponse et ce qu'elle a fait, avec son lien (« Voir les tâches », « Voir les postes », « Voir les types ») ; « Ouvrir un mariage d'exemple » (ou « Revoir l'exemple ») en second ; « Modifier mes réponses » ; « Voir l'accueil ». `first-event-form.tsx` est retiré |
| Sans le module Évènements | « … liste de prise en main de l'accueil », « Aller à l'accueil » | Gardé |

**Critères d'acceptation**

1. À la première connexion, la titulaire voit la question 1 avant tout autre écran ; aucune visite
   ne s'ouvre avant la fin de l'assistant.
2. Une titulaire qui quitte l'assistant à la question 3 voit sur l'accueil la ligne « 2 questions sur
   5 restent » ; « Continuer les questions » l'y ramène ; aucun bandeau « Reprendre le
   questionnaire » n'existe avant la première réponse.
3. Aucune réponse n'est cochée aux questions 3, 4 et 5 ; le métier et les types sont proposés.
4. « Continuer » sans réponse écrit « Choisissez une réponse » sous la question et ne passe pas ;
   aucun bouton « Passer ».
5. La question 4 n'est posée qu'après « Oui » ; « Non » mène à la question de la TVA, comptée « 4 sur 4 ».
6. Le volume annuel n'est jamais demandé ; sa valeur existante reste et se lit dans la fiche (74h).
7. Les trois issues de la fin suivent la table ci-dessus ; une seule a un bouton plein.
8. « Préparé pour vous » liste chaque effet avec un lien qui ouvre le bon écran.
9. « Je ne sais pas encore » pose la franchise et le drapeau ; l'étape « Devis et factures » du
   parcours et « L'essentiel » redemandent la TVA tant que le drapeau est posé.
   Tant que le drapeau est posé, **aucun devis ne s'envoie** (L74-D4) : le brouillon se crée et
   s'enregistre ; « Envoyer » ouvre la question de la TVA (« Non » ou « Oui », sans « Je ne sais pas
   encore ») et l'envoi reprend une fois la réponse donnée. Le contrôle est côté serveur, à côté de
   celui des mentions (`modules/quotes/service.ts:1470, 1498`), par le `service.ts` du hub.
10. Une collègue (rôle membre) n'est jamais menée à l'assistant.

**Tests** : Vitest (enchaînement des questions selon les réponses ; issues de la fin ; aucune valeur
par défaut de fait) ; intégration (réponses en base, drapeau de TVA, envoi d'un devis refusé tant que le drapeau est posé, accepté après la réponse, `replaced_tools` après « Oui »
seulement) ; Playwright `lot-74a-assistant.spec.ts` à 1 440, 375 et 911 × 512 (« Continuer » dans la
fenêtre), axe-core à chaque question ; mis à jour : `hub-09-10-demarrage`, `onb-01-02-onboarding`,
`lot-12-demarrage`, `sc-01-sc-10-demarrage` (SC-01 chronométré, moins de dix minutes) ; abus : une
collègue qui poste une réponse à la main est refusée ; une titulaire de A ne modifie pas le profil de B.

### 6.2 Paquet 74b — Le premier mariage, à l'heure (page 23)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| Fenêtre « Nouvel évènement » (70e : `app/events/new-event-menu.tsx`, `new/*`) | « Où en est-il ? », nom, date, client, type ; le rétroplanning s'applique selon le statut | Pour « Signé, en préparation » avec une date : une ligne « Avec le rétroplanning « Mariage » · 18 tâches, dont 8 tombent avant aujourd'hui · Changer » (autre modèle ou aucun ; « Voir les tâches » dans « Changer »). « Créer » mène à l'étape 2 s'il y a des échéances passées, sinon crée |
| Étape 2 (nouvelle, dans la même fenêtre) | — | « 8 tâches tombent avant aujourd'hui » ; chaque tâche avec sa date prévue et deux bascules « Déjà fait » / « À faire » (encre, M8), rien de coché ; « Tout est déjà fait », « Tout reste à faire » ; « Répartir les tâches à faire : d'ici 2 semaines / 4 semaines / 8 semaines / Laisser à dater » (4 semaines proposé, voir L74-D2) ; « Une tâche sans réponse sera créée à dater » ; « Créer l'évènement » |
| `modules/events/template-rules.ts`, `service.ts` (application d'un modèle) | Échéance = date de l'évènement + décalage, même passée | Pour chaque tâche dont l'échéance tombe avant aujourd'hui (`Europe/Paris`) : « Déjà fait » → faite, `done_date_known = false` (71a) ; « À faire » → date redistribuée sur la période, jours ouvrés, dans l'ordre du modèle, jamais après la tâche suivante du modèle ; sans réponse → `due_date_known = false` (0245). La tâche garde sa date relative pour la suite (DAT-07), sauf si elle est redatée à la main |
| États d'échéance (lot 70a, `due-state.ts`) | `late`, `today`, `tomorrow`, `soon`, `later` | Plus `undated` : « À dater », neutre, jamais en retard, comptée à part (« 3 à dater »), hors filtre « En retard », hors radar et hors santé du planning |
| Tâches des mariés (`Today.words.clientTask`, état « Attend le client ») | « Tâche confiée au client » dès la création, « Attend le client » | « Avec les mariés » tant que l'espace des mariés n'est pas ouvert (aucun lien des mariés actif, `events.event_links` audience clients) ; « Attend les mariés » ensuite |
| Statut, source (`lifecycle.ts`, ancien `first-event-form`) | Confirmé d'office ; première source de la liste | Le statut suit « Où en est-il ? » (A10) ; « Venu par » reste « non renseigné » |
| « Une demande en cours » | — | Ni rétroplanning ni étape 2 ; la suite dit « Envoyer le devis » ; à la signature, le rétroplanning se pose avec la même étape 2 |
| Proposition de supprimer l'exemple au premier vrai mariage | Gardée | Gardée |

**Critères d'acceptation**

1. Créé le 25/11/2026 pour le 12/06/2027, un mariage « Signé, en préparation » avec le rétroplanning
   de départ annonce 8 tâches avant aujourd'hui et ouvre l'étape 2 ; aucune n'est cochée.
2. Aucune tâche n'est en retard dix secondes après la création, quelle que soit la réponse.
3. « Déjà fait » donne une tâche faite, « date de fin non renseignée ».
4. « À faire » sur « 4 semaines » donne des dates entre demain et J+28, en jours ouvrés, dans l'ordre
   du modèle, aucune après la tâche suivante.
5. Une tâche sans réponse est « À dater », comptée à part, absente du filtre « En retard », du
   radar et de la santé du planning.
6. Une tâche « À dater » redatée à la main devient une tâche ordinaire.
7. Les tâches des mariés se lisent « Avec les mariés » jusqu'à la création d'un lien des mariés.
8. « Une demande en cours » ne crée ni tâche ni étape 2.

**Tests** : Vitest avec **horloge simulée** (veille et jour même : une tâche due aujourd'hui n'est
pas « passée » ; répartition qui franchit un week-end, un jour férié non compté, le passage à l'heure
d'été du 28/03/2027) ; intégration (création avec chaque réponse ; « à dater » hors des compteurs) ;
Playwright `lot-74b-premier-mariage.spec.ts` à 1 440 et 375 px, axe-core sur les deux étapes ; mis à
jour : SC-01 ; abus : une réponse portant l'identifiant d'une tâche de B est refusée.

### 6.3 Paquet 74c — États vides et mariage d'exemple (page 24)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/ui/empty-state.tsx` (12 clés), `EmptyStates.*` | Titre, texte, exemple, action secondaire à côté d'un bouton plein, « Lire l'aide » | Gabarit : titre qui dit ce qui viendra ; une phrase et un exemple ; **la seule action principale** ; l'autre voie (la reprise) en ligne à part ; l'aide (mariage d'exemple, aide de l'écran). Trois variantes de texte par écran : `empty` (rien encore), `filtered` (« 0 évènement sur 6 avec ces filtres » et « Retirer les filtres »), `done` (tout est passé ou fait) |
| Écrans qui l'emploient (`devis/page.tsx:73`, `encaissements/upcoming-payments.tsx:46`, `devis/modeles`, `taches`, `contacts`, `events`, `events/modeles`, `modeles-programme`, `events/[id]/documents-tab.tsx`, `prestataires`, `parametres/messages`, `parametres/corbeille`) | Filtres, vues, exports et charge affichés sur l'écran vide | Tant que l'écran est vide (sans filtre) : ni filtres, ni vues, ni exports ; les commandes de l'en-tête passent au menu « ⋯ » ; aucune ligne « Découvrir » ni invitation à un tutoriel |
| `app/devis/page.tsx` (vide), `app/page.tsx:87, 137-141` | État vide « Nouveau devis » ; bandeau « Votre fiche entreprise n'est pas encore complète » sur l'accueil | Si la fiche n'a pas ce qu'il faut pour envoyer un devis : l'état vide commence par « Compléter votre fiche entreprise » (ouvre « L'essentiel »), « Ouvrir un devis d'exemple » en second ; le bandeau de l'accueil disparaît. Un devis se crée et s'enregistre sans fiche complète ; il ne s'envoie qu'une fois les mentions présentes (contrôle actuel, `modules/quotes/service.ts:1498`) |
| `app/events/page.tsx:122-147, 247-253`, `trial-actions.ts`, `demo-event.json`, `example-event.json`, `startEventsTrial`, `startExampleEvent` | Essai guidé (24 h) et exemple (30 j) | **Un seul mariage d'exemple** de 30 jours, au contenu de l'essai (budget, rétroplanning, programme) et à la bannière de l'exemple ; « Ouvrir un mariage d'exemple » partout où l'on proposait l'essai ; l'évènement de tutoriel (24 h) n'est pas touché |

**Critères d'acceptation**

1. Chaque écran vide de la liste ci-dessus a un seul bouton plein (mesure par l'utilitaire de DS-S14,
   s'il est retenu) et aucun filtre ni export visible.
2. Les trois textes sont distincts : sans donnée, avec des filtres sans résultat, tout fait.
3. « Devis et factures » vide, fiche incomplète : « Compléter votre fiche entreprise » est l'action ;
   l'accueil n'a plus le bandeau.
4. Un devis s'enregistre en brouillon sans fiche complète ; son envoi dit ce qui manque.
5. « Essai guidé » n'apparaît plus nulle part ; un seul évènement d'exemple existe à la fois, effacé
   après 30 jours ou d'un clic, exclu des statistiques et exports (HUB-10).

**Tests** : Vitest (`empty-state.test.ts` étendu aux trois variantes) ; intégration
(`example.integration.test.ts`, `trial.integration.test.ts` refondus ; `demo-purge` à 30 jours avec
horloge simulée) ; Playwright `lot-74c-etats-vides.spec.ts` sur un espace neuf, à 1 440 et 375 px,
axe-core ; mis à jour : `ux-08-13-hub-12-rgp-04-ecrans`, `aide-01-02-evenements` ; abus : l'exemple de
A n'apparaît jamais chez B ; aucun envoi vers un tiers réel depuis l'exemple.

### 6.4 Paquet 74d — Les visites proposées (page 25)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `packages/starter-templates/src/tours.json`, `tours.ts` | Six visites de 3 à 5 bulles, toutes automatiques | Sept visites : accueil 3 (automatique, une fois, après l'assistant ; textes « vide » et « rempli »), liste des évènements 3, fiche 4, **« Tâches » 3** (la ligne et « Fait », les filtres, « Sélectionner »), carnet 3, catalogue 3, paramètres du budget 3 ; un drapeau `automatic` (accueil seul) ; des textes par appareil (« Touchez » sur téléphone) |
| `lib/help/page-tour.ts`, `app/page-tour.tsx`, `app/help-context.tsx` | Ouverture automatique si jamais vue | Accueil : automatique une fois, si l'assistant est fini. Ailleurs : **la ligne « Découvrir cet écran en 1 minute · 3 bulles · Lancer · Fermer »** sous l'en-tête, aux trois premières venues (L74-D9) ou jusqu'à « Lancer » ou « Fermer » ; jamais sur un écran vide ; aucun bouton plein. `?visite=revoir` gardé |
| `packages/ui/src/guided-tour.tsx` | Précédent, Suivant, Terminer, « Passer la visite » | Une croix « Fermer la visite » à chaque bulle ; « Précédent », « Suivant », « Terminer » ; chaque bulle encadre un élément visible (sinon la bulle est sautée) ; sur téléphone, la bulle se colle en bas et l'élément encadré reste visible |
| `app/help-bar.tsx` | Carte « Découvrir en N minutes », « Commencer le tutoriel », « Plus tard » | Carte retirée ; la pastille « Reprendre » d'un tutoriel en cours reste sur `/tutoriels*` |
| `app/aide/auto-tours-toggle.tsx`, `lib/help/preferences.ts` | « Visites automatiques » (cookie) | « Proposer la visite d'un écran à sa première ouverture » (même cookie) : coupée, plus de ligne ; l'accueil n'est plus automatique non plus |
| `modules/hub/service.ts:1279-1285`, `app/actions.ts:7` | `markTourSeen`, `hasSeenTour`, `markTourSeenAction` inutilisés | Retirés |

**Critères d'acceptation**

1. Seule la visite de l'accueil s'ouvre seule, une fois, après l'assistant ; jamais pendant.
2. La ligne « Découvrir » paraît aux trois premières venues sur un écran rempli, jamais sur un écran
   vide, et disparaît après « Lancer » ou « Fermer ».
3. Chaque bulle a la croix ; aucune « Passer la visite » ; Échap ferme.
4. Chaque bulle encadre un élément présent et visible à 1 440, 911 × 512 et 375 px.
5. « Tâches » a sa visite ; aucun formulaire n'en promet une.
6. La préférence coupée retire la ligne et la visite de l'accueil.

**Tests** : Vitest (`tours.test.ts` : trois ou quatre bulles, un seul automatique, cibles déclarées ;
compte des venues) ; tests unitaires de `placeTourBubble` (absents aujourd'hui) ; intégration
(`help-progress.integration.test.ts` : compte et fermeture par personne) ; Playwright
`lot-74d-visites.spec.ts` (chaque visite jouée de bout en bout aux trois tailles, axe-core sur la
bulle) ; mis à jour : `lot-10-aide`, `aide-01-*` ; abus : la progression de A n'est pas lue pour B.

### 6.5 Paquet 74e — L'aide de l'écran (page 26)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `packages/ui/src/help-drawer.tsx`, `app/help-button.tsx`, `app/screen-help.tsx` | Titre, un paragraphe, « Revoir la visite », bloc propre | Titre « Aide · {écran} » ; dans cet ordre : « Revoir la visite de cet écran » (si visite) ; « Sur cet écran » (ou « Pour commencer » à l'écran vide), en lignes courtes ; les questions fréquentes, qui s'ouvrent en place ; « Une autre question ? », champ qui cherche dans le centre d'aide et montre la meilleure réponse dans le panneau ; « Liens » (l'article, le tutoriel). Le bloc « Essai guidé » de `/events` devient « Ouvrir un mariage d'exemple » |
| `app/globals.css:96, 1923-1931` | 380 px à droite à partir de 1 024 px ; sous 1 024 px, feuille en bas de 60 % | 420 px rangé à droite, l'écran resserré à côté, à partir de 1 100 px ; **sous 1 100 px, posé par-dessus à droite, de toute la hauteur, avec son défilement** (jamais coupé) ; sur téléphone, plein écran défilable, « Fermer » en haut |
| Fenêtres (`app/ui/form-dialog.tsx` et fenêtres d'objet) | Pas de « ? » | Un « ? » dans l'en-tête de la fenêtre ; une question par champ difficile (`Help.<fenêtre>.fields`) ; la saisie reste intacte à la fermeture de l'aide |
| `lib/help/screens.ts`, `Help.*` (fr, en) | 125 fiches, 40 avec questions fréquentes | Chaque fiche gagne `onScreen` (lignes) et `start` (écran vide) ; questions fréquentes selon L74-D11 |

**Critères d'acceptation**

1. Le panneau tient en entier à 911 × 512 (de 0 à 512 px, défilable), à 1 440 et à 375 px ; aucun
   texte n'est caché par le bas.
2. L'ordre des blocs est celui de la maquette ; un écran sans visite n'a pas la ligne de la visite.
3. « Une autre question ? » rend une réponse sans quitter l'écran ; Échap ferme et rend le focus au « ? ».
4. Le « ? » d'une fenêtre ouvre l'aide de la fenêtre ; ce qui était saisi y est toujours à la fermeture.
5. Aucune fiche ne parle d'un élément absent de son écran (contrôle par la liste des `data-tour` et des
   titres, au moins pour les écrans à visite).

**Tests** : Vitest (ordre des blocs, présence de `onScreen` pour chaque fiche) ; Playwright
`lot-74e-aide-ecran.spec.ts` (mesure à 911 × 512, saisie gardée dans une fenêtre, clavier), axe-core
sur le panneau ; mis à jour : `l16-hub-19-aide-meme-endroit`, `ux-08-13-*`, `nfr-19-zoom`.

### 6.6 Paquet 74f — Centre d'aide et tutoriels (pages 27 et 28)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/aide/page.tsx` | Progression, vignettes de 125 fiches, case des visites, raccourcis ; plus de 12 000 px | Deux écrans : la recherche en tête ; « Pour bien démarrer » (le parcours, où la planner en est) ; « Pour découvrir » (les visites, le mariage d'exemple, les tutoriels) ; les sujets, une ligne chacun avec leur nombre d'articles ; l'interrupteur des visites ; « Raccourcis clavier » derrière un lien, ordinateur seulement |
| `app/aide/aide-search.tsx`, `packages/db/src/search.ts` | Sous-chaîne sans accents, côté client | Lecture d'une phrase : mots vides écartés, synonymes de la planner (`help-synonyms.json`, FR et EN), classement titre puis texte puis questions ; « Compris : importer · contacts » ; une meilleure réponse lisible sans l'ouvrir (résumé en étapes et bouton de l'écran concerné), puis quatre au plus ; aucune réponse : mots voisins et sujets. Le même moteur sert la recherche du haut (groupe « Aide ») et le « ? » (74e). Côté serveur ou client au choix du code, sans service extérieur, en moins de 500 ms (HUB-12) |
| `app/aide/ecrans/[key]/page.tsx` | Fiche d'écran | Garde sa forme, s'appelle « article » partout |
| `lib/help/journey.ts`, `catalog.ts`, `app/tutoriels/page.tsx` | Un parcours en six étapes, devis d'abord, import en dernier | Deux parcours choisis par `has_ongoing_events` : « Je reprends mes mariages en cours » (reprendre un mariage, compléter un mariage repris, vos prestataires, le rétroplanning et le programme, devis et factures) ; « Je pars de zéro » (créer votre premier mariage, son rétroplanning, ses prestataires, devis et factures) ; les onze tutoriels tous rangés, les autres sous « Autres tutoriels » ; « Ensuite » ; « Changer de parcours » dans un panneau ; minutes restantes gardées |
| `app/accueil/onboarding-checklist.tsx`, `lib/onboarding/checklist.ts` | Deux éléments | Une seule liste, celle du parcours (accueil, « Aide », « Tutoriels »), cochée par le geste fait dans l'espace ; « Régler l'essentiel » et « Ajouter un premier prestataire » en deviennent des marches ; elle disparaît une fois finie |
| `app/app-shell.tsx:609-626` | « Tutoriels » au menu, pastille « n/11 » | Pastille retirée ; « Tutoriels » quitte le menu latéral avec 74g (G11) et s'ouvre depuis « Aide » |
| `lib/help/tutorials.ts` | Onze scénarios | Un scénario « Compléter un mariage repris » à écrire (L74-D8) |

**Critères d'acceptation**

1. Les quinze phrases de la table de la page 27 (dont « importer mes contacts », « reprendre mon
   tableau excel ») rendent leur article en meilleure réponse ; « import » met la bonne en tête.
2. La page tient en deux hauteurs d'écran à 1 440 × 900 ; aucun libellé coupé.
3. Le parcours suit la réponse de l'assistant ; « Changer de parcours » le change et le garde.
4. Une étape se coche par le geste fait (premier mariage créé, reprise ouverte, premier prestataire).
5. Aucune pastille sur « Tutoriels » ; aucune occurrence de « fiche » pour un article dans l'aide.

**Tests** : Vitest (moteur de recherche : mots vides, synonymes, classement, phrases de la page 27 ;
`journey.test.ts` pour les deux parcours) ; intégration (`aide.integration.test.ts`) ; Playwright
`lot-74f-centre-aide.spec.ts` à 1 440 et 375 px, axe-core ; mis à jour : `lot-13-centre-aide`,
`lot-13-tutoriels` ; abus : un article d'un module non souscrit n'est jamais rendu, ni par la
recherche ni par son adresse.

### 6.7 Paquet 74g — Le menu des Paramètres et le menu latéral (pages 29 et 31)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/settings-menu.ts`, `settings-paths.ts`, `SettingsMenu.*` (fr, en) | 53 entrées, cinq groupes | Un registre des rubriques (§ 7.1) : huit groupes, 38 rubriques, chacune avec son libellé, sa phrase, son module, son drapeau « titulaire », sa forme (§ 7), ses mots de recherche ; `SETTINGS_MENU_HREFS` et `isSettingsPath` en dérivent. (G1, G2, G16) |
| `app/parametres/page.tsx`, `company-tabs.tsx` | « Paramètres » ouvre « Entreprise et TVA » à deux onglets | `/parametres` devient l'accueil ; la fiche passe à `/parametres/entreprise` et les mentions à `/parametres/mentions` ; les ancres `#profil-entreprise`, `#coordonnees-documents`, `#informations-professionnel`, `#tva-debits` (citées par `app/devis/missing-mentions.tsx` et `compliance-checks.json`) redirigent au bon bloc |
| `app/settings-nav.tsx`, `settings-search.ts` | Groupes repliables, « Chercher un réglage » | À 1 100 px et plus : le menu du groupe ouvert (sept lignes au plus), les autres groupes en une ligne, « Tous les paramètres », tenu dans l'écran sans défiler avec la page ; en dessous et sur téléphone : la rubrique seule, « ‹ Paramètres · {groupe} ». « Chercher un réglage » retiré (74k). (G7, G12) |
| Page « Vos données » (nouvelle, adresse L74-D7) | Rubriques dispersées dans « Mon entreprise » et « Prestataires et données » | Copie de toutes vos données, Reprendre une copie Symbola, Corbeille, Historique des actions, Historique des e-mails envoyés, Demandes sur les données personnelles (avec le repère « n demandes en alerte »), Stockage, Comptabilité (e-reporting, exports, archive) ; « Fermer l'espace » seul, en bas, en danger de niveau 3 (lot 70b). Ouverte par une ligne à part en bas de l'accueil et par le menu du compte. Chaque ligne garde son écran et ses droits d'aujourd'hui. (G5) |
| `app/import/page.tsx` | Dans les Paramètres (« Reprendre et importer » depuis 71b) | Hors des Paramètres : ouvert par « Vos données », les menus « ⋯ » des listes, la recherche, la palette. (G6) |
| Redirections | — | Chaque adresse d'aujourd'hui reste valable : elle redirige vers sa rubrique, à son bloc pour les rubriques fondues (§ 7.1) |
| `app/app-shell.tsx:583-630`, `app-sidebar.tsx`, `globals.css:351, 826` | « Apps », « Paramètres » (pastille RGPD), « Tutoriels » (pastille), « Aide » ; menu qui défile entier | Les modules souscrits, un filet, puis « Paramètres » et « Aide » **tenus en bas** ; la liste des modules défile seule si besoin ; sous 640 px de haut, lignes de 44 px sans espace ; « Tous les modules » dans « Abonnement et modules » et le menu du compte ; « Tutoriels » dans « Aide » ; le repère RGPD passe sur « Vos données » (accueil des Paramètres et menu du compte). (G11) |
| Téléphone (« Plus », 70f) | Menu des réglages avant l'écran ; « PUSH » | « Plus › Paramètres » ouvre la liste ; une rubrique s'ouvre seule avec « ‹ Paramètres » ; son premier réglage à 150 px du haut au plus ; « PUSH » devient « Ce téléphone ». (G12, G16) |
| Fenêtres (`globals.css`) | Hauteur libre | Au plus la hauteur de l'écran moins 32 px ; le contenu défile entre l'en-tête et les boutons |

**Critères d'acceptation**

1. « Paramètres » ouvre l'accueil : huit groupes, 38 rubriques tous modules ouverts ; un groupe d'un
   module non souscrit disparaît ; une rubrique « titulaire » est lisible par l'équipe et le dit. (G1, G2)
2. Toutes les 53 adresses d'aujourd'hui et les 12 sous-écrans s'ouvrent encore (redirection au
   besoin) ; aucune fonction de l'inventaire du § 3 bis de la note 12 ne manque (un test par ligne).
3. Le titre d'une rubrique ouverte est son libellé du menu, mot pour mot. (C-72)
4. À 911 × 512, toutes les entrées du menu latéral sont dans la fenêtre ; « Aide » finit à 512 px au
   plus (mesure par script). (G11, C-82)
5. À 375 px et à 911 × 512, le premier réglage de chaque rubrique est dans le premier écran (150 px
   au plus sur téléphone). (G12, C-79)
6. « Vos données » porte les huit lignes et « Fermer l'espace » en dernier ; ses droits sont ceux
   d'aujourd'hui (titulaire pour la copie, la reprise, l'historique, le stockage, la fermeture). (G5)
7. Aucune fenêtre ne dépasse la hauteur de l'écran moins 32 px.

**Tests** : Vitest (`settings-menu.test.ts` réécrit : groupes, sept rubriques au plus, filtres par
modules et rôle, chaque combinaison de modules du MVP, ARC-07 ; table des redirections) ; Playwright
`lot-74g-menu-parametres.spec.ts` à 1 440, 911 × 512, 375 et 360 px (mesures du menu latéral et du
premier réglage), axe-core ; mis à jour : `lot-13-parametres`, `lot-62b-ecrans-de-reglage`,
`lot-65f-menu-reductible`, `nfr-19-zoom`, `rgp-11-fermeture`, `hub-13-*` ; abus : un membre qui ouvre
l'adresse d'une rubrique titulaire voit la lecture seule et ses actions sont refusées ; le Comptable
n'a pas les Paramètres ; une rubrique d'un module non souscrit répond comme une page inexistante.

### 6.8 Paquet 74h — Le patron et la première vague (page 30)

**Les composants du patron** (`app/ui/`, au Design System) :

- `settings-header.tsx` : titre (le libellé du menu), phrase, portée (« Pour toute l'agence » ou
  « Pour vous seule » ; dans un panneau ouvert d'un écran, « vos futurs mariages » ou « ce
  mariage »), et qui la change (« Seule la titulaire la change »).
- `saved-indicator.tsx` : « ✓ Enregistré » à côté du réglage, en encre, annoncé par `role="status"`,
  qui s'efface après quelques secondes ; en cas d'échec, l'erreur sous le champ (lot 70b) et la
  valeur d'avant rendue.
- `settings-save-bar.tsx` : barre collée en bas de la fenêtre (au-dessus de la barre du bas du
  téléphone), bord haut de 2 px en encre, sans ombre (DS-S2) ; elle dit l'état en mots (« Rien à
  enregistrer », « 2 champs modifiés : adresse, téléphone », « Enregistré à 10 h 42 ») ; le bouton
  « Enregistrer la fiche » **n'est jamais grisé** (sans changement, il dit « Rien à enregistrer ») ;
  quitter avec des changements demande « Quitter sans enregistrer ? » (comme M1) ; `DraftKeeper`
  garde la saisie si l'onglet se ferme (ADR 0074).
- `AutosaveList` reçoit « ✓ Enregistré » sur la ligne au lieu de sa barre ; « Monter »,
  « Descendre », « Supprimer… » passent au menu « ⋯ » de la ligne.

**La première vague** : groupes « Votre entreprise » et « Vous », plus « Tâches : catégories et
échéances » (pour le seuil) et « Automatismes » et « Radar » (pour G10).

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `/parametres` onglet « Fiche et TVA » (`CompanySheetForm`, `VatRegimeForm`, `VatOnDebitsForm`) | Trois formulaires, adresse et coordonnées en deux cartes, « Enregistrer la fiche » sous le pli | **Fiche de l'entreprise** : formulaire lié (identité ; adresse et coordonnées dans un même bloc ; activité : métier et « Mariages par an », G15) et sa barre ; la TVA en ligne à part, datée, avec sa fenêtre (régime et TVA sur les débits). Vide, elle dit en tête ce qui manque avant le premier devis |
| Onglet « Mentions et logo » | Deux formulaires | **Mentions et logo des documents** : formulaire lié (mentions) et le logo en ligne à part (s'enregistre seul) |
| `/parametres/equipe` | Cinq formulaires ; liens coupés ; « inviter » sous le pli | **Équipe et accès** : « Inviter une personne » en bouton plein, liste éditable des membres (rôle s'enregistre seul ; « Retirer l'accès… » au menu de la ligne, danger de niveau 2) |
| `/parametres/abonnement` | Trois formulaires | **Abonnement et modules** : liste de réglages ; « Tous les modules » ouvert d'ici |
| `/profil`, `profil/signature` | Formulaires | **Votre profil et votre connexion** : formulaire lié (prénom, nom, langue) ; signature, agenda et sessions en lignes à part |
| `/parametres/notifications` | Trois formulaires | **Vos notifications** : liste de réglages, chaque interrupteur s'enregistre seul ; « Ce téléphone » |
| `/events/parametres/taches` | Catégories et priorité (liste) | **Tâches : catégories et échéances** : première ligne « Une tâche est « Bientôt » quand son échéance est dans … jours » (1 à 30, 7 au départ, s'enregistre seul, `setTaskSoonDays`), lue par « Aujourd'hui », « Tâches » et le rétroplanning ; puis la liste éditable des catégories. (G9) |
| `/parametres/automatisations` | Dix automatismes, interrupteur, heure, journal ; « reprise le » | **Automatismes : en marche ou coupés** : liste de réglages, état en mots (« En marche », « Coupé depuis le 12 nov. par Camille ») ; le radar coupé dit ce que cela change ; « Régler le rappel du jour J » gardé. Couper écrit `paused_at` et `paused_by` (0246). (G10) |
| `/parametres/radar` | Règles et seuils | **Radar des risques : règles et seuils** : si le radar est coupé, en tête « Le radar est coupé depuis … · Remettre le radar en marche » (titulaire) |

**Critères d'acceptation**

1. Chaque écran de la vague a l'en-tête commun et un bouton plein au plus. (G8)
2. Un réglage isolé s'enregistre au changement et affiche « ✓ Enregistré » à côté de lui ; aucun
   bouton « Enregistrer » sur une liste de réglages. (D7, G8)
3. La fiche de l'entreprise s'enregistre par sa barre, toujours visible à 1 440, 911 × 512 et 375 px ;
   la barre nomme les champs modifiés ; quitter avec des changements pose la question ; un onglet
   fermé garde la saisie. (D7, G8)
4. « Mariages par an » se lit et se change dans la fiche. (G15)
5. Le seuil de « Bientôt » se règle de 1 à 30 ; hors de cet intervalle, l'erreur sous le champ ; la
   valeur change l'état « Bientôt » de « Tâches » au rechargement. (G9)
6. Couper le radar le dit avec la date et la personne dans « Automatismes » et en tête de ses règles (G10).
7. Un membre voit les rubriques titulaires en lecture et le texte « Seule la titulaire la change ».

**Tests** : Vitest (composants : `saved-indicator`, `settings-save-bar` — liste des champs modifiés,
jamais grisé, question à la sortie) ; intégration (seuil 1-30 ; `paused_at`/`paused_by` ; un réglage
par rôle) ; **pour chaque écran de la vague, un test d'isolation et de rôles** (titulaire, membre,
comptable, Admin ; organisation A contre B ; module non souscrit) ; Playwright
`lot-74h-patron.spec.ts` aux trois tailles, axe-core ; mis à jour : `hub-04-equipe-et-sessions`,
`hub-27-abonnement`, `hub-15-gc-02-notifications-radar`, `lot-66b-rappel-jour-j`.

### 6.9 Paquets 74i et 74j — Les deuxième et troisième vagues

Mêmes composants, appliqués rubrique par rubrique selon le § 7.1 ; les quatre fusions (G3) et les
renommages (G4) sont au 74i. Critères communs, répétés pour chaque rubrique (un `it` par rubrique et
par critère, produits par une table de test) :

1. L'en-tête commun, la portée et un bouton plein au plus.
2. La forme dite au § 7.1 : réglage isolé enregistré seul avec « ✓ Enregistré » ; formulaire lié par
   sa barre ; liste éditable sans « Enregistrer » par ligne ; modèles par leur fenêtre.
3. L'ancienne adresse redirige au bon bloc ; aucune fonction perdue (§ 3 bis de la note 12).
4. Aucun libellé brut (`{{…}}`, « PUSH », « JSON », « ZIP » ; C-76), aucun libellé coupé, aucun
   chevauchement (contrôle de « Catégories des tâches » à 1 440 px).
5. Droits : un membre lit une rubrique titulaire, ses actions sont refusées ; B ne lit ni ne change
   un réglage de A ; une rubrique d'un module non souscrit n'est pas servie.

**Tests** : une table de test par vague (`settings-screens-74i.test.ts`, `-74j.test.ts`) qui parcourt
les rubriques ; Playwright `lot-74i-…` et `lot-74j-…` (un parcours par rubrique à 1 440 et 375 px,
axe-core) ; mis à jour : `lot-21-etiquettes-et-reglages`, `lot-63c-evenements-budget-documents`,
`lot-16j-types-evenement`, `hub-29-rdv-02-plages-occupees`, `msg-01-02-hub-18-emails`,
`hub-18-msg-01-signature-et-marque`, `lot-66a-heure-envoi`, `jur-06-archive-comptable`.

### 6.10 Paquet 74k — La recherche des réglages (page 32)

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `lib/search/run-search.ts`, `lib/search/screens.ts`, `app/search-box.tsx` | 23 écrans, par leur nom ; groupes du 70e | Un groupe « Réglages » : chaque rubrique du registre (nom, phrase, libellés des réglages qu'elle contient) et les synonymes de `settings-synonyms.json` ; chaque résultat dit son chemin (« Paramètres › Votre entreprise › Fiche de l'entreprise ») et la ligne qui répond ; « Compris : … » ; sur une page des Paramètres, les réglages viennent en tête ; aucune réponse : mots voisins et « Voir tous les paramètres » |
| Rubrique ouverte depuis la recherche | — | S'ouvre à la ligne trouvée (`#reglage-<clé>`), mise en évidence quelques secondes |
| Palette (⌘K) | « Paramètres », « Corbeille », « Importer », « Aide » | Gardée ; « Corbeille » mène à « Vos données › Corbeille » ; « Importer » à « Reprendre et importer » |

**Critères d'acceptation** : les quinze demandes de PC-07 (table de la page 32) rendent leur rubrique
en premier résultat du groupe ; « copie de mes données » et « assurance » répondent ; résultats en
moins de 500 ms et limités aux droits (§ 4.3) ; « Chercher un réglage » n'existe plus. (G13)

**Tests** : Vitest (les quinze demandes ; synonymes FR et EN ; filtre par rôle et modules) ;
intégration `search.integration.test.ts` étendu ; Playwright `lot-74k-recherche-reglages.spec.ts` ;
NFR-02 (le temps de la recherche reste sous le seuil mesuré en CI, ADR 0114 et 0115).

### 6.11 Paquet 74l — Le bouton « Réglages » des écrans (page 33)

| Écran | Aujourd'hui (`SettingsLink`) | Après (section « Réglages » du menu « ⋯ ») |
| --- | --- | --- |
| Tâches (`taches/page.tsx:83`) | → Modèles de rétroplanning | « Régler les tâches… » ; « Modèles de rétroplanning… » |
| Évènements (`events/events-header.tsx:26`) | → lignes du budget | « Régler les évènements… » : types et termes, sources et motifs, étapes des demandes |
| Fiche › Tâches (`events/[id]/page.tsx`) | → Modèles de rétroplanning | « Modèles de rétroplanning… » ; « Régler les tâches… » |
| Fiche › Budget (deux endroits) | → lignes du budget par défaut | « Postes de départ de vos futurs mariages… · Ne change pas les postes de « {évènement} » » |
| Fiche › Programme | → Modèles de programme | « Modèles de programme… » |
| Fiche › Devis, Devis et factures (`devis/page.tsx:55`), Encaissements (`encaissements/page.tsx:35`) | → paramètres des devis | « Régler les devis et factures… » : numérotation, échéances et paiement ; apparence ; catalogue |
| Carnet (`prestataires/page.tsx:123`) | → types | « Régler le carnet… » : métiers et familles, étiquettes, assurances et pièces, trajets |
| Liens dans une phrase (rendez-vous, plages, rappel du jour J, RGPD) | Liens | Gardés ; « Réglages RGPD » devient « Demandes sur les données personnelles » |

`app/reglages/panels.ts` : une clé ouvre plusieurs rubriques (« Pour cet écran ») ; le panneau
s'intitule « Réglages de « {écran} » » ; la rubrique s'y règle comme dans les Paramètres (mêmes
composants) ; « Voir dans les Paramètres » garde « ‹ Retour à {écran} ». `app/settings-link.tsx` est
retiré une fois le dernier usage remplacé.

**Critères d'acceptation** : aucune roue dans un en-tête ; chaque ligne nomme ce qu'elle règle et sa
portée ; le panneau ne mène jamais à une rubrique voisine ; fermé, il rend l'écran d'origine à sa
place ; « Voir dans les Paramètres » puis « ‹ Retour » ramène au même mariage. (G14, C-11)

**Tests** : Vitest (`panels.test.ts` : clés, rubriques par clé, retour par clé seulement) ; Playwright
`lot-74l-reglages-ecran.spec.ts` à 1 440 et 375 px (panneau du bas sur téléphone), axe-core ; abus :
une clé inconnue ou un retour forgé répondent comme une page inexistante.

---

## 7. Le patron d'un écran de réglage (D7), appliqué aux écrans

### 7.1 Les rubriques, leur forme et leur vague

Formes : **R** liste de réglages (chaque réglage seul, « ✓ Enregistré ») ; **E** liste éditable
(ligne par ligne) ; **L** formulaire à champs liés (barre d'enregistrement) ; **M** modèles (liste et
fenêtre, règle du lot 63). « T » = titulaire. Mode actuel : relevé dans le code (§ 3). Les choix de
groupe et de nom sont ceux de G2 à G4 (L74-D1).

| Rubrique (groupe) | Écrans d'aujourd'hui | Mode actuel | Forme | T | Vague |
| --- | --- | --- | --- | --- | --- |
| Fiche de l'entreprise (Votre entreprise) | `/parametres` onglet fiche | 3 formulaires | L + ligne TVA | — | 74h |
| Mentions et logo des documents | `/parametres` onglet mentions | 2 formulaires | L + ligne logo | — | 74h |
| Équipe et accès | `/parametres/equipe` | 5 formulaires | E + bouton « Inviter » | T | 74h |
| Abonnement et modules | `/parametres/abonnement` | 3 formulaires | R | T | 74h |
| Votre profil et votre connexion (Vous) | `/profil`, `profil/signature` | formulaires | L + lignes | — | 74h |
| Vos notifications (Vous) | `/parametres/notifications` | 3 formulaires | R | — | 74h |
| Types d'évènements et termes des clients (Évènements) | `events/parametres/types` + `/termes` (fusion) | AL + formulaire ; AL | E | — | 74i |
| Sources et motifs | `/sources` | 3 formulaires | E | — | 74i |
| Demandes : étapes et formulaire de contact | `/etapes` + `/contact` (fusion) | AL + formulaire ; formulaire | E + L | T | 74i |
| Modèles d'évènement | `events/modeles-evenement` | 2 formulaires | M | — | 74i |
| Questionnaires des clients | `/questionnaires`, `questionnaires/[id]` | formulaires | M | — | 74i |
| Invités : régimes et repas | `/regimes` + `/repas` (fusion) | 2 formulaires ; AL | E (deux blocs) | — | 74i |
| Plages occupées dans l'agenda | `/plages-occupees` | fenêtre | E | — | 74i |
| Tâches : catégories et échéances (Tâches, programme et jour J) | `events/parametres/taches` | AL + formulaire | R (seuil) + E | — | 74h |
| Rétroplanning : modèles | `events/modeles`, `modeles/[id]` | formulaires | M | — | 74i |
| Programme du jour J : modèles | `events/modeles-programme`, `[id]` | formulaires | M | — | 74i |
| Jour J : listes de contrôle | `/listes-jour-j` | AL + formulaire | E | — | 74i |
| Budget : postes de départ et répartition (Budget et prestataires) | `events/parametres` + `budget/parametres` (fusion) | formulaires | E (bloc 1, T) + E (bloc 2) | bloc 1 | 74i |
| Prestataires : métiers et familles | `prestataires/parametres` | 17 formulaires | E | — | 74i |
| Prestataires : étiquettes | `/etiquettes` | 8 formulaires | E | — | 74i |
| Prestataires : assurances et pièces | `/pieces` | 3 formulaires | R + E | — | 74i |
| Prestataires : trajets | `/trajet` | 4 formulaires | R | — | 74i |
| Prestataires par lien | `/prestataires-par-lien` | formulaire, lecture pour l'équipe | R | T | 74i |
| Catalogue des prestations (Devis et factures) | `devis/catalogue` | AL + formulaire | E | — | 74j |
| Numérotation, échéances et paiement | `devis/parametres` | 4 formulaires | L (coordonnées bancaires) + R | — | 74j |
| Apparence des devis et factures | `devis/parametres/documents` | 3 formulaires | R + aperçu | — | 74j |
| Modèles de devis | `devis/modeles` | 5 formulaires | M | — | 74j |
| Modèles de contrat | `devis/modeles-contrat`, `[id]` | formulaires | M | — | 74j |
| Modèles de proposition | `devis/modeles-proposition` | 4 formulaires | M | — | 74j |
| Messages types : ce que vous envoyez (Messages et automatismes) | `parametres/messages`, `[id]` | formulaire + brouillon | M | — | 74j |
| E-mails automatiques : ce que Symbola envoie | `parametres/emails`, `[kind]`, `marque` | formulaires | M (+ L pour la marque, T) | marque | 74j |
| Adresse d'envoi et réponses | `parametres/adresse-envoi` | formulaire | L | T | 74j |
| Automatismes : en marche ou coupés | `parametres/automatisations`, `rappel-jour-j` | formulaire, lecture pour l'équipe | R | T | 74h |
| Radar des risques : règles et seuils | `parametres/radar` | formulaires, lecture pour l'équipe | R | T | 74h |
| Prospects : délai avant relance | `parametres/relances` | 4 formulaires | R | — | 74j |
| Paiements et propositions : relances | `devis/relances` | formulaire | R | — | 74j |
| Rendez-vous : types et page de réservation (Rendez-vous) | `rendez-vous/reglages`, `types/[id]` | 4 formulaires | M + R | — | 74j |
| Disponibilités et agendas | `rendez-vous/disponibilites` | 6 formulaires | R (semaine) | — | 74j |

**Vos données** (74g, hors patron de réglage, chaque écran gardé tel qu'il est, avec l'en-tête
commun) : `parametres/export` (T), `parametres/reprise` (T), `parametres/corbeille`,
`parametres/journal` (T), `parametres/envois`, `/rgpd` et ses sous-écrans (T), `parametres/stockage`
(T), `devis/e-reporting`, `devis/exports-comptables`, `devis/parametres/archive` (titulaire et
comptable), `parametres/fermeture` (T). **Hors Paramètres** : `/import` (« Reprendre et importer »).

Compte : des 53 entrées d'aujourd'hui, onze vont à « Vos données » et une (« Importer ») sort des
Paramètres, soit 41 ; « Entreprise et TVA » donne deux rubriques (42) ; les quatre fusions en retirent
quatre : **38 rubriques**. Avec les sous-écrans (modèles, e-mails, rappel du jour J, signature,
types de rendez-vous), une cinquantaine d'écrans passent au patron ; le relevé en comptait 58 en
comptant les écrans de « Vos données » (C-75), qui reçoivent l'en-tête commun sans changer de forme.

### 7.2 Le plan de bascule

- **Vague 1 (74h)** : les composants, puis « Votre entreprise », « Vous », le seuil, les
  automatismes et le radar (douze écrans). C'est là que le patron se juge : Julien regarde ces
  écrans dans le rejeu avant que les vagues 2 et 3 partent (la règle « pas de recette
  intermédiaire » vaut pour la planner ; ce regard sur le patron est un rejeu local, voir L74-D12).
- **Vague 2 (74i)** : « Évènements », « Tâches, programme et jour J », « Budget et prestataires »,
  les quatre fusions (une vingtaine d'écrans).
- **Vague 3 (74j)** : « Devis et factures », « Messages et automatismes », « Rendez-vous » (une
  vingtaine d'écrans).
- **Entre deux vagues**, un écran pas encore basculé garde son enregistrement d'aujourd'hui, sous le
  nouvel en-tête et dans le nouveau menu (74g) : l'app reste cohérente à chaque fusion.
- Un écran basculé **ne garde aucun ancien bouton** : la table de test de la vague vérifie qu'aucun
  `type="submit"` ne reste dans une liste de réglages.

---

## 8. Les textes, l'aide, les captures, le rejeu et `gap.csv`

### 8.1 Textes (français et anglais)

Tous les textes des maquettes, en clés de `fr.json` et `en.json` (C1, HUB-19), vérifiés par
`scripts/check-messages.ts` ; aucun texte dans le code. Espaces nouveaux ou refaits :
`Onboarding.*` (questions, issues, « Préparé pour vous »), `NewEvent.pastDue.*` (étape 2),
`EmptyStates.<écran>.{empty,filtered,done}`, `Tours.*` (bulles par état et par appareil),
`HelpPanel.*`, `Help.<clé>.{onScreen,start,faq,fields}`, `HelpCenter.*` (sujets, « Compris : »),
`Journey.*` (deux parcours), `SettingsMenu.*` (huit groupes, 38 libellés et phrases),
`SettingsHeader.*` (portées), `SettingsSave.*` (« ✓ Enregistré », états de la barre),
`YourData.*`, `SettingsPanel.*` (« Réglages de « {écran} » », « Pour cet écran »). Exemples :

| Français (maquette) | Anglais |
| --- | --- |
| Avez-vous déjà des mariages en cours ? · Oui · Non, je pars de zéro | Do you already have weddings under way? · Yes · No, I'm starting from scratch |
| Vos devis portent-ils la TVA ? · Non · Oui · Je ne sais pas encore | Do your quotes include VAT? · No · Yes · I don't know yet |
| Votre espace n'est pas tout à fait prêt · {n} questions sur 5 restent | Your workspace isn't quite ready · {n} of 5 questions left |
| 8 tâches tombent avant aujourd'hui · Déjà fait · À faire · À dater | 8 tasks fall before today · Already done · To do · To be dated |
| Découvrir cet écran en 1 minute · Lancer · Fermer | Discover this screen in 1 minute · Start · Close |
| Fermer la visite | Close the tour |
| Une autre question ? | Another question? |
| ✓ Enregistré | ✓ Saved |
| 2 champs modifiés : adresse, téléphone · Enregistrer la fiche | 2 fields changed: address, phone · Save the profile |
| Pour toute l'agence · Pour vous seule | For the whole agency · Just for you |
| Coupé depuis le {date} par {prénom} | Paused since {date} by {first name} |

Le **lexique** (lot 70g) : ce lot retire de `lexique-exceptions.json` les exceptions des volets 5 et
6 (« Réglages » comme bouton, « vos modules », « Apps », « Essai guidé », « fiche » pour un article,
« PUSH », « JSON », « ZIP » à l'écran) ; « titulaire » suit DS-S7.

### 8.2 Aide d'écran et centre d'aide

- `lib/help/screens.ts` : chaque fiche reçoit ses lignes « Sur cet écran » et, pour un écran vide,
  « Pour commencer » ; les fiches des rubriques fondues sont fondues ; les fiches de « Vos données »
  changent de sujet ; « Apps », « Tutoriels » au menu, « Passer la visite », « Essai guidé »
  disparaissent des textes.
- **Captures à régénérer** (`pnpm --filter @symbola/app help:captures`, puis relire les images dans la
  PR) : toutes celles qui montrent le menu latéral, la barre du haut, l'assistant, l'accueil, un écran
  vide ou un écran de réglage, soit au moins `home`, `events`, `allTasks`, `vendors`, `quotes`, les
  écrans de réglage à capture et l'aide elle-même ; en pratique **les 40 captures**, le menu latéral
  étant sur chacune. Le script coupe les visites (cookie à 0) : il doit aussi fermer la ligne
  « Découvrir » pour des captures propres.

### 8.3 Rejeu (C4)

- **SC-01 « Le premier quart d'heure »** (PAR-01, P0) à 74a et 74b : chronométré, sur téléphone, avec
  les nouvelles questions ; compte rendu `docs/recette/SC-01.md`. Écart à noter : l'étape 2 du
  scénario cite « douze par an » (L74-D5).
- **SC-10 « Quinze ans de contacts »** à 150 % (NFR-19) à 74e, 74f et 74g : « elle ouvre l'aide
  guidée et la suit jusqu'au bout », menu entier dans la fenêtre ; compte rendu `docs/recette/SC-10.md`.
- **PC-07** (les quinze demandes de réglage du panel) à 74k ; **PC-08** (aide et premiers pas) à 74f.

### 8.4 `gap.csv`

Lignes mises à jour par le paquet qui les touche : HUB-06, HUB-09, HUB-10, HUB-11, HUB-12, HUB-13,
HUB-16, HUB-17, HUB-23, UX-04, UX-08, UX-09, UX-12, UX-13, NFR-17, NFR-19, CHR-05, GC-02.

### 8.5 Chaîne de sécurité

SEC-30 à SEC-36 verts à chaque PR ; tests d'abus des § 4.3 et 6 obligatoires (nouvelles colonnes,
nouvelle page « Vos données », redirections, recherche, panneau « Réglages »).

---

## 9. Ambiguïtés et décisions à prendre par Julien

Numérotées L74-D1 à L74-D12 (« L74 » pour ce lot, « D » pour décision ; d'abord appelées S1 à S12,
renommées le 27/11 pour ne pas les confondre avec les DS-S1 à DS-S15 du Design System ni avec les
choix des autres lots). **Règle donnée par Julien le 27/11 : une divergence se tranche en faveur de
la décision la plus récente** (maquettes validées et décisions du 26/11 contre le cahier des
charges ou un lot plus ancien). Celles qui
touchent le cahier des charges sont aussi dans `docs/QUESTIONS.md` (Q51).

| # | Question | Où regarder | Proposition (ma recommandation) | L'autre voie |
| --- | --- | --- | --- | --- |
| L74-D1 | **Tranché le 27/11 : G1 à G16 confirmés tels que proposés** (« je confirme S1 tes 16 recommandations »). **Confirmez-vous G1 à G16 ?** Ils sont retenus par la règle du 26/11, sans parole de votre part sur chacun (§ 0). | Note 12, § 3 ; pages 29 à 33 | **Les confirmer tous**, tels que proposés : ce lot les réalise mot pour mot. Si vous en renversez un, citez son numéro ; je corrige la maquette et les critères marqués de ce numéro avant le code | Les reprendre un par un, comme B1 à B17 |
| L74-D2 | **Tranché le 27/11 : les deux gardés** (« garde les 2 options ») : B7 tâche par tâche pour un mariage créé, I3 pour un mariage repris. **Les échéances passées d'un mariage créé : tâche par tâche (B7) ou une réponse pour toutes (I3 du lot 71) ?** Le lot 71 a décidé, pour « Partir d'un modèle » sur un mariage repris, « la même question que pour la liste reprise » (garder en retard, redater, tout est fait) et dit que le volet 5 reprendrait ce composant ; la maquette 23, validée, dessine une réponse par tâche, « rien de coché », et « à dater » sans réponse. | Page 23, « Les échéances passées » ; lot 71, I3 | **B7 tel que dessiné pour un mariage créé** (tâche par tâche, « Tout est déjà fait » et « Tout reste à faire » en raccourcis, 4 semaines proposé) ; I3 reste pour un mariage repris. Les deux partagent le calcul des échéances passées et la répartition des dates | Un seul composant partout, celui de I3 (plus simple, mais « rien de coché » et « à dater » se perdent) |
| L74-D3 | **Tranché le 27/11 : une marque** (`due_date_known`), à côté d'une date technique. **« À dater » : une marque à côté d'une date technique, ou une échéance vide ?** | § 4.1, 0245 | **Une marque** (`due_date_known`, comme `done_date_known` du lot 71) : rien ne casse dans les tris ni les lectures, et le lot 71 a fait ce choix | `due_date` facultatif : plus juste, mais chaque lecture d'échéance de l'app est à revoir |
| L74-D4 | **Tranché le 27/11 : la planner doit choisir** (« il faut qu'elle choisisse ») : aucun devis envoyé tant que la réponse manque, le brouillon reste possible ; l'étape « Devis et factures » et « L'essentiel » le lui rappellent. **« Je ne sais pas encore » pour la TVA : quel régime en attendant ?** C'est un point fiscal : un devis envoyé sous franchise porte la mention « TVA non applicable, art. 293 B du CGI ». | Page 22, Q5 ; B5 | La note 11 propose de garder la franchise et de redemander avant le premier devis. **Je ne tranche pas** : je recommande que l'envoi du premier devis (pas son brouillon) soit impossible tant que la réponse manque, et de faire confirmer par l'expert-comptable | Garder la franchise sans blocage, avec un rappel seulement |
| L74-D5 | **Tranché le 27/11 par la règle de la décision récente : l'écart est accepté** (B2 l'emporte sur HUB-09 et SC-01). **Le volume annuel quitte l'assistant** (B2), alors que HUB-09 le cite parmi les questions et que SC-01 dit « douze par an ». | HUB-09, SC-01 ; B2, G15 | **Accepter l'écart** : la réponse reste modifiable dans la fiche de l'entreprise (HUB-09 : « tout reste modifiable dans les réglages ») ; noté dans `gap.csv` et Q51 ; un ADR court, puisque c'est une divergence acceptée | Garder la question (six questions), contre B2 |
| L74-D6 | **Tranché le 27/11 : sans objet.** Aucune production n'est en cours (conception du MVP) : il n'existe aucun automatisme réellement coupé avant ce lot, donc aucun cas particulier à prévoir ; le jeu fictif est rechargé. **Un automatisme coupé avant ce lot** : la base n'a ni la date ni l'auteur. | § 4.1, 0246 ; page 30 | **« Coupé », sans date ni nom**, et la conséquence ; la prochaine coupure les gardera (règle « le sûr », comme A9) | Prendre `updated_at` et `updated_by`, au risque d'une date qui n'est pas celle de la coupure |
| L74-D7 | **L'adresse de « Vos données ».** | § 6.7 | **`/donnees`** (page à part, comme `/aide`), les anciennes adresses gardées par redirection | `/parametres/donnees` (reste « dans » les Paramètres pour le menu et la recherche) |
| L74-D8 | **Le tutoriel « Compléter un mariage repris »** du parcours « Je reprends » n'existe pas. (La seconde moitié, un espace préparé avant ce lot, est sans objet depuis L74-D6 : aucune production.) | Page 28 ; note 11, § 4 | **L'écrire** (un scénario joué sur un mariage d'exemple repris, après 71f) | Le remplacer par la visite de la fiche |
| L74-D9 | **Qu'est-ce qu'une « venue » pour la ligne « Découvrir » (trois venues) ?** | Page 25 ; B11 | **Une ouverture de l'écran un jour différent** : recharger ou revenir dans la journée ne compte pas | Chaque ouverture |
| L74-D10 | **L'ordre avec les lots 72 et 73.** La section « Réglages » vit dans le menu « ⋯ » de chaque écran, que les volets 3 et 4 créent ; les états vides de la liste des évènements et du carnet aussi. | § 5.2 | **74l et 74c après les paquets des lots 72 et 73 qui créent ces menus et ces écrans** ; d'ici là, la roue reste sur les écrans qui n'ont pas de menu « ⋯ » | 74l ajoute lui-même un menu « ⋯ » minimal aux écrans qui n'en ont pas, quitte à le refaire |
| L74-D11 | **Les questions fréquentes du « ? »** : 85 fiches sur 125 n'en ont pas ; en écrire pour toutes est un gros travail de textes (FR et EN). | Page 26 ; § 6.5 | **Obligatoires pour les écrans à visite, les écrans vides, les fenêtres à champs difficiles et les rubriques de réglage** (une soixantaine) ; les autres montrent « Sur cet écran » et la recherche | Toutes les 125 dans ce lot |
| L74-D12 | **Regarder le patron avant de l'étendre.** La règle du 27/11 écarte toute recette avant la fin des lots de réalisation. | § 7.2 | **Un rejeu local par Claude Code de la vague 1, captures dans la PR 74h**, que vous regardez avant que 74i et 74j partent ; ce n'est pas une recette de la planner | Basculer les trois vagues sans arrêt |

**Points qui ne demandent pas de décision mais méritent d'être sus**

- Le lot 70 (paquet 70c) écrit l'ADR « Enregistrer par un bouton » pour le panneau de tâche
  (M1) ; la barre d'enregistrement des formulaires liés (D7) relève du même écart avec UX-09 et
  s'ajoute à cet ADR par un avenant (§ 10).
- « Mariages par an » n'est lu par rien d'autre que la fiche ; s'il doit servir un jour (forfaits,
  statistiques), ce sera un autre lot.
- Le contact du support n'est pas ajouté au centre d'aide (décision du 26/11, note 11, § 6).
- `markTourSeen`, `hasSeenTour` et `markTourSeenAction`, inutilisés, sont retirés (74d).
- La note de la session 70c prévoit l'ADR 0119 pour M1, numéro que le lot 71 réserve aussi : à
  régler entre ces deux lots ; ce lot ne prend aucun numéro d'ADR.

---

## 10. Divergences avec le cahier des charges, et ADR à prévoir

À signaler ; **aucun ADR n'est écrit dans cette PR**. Chacun sera écrit avec le paquet qui le réalise,
si Julien confirme.

1. **La barre d'enregistrement des formulaires liés (D7)** contre UX-09 (« Enregistrement
   automatique ») et l'anti-patron du bouton « Enregistrer » oublié : même écart que M1 (lot 70,
   § 9 point 1), protégé de même (question à la sortie, brouillon, barre jamais grisée). → **avenant à
   l'ADR de M1** (paquet 74h). **Tranché le 27/11 par la règle de la décision récente :
   D7 l'emporte.**
2. **Le volume annuel hors du questionnaire** (B2) contre HUB-09 et l'étape 2 de SC-01 (L74-D5). →
   **ADR court** (paquet 74a), l'écart étant accepté le 27/11 (L74-D5) ; `gap.csv` (HUB-09) et Q51.
3. **Les visites proposées et non automatiques (D2)** : HUB-11 demande une visite « rejouable » et
   relancée « depuis le menu d'aide » ; D2 le respecte. Pas d'ADR ; `gap.csv` (HUB-11).
4. **Le mariage d'exemple unique (B13)** : HUB-10 ne parle que de données de démonstration ; la
   disparition de l'essai guidé de 24 h n'enlève aucune exigence. Pas d'ADR ; `gap.csv` (HUB-10).
5. **Les rubriques de « Vos données » sorties des Paramètres (G5)** : aucune exigence ne les y place.
   Pas d'ADR.
6. **`DESIGN.md`** n'est pas réécrit : il porte déjà ces formes (phase 6). La largeur du panneau
   d'aide (420 px) et la hauteur des fenêtres (écran moins 32 px) sont des valeurs de mise en page de
   `globals.css`, pas des jetons ; si un écart apparaît au code, il est noté pour la phase 7.
