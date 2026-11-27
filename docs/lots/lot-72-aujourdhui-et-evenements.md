# Lot 72 — Réaliser le volet 3 des maquettes : « Aujourd'hui » et « Évènements »

**Statut** : **spécification à valider par Julien** ; J1 à J6 tranchées le 27/11, J7 à J14 ouvertes (§ 7). Le lot change
le schéma de données du module `events` (deux migrations, 0224 et 0225) et deux parcours P0 (PAR-03, et PAR-02
par la frise et la liste) : la validation vaut accord pour cette migration.
**Branche de la spécification** : `lot-72-aujourdhui-et-evenements` (une PR vers `main`, ce fichier et
`docs/QUESTIONS.md` seulement). Chaque paquet aura ensuite sa branche `lot-72<x>-…` et sa PR.
**Date** : 27/11/2026, par Claude Code.

Sources, dans l'ordre où elles font foi :

1. `docs/audits/2026-11-ux-parcours/06-decisions-porte-2.md` (D1 à D11) ;
2. `docs/audits/2026-11-ux-parcours/09-maquettes-aujourdhui-evenements.md` (A1 à A7 et E1 à E9,
   tranchés le 26/11 : « on fait confiance par défaut aux choix poussés par ces nouvelles maquettes »),
   son § 3 bis (aucune fonction majeure ne disparaît) et son § 4 (ce que les maquettes supposent de
   l'app) ;
3. les cinq maquettes `docs/maquette/lot-68/13-aujourdhui-accueil.html` à
   `17-evenements-liste-programme.html` ;
4. `DESIGN.md`, réécrit par la phase 6 du lot 68 (PR #193) : il porte déjà les formes de ce volet
   (ligne allégée, en-tête d'un objet, onglets, frise, barre d'avancement, fenêtre longue à un seul
   « Enregistrer », état vide) ; ce lot les applique, il ne le réécrit pas ;
5. `docs/audits/2026-11-ux-parcours/04-synthese.md` (constats C-nn, principes P-nn) et
   `13-design-system.md` (liste de contrôle du § 4.1, points S1 à S15) ;
6. `docs/CAHIER_DES_CHARGES.md` pour les exigences ; les lots 70 (`docs/lots/lot-70-taches-et-transverse.md`)
   et 71 (`docs/lots/lot-71-reprise-et-import.md`, branche `origin/lot-71-reprise-et-import`) pour ce
   qu'ils laissent à ce lot (leur § 8).

Règle de lecture (décision de Julien du 26/11) : quand une maquette plus récente (volets 4 à 6) dessine
autrement un geste que ce volet touche, la plus récente l'emporte, sans perdre de fonction. Les cas sont
dans les décisions du § 7 (J6 pour « Relancer… », J5 pour « Pour bien démarrer »).

Fichiers sous `apps/symbola/` sauf mention ; `fr` = `packages/i18n/src/messages/fr.json`. État du code
lu sur `origin/main` au commit `2342f79e` (lots 70a et 70b fusionnés).

---

## 1. Ce qui change pour la planner, en clair

Une fois le lot livré, Camille (et Nadia, à la tête d'une agence de six personnes) verra :

**Sur « Aujourd'hui »**

- **Le premier jour, une seule chose à faire.** L'espace neuf ne montre plus un calendrier vide ni
  « Rien ne presse : tout est à jour » : il dit « Commencez par votre premier mariage » avec un seul
  bouton, « Nouvel évènement » ; ou « Reprendre un mariage », si elle a dit à l'assistant de démarrage
  qu'elle suit ses mariages dans un tableur ou un logiciel. L'autre voie reste en petit dessous.
- **Rien avant les urgences.** Le bandeau « fiche entreprise » et le bloc « Risques » disparaissent du
  haut de l'écran. Seules les vraies alertes (plafond d'e-mails, rappels arrêtés, demande RGPD qui
  arrive à échéance) passent avant la liste.
- **Un nombre qui se recompte.** « 7 points à traiter d'ici 14 jours, dont 2 en retard » : un point est
  une ligne de la liste, et 7 = 5 tâches + 1 relance + 1 paiement. Une partie dit « Tâches 4 sur 7 »
  quand elle n'est pas montrée en entier ; « 4 autres points · Tout afficher » ouvre le reste sur place.
- **Les lignes rangées par date**, les retards d'abord : ce qu'attend un prestataire ne passe plus
  devant ce que Camille doit faire elle-même aujourd'hui.
- **Qui appeler.** Quand la ligne attend les mariés ou un prestataire, le nom et le téléphone de la
  personne sont sous le titre ; sur téléphone, on appelle d'un toucher.
- **La tâche s'ouvre sur place.** Cliquer le titre ouvre la fenêtre de la tâche par-dessus l'accueil ;
  « Fermer » rend la même ligne. Le nom du mariage, à côté, mène à sa fiche. Le bouton « Ouvrir » disparaît.
- **Une alerte du radar devient une ligne** « À regarder » de la liste, comptée avec les autres ; sans
  alerte, rien (plus de « Aucun risque détecté ce matin » sous deux retards).
- **« Mes évènements » remonte** sous la liste, avant le calendrier, et dit pour chaque mariage
  « 6 points, dont 2 en retard », « Pas encore de tâches » ou « À jour ».
- **« Pour bien démarrer »** n'est plus au milieu de l'écran : une ligne en bas, tant qu'une étape
  reste, que l'on masque pour de bon.
- **Dans une agence, « Moi · L'agence ».** « Moi » montre ce dont Nadia s'occupe ; « L'agence » répond
  à « qui est en retard dans l'équipe ? » (une ligne par personne : en retard, aujourd'hui, d'ici
  14 jours, évènements suivis, « Voir ses tâches ») et à « quels mariages ont du retard ? » (planner
  principal, « 32 sur 42 » tâches faites, retards, le plus ancien retard ; les mariages à jour repliés).

**Dans la fiche d'un évènement**

- **Un en-tête court** : « ← Évènements », le nom, une ligne de faits (« Mariage · samedi 12 juin 2027 ·
  dans 199 jours · Manoir des Aulnes, Poitiers »), la frise, un bouton « Écrire aux mariés » (« Ouvrir
  le Jour J » à partir de sept jours avant) et un menu « ⋯ » pour le reste (Messages, Voir comme Léa
  Martin, Ouvrir le Jour J, Changer le type…, puis à part Reporter et Annuler l'évènement). Le premier
  contenu utile arrive à 191 px au lieu de 552.
- **Tous les onglets visibles**, l'ouvert souligné, chacun avec son nombre utile (« 6 sur 9 »,
  « 2 en retard » en rouge) ; « Programme du jour J » devient « Programme ». Sur un portable à 150 %,
  ce qui ne tient pas passe dans « Plus ▾ » ; en défilant, une barre fine garde le nom, la date, le
  statut et les onglets. Sur téléphone, la barre des onglets défile de côté et l'onglet ouvert reste en vue.
- **Une frise qui se lit** : quatre étapes (« Une demande en cours », « Signé, en préparation »,
  « Jour J », « Clôturé »), plus de ronds qui changent le statut sans prévenir. L'étape qui se franchit
  à la main a son bouton nommé au bout (« Le contrat est signé… », avec la date de signature, qui peut
  être passée ; « Clôturer l'évènement… » le lendemain du jour J). Reporté, Annulé et Archivé
  remplacent la frise par une ligne qui dit l'état et la seule suite (« Fixer la nouvelle date… »,
  « Rétablir l'évènement… »).
- **Une seule réponse à « que faire maintenant ? »**, en tête de la Synthèse, selon l'état : le devis à
  envoyer pour une demande ; « Créer la liste des tâches » pour un mariage signé sans tâches ; les points
  du mariage (les mêmes lignes et les mêmes nombres que sur l'accueil) en préparation, une étape en
  attente (le programme à trois mois, le lien des mariés) y étant une ligne de plus ; « À compléter
  après la reprise » pour un mariage repris ; « Clôturer » après le jour J. Plus de bandeau « Prochaine
  étape », plus de « tout est à jour » quand une étape attend.
- **La Synthèse en cinq blocs** au lieu de onze : la suite, « Où en est le mariage » (tâches, budget,
  prestataires, décisions des mariés, et « Pourquoi ces nombres ? »), « Temps forts », « Rendez-vous »
  à gauche ; « Informations » (mariés, invités, lieux, budget souhaité, style, type, « Venu par »,
  agenda de l'équipe, équipe, notes) et le fil d'activité à droite. « Les 14 prochains jours » se fond
  dans la suite.
- **« Modifier les informations » dans une seule fenêtre** à rubriques (Date et lieux, Mariés, Invités
  et budget, Style et notes, Type et origine) avec un seul « Enregistrer », au lieu de six formulaires
  et six boutons. La date d'un mariage signé ne se change plus là : « Reporter l'évènement… ».

**Dans la liste des évènements et le programme**

- **La liste** n'a plus qu'un bouton plein, « Nouvel évènement » ; « Importer » et « Réglages » passent
  au menu « ⋯ » ; les bascules sont en encre ; les filtres ont un libellé (« Venu par » au lieu de
  « Source du prospect ») ; la colonne « Évènement » porte le type ; une colonne « Tâches faites » dit
  « 14 sur 20 · 2 en retard » ; « 2 le même jour » se lit dans la date, en gris ; la charge des douze
  mois passe dans la vue « Calendrier ». Sur téléphone, la première ligne arrive à 126 px.
- **Le programme** n'a plus que « Ajouter un moment », « Partager… » et un menu en tête, au lieu de sept
  commandes ; chaque journée finit par son « Ajouter un moment » ; on clique une ligne pour l'ouvrir sur
  place, « Retirer » passe dans son menu, avec « Annuler » dix secondes ; un doublon possible se dit
  « À vérifier : » ; les heures s'écrivent « 17 h 30 » partout ; « Décaler tout le programme… » au menu.

Ce qui **ne change pas** dans ce lot : le contenu des onglets « Budget et prestataires » (lot 73),
« Tâches » (lot 70c), « Devis et factures », « Mariés », « Documents », « Invités » ; le calendrier
d'« Aujourd'hui » (seule sa place change) ; la vue « Colonnes » ; le contenu de « Pour bien démarrer »
et des visites (lot 74) ; la page et l'assistant de reprise (lot 71).

---

## 2. Exigences et constats traités

| Élément des maquettes | Exigences du cahier des charges | Constats et décisions |
| --- | --- | --- |
| Accueil vide, une seule action (page 13) | PAR-01, HUB-08, UX-08, UX-04 | C-15, C-69, P-05 ; D6, R3, M12 |
| Accueil rempli, ordre des blocs (page 13) | HUB-08 (« tri par urgence »), UX-01, PAR-03 (« en trente secondes ») | C-18, C-20 ; A5, A6 ; M15 |
| Au lendemain d'une reprise (page 13) | HUB-08, HUB-14 | C-15, C-53, C-55 ; P-01 ; R9 (avec le lot 71f) |
| La ligne allégée, le panneau sur place, le contact (page 14) | HUB-08 (« chaque ligne mène à l'action en un clic »), UX-01, UX-13 | C-16, C-19, C-21 ; P-10 à P-12 ; A2, A3, A4 ; M3, M4 |
| Les compteurs (page 14) | UX-01, HUB-08 | C-20, P-07 ; A1 |
| La vue d'agence (page 14) | PAR-10 (« charge par personne »), HUB-03, EVT-06 | C-14, C-32 ; P-13 ; A7 |
| En-tête de fiche, menu « ⋯ » (page 15) | EVT-02 (« les trois actions les plus urgentes visibles sans défiler sur un écran de 13 pouces »), patrons d'interface (« Cockpit : en-tête nom, date, compte à rebours, statut »), UX-06 | C-22, C-82 (en partie) ; P-09 ; E4 ; D10 |
| Onglets, « Plus ▾ », barre fine, téléphone (page 15) | Patrons d'interface (onglets du cockpit), UX-05 | C-23, C-80 ; E3, E6 |
| La frise (page 15) | EVT-05, UX-06, UX-07 | C-27, C-25 ; P-17 ; E1, E2 ; M6 |
| Une seule suite (page 16) | UX-01, UX-06, EVT-02 (« prochaine action, échéances des quatorze jours ») | C-24, C-55, C-20 ; P-05, P-08 ; E9 |
| La Synthèse en cinq blocs (page 16) | EVT-02, EVT-03, EVT-06 | C-28 ; P-09, P-15 |
| Modifier les informations (page 16) | EVT-03, EVT-05, UX-09 | C-26 ; D7, M1 ; E5 |
| La liste des évènements (page 17) | EVT-07 (« deux évènements le même jour sont signalés »), UX-12 | C-29, C-14, C-81 ; P-08, P-21 ; E7, E8 ; M8 |
| Le programme (page 17) | CHR-06, CHR-07, CHR-08, CHR-09 | C-30, C-22 ; P-10 ; D5 ; R11, R12, R13, R15 ; E6 |

---

## 3. L'app d'aujourd'hui, en bref

Lu dans le code (`origin/main`, `2342f79e`) ; numéros de ligne indicatifs.

- **Accueil** (`app/page.tsx:126-188`) : en-tête avec `attentionCount` ; « Reprendre le questionnaire » ;
  bandeau fiche entreprise (`:137-141`) ; `NamesPrompt` (70a) ; plafond d'e-mails ; rappels arrêtés ;
  alertes RGPD ; `UndoTaskNotice` ; `UnavailableNotice` ; `TodayFirst` ; calendrier (`:165-180`) ;
  `TodayRest` (« Ensuite ») ; `RiskSection` ; `OnboardingChecklist` ; `MyEvents` ; `PageTour`.
- **Rang des lignes** (`lib/today/rank.ts`) : `TODAY_HORIZON_DAYS = 14` (`:11`) ; `groupOf` (`:112-119`)
  range en « en retard », « aujourd'hui », « attente » (acteur autre que soi), « à venir » ; `sortGroup`
  (`:122-133`) ; `attentionCount` (`rankToday`, `:135-150`) compte tout sauf « à venir », comme
  `attentionByEvent`. **C'est le « 6 points pour sept lignes » de C-20.**
- **Parties** (`lib/today/parts.ts`) : `HOME_FIRST_COUNT = 7` (`:9`), six natures, `todayParts`
  (`:70-81`) ; le titre d'une partie compte tous les éléments de sa nature, même non montrés.
- **Sources** (`lib/today/load.ts`) : `loadTodayItems` (`:617-660`) réunit les tâches, décisions,
  prestataires sans contrat, briefs, clôtures, conflits, relances de prospects (`eventItems`, `:118`),
  paiements et relances de devis (`quoteItems`, `:417`), paiements aux prestataires (`budgetItems`,
  `:483`), prestataires (`:519`), rendez-vous (`:579`), messages préparés (`:666`). Le type
  `TodayItem` (`rank.ts:70-84`) **n'a aucun champ de contact** ; pour un prestataire, seul son nom.
- **Ligne** (`app/accueil/today-view.tsx`, `TodayItemLine:78-123`) : titre-lien vers l'objet (une
  tâche ouvre `?onglet=retroplanning&tache=` dans la fiche), nom du mariage en texte, quatre actions
  possibles (« Fait », « Fait » hors évènement, « Noter une relance », « Ouvrir »). `MyEvents`
  (`:190-227`) dit « N points » ou « À jour ».
- **Visibilité** (`lib/event-visibility.ts`) : `visibleEventScope` (`:17`) et `withinScope` (`:25`,
  garde les lignes sans évènement), appliqués à l'accueil pour le rôle `member` (`page.tsx:95-98`).
  **`RiskSection` et `loadRiskRadar` ne sont pas filtrés** (ils voient tous les évènements ; ce lot le
  corrige, § 5.1).
- **« Pour bien démarrer »** (`app/accueil/onboarding-checklist.tsx`, `lib/onboarding/checklist.ts`) :
  deux marches (`essentials`, `first_vendor`), disparaît une fois fini ; **ne lit pas**
  `hub.users.first_steps_hidden`, qui existe (`packages/db/src/schema/hub.ts:106`, `hideFirstSteps`
  dans `modules/hub/service.ts:1288`) mais qu'aucun écran n'écrit. La réponse « Que voulez-vous
  remplacer ? » est gardée par organisation (`organization_profiles.replaced_tools`, `hub.ts:351`).
- **Liste** (`app/events/page.tsx`) : filtres recherche, statut, source, année ; onglets À venir,
  Terminés, Archivés ; colonnes clients, date (avec « même jour que… »), statut, lieu ; vues Liste,
  Colonnes, Calendrier (`events-header.tsx:12-16`) ; « Réglages », « Importer », `NewEventMenu` ;
  `MonthlyLoad` sous la liste. `listEvents` (`modules/events/service.ts:632`) **ne rend aucun compte de
  tâches** ; `lib/task-counts.ts` compte pour toute l'organisation.
- **Fiche, en-tête** (`app/events/[id]/page.tsx`, `PageHeader:578-648`) : date, compte à rebours, lieu,
  source, formulaire de type ; « Messages », « Écrire au client », « Voir comme … », « Jour J »
  (`isDayOfOpen`, dès qu'un évènement signé a une date). Onglets (`:531-546`) : `apercu`, `budget`
  (« 6/9 »), `retroplanning` (« N en retard »), `programme`, `devis` (nombre), `maries`, `documents`
  (nombre), `invites`. La clé `retroplanning` est renommée `taches` au paquet 70c.
- **Frise** (`change-status-form.tsx`) : cinq étapes (`STEPS:23`), ronds cliquables sauf « Jour J »
  (`CLICKABLE:24`) ; Reporter et Annuler (niveau 2 depuis le 70b) **dans la frise** ; « Rétablir » pour
  un annulé (`:127-139`). Règles dans `modules/events/lifecycle.ts` (`MANUAL_STATUSES`, `canSetStatus`,
  `eventPhase`, `closingDue`, `canPostpone`). L'automatisation « Contrat signé, puis évènement
  confirmé » (`quote_signed_confirm_event`, lot 53) confirme déjà une option à la signature d'un devis.
  **Aucune date de signature n'est gardée** : `event_status_history.changed_at` dit quand le statut a
  été posé dans Symbola, pas quand le contrat a été signé.
- **Synthèse** (`page.tsx:777-930`, `cockpit.tsx`) : prochaine action et deux suivantes (avec
  « Reporter »), `NextStepBanner` (`next-step.ts`, quatre étapes : devis, rétroplanning, programme,
  liens des mariés), santé (tuiles), 14 prochains jours, `EventTeamCard` (des e-mails, pas des noms),
  `EventBusyCard`, fiche d'identité (avec `VenueCapacityNotice`), temps forts, bilan du lendemain,
  `ImportedFields`, simulation du budget, rendez-vous, demande du prospect, échanges, fil.
  `EventCockpit` charge `loadTodayItems` de toute l'organisation puis filtre l'évènement (`:62-66`).
- **Modifier les informations** (`?modifier=infos`, `SidePanel:862-876`) : six formulaires
  (`EventDateForm`, `TimeZoneForm`, `WantedBudgetForm`, `VenueForm`, `EventIdentityForm`,
  `EventNotesForm`), chacun son bouton.
- **Programme** (`page.tsx:1324-1531`, `program-editor.tsx`, `program-actions.ts`) : sept commandes en
  tête (Importer, Réglages, Diffuser vN, Prévenir, deux PDF, Agenda) ; versions repliées ; « Appliquer un
  modèle » ; chevauchements par intervenant ; « Ajouter une séquence » en bas (`program-editor.tsx:442`) ;
  « Modifier » et « Retirer » par ligne ; retrait d'une séquence enregistrée avec « Annuler » 10 s
  (`program-actions.ts:179`) ; décalage des suivantes (`program-shift.tsx`) ; barre « Enregistrer le
  programme » (`:455-460`) ; lieux, contacts du jour J, rappel du jour J.

---

## 4. Ce qui touche les données, les contrats et les événements

Dernière migration de `main` : **0217** ; le lot 71 réserve 0218 à 0223 ; ce lot commence à **0224**
(numéros indicatifs, à reprendre au moment du code). Chaque migration a son retour arrière dans
`packages/db/drizzle-rollback/` (ADR 0036) et ne touche que le schéma de son module (DAT-09).

### 4.1 Deux migrations

| N° | Fichier | Ce qu'elle fait | Pourquoi |
| --- | --- | --- | --- |
| 0224 | `0224_lot72a_events_status_effective_date.sql` | Ajoute `events.event_status_history.effective_on date` (nullable). Rempli par « Le contrat est signé… » (la date choisie, au plus aujourd'hui) et par le passage à « Annulé » (le jour) ; nul pour les lignes d'avant, qui se lisent alors à `changed_at` dans le fuseau de l'évènement. Aucune étape de données | E2 : « Signé le » peut être antérieur au jour (la planner avait signé sur papier) ; la frise dit « Signé, en préparation depuis le 2 avr. ». Le lot 71 ajoute `date_known` à la même table (0220) : colonnes distinctes, aucun conflit |
| 0225 | `0225_lot72a_events_drop_in_preparation.sql` | **Retire le statut « En préparation »** (J1, tranchée le 27/11). Étape de données : `events.events.status`, `postponed_from_status` et `events.event_status_history.from_status` / `to_status` passent de `in_preparation` à `confirmed` ; puis l'énumération `events.event_status` est recréée sans la valeur (PostgreSQL ne sait pas retirer une valeur : nouveau type, colonnes converties, ancien type supprimé). Retour arrière : recrée la valeur dans l'énumération ; les lignes converties restent « Confirmé » (aucune donnée réelle concernée : rien en production, staging remis à zéro au besoin) | E1 : une seule étape « Signé, en préparation » ; aucune règle de l'app ne distinguait les deux statuts. Un seul statut en base, un seul à l'écran : plus de correspondance à tenir entre les deux |

**Ce qui ne demande pas de migration** (décisions J3, J4, J5) :

- « Masquer » de « Pour bien démarrer » écrit `hub.users.first_steps_hidden` (existant, par personne,
  `hideFirstSteps`), par le service du hub.
- La bascule « Moi · L'agence » se garde dans l'adresse (`?vue=agence`) et un cookie de l'appareil,
  comme `NAMES_PROMPT_COOKIE` (J4).
- Les comptes par évènement (tâches faites, en retard, plus ancien retard) et par personne se calculent
  par des requêtes groupées du module `events` (index existants `(organization_id, event_id)` ; un index
  `(organization_id, assignee_user_id)` vient de 0211), mesurées au § 5.1.

### 4.2 Contrats (`packages/contracts`)

Changements **compatibles** (ajouts) :

- `today.ts` (nouveau, ou dans le contrat actuel du hub) : une ligne d'accueil gagne `contact`
  (`{ name, phone | null, email | null }`, rempli seulement quand un tiers est attendu) et `nature`
  `watch` (« À regarder », une alerte du radar) ; le compte rend `points`, `late`, et par partie
  `shown` et `total` ; les constantes d'affichage `TODAY_HORIZON_DAYS = 14`, `HOME_FIRST_COUNT = 7`,
  `DAY_OF_HEADER_DAYS = 7` (J9) y sont exportées ;
- `events/service-contract.ts` : `EventSummary` gagne `taskProgress` (`{ done, total, late }`) et
  `sameDayCount` ; la ligne d'historique de statut gagne `effectiveOn` ; une nouvelle fonction
  `listAgencyOverview` rend `{ byPerson[], byEvent[] }` (§ 5.3) ;
- `EVENT_DISPLAY_STEPS` : les quatre étapes de la frise et la règle qui associe un statut à son étape
  (`option` → demande ; `confirmed` → signé ; phase `day_of` → Jour J ; `closed` →
  clôturé).

**Un changement incompatible, accordé par J1** : `EventStatus` (`packages/contracts/src/events/events.ts`) perd `in_preparation` ; tout le code qui le lit (27 fichiers, dont `lifecycle.ts`, `next-step.ts`, `event-status.ts`, `closing.ts`, `privacy-retention.ts`, `day-of-view.ts`, le jeu de recette `lib/recette/load.ts`, les synonymes d'import `import-synonyms.json` où « En préparation » mène désormais à `confirmed`, `import/fields.ts`, deux tests e2e) est mis à jour dans le même paquet. Le reste est compatible.

### 4.3 Événements internes (`domain_events`)

**Aucun nouvel événement.** « Le contrat est signé… » passe par `changeEventStatus`, qui écrit déjà
l'historique et publie ce qu'il publie aujourd'hui ; la date de signature va dans la même transaction.

### 4.4 Droits et isolation (SEC-10 à SEC-13)

- La vue « L'agence » suit le réglage de visibilité du lot 52 : une Planner qui ne voit que les
  évènements de son équipe ne voit qu'eux, par personne comme par évènement ; une ligne « par personne »
  ne compte que les tâches des évènements visibles (et les tâches hors évènement qu'elle voit, A20 du
  lot 70). Aucun nombre ne trahit un évènement invisible.
- La bascule n'existe que si l'organisation a plus d'un membre actif ; `?vue=agence` sur un espace d'une
  personne rend la vue « Moi » sans erreur.
- Le contact d'une ligne (nom, téléphone, e-mail) n'est lu que par la planner connectée, depuis la fiche
  du prestataire ou le contact des mariés de **la même organisation** ; il n'apparaît dans aucun portail,
  aucune notification, aucun journal (SEC-20).
- « Le contrat est signé… » refuse une date future, une date antérieure à la création de l'évènement
  moins un an (J2), et un évènement d'une autre organisation (même réponse qu'un objet inexistant).
- **Correctif de sécurité au passage** : le radar de l'accueil (`loadRiskRadar`) n'est pas filtré par la
  visibilité du lot 52 ; ses alertes devenant des lignes d'accueil, elles passent par `withinScope` comme
  les autres (§ 5.1, critère 7).
- L'Admin d'exploitation n'a accès à aucune de ces données (SEC-09).

### 4.5 Registre RGPD (`privacy.registry.yaml`)

| Table | Champ | Catégorie | Règle |
| --- | --- | --- | --- |
| `events.event_status_history` | `effective_on` | date technique | Aucune donnée personnelle. Suit la ligne d'historique (exportée, effacée avec l'évènement) |

Aucune nouvelle donnée personnelle n'est stockée : le contact d'une ligne d'accueil est lu à l'affichage
depuis les champs déjà déclarés (`vendors.contact_name`, `vendors.phone`, `hub.contacts.phone`,
`email`) ; le cookie de la bascule ne porte que `moi` ou `agence`.

---

## 5. Les paquets en détail

Pour chaque paquet : l'écart entre l'app et la maquette, fichier par fichier ; les critères
d'acceptation (chacun devient un `it`) ; les tests. Les `describe` portent l'identifiant de l'exigence
(`describe('HUB-08 — Un point est une ligne', …)`). Chaque paquet passe la liste de contrôle du § 4.1
de `13-design-system.md` à 1 440, 911 × 512 et 375 px, avec l'utilitaire de S14 s'il existe.

### 5.1 Paquet 72a — Les règles d'« Aujourd'hui » et les comptes

Le socle : tout ce qui se calcule, sans changer la forme des écrans (ils lisent les nouveaux nombres).

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `lib/today/rank.ts` (`groupOf`, `sortGroup`, `rankToday`) | Quatre groupes ; l'attente d'un tiers passe avant l'à-venir ; `attentionCount` sans l'à-venir | Deux rangs (A2) : **les retards** (le plus ancien en tête), **puis tout le reste par date**, quel que soit qui agit ; une attente sans échéance se range à sa date de début ; une alerte du radar (sans date) se range au jour même. `points` = toutes les lignes de l'horizon (A1) ; `late` = celles en retard ; `pointsByEvent` et `lateByEvent` sur la même règle |
| `lib/today/parts.ts` (`todayParts`) | Le titre d'une partie compte tous les éléments de sa nature ; « Ensuite » à part | Chaque partie rend `shown` et `total` ; la carte garde sept lignes au plus (M15), découpées par nature, l'ordre des parties suivant leur première ligne ; le reste (« 4 autres points ») est rendu à part pour « Tout afficher ». Une nouvelle nature `watch` (« À regarder ») |
| `lib/today/load.ts`, `lib/risk-radar/load.ts` | Le radar est une section à part, non filtrée par la visibilité | Chaque alerte du radar devient une ligne `watch` : sa règle en une phrase (les textes `RiskRadar.*` existants), « Agir » vers l'objet en cause ; filtrée par `withinScope` ; radar coupé : aucune ligne |
| `lib/today/load.ts` (lignes d'attente) | Pour un prestataire, son nom seulement | `contact` rempli pour une ligne dont `actor.kind` est `client` ou `vendor` : pour les mariés, le premier client de l'évènement (`event_clients`, son contact du hub : nom, téléphone, e-mail) ; pour un prestataire, `contact_name` et `phone` de sa fiche ; sans téléphone, l'e-mail ; sans rien, aucun contact (aucun « — »). Lu par les services `events` et `vendors`, en une requête par source, jamais par ligne |
| Portée « Moi » (nouveau, `lib/today/scope.ts`) | Tous les évènements visibles | Dans une organisation de plus d'un membre actif, « Moi » garde : les tâches confiées à la personne (`assignee_user_id`, 70a) ; les lignes des évènements dont elle est planner principale (`event_team_members.role = 'lead'`) qui ne sont pas confiées à une collègue (tâches des mariés ou d'un prestataire, paiements, relances, décisions, alertes) ; les lignes des évènements **sans planner principal** (J3) ; les tâches hors évènement qui lui sont confiées ou n'ont personne. Une personne seule : tout |
| `modules/events/service.ts`, `repository.ts` | `listEvents` sans compte ; `lib/task-counts.ts` par organisation | `taskProgressByEvent(organizationId, eventIds)` : une requête groupée (faites, total, en retard selon l'état d'échéance unique de 70a, `due-state.ts`), hors tâches supprimées ; `listEvents` le joint pour la liste. `listAgencyOverview` (§ 5.3) |
| `modules/events/lifecycle.ts`, `packages/db/src/schema/events.ts` | Six statuts ; cinq étapes affichées ; `MANUAL_STATUSES` comprend `in_preparation` | Cinq statuts (`in_preparation` retiré, 0225, J1) ; `displayStep(status, phase)` (quatre étapes) ; `LIVE_STATUSES` = `confirmed` ; `MANUAL_STATUSES` réduit à ce que la frise propose (`option` → `confirmed` par « Le contrat est signé… », `closed` par « Clôturer ») |
| `modules/events/service.ts` (`changeEventStatus`) | Pas de date de signature | `markContractSigned(organizationId, eventId, signedOn)` : passe une option en `confirmed`, écrit `effective_on` (0224) ; l'automatisation `quote_signed_confirm_event` écrit la date de signature du devis (`quote_signers.signed_at`) |
| `app/events/[id]/next-step.ts` | Quatre étapes en bandeau | Les mêmes règles, rendues comme une **ligne de la suite** (`nature: step`) : « Préparer le programme du baptême · Le baptême est dans 39 jours et son programme est vide · Ouvrir le programme » ; aucune règle ne change (programme à trois mois, liens des mariés) |

**Critères d'acceptation**

1. Le compte du haut est la somme des lignes de la carte et de « Tout afficher » ; chaque partie montre
   « N sur M » quand elle n'est pas entière ; « Mes évènements » répartit le même total (horloge
   simulée, jeu de l'Atelier Roussel : 7 = 5 + 1 + 1 ; Nadia : 11 = 7 + 4).
2. « dont N en retard » compte les lignes en retard de toutes natures (tâches et paiements) ; la
   pastille du menu « Tâches » ne compte que les tâches et le dit (« 2 en retard »).
3. Les retards viennent d'abord, du plus ancien au plus récent ; puis tout le reste par date ;
   « Valider le faire-part » (3 déc., attend les mariés) vient après « Rappeler la mère de la mariée »
   (26 nov., vous). Horloge simulée : veille, jour même, lendemain, quatorzième et quinzième jour,
   passage à l'heure d'été (dates en `Europe/Paris`, puis dans le fuseau de l'évènement).
4. Une ligne qui attend un prestataire porte son contact et son téléphone ; une ligne qui attend les
   mariés, ceux du premier client ; sans téléphone, l'e-mail ; sans rien, rien.
5. « Moi » ne montre à Bastien ni les tâches confiées à Camille, ni les paiements d'un mariage dont
   Camille est planner principale ; il lui montre ceux d'un mariage sans planner principal.
6. Une alerte du radar est une ligne « À regarder », comptée dans les points ; radar coupé ou sans
   alerte, aucune ligne et aucun texte.
7. **Isolation** : une Planner restreinte (lot 52) ne voit ni ligne, ni alerte du radar, ni nombre d'un
   évènement hors de son équipe ; l'organisation A ne lit ni contact ni compte de B.
8. « Le contrat est signé… » au 2 avril pose « Confirmé » et la date du 2 avril ; une date future est
   refusée sous le champ. Après 0225, aucun évènement ni aucune ligne d'historique n'est en
   `in_preparation` ; un import qui lit « En préparation » crée un évènement « Confirmé ».
9. Le compte des tâches par évènement d'une agence de 40 évènements et 1 600 tâches tient sous le seuil
   de l'ADR 0115 (mesuré comme lui).

**Tests** : Vitest (`rank.test.ts` et `parts.test.ts` réécrits : ordre, comptes, `shown`/`total` ;
`scope.test.ts` ; `display-step.test.ts`, une ligne par statut et phase) ; intégration
(`today-72a.integration.test.ts` : contact par source, portée « Moi », radar filtré ; `markContractSigned`
0224 et 0225, leurs retours arrière, la conversion des lignes `in_preparation`) ; isolation et abus (critère 7 ; `?vue=agence` d'une autre organisation ;
date de signature d'un évènement de B) ; performance (critère 9).

### 5.2 Paquet 72b — L'écran « Aujourd'hui » (page 13 et le haut de la page 14)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/page.tsx` (ordre des blocs, `:126-188`) | Treize blocs ; bandeau fiche entreprise et « Risques » avant ou après les urgences ; « Pour bien démarrer » au milieu | **Vide** (aucun évènement, hors exemple) : l'état vide seul (gabarit de `DESIGN.md`) : « Commencez par votre premier mariage », sa phrase, **un** bouton plein, l'autre voie en ligne à part, puis « Pour bien démarrer · 0 sur N » ; ni calendrier, ni « Mes évènements », ni pastille. Le bouton suit `replaced_tools` (R3, I5 du lot 71) : un tableur ou un logiciel → « Reprendre un mariage » (vers `/reprise`, lot 71b) et « Un mariage qui commence ? Nouvel évènement » ; sinon « Nouvel évènement » et « Vous suivez déjà vos mariages dans un autre logiciel ou un tableur ? Reprendre ses fichiers ». **Rempli** : titre, date et « N évènements en cours », le compte (72a), la bascule (72c) ; puis seulement les alertes qui bloquent (plafond, rappels arrêtés, RGPD), « Reprendre le questionnaire », le message de retour et « Une partie des urgences ne répond pas » ; puis « Reprises en cours » (lot 71f) ; « À traiter en premier » ; « N tâches faites aujourd'hui · Les revoir » (70c) ; « Mes évènements » ; le calendrier (A5) ; la ligne « Pour bien démarrer » en bas. Le bandeau fiche entreprise et `RiskSection` sont retirés de l'accueil |
| `app/accueil/today-view.tsx` (`TodayFirst`, `TodayRest`, `TodayItemLine`, `MyEvents`) | Parties comptées par nature ; « Ensuite » sous le calendrier ; ligne à quatre actions dont « Ouvrir » | Carte « À traiter en premier · 7 points » (ou « 7 sur 11 ») ; chaque partie « Tâches 4 sur 7 · Voir les 7 dans Tâches » ; « 4 autres points d'ici 14 jours · Tout afficher » ouvre le reste **dans la carte** (sans recharger, l'adresse garde `?tout=1`) ; `TodayRest` disparaît. Ligne : la **forme allégée** de la ligne type (`app/ui/task-row.tsx`, forme `today`, paquet 70c) pour les tâches, la même anatomie pour les autres natures (titre-lien, contact sous le titre, nom du mariage en lien séparé, échéance et état en mots, « qui agit », une action rapide d'une seule taille : « Fait », « Noter une relance » ou rien pour un paiement — J6) ; « Ouvrir » retiré. `MyEvents` : « 6 points, dont 2 en retard », « 1 point », « Pas encore de tâches » (mariage signé ou repris sans tâche), « À jour » ; l'étiquette « Repris » (lot 71f) ; « 4 en cours · Tous les évènements » |
| Ce que le titre ouvre | Une tâche ouvre la fiche, onglet Rétroplanning | Une tâche ouvre **son panneau par-dessus « Aujourd'hui »** (panneau du 70c, par `?tache=<id>` sur l'accueil) ; « Fermer » rend la même ligne au même défilement ; sur téléphone, page entière « ← Aujourd'hui ». Une relance ouvre la fiche du poste ; un paiement, son échéance (inchangé) |
| Le contact | — | Sous le titre, en `ink-muted` : « Karim Haddad · 06 00 00 41 27 » ; le téléphone en lien `tel:` de 44 px sur téléphone, en texte à l'ordinateur ; l'e-mail en `mailto:` |
| `app/accueil/onboarding-checklist.tsx`, `lib/onboarding/checklist.ts` | Carte au milieu ; ne lit pas `first_steps_hidden` | Ligne en bas : « Pour bien démarrer · 2 sur 3 · reste : compléter votre fiche entreprise · Compléter · Masquer » ; « Masquer » appelle `hideFirstSteps` (message de retour avec « Annuler ») ; masquée, plus rien sur l'accueil (la liste reste dans « Aide », lot 74). Les marches : J5 |
| « Au lendemain d'une reprise » | Douze « contrats à faire signer » | « Aucun point à traiter d'ici 14 jours : vos deux mariages repris n'ont pas encore de tâches » ; la carte dit « 0 point » et « Rien d'ici 14 jours. Les échéances arriveront avec les tâches : reprendre la liste de votre tableur ou partir d'un modèle, depuis chaque mariage » (liens vers l'onglet « Tâches » de chaque mariage). Aucune ligne née d'un import : règle du lot 71a |
| Téléphone (`globals.css`) | — | Haut de l'écran : titre, date courte, « 7 points d'ici 14 jours, dont 2 en retard » ; ligne sur trois étages (titre ; mariage · qui ; échéance · date ; contact) ; « Fait » de 44 px ; aucun défilement de côté |

**Critères d'acceptation**

1. Dans un espace neuf, l'écran a un seul bouton plein, celui que la réponse à l'assistant désigne,
   et l'autre voie en ligne ; aucun calendrier, aucune pastille, aucun « tout est à jour ».
2. Dans un espace rempli, rien ne s'affiche entre le compte et « À traiter en premier », sauf une alerte
   qui bloque ; le bandeau fiche entreprise et « Risques » n'existent plus sur l'accueil.
3. Le titre d'une tâche ouvre son panneau sur l'accueil ; « Fermer » rend la ligne à la même place
   (mesure du défilement) ; le nom du mariage mène à la fiche.
4. « Tout afficher » allonge la carte sur place, et la somme des lignes montrées égale le compte du haut.
5. « Masquer » retire « Pour bien démarrer » pour cette personne, sur tous ses appareils, pas pour ses
   collègues ; « Annuler » le rend.
6. Au lendemain de deux reprises, l'accueil a « Reprises en cours », « 0 point » avec sa raison, et
   « Pas encore de tâches » dans « Mes évènements ».
7. À 375 px : aucune commande sous 44 px, aucun défilement de côté, la première ligne arrive à 260 px au
   plus ; un toucher sur le téléphone ouvre l'appel.

**Tests** : Playwright `lot-72b-aujourdhui.spec.ts` à 1 440 et 375 px (vide « zéro », vide « tableur »,
rempli, repris, plus de sept points), axe-core sur chaque état ; tests mis à jour :
`hub-08-sc-03-lundi-matin`, `chr-02-03-hub-08-lot-63d-taches`, `hub-15-gc-02-notifications-radar`
(le radar devient des lignes), `onb-01-02-onboarding`, `hub-09-10-demarrage`, `arc-07-combinaisons-modules`
(un module non souscrit ne laisse aucune partie vide), `lot-69-corrections-audit-ux`.

### 5.3 Paquet 72c — « Moi · L'agence » (page 14, la vue d'agence)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/page.tsx`, nouveau `app/accueil/agency-view.tsx` | — | Bascule « Moi · L'agence » (`.segmented`, option active en encre, M8), seulement si l'organisation a plus d'un membre actif ; `?vue=agence`, et le dernier choix gardé par un cookie de l'appareil (J4). « Moi » : l'écran du 72b avec la portée « Moi » (72a). « L'agence » : « L'agence : 23 tâches en retard, dans 9 évènements » ; **Par personne** : une ligne par membre actif (initiales, prénom et nom, « (vous) »), En retard, Aujourd'hui, D'ici 14 jours, Évènements suivis (planner principal ou assistant), « Voir ses tâches » (vers `/taches?qui=<id>&grouper=evenement`, 70d) ; une dernière ligne « Attendu des mariés ou d'un prestataire · Voir » ; **Par évènement** : les évènements avec un retard (Évènement, Date, Planner principal, Tâches faites « 32 sur 42 » avec la barre d'avancement en encre, En retard, Plus ancien retard), triés par nombre de retards puis par date ; filtre « Planner principal » ; « 31 évènements à jour · Afficher » |
| `modules/events/service.ts` | — | `listAgencyOverview(organizationId, scope, today)` : deux requêtes groupées (par `assignee_user_id`, par `event_id`), état d'échéance unique, hors démonstration, hors évènements terminés ; les noms viennent de `listTeam` (`packages/auth`, prénom et nom de 70a) |
| Téléphone | — | « Par personne · en retard · 14 jours » en lignes courtes (« Nadia Belkacem 3 · 6 »), quatre personnes puis « Les 6 personnes » ; « Par évènement » en cartes (nom, nombre de retards, date et planner, « 32 sur 42 tâches ») |

**Critères d'acceptation**

1. La bascule n'existe pas pour une planner seule ; elle existe dès qu'un second membre est actif.
2. La somme de la colonne « En retard » (lignes de personnes et ligne « Attendu… ») égale le nombre du
   titre ; chaque ligne d'évènement dit les mêmes nombres que la colonne « Tâches faites » de la liste
   (72f).
3. « Voir ses tâches » ouvre « Tâches » filtré sur la personne et groupé par évènement.
4. Isolation : une Planner restreinte ne voit que ses évènements et leurs nombres ; une organisation
   ne voit jamais un membre d'une autre.
5. 40 évènements tiennent en un écran et demi à 1 440 px (évènements à jour repliés) ; l'écran se
   charge sous le seuil de l'ADR 0115 pour une agence de 6 personnes et 1 600 tâches.

**Tests** : Vitest (tri, repli, sommes) ; intégration (requêtes groupées, portée, visibilité) ;
Playwright `lot-72c-agence.spec.ts` sur le jeu « Maison Belkacem » (6 personnes, 40 évènements) à 1 440
et 375 px, axe-core ; abus : `?vue=agence` d'un membre restreint, d'une autre organisation.

### 5.4 Paquet 72d — L'en-tête de la fiche, les onglets et la frise (page 15)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/events/[id]/page.tsx` (`PageHeader:578-648`) | Sous-titre avec source et formulaire de type ; quatre boutons ; Reporter et Annuler dans la frise | **En-tête d'un objet** de `DESIGN.md` : « ← Évènements », le nom (`title`), une ligne de faits (type, date en toutes lettres, compte à rebours, lieu et ville), la frise sur une ligne, à droite **une** action (« Écrire aux mariés » — le mot des clients du type d'évènement, J10 ; à partir de J-7 et jusqu'au lendemain, « Ouvrir le Jour J » prend sa place) et le menu « ⋯ » : « Écrire aux mariés » (quand « Ouvrir le Jour J » a pris sa place), « Messages — Les fils de discussion de ce mariage », « Voir comme Léa Martin — Son espace, tel qu'elle le voit » (si un lien est actif), « Ouvrir le Jour J — L'écran du terrain » (dès qu'il est ouvert, `isDayOfOpen`), « Changer le type… », puis après un filet « Reporter l'évènement… » et « Annuler l'évènement… » (rouge, en dernier, S8). Source et type quittent l'en-tête (« Informations », 72e). Cible mesurée : 130 px du retour au bas de la frise, 191 px onglets compris, à 1 440 px |
| Onglets (`:531-546`, `tabs`) | Libellés « Programme du jour J » ; nombres « 6/9 », « N en retard » ; onglets coupés à « Documen » | L'ouvert en gras, souligné de 3 px, `aria-selected` ; nombres : J11 ; « Programme ». À moins de largeur que les huit (mesure à l'affichage, pas un point de rupture fixe), ceux qui ne tiennent pas passent dans « Plus ▾ », l'onglet ouvert toujours visible ; **barre fine** collée sous la barre du haut quand l'en-tête sort de l'écran : nom, date, statut, onglets et menu « ⋯ » (pas l'action) ; changer d'onglet garde la barre en place (ancre, pas de retour en haut) |
| Téléphone | 800 px d'en-tête, deux onglets visibles | Nom, date courte et compte à rebours, lieu, « Signé, en préparation · étape 2 sur 4 · Les étapes » (frise complète en panneau du bas) ; pas de bouton : tout au menu « ⋯ » (panneau du bas, « Écrire aux mariés » en tête) ; onglets à 224 px, la barre défile de côté seule, flèche de 44 px, l'onglet ouvert amené dans le cadre ; noms courts (« Budget », « Devis ») |
| `change-status-form.tsx` | Cinq ronds cliquables ; Reporter et Annuler dans la frise | **Frise en lecture**, quatre étapes (J1) : rond plein et coche pour une étape franchie avec sa date (« ✓ Une demande en cours, 12 mars »), anneau et gras pour l'étape en cours (« depuis le 2 avr. », date de `effective_on` sinon `changed_at`), rond bordé pour la suite. Au bout, le **bouton de l'étape** quand elle se franchit à la main : pour une demande, « Le contrat est signé… » ouvre juste dessous « Le contrat d'Inès & Paul est signé ? », la phrase de ce qui suit, « Signé le » (aujourd'hui par défaut, une date passée possible), « Garder en demande » et « Passer en signé » ; le lendemain du jour J, « Clôturer l'évènement… » ouvre la liste de clôture (lot 58). « Jour J » vient seul. **Reporté** : « Reporté · le 12 juin 2027 n'est plus la date · Nouvelle date à fixer ; les tâches attendent » et « Fixer la nouvelle date… » (la confirmation actuelle, `page.tsx:708-730`, qui liste les tâches qui tomberaient dans le passé). **Annulé** : « Annulé le 25 nov. · motif : budget » et « Rétablir l'évènement… » (niveau 2, texte calé sur ce que fait l'app, J12) ; « À vérifier : 2 factures émises. Un avoir vous est proposé pour chacune · Voir les factures ». **Archivé** : « Archivé · lecture seule · Ouvrir la clôture ». Teintes neutres ; l'état se lit au mot |
| « Changer le type… » | Formulaire dans l'en-tête | Fenêtre courte (un choix, « Enregistrer ») depuis le menu ; même règle qu'aujourd'hui |

**Critères d'acceptation**

1. À 1 440 px, l'en-tête tient en 200 px (mesuré : 130 px sans les onglets), avec un seul bouton et un
   menu ; le statut est dit une fois.
2. À 911 × 512, l'action de l'en-tête et la première ligne de la Synthèse sont dans le premier écran ;
   aucun onglet coupé en plein mot ; l'onglet ouvert est visible ; la barre fine apparaît quand
   l'en-tête sort et garde l'onglet en changeant d'onglet.
3. À 375 px, les onglets sont à 224 px au plus du haut, l'onglet ouvert est visible, seul le ruban des
   onglets défile de côté ; toutes les cibles font 44 px.
4. « Ouvrir le Jour J » est l'action de l'en-tête de J-7 au lendemain inclus (horloge simulée : J-8,
   J-7, J, J+1, J+2, dans le fuseau de l'évènement) ; il est au menu dès que l'écran du jour J est
   ouvert.
5. Aucun rond de la frise ne réagit au clic ; « Le contrat est signé… » pose « Confirmé » à la date
   choisie, sans créer de tâche ; la question s'ouvre sous le bouton.
6. Reporter, Annuler, Rétablir, Fixer la nouvelle date sont des fenêtres de niveau 2 qui nomment
   l'évènement et proposent « Garder … » ; « Annuler l'évènement » est dernier du menu, à part.
7. Un évènement annulé, reporté ou archivé montre sa ligne d'état et sa seule suite, jamais la frise.

**Tests** : Vitest (choix de l'action selon la date et le statut ; étape affichée) ; Playwright
`lot-72d-entete-fiche.spec.ts` à **1 440, 911 × 512 et 375 px** (mesures de hauteur par script, comme au
contrôle de la note 09 § 5), axe-core sur l'en-tête, le menu, la frise, chaque fenêtre ; clavier (menu
« ⋯ » au clavier, « Plus ▾ », flèche des onglets) ; tests mis à jour : `lot-13-fiche`,
`ux-13-lot-62c-fiche-evenement`, `evt-05-cycle-de-vie`, `evt-06-renfort-jour-j`, `lot-70b-retours-danger-erreurs`,
`prd-evt-03` à `prd-evt-06` ; abus : « Le contrat est signé… » sur un évènement d'une autre organisation,
par un lien des mariés, par une Planner hors de l'équipe.

### 5.5 Paquet 72e — La suite, la Synthèse et « Modifier les informations » (page 16)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/events/[id]/cockpit.tsx`, `next-step.ts` | Prochaine action et deux suivantes avec « Reporter », `NextStepBanner`, santé en tuiles, 14 prochains jours | **Un bloc « suite »** en tête, dont la forme suit l'état : **demande** — « Prochaine action · Une demande en cours », « Envoyer le devis : Inès et Paul attendent votre proposition depuis le 2 nov. », leur demande en une phrase, « Préparer le devis » (bouton plein ; devis envoyé : sa relance) ; **signé sans tâches** — « Créer la liste des tâches de Chloé & Samuel », la phrase du rétroplanning, « Partir du rétroplanning » (bouton plein) et « Reprendre la liste de votre tableur » (lot 71) ; **en préparation** — « Prochaines actions · 6 points d'ici 14 jours, dont 2 en retard », les lignes de l'évènement à la ligne type (forme `event`, 70c), trois au plus, « 3 autres : … · Tout afficher » ; une étape en attente (programme, liens des mariés, simulation du budget à confirmer) y est une ligne avec son bouton ; sans rien : « Rien d'ici 14 jours, et aucune étape en attente. Prochaine échéance : « … », lun. 14 déc. · Les tâches » ; **repris** — le bloc « À compléter après la reprise » du lot 71f, tant qu'il reste un point ; **après le jour J** — « Clôturer l'évènement… ». Les lignes viennent de la même fonction que l'accueil (72a), restreinte à l'évènement, **toutes personnes confondues**, sans recharger toute l'organisation (`loadTodayItems` reçoit l'évènement, J13). Le bandeau `NextStepBanner` et le bloc des 14 jours disparaissent, sur la Synthèse comme au-dessus des autres onglets |
| Santé | Trois tuiles dans une carte, « Planning : Bon », « lignes pourvues » | « Où en est le mariage » : quatre lignes en mots — « Tâches 14 sur 20 · 2 en retard », « Budget 31 200,00 € engagés sur 40 000,00 € », « Prestataires 6 postes complets sur 9 · 1 contrat attendu » (mot de I7 du lot 71), « Décisions des mariés 1 en attente, depuis le 18 nov. » — et « Pourquoi ces nombres ? » (l'explication du lot 53) ; zéro tâche : « Pas encore de tâches : pas d'avis » (lot 71f) |
| `page.tsx` (`:777-930`), `team-card.tsx`, `busy-card.tsx` | Onze blocs ; « Planner principal : Aucun » ; plage occupée en carte | Deux colonnes sous la suite : à gauche « Où en est le mariage », « Temps forts · Gérer » (les mêmes formulaires), « Rendez-vous · Tous les rendez-vous » ; à droite, au-dessus, le **bilan du lendemain** après le jour J (« Télécharger »), puis **« Informations · Modifier les informations »** (Mariés, Invités — « À vérifier : » si la capacité du lieu est dépassée —, Lieux, Budget souhaité, Style, Type, Venu par, Agenda — l'ancienne plage occupée —, Équipe — prénoms (70a), « Camille (planner principale) · Bastien », masquée pour une planner seule —, Notes ; une valeur absente dit « non renseigné ») et le **fil d'activité · Tout le fil**. Tant que l'évènement est une demande : « Demande reçue » et « Échanges avec le prospect » restent, sous la suite. Gardés : le bandeau d'essai guidé au-dessus de la suite, l'exemple à supprimer, « Champs importés » pour les fiches d'avant le lot 71 (I8). Sur téléphone, une colonne dans le même ordre |
| `?modifier=infos`, `SidePanel` (`:862-876`), formulaires `task-forms.tsx`, `lifecycle-forms.tsx`, `client-contact-forms.tsx` | Six formulaires, six boutons | **Fenêtre longue** (`object-window`, 860 px) « Les informations de « Léa & Maxime » », cinq rubriques à gauche : **Date et lieux** (date : un champ pour une demande ; en lecture pour un évènement signé, « le contrat est signé : changer la date, c'est reporter le mariage · Reporter l'évènement… » ; lieu de réception, ville ; fuseau dit en mots, « Heure de Paris · Changer », ouvert à la demande ; agenda de l'équipe, la plage occupée), **Mariés** (J14), **Invités et budget** (invités prévus, budget souhaité), **Style et notes** (style, notes, notes confidentielles selon le droit actuel), **Type et origine** (type, « Venu par »). Un seul « Enregistrer » toujours visible, « Rubrique suivante : … » ; « Fermer » avec des changements demande « Fermer sans enregistrer ? » dans la fenêtre (règle de l'ADR du 70c) ; validation par Symbola (70b). Ouverte depuis « Informations » et le menu « ⋯ ». Sur téléphone, une page entière « ← Léa & Maxime ». Les six actions serveur sont réunies en une seule, transactionnelle (tout ou rien) |

**Critères d'acceptation**

1. Une demande sans devis, un signé sans tâches, un évènement en préparation, un repris, un évènement
   du lendemain : chacun montre la forme de suite de la table, et jamais « tout est à jour » quand une
   étape attend.
2. « 6 points d'ici 14 jours, dont 2 en retard » sur la fiche égale les lignes de cet évènement sur
   l'accueil de la personne qui voit tout (même horloge simulée).
3. La Synthèse a cinq blocs (six après le jour J avec le bilan) ; ni « Prochaine étape », ni « Les 14
   prochains jours », ni « Planner principal : Aucun » pour une planner seule.
4. « Modifier les informations » enregistre toutes les rubriques d'un coup ; une erreur dans une rubrique
   n'enregistre rien et mène au champ ; la date d'un évènement signé ne s'y modifie pas.
5. « Fermer » sans changement ferme ; avec des changements, la question s'affiche dans la fenêtre.
6. À 1 440 px, la suite et « Modifier les informations » sont dans le premier écran (EVT-02 : trois
   actions sans défiler sur un écran de 13 pouces, mesuré à 1 280 × 800).

**Tests** : Vitest (forme de la suite par état, en règle pure ; regroupement des rubriques) ;
intégration (enregistrement groupé transactionnel ; date en lecture pour un signé) ; Playwright
`lot-72e-synthese.spec.ts` à 1 440, 911 × 512 et 375 px, les cinq états, axe-core sur la Synthèse et
la fenêtre ; tests mis à jour : `evt-03-chr-02-fiche-taches` (`modifier=infos`), `lot-13-fiche`,
`prd-evt-03` ; abus : la fenêtre d'un évènement de B, l'enregistrement par une Planner hors équipe, les
notes confidentielles sans le droit.

### 5.6 Paquet 72f — La liste des évènements (page 17, haut)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/events/page.tsx`, `events-header.tsx`, `new-event-menu.tsx` | « Nouveau », « Liste », « À venir · 4 » en aplats verts ; « Réglages » et « Importer » en boutons | En-tête « Évènements · 6 évènements à venir » ; bascule « Liste · Colonnes · Calendrier » en encre (M8) ; **« Nouvel évènement »** seul bouton plein (la fenêtre du 70e) ; menu « ⋯ » à côté : « Reprendre et importer » (le nom de I6 du lot 71), puis section « Réglages » (G14). Barre de filtres libellés de même hauteur : Rechercher (« Nom, lieu, client… »), Période (À venir · 6, Terminés · 12, Archivés, en encre), Statut (les quatre étapes affichées, plus Reporté et Annulé), **Venu par** (l'ancien « Source du prospect »), Origine (lot 71f), Année ; dans une agence, Planner principal |
| Colonnes | Mariés, Date (pastille ambrée « Même jour : … »), Statut, Lieu | **Évènement** (le nom en titre-lien, le type dessous, l'étiquette « Repris » du lot 71f) ; **Date** (date, « dans 39 jours », et « · 2 le même jour » en texte neutre) ; **Statut** (mots de la frise) ; **Tâches faites** (« 14 sur 20 · 2 en retard », retard en rouge avec son mot ; « Pas encore de tâches » ; « Demande : pas de tâches ») ; **Lieu** (« non renseigné » si vide) ; dans une agence, **Planner principal** à la place du lieu sous 1 280 px |
| `monthly-load.tsx`, vue Calendrier | Charge des douze mois sous la liste | Sous le calendrier de la vue « Calendrier », réduite aux mois qui ont un évènement (E8) |
| Téléphone | Première ligne à 835 px | « Évènements » ; « À venir · 6 · Terminés » et « Filtres » (panneau du bas, nombre de filtres actifs) ; une carte par évènement (nom, date et compte à rebours, statut, tâches faites) ; première ligne à 126 px |
| État vide | Gardé | Inchangé (il suit le gabarit) ; « Nouvel évènement » y reste seul bouton plein |

**Critères d'acceptation**

1. Un seul bouton plein visible ; « Importer » et « Réglages » sont au menu.
2. « Tâches faites » d'un évènement égale l'onglet « Tâches » de sa fiche et sa ligne de la vue d'agence.
3. Deux évènements le même jour disent « 2 le même jour » dans leur date, sans pastille ; trois disent
   « 3 le même jour » (EVT-07).
4. La charge des douze mois est dans la vue « Calendrier » et n'est plus sous la liste.
5. Les filtres et la vue restent en passant d'une vue à l'autre et au retour d'une fiche.
6. À 375 px, la première ligne est à 126 px au plus ; aucun défilement de côté.
7. La liste d'une agence de 200 évènements, avec leurs comptes de tâches, se charge sous le seuil de
   l'ADR 0115.

**Tests** : Vitest (« même jour » ; libellé de la colonne selon le cas) ; intégration (compte joint à
`listEvents`) ; performance (critère 7) ; Playwright `lot-72f-liste-evenements.spec.ts` à 1 440 et
375 px, axe-core ; tests mis à jour : `prd-evt-01-02-07`, `lot-63c-evenements-budget-documents`,
`aide-01-02-evenements`, `hub-03-planner`, `lot-16j-types-evenement`, `ux-08-13-hub-12-rgp-04-ecrans` ;
abus : filtres `venu-par`, `origine`, `planner` d'une autre organisation.

### 5.7 Paquet 72g — Le programme (page 17, bas)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `page.tsx` (`:1324-1531`, onglet `programme`) | Sept commandes en tête ; versions repliées ; « Appliquer un modèle » ; import replié | En tête « Programme · 3 journées · 21 moments · version des mariés partagée le 20 nov. » ; **« Ajouter un moment »** (secondaire), **« Partager… »** (la fenêtre de diffusion du lot 71e, qui prévient d'un programme « à compléter » et prévient les destinataires ; « Prévenir » s'y fond) et un menu « ⋯ » : « Importer un PDF ou un tableur », « Télécharger le PDF » (demande la version : mariés, ou équipe avec les notes internes), « Ajouter à mon agenda » (renouveler et révoquer dans sa fenêtre), « Partir d'un modèle de programme » (seulement si vide), « Décaler tout le programme… », « Versions partagées », puis section « Réglages » : « Réglages du programme ». « À vérifier : 2 moments se chevauchent le jour J (Vin d'honneur et Photos de groupe) · Les voir » en tête, au-dessus des journées |
| `program-editor.tsx` | « Modifier » et « Retirer » par ligne ; « Ajouter une séquence » en bas ; la nouvelle ligne s'ouvre au-dessus | Journées « Veille · vendredi 11 juin 2027 · 2 moments » (R11) ; une ligne = un titre-lien (cible), heures, lieu, qui, menu « ⋯ » (« Modifier », « Dupliquer », puis « Retirer » : niveau 1, « Annuler » dix secondes, y compris pour une ligne pas encore enregistrée) ; la ligne s'ouvre **en place**, une à la fois (liste éditable) ; « Ajouter un moment à la veille » à la fin de chaque journée, la nouvelle ligne ouverte à cet endroit ; « Fermer la ligne » ; un moment au même nom à moins de deux heures, ou un chevauchement, dit « À vérifier : un moment « Photos de groupe » existe déjà à 18 h 45 · Le voir », sans bloquer ; « Ponctuel » (lot 71a, `timing`) ; « moment » partout au lieu de « séquence » (R15) ; barre « 1 moment ajouté, pas encore enregistré · Annuler les modifications · Enregistrer le programme » (gardée) |
| Heures | `<input type="time">` (« 05:30 PM » selon le navigateur) | Un champ d'heure Symbola, J8 : saisie et affichage « 17 h 30 » ; accepte « 17:30 », « 17h30 », « 1730 » ; durée calculée (« 30 min ») ; erreurs sous le champ (70b) |
| « Décaler tout le programme… » | Seule la proposition qui suit un changement d'heure (`program-shift.tsx`) | Fenêtre courte : la journée, « Avancer ou retarder de … », l'aperçu des heures changées, « Décaler 16 moments » ; même code de décalage, « Annuler » dix secondes |
| Lieux, contacts du jour J, rappel du jour J | Formulaires sous les journées | Trois blocs sous les journées, chacun avec son action (« Ajouter un lieu », « Ajouter », « Changer ») ; contenus inchangés |
| Téléphone | Commandes sur plusieurs lignes ; formulaire loin de la ligne | Titre et « Partager… » ; « 3 journées · 21 moments » ; lignes sur deux étages ; « Ajouter un moment » collé en bas, au-dessus de la barre du bas ; la ligne s'ouvre en page entière « ← Programme » |

**Critères d'acceptation**

1. En tête, deux commandes et un menu ; aucune fonction d'aujourd'hui ne manque (import, PDF des deux
   versions, agenda, modèle, versions, prévenir, réglages).
2. « Ajouter un moment à la veille » ouvre la nouvelle ligne à la fin de la veille, dans l'écran.
3. « Retirer » s'annule pendant dix secondes, ligne enregistrée ou non.
4. Les heures s'écrivent et se lisent « 17 h 30 » dans le champ, la liste et les PDF, sur un navigateur
   réglé en anglais comme en français ; « 17:30 » saisi donne 17 h 30.
5. Un doublon possible et un chevauchement se disent « À vérifier : » sans empêcher l'enregistrement.
6. « Décaler tout le programme… » décale tous les moments d'une journée et s'annule.

**Tests** : Vitest (champ d'heure : formats acceptés, refusés, minuit et le lendemain ; doublon) ;
intégration (décalage d'une journée, annulation) ; Playwright `lot-72g-programme.spec.ts` à 1 440 et
375 px, navigateur en `en-US` pour le critère 4, axe-core ; tests mis à jour : `chr-06-chrono`,
`chr-07-doc-12-programme-stockage`, `lot-65g-retours-testeuse`, `lot-66b-rappel-jour-j`,
`hub-14-lot-63b-import` ; abus : décaler ou retirer un moment d'un évènement de B, par un lien de
prestataire.

---

## 6. Le découpage en paquets, et ce qui dépend des autres lots

### 6.1 L'ordre

Sept paquets ; chacun laisse l'app cohérente, a sa PR, ses tests et son rejeu ciblé.

| Paquet | Contenu | Dépend de | Migrations |
| --- | --- | --- | --- |
| **72a** Règles et comptes | Statut « En préparation » retiré ; point = ligne, ordre, radar en lignes (et filtré), contact, portée « Moi », comptes par évènement, étapes affichées, « Le contrat est signé » côté service | **70a** (fusionné) | 0224, 0225 |
| **72b** Écran « Aujourd'hui » | Vide, rempli, repris ; ordre des blocs ; ligne allégée ; panneau sur place ; « Tout afficher » ; « Pour bien démarrer » en ligne | 72a ; **70c** (ligne type `today`, panneau) ; **71f** pour « Reprises en cours » (sinon la section s'ajoute à 71f) ; **71b** pour le lien `/reprise` | — |
| **72c** « Moi · L'agence » | Bascule, vue d'agence | 72b ; **70d** pour « Voir ses tâches » (sinon le lien mène à `/taches` sans filtre) | — |
| **72d** En-tête, onglets, frise | En-tête en 200 px, menu « ⋯ », onglets, barre fine, frise en lecture, lignes d'état | 72a ; **70c** (onglet renommé `taches`) | — |
| **72e** Suite, Synthèse, informations | Suite unique, cinq blocs, fenêtre « Modifier les informations » | 72d ; **70c** (ligne `event`) ; **71f** (bloc « À compléter ») ; **70e** (carte « Source et clients ») | — |
| **72f** Liste des évènements | Un bouton plein, colonnes, « même jour », charge dans le calendrier | 72a ; **70e** (« Nouvel évènement ») ; **71f** (« Repris », filtre « Origine ») | — |
| **72g** Programme | Deux commandes et un menu, ligne en place, heures, décalage | **71e** (fenêtre « Partager… », « Ponctuel ») | — |

Conduite proposée (règle « aller plus vite ») : **72a** seul d'abord (il porte la migration et les
règles que tous lisent). Ensuite deux files indépendantes : l'accueil (72b puis 72c) et la fiche (72d
puis 72e) ; **72f** en parallèle de l'une ou de l'autre (fichiers à part) ; **72g** dès que 71e est
fusionné.

### 6.2 Ce qui dépend des lots 70 et 71, pas encore fusionnés

| Paquet amont | État au 27/11 | Ce que ce lot en attend | Fichiers partagés |
| --- | --- | --- | --- |
| 70a Données des tâches | Fusionné (#190) | Personne d'une tâche, état d'échéance unique, prénoms | — |
| 70b Retour, danger, erreur | Fusionné (#189) | Message de retour, niveaux de danger, erreurs sous le champ | — |
| 70c Ligne type et panneau | En cours | La forme `today` et la forme `event` de la ligne ; le panneau ouvert par `?tache=` ; l'onglet `taches` | **Mêmes fichiers** : `app/accueil/today-view.tsx` (`TodayItemLine`), `app/events/[id]/page.tsx` (onglets), `cockpit.tsx`, `next-step.ts`, `lib/today/load.ts` (liens profonds). **72b, 72d, 72e partent après sa fusion** et reprennent ses composants sans les redessiner |
| 70d Écran « Tâches » | Pas commencé | Filtres `qui` et `grouper` pour « Voir ses tâches » | — |
| 70e Barre du haut et « + Créer » | En cours | « Nouvel évènement » (fenêtre unique) ; la carte « Source et clients » ajoutée à l'onglet « Mariés » | `app/events/[id]/page.tsx` (deux ajouts dans l'onglet `maries`) ; `new-event-menu.tsx` (que 72f remplace par le bouton du 70e) |
| 70g Lexique | Pas commencé | Le contrôle en cliquet : 72 retire les exceptions « Programme du jour J », « séquence », « le radar », « Plage occupée », « Source du prospect », « Mariés » comme nom de colonne | `packages/i18n/src/lexique-exceptions.json` |
| 71a Socle de la reprise | Spécification validée, pas codé | « Aucune ligne née d'un import » ; `program_items.timing` ; `event_status_history.date_known` (même table que 0224) | Migrations : 71 a 0218-0223, ce lot 0224 |
| 71b Page de reprise | Attend 71a | Le lien « Reprendre un mariage » de l'état vide | — |
| 71e Prestataires retenus et programme | Attend 71d | « Partager… » et « Ponctuel » | **Mêmes fichiers** : l'onglet `programme` de `page.tsx`, `program-editor.tsx`. **72g part après 71e** |
| 71f Fiche d'un mariage repris | Attend 71a | « À compléter après la reprise », « Repris », filtre « Origine », « Reprises en cours », santé sans avis | **Mêmes fichiers** : `cockpit.tsx`, `page.tsx` (en-tête : « Repris le … · Voir la reprise »), `app/events/page.tsx`, `today-view.tsx`, `lib/today/load.ts`. Si 71f passe avant, 72 reprend ses blocs à leur nouvelle place ; si 72 passe avant, 71f pose ses blocs dans les nouveaux écrans (la place est écrite ici) |

### 6.3 Ce qui dépend des volets pas encore réalisés

| Ce qui attend | Volet et lot | Ce que fait ce lot en attendant |
| --- | --- | --- |
| Le contenu de « Pour bien démarrer » (le parcours de D6, B15) et la troisième issue de l'assistant (« Entrer un mariage en cours », B3) | 5, Premiers pas et aide (lot 74) | La place, la forme et « Masquer » ; les marches d'aujourd'hui (J5) |
| La visite de l'accueil sur l'état vide (D2, B10) | 5 (lot 74) | Les sélecteurs de la visite actuelle suivent les nouveaux blocs |
| « Relancer… » (fenêtre en deux temps, V14) | 4, Prestataires (lot 73) | « Noter une relance » (J6) |
| Le contenu de l'onglet « Budget et prestataires », son nombre (I7) | 4 (lot 73) | Le nombre de l'onglet suit I7 |
| La section « Réglages » des menus « ⋯ » et le sort de la roue (G14, C-11) | 6, Paramètres (lot 74) | « Réglages » au menu « ⋯ » de la liste et du programme, vers les écrans actuels |
| Le menu latéral à 911 × 512 (C-82) | 6 (lot 74) | Seul le contenu de la fiche est mesuré à cette taille |
| Les valeurs du bleu, de l'orange et du crème | Design System | Jetons actuels |

---

## 7. Ambiguïtés et décisions à prendre par Julien

Numérotées **J1 à J14** (propres à ce lot). Pour chacune : où regarder, la proposition, l'autre voie,
ma recommandation. Je les pose une par une. Celles qui touchent le cahier des charges sont aussi dans
`docs/QUESTIONS.md` (Q49).

| # | Question | Où regarder | Proposition | L'autre voie | Recommandation |
| --- | --- | --- | --- | --- | --- |
| J1 | **« Confirmé » et « En préparation » en base** (E1 les fond à l'écran). | Page 15, « La frise » ; `lifecycle.ts` | Garder les deux en base, une seule étape affichée | Migrer « En préparation » vers « Confirmé » et retirer la valeur | **Tranché le 27/11 par Julien : retirer « En préparation »** (« Je n'ai rien en production… le staging sera remis à zéro si besoin »). Migration 0225, contrat `EventStatus` modifié (§ 4.2), ADR au paquet 72a |
| J2 | **La date de signature** : « Signé le » peut être passée (contrat signé sur papier). Jusqu'où en arrière ? | Page 15, « Le contrat est signé… » ; § 4.1 | Une colonne `effective_on` (0224) ; aujourd'hui par défaut ; jusqu'à un an avant la création de l'évènement ; jamais dans le futur | Pas de date : la signature est le jour du clic (« depuis le 25 nov. » pour un contrat d'avril) | **Tranché le 27/11 par Julien : « Oui, date passée »** (au plus un an avant la création de l'évènement, jamais dans le futur, aujourd'hui par défaut ; migration 0224) |
| J3 | **« Moi » et les évènements sans planner principal** | Page 14, « La vue d'une agence » ; `event_team_members` | Leurs lignes (paiements, attentes, tâches sans personne) vont dans le « Moi » de tout le monde | Elles ne vont dans le « Moi » de personne, seulement dans « L'agence » | **Tranché le 27/11 par Julien : « Oui, chez tous »** |
| J4 | **La bascule « Moi · L'agence » : par défaut, et gardée où ?** | Page 14 | « Moi » par défaut pour tous ; le dernier choix gardé sur l'appareil (cookie), sans migration | Gardé par personne en base (une colonne de plus dans `hub.memberships`), le même sur tous ses appareils | **Tranché le 27/11 par Julien : « Oui, par appareil »** (« Moi » par défaut, cookie, aucune migration) |
| J5 | **« Pour bien démarrer » : ce lot ou le lot 74 ?** La maquette 13 dessine trois marches ; le volet 5 (B15, plus récent) en fait le parcours de D6 en quatre ou cinq marches | Page 13 ; note 11, B15 | Ce lot fait la place (une ligne en bas), la forme et « Masquer » (colonne existante `first_steps_hidden`) ; il garde les deux marches d'aujourd'hui ; le lot 74 met le parcours dedans | Ce lot ajoute déjà « Créer votre premier mariage » comme troisième marche | **Tranché le 27/11 par Julien : « Oui, place seulement »** (la ligne en bas, sa forme, « Masquer » ; les deux marches actuelles ; le parcours au lot 74) |
| J6 | **L'action rapide d'une relance sur l'accueil** : « Noter une relance » (page 14) ou « Relancer… » (volet 4, V14, plus récent, déjà dans `DESIGN.md`) ? | Page 14, repère 4 ; note 10, V14 ; `DESIGN.md`, ligne allégée | « Noter une relance » (le geste qui existe) dans ce lot ; le lot 73 le remplace par « Relancer… » quand sa fenêtre existe, à la même place | Attendre le lot 73 pour la ligne des relances | **Tranché le 27/11 par Julien : « Oui, garder »** (« Noter une relance » ; le lot 73 le remplace par « Relancer… » à la même place) |
| J7 | **Quel contact pour « Attend les mariés »** quand l'évènement a deux clients ? | Page 14, repère 3 | Le premier client (celui de la fiche), nom et téléphone | Les deux, sur deux lignes | **La proposition** : une ligne courte ; le second est dans la fiche |
| J8 | **Le champ d'heure « 17 h 30 »** : le champ natif du navigateur écrit « 05:30 PM » en anglais | Page 17, « Le programme » ; synthèse § 9 (« sur un vrai navigateur français ») | Un champ de texte Symbola qui lit « 17:30 », « 17h30 », « 1730 » et écrit « 17 h 30 » (en anglais « 5:30 pm » selon la langue choisie dans Symbola, pas celle du navigateur) | Garder le champ natif et n'écrire « 17 h 30 » que dans la liste | **La proposition** : c'est le défaut constaté (« 05:30 PM ») ; sur téléphone, le clavier numérique s'ouvre quand même |
| J9 | **« Ouvrir le Jour J » à partir de J-7** : un seuil fixe ou réglable ? (`CLAUDE.md` : pas de seuil métier en dur) | Page 15, « En-tête et onglets » | Une constante d'affichage (7 jours), comme l'horizon de 14 jours de l'accueil ; l'écran du jour J reste ouvert dès la signature, par le menu | Un réglage par organisation (Paramètres) | **La proposition** : c'est le choix du bouton visible, pas une règle métier ; rien n'est fermé |
| J10 | **« Écrire aux mariés » pour un baptême ou un séminaire** | Page 15 ; `fr` (le mot des clients par type, lot 16j) | Le mot des clients du type : « Écrire aux mariés », « Écrire aux parents », « Écrire au client » ; ouvre « Messages » sur un nouveau fil (lot 55), comme « Écrire au client » aujourd'hui | Un libellé unique « Écrire au client » | **La proposition** : le mot du type est déjà réglé par organisation |
| J11 | **Les nombres des onglets** : la maquette montre « 6 sur 9 », « 2 en retard », « Devis et factures 3 », « Documents 4 », rien sur « Mariés », « Programme », « Invités » | Page 15, règle « le nombre d'un onglet dit ce qui demande attention » | Budget : postes complets sur requis (I7) ; Tâches : « N en retard » en rouge, sinon « 14 sur 20 » en gris ; Devis et factures et Documents : leur nombre en gris (comme aujourd'hui) ; Invités : « 38 réponses sur 120 » quand le module est ouvert ; Programme et Mariés : rien | Ne garder que les nombres qui demandent attention (Budget, Tâches) | **La proposition** : c'est la maquette, et chaque nombre dit son mot |
| J12 | **« Rétablir l'évènement » : que deviennent les rappels et les acomptes ?** La maquette le laisse à vérifier dans le code | Page 15, « Rétablir : la question » ; `reactivateEvent` (`service.ts:744`) | Écrire le texte de la fenêtre d'après ce que fait le code au moment du paquet 72d (vérifié par un test d'intégration), sans changer la règle ; si le code ne rouvre pas les liens ou ne relance pas les rappels, le dire tel quel | Changer la règle pour qu'elle colle au texte de la maquette (liens rouverts, rappels repris) | **La proposition** : ne promettre que ce que l'app fait ; un changement de règle serait une décision à part |
| J13 | **La Synthèse et l'accueil d'une Planner restreinte** : la suite de la fiche montre-t-elle les lignes confiées à une collègue ? | Page 16, « En préparation » | Oui : sur la fiche, toutes les lignes de l'évènement, toutes personnes confondues (« Bastien » sur la ligne) ; « Moi » ne vaut que pour l'accueil | Appliquer « Moi » aussi sur la fiche | **La proposition** : la fiche répond à « où en est ce mariage ? », pas à « qu'ai-je à faire ? » |
| J14 | **La rubrique « Mariés » de « Modifier les informations »** : le lot 70e a mis « Source et clients » dans l'onglet « Mariés » ; la maquette 16 a une rubrique « Mariés » dans la fenêtre | Page 16 ; note `lot-70e-etat.md` ; onglet `maries` | La rubrique montre les mariés (noms, contacts, en lecture) avec « Gérer dans l'onglet Mariés » ; « Venu par » passe dans « Type et origine » et quitte la carte du 70e | Déplacer toute la gestion des clients (ajout, second client, contacts) dans la fenêtre | **La proposition** : un seul endroit pour gérer les clients (l'onglet, qui porte aussi les liens et les décisions), la fenêtre pour les faits de l'évènement |

**Points qui ne demandent pas de décision mais méritent d'être sus**

- **Un défaut de sécurité trouvé en lisant le code** : le radar de l'accueil n'est pas filtré par la
  visibilité du lot 52 (`loadRiskRadar`, appelé sans `withinScope` ; il lit aussi les évènements
  archivés). Une Planner restreinte peut y lire le nom d'un mariage d'une collègue. Il est corrigé au
  paquet 72a (critère 7), puisque les alertes deviennent des lignes ; s'il faut le corriger avant,
  c'est une ligne dans `app/page.tsx`.
- **Les constantes d'affichage** (horizon de 14 jours, sept lignes, J-7) restent du code, dans
  `packages/contracts` : ce sont des choix d'écran, pas des données métier.
- **« Le contrat est signé… » ne crée pas de tâches** (règle actuelle de `changeEventStatus`, gardée) :
  la suite de la Synthèse propose ensuite « Partir du rétroplanning ». L'automatisation
  `quote_signed_confirm_event` reste ; quand elle est active, le bouton n'apparaît que pour une option
  qui n'a pas de devis signé.
- **`same-day-notice.tsx` n'est pas utilisé par la liste** (il sert sous les champs de date) : il reste ;
  la liste calcule « 2 le même jour » avec `sharedDates` (`lib/portfolio/portfolio.ts:44`).
- **Les visites guidées** de l'accueil, de la liste et de la fiche citent des blocs qui bougent : leurs
  sélecteurs et textes sont mis à jour par chaque paquet (`lib/help/tours.ts`, `tours.json`), sans
  changer leur forme (lot 74).
- **Le scénario C-17** (annuler un « Fait » dans l'agence) n'est pas touché : D1, réglé au volet 1.

---

## 8. Divergences avec le cahier des charges, et ADR à prévoir

À signaler ; **aucun ADR n'est écrit dans cette PR**.

1. **Statuts affichés en quatre étapes (EVT-05 en cite sept)** : « Confirmé » et « En préparation »
   réunis en un seul statut (« Confirmé » en base, « Signé, en préparation » à l'écran ; « En
   préparation » retiré, J1 tranchée le 27/11), « Jour J » restant une phase. → `gap.csv` et Q49 ;
   **ADR à écrire** au paquet 72a (un statut du cahier des charges disparaît de la base).
2. **HUB-08 « tri par urgence »** : l'ordre retenu (A2) est « les retards, puis par date, quel que soit
   qui agit ». C'est une lecture de l'urgence, pas un écart ; à écrire dans `gap.csv`.
3. **Onglets du cockpit** (patrons d'interface : « Synthèse, Planning, Budget, Prestataires, Invités,
   Documents, Jour J ») : l'app a « Budget et prestataires » ensemble, « Tâches » (lot 70) et
   « Programme » (E6) au lieu de « Jour J ». → `gap.csv` et Q49, sans ADR.
4. **EVT-02 « bandeau de santé » dans l'en-tête** : la santé descend dans « Où en est le mariage »,
   sous la suite ; « échéances des quatorze jours » se fond dans la suite (E9). → `gap.csv`.
5. **« Fermer le panneau enregistre »** (patrons d'interface) : « Modifier les informations » a un
   seul « Enregistrer » (D7, M1) ; couvert par l'ADR du paquet 70c, qui amende l'ADR 0107 (S9).
6. **`DESIGN.md`** n'est pas réécrit : il porte déjà ces formes (phase 6). Un écart trouvé au code est
   noté pour la phase 7.

---

## 9. Textes (français et anglais), aide d'écran, rejeu et `gap.csv`

### 9.1 Les textes à créer ou à changer

Clés indicatives. Le français est celui des maquettes validées ; l'anglais est proposé ici (C1) et relu
par Julien avec la PR de chaque paquet.

| Où | Français | Anglais |
| --- | --- | --- |
| Accueil, compte | {n, plural, one {# point} other {# points}} à traiter d'ici 14 jours, dont {late} en retard · Aucun point à traiter d'ici 14 jours · {n} évènements en cours | {n, plural, one {# item} other {# items}} to handle in the next 14 days, {late} late · Nothing to handle in the next 14 days · {n} events in progress |
| Accueil, carte | À traiter en premier · {shown} sur {total} · Voir les {total} dans Tâches · {n} autres points d'ici 14 jours · Tout afficher · À regarder · Agir | Handle first · {shown} of {total} · See all {total} in Tasks · {n} more items in the next 14 days · Show all · To watch · Act |
| Accueil, vide | Commencez par votre premier mariage · Symbola part de vos évènements : une fois le premier créé, cet écran vous dit chaque matin ce qui presse, pour qui et quand. · Commencez par reprendre un mariage en cours · Ses prestataires, son budget, ses tâches et son programme arrivent tels qu'ils sont. · Reprendre un mariage · Un mariage qui commence ? | Start with your first wedding · Symbola starts from your events: once the first one exists, this screen tells you every morning what's urgent, for whom and when. · Start by importing a wedding in progress · Its vendors, budget, tasks and schedule come in as they are. · Import a wedding · A wedding just starting? |
| Accueil, repris | Vos mariages repris n'ont pas encore de tâches. · Rien d'ici 14 jours. Les échéances arriveront avec les tâches : reprendre la liste de votre tableur ou partir d'un modèle, depuis chaque mariage. | Your imported weddings have no tasks yet. · Nothing in the next 14 days. Due dates will come with the tasks: import your spreadsheet list or start from a template, from each wedding. |
| Mes évènements | {n} en cours · Tous les évènements · {n} points, dont {late} en retard · Pas encore de tâches · À jour | {n} in progress · All events · {n} items, {late} late · No tasks yet · Up to date |
| Pour bien démarrer | Pour bien démarrer · {done} sur {total} · reste : {étapes} · Masquer · Voir les étapes | Getting started · {done} of {total} · left: {steps} · Hide · See the steps |
| Agence | Moi · L'agence · L'agence : {n} tâches en retard, dans {e} évènements · Par personne · Tâches dont chacun s'occupe · En retard · Aujourd'hui · D'ici 14 jours · Évènements suivis · Voir ses tâches · (vous) · Attendu des mariés ou d'un prestataire · Par évènement · {n} avec un retard · Planner principal · Tâches faites · Plus ancien retard · {n} évènements à jour · Afficher · {done} sur {total} | Me · The agency · The agency: {n} late tasks, in {e} events · By person · Tasks each one handles · Late · Today · Next 14 days · Events followed · See their tasks · (you) · Expected from the couple or a vendor · By event · {n} with a delay · Lead planner · Tasks done · Oldest delay · {n} events up to date · Show · {done} of {total} |
| En-tête | ← Évènements · Écrire aux mariés · Ouvrir le Jour J · Messages · Les fils de discussion de ce mariage · Voir comme {nom} · Son espace, tel qu'elle le voit · L'écran du terrain · Changer le type… · Reporter l'évènement… · Garder le mariage, changer sa date · Annuler l'évènement… · Il passe à « Annulé » ; vous pourrez le rétablir · Plus · Les étapes · étape {n} sur 4 | ← Events · Write to the couple · Open the big day · Messages · This wedding's threads · View as {name} · Their space, as they see it · The on-site screen · Change type… · Postpone the event… · Keep the wedding, change its date · Cancel the event… · It becomes "Cancelled"; you can restore it · More · The steps · step {n} of 4 |
| Onglets | Programme · {n} en retard · {done} sur {total} · {n} réponses sur {total} | Schedule · {n} late · {done} of {total} · {n} replies of {total} |
| Frise | Une demande en cours · Signé, en préparation · Jour J · Clôturé · depuis le {date} · Le contrat est signé… · Le contrat de {nom} est signé ? · L'évènement passe en « Signé, en préparation » à cette date. Ensuite, la Synthèse vous propose de créer sa liste de tâches. · Signé le · Garder en demande · Passer en signé · Clôturer l'évènement… · Reporté · le {date} n'est plus la date · Nouvelle date à fixer ; les tâches attendent. · Fixer la nouvelle date… · Annulé le {date} · motif : {motif} · Rétablir l'évènement… · Garder annulé · Archivé · lecture seule · Ouvrir la clôture | An ongoing enquiry · Signed, in preparation · Big day · Closed · since {date} · The contract is signed… · Is {name}'s contract signed? · The event becomes "Signed, in preparation" on that date. Then the Overview offers to create its task list. · Signed on · Keep as enquiry · Mark as signed · Close the event… · Postponed · {date} is no longer the date · New date to set; tasks are on hold. · Set the new date… · Cancelled on {date} · reason: {reason} · Restore the event… · Keep cancelled · Archived · read only · Open the closing |
| Suite | Prochaine action · Prochaines actions · Envoyer le devis : {noms} attendent votre proposition depuis le {date}. · Préparer le devis · Créer la liste des tâches de {nom}. · Partir du rétroplanning · {n} autres : {liste} · Rien d'ici 14 jours, et aucune étape en attente. Prochaine échéance : « {tâche} », {date} · Les tâches | Next action · Next actions · Send the quote: {names} have been waiting for your proposal since {date}. · Prepare the quote · Create {name}'s task list. · Start from the planning · {n} more: {list} · Nothing in the next 14 days and no step waiting. Next due: "{task}", {date} · The tasks |
| Synthèse | Où en est le mariage · Pourquoi ces nombres ? · {n} postes complets sur {total} · {n} contrat attendu · {n} en attente, depuis le {date} · Temps forts · Gérer · Rendez-vous · Tous les rendez-vous · Informations · Modifier les informations · Venu par · Agenda · Bloqué pour l'équipe du {du} au {au} · Équipe · (planner principale) · Fil d'activité · Tout le fil · non renseigné | Where the wedding stands · Why these numbers? · {n} complete items of {total} · {n} contract awaited · {n} pending, since {date} · Highlights · Manage · Appointments · All appointments · Details · Edit details · Came through · Calendar · Blocked for the team from {from} to {to} · Team · (lead planner) · Activity · All activity · not provided |
| Informations | Les informations de « {nom} » · Date et lieux · Mariés · Invités et budget · Style et notes · Type et origine · Date de l'évènement · Le contrat est signé : changer la date, c'est reporter le mariage. · Fuseau horaire · Heure de Paris · Changer · Agenda de l'équipe · Personne de l'équipe ne peut être réservé ces jours-là sans qu'on le lui signale. · Rubrique suivante : {rubrique} · Gérer dans l'onglet Mariés | {name}'s details · Date and venues · Couple · Guests and budget · Style and notes · Type and origin · Event date · The contract is signed: changing the date means postponing the wedding. · Time zone · Paris time · Change · Team calendar · No one on the team can be booked on those days without being warned. · Next section: {section} · Manage in the Couple tab |
| Liste | {n} évènements à venir · Liste · Colonnes · Calendrier · Nouvel évènement · Période · Venu par · Origine · Planner principal · Évènement · Tâches faites · · {n} le même jour · Demande : pas de tâches · Filtres · Reprendre et importer | {n} upcoming events · List · Columns · Calendar · New event · Period · Came through · Origin · Lead planner · Event · Tasks done · · {n} on the same day · Enquiry: no tasks · Filters · Import and bring over |
| Programme | Programme · {j} journées · {m} moments · version des mariés partagée le {date} · Ajouter un moment · Partager… · Ajouter un moment {à la veille / au jour J / au lendemain} · Fermer la ligne · Retirer · À vérifier : {n} moments se chevauchent {journée} ({a} et {b}). · Les voir · À vérifier : un moment « {nom} » existe déjà à {heure}. · Le voir · Importer un PDF ou un tableur · Télécharger le PDF · Ajouter à mon agenda · Partir d'un modèle de programme · Décaler tout le programme… · Versions partagées · Réglages du programme · {n} h {mm} · Durée | Schedule · {d} days · {m} moments · couple's version shared on {date} · Add a moment · Share… · Add a moment {to the eve / to the big day / to the day after} · Close the line · Remove · To check: {n} moments overlap {day} ({a} and {b}). · See them · To check: a "{name}" moment already exists at {time}. · See it · Import a PDF or a spreadsheet · Download the PDF · Add to my calendar · Start from a schedule template · Shift the whole schedule… · Shared versions · Schedule settings · {h}:{mm} · Duration |

Textes **retirés** : `Events.programTitle` « Programme du jour J » ; `Home` « Rien ne presse : tout est
à jour. » et « aucun évènement en cours · rien ne presse » ; `RiskRadar.today` (« Le radar passe chaque
matin… », « Aucun risque détecté ce matin. ») sur l'accueil ; `Events.nextStep*` (bandeau) ;
`Events.next14Days` ; `Events.reactivate` s'il reste ; les « Changer la date », « Enregistrer le
fuseau », « Enregistrer le budget souhaité » du panneau ; « Ajouter une séquence », « séquence » ;
« Source du prospect » (filtre) ; « Mariés » comme nom de colonne de la liste ; « Charge des douze
prochains mois » sous la liste. Les textes du portail ne changent pas.

### 9.2 Aide d'écran et centre d'aide

- **Aide contextuelle** (`lib/help/screens.ts`) : réécrire `home` (« Un point est une chose à faire ou à
  surveiller d'ici quatorze jours », l'ordre, « Moi · L'agence », le contact, « Masquer »),
  `eventsList` (colonnes, « même jour », vues), `eventsDetail` (en-tête, frise, suite, « Modifier les
  informations ») ; **ajouter une clé `eventsProgram`** (il n'y en a pas : commandes, ligne en place,
  heures, décalage) ; `riskRadar` dit que les alertes sont des lignes de l'accueil.
- **Centre d'aide** : articles sur l'accueil, la frise (« changer le statut »), la Synthèse, le
  programme (« séquence », « Diffuser »). Captures à régénérer (`pnpm --filter @symbola/app
  help:captures`) : `home.jpg`, celles de la liste, de la fiche et du programme ; relues dans la PR.
- **Visites** : sélecteurs et textes des visites `hub`, `events`, `event` (`tours.json`).

### 9.3 Rejeu (C4)

- **SC-03 « Lundi matin »** (PAR-03, SU-01) à 72b, 72d et 72e : « en trente secondes, elle sait par
  quoi commencer » ; les trois actions les plus urgentes sans défiler (mesuré à 1 280 × 800).
- **SC-11 « L'agence »** (SU-02 Nadia, PAR-10) à 72c : qui est en retard, quels mariages, sans ouvrir
  une fiche.
- **SC-01 « Le premier quart d'heure »** à 72b (accueil vide) ; **SC-R1** (lot 71) à 72b (au lendemain
  d'une reprise) ; **SC-02 « De la demande à l'acompte »** à 72d (« Le contrat est signé… ») et 72e
  (suite d'une demande) ; Sophie (SU-04, 150 %) pour l'en-tête à 911 × 512.
- Comptes rendus : `docs/recette/SC-03.md`, `SC-11.md`, `SC-01.md`, `SC-02.md` mis à jour.

### 9.4 `gap.csv`

Lignes HUB-08, UX-01, UX-06, PAR-03, PAR-10, EVT-02, EVT-03, EVT-05, EVT-06, EVT-07, CHR-06, CHR-07,
CHR-09, HUB-03 mises à jour par le paquet qui les touche.

### 9.5 Chaîne de sécurité

SEC-30 à SEC-36 vertes à chaque PR ; tests d'abus des § 5.1 à 5.7 obligatoires (nouvelle colonne,
nouvelles requêtes groupées, paramètres d'adresse `vue`, `tout`, filtres de la liste).
