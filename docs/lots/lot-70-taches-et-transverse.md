# Lot 70 — Réaliser le volet 1 des maquettes : « Tâches » et le transverse

**Statut** : spécification, **à valider par Julien avant tout code** (le lot change le schéma de
données du module `events` et un parcours P0, PAR-03).
**Branche de la spécification** : `lot-70-taches-et-transverse` (une PR vers `main`, ce fichier et
`docs/QUESTIONS.md` seulement). Chaque paquet aura ensuite sa branche `lot-70<x>-…` et sa PR.
**Date** : 26/11/2026, par Claude Code.

Sources, dans l'ordre où elles font foi :

1. `docs/audits/2026-11-ux-parcours/06-decisions-porte-2.md` (D1 à D11) ;
2. `docs/audits/2026-11-ux-parcours/07-maquettes-transverse-taches.md` (M1 à M13, porte 3 du
   25/11, et son § 4 « ce que les maquettes supposent hors de l'écran ») ;
3. les cinq maquettes `docs/maquette/lot-68/01-taches-ligne-et-panneau.html` à
   `05-transverse-mots-etats.html` ;
4. `docs/audits/2026-11-ux-parcours/04-synthese.md` (constats C-nn, principes P-nn) ;
5. `docs/CAHIER_DES_CHARGES.md` pour les exigences ; `DESIGN.md` pour les jetons.

Règle de ce lot : il **emploie les jetons actuels de `DESIGN.md` et ne réécrit pas `DESIGN.md`**
(le Design System s'écrit après la validation de toutes les maquettes). Là où une maquette change
le rôle d'une teinte ou une règle de composant écrite dans `DESIGN.md`, l'écart est listé au § 9
pour la réécriture du Design System, et la décision A15 dit ce qu'on applique dès maintenant.

Fichiers sous `apps/symbola/` sauf mention ; `fr` = `packages/i18n/src/messages/fr.json`.

---

## 1. Ce qui change pour la planner, en clair

Une fois le lot livré, Camille (et Bastien, son collègue) verra :

- **Une tâche a partout la même forme.** Sur « Aujourd'hui », dans « Tâches », dans la fiche d'un
  mariage et sur le téléphone : le titre (on clique dessus pour ouvrir la tâche), le mariage,
  l'échéance dite en mots (« En retard de 4 jours », « Dans 4 jours »), qui s'en charge, un bouton
  « Fait », et un menu « ⋯ » pour le reste (changer la date, confier, ouvrir l'évènement,
  supprimer). Plus de case sans nom, de rond, ni de trois boutons par ligne.
- **Une seule fenêtre pour une tâche**, la grande, avec les mêmes mots partout (« Qui s'en
  charge », « Place dans le rétroplanning », « Étape clé »), un bouton « Enregistrer » et un bouton
  « Fermer » qui prévient s'il reste des changements.
- **Les collègues dans « Qui s'en charge ».** Une tâche peut être confiée à Bastien, et pas
  seulement à « Planner », « Mariés » ou un prestataire. « Mes tâches » en un geste ; les retards
  de toute l'équipe, rangés par personne, sur un écran.
- **L'écran « Tâches » refait** : « Nouvelle tâche » en haut, avec ou sans mariage (la
  « Déclaration de TVA » se crée là, plus en bas de page) ; des filtres nommés (Évènement, Qui
  s'en charge, Période, Catégorie, État) ; « Grouper par » mois, évènement ou personne ;
  « 8 tâches à faire sur 42 » ; une sélection en lot qui ne fait plus sauter la liste ; des écrans
  vides qui disent la vérité (rien encore, tout est fait, aucun résultat, mariage repris sans
  tâches).
- **Retrouver une tâche cochée par erreur** : « État : Faites » les range de la plus récente à la
  plus ancienne, avec qui l'a cochée et quand, et « Rouvrir ».
- **Un seul nom pour changer une échéance** : « Changer la date… » (demain, lundi prochain, dans
  une semaine, ou une date), avec « Annuler » ensuite. « Reporter » ne sert plus qu'à l'évènement.
- **La fiche d'un mariage** : l'onglet « Rétroplanning » s'appelle « Tâches ».
- **La barre du haut reste en place** quand on fait défiler la page ; le compte passe dans un menu
  sous le prénom ; « + Créer » propose aussi l'évènement, le prestataire et le contact, et dit le
  mariage en cours (« Tâche pour Léa & Maxime »).
- **« Nouvel évènement »**, une seule entrée, pose « Où en est-il ? » (« Une demande en cours » ou
  « Signé, en préparation », aucune réponse choisie d'avance) ; un lien à part mène à la reprise
  de fichiers.
- **Sur téléphone**, une barre en bas : Aujourd'hui, Évènements, Tâches, Prestataires, Plus. La
  barre du haut tient en 60 px.
- **Un message après chaque action**, toujours au même endroit, avec « Annuler » pendant dix
  secondes quand on peut défaire. Une suppression ne pose pas de question mais s'annule ; ce qui
  touche les mariés ou les prestataires (annuler un évènement) demande une confirmation qui dit
  la conséquence et propose « Garder l'évènement ».
- **Les erreurs de saisie** sont écrites par Symbola, en français, sous le champ, plus par la
  bulle du navigateur.
- **Les mots** : un mot par chose, vérifié par un contrôle automatique (« Tous les modules » au
  lieu d'« Apps », « Qui s'en charge » au lieu de « Responsable » et « Qui la réalise »,
  « Rétablir » au lieu de « Réactiver »…).

Ce qui **ne change pas** dans ce lot : les autres sections d'« Aujourd'hui » (relances, paiements,
calendrier, compteurs), l'en-tête et l'ordre des onglets de la fiche, les Paramètres, l'aide et
les visites guidées, la page de reprise (§ 8).

---

## 2. Exigences et constats traités

| Élément des maquettes | Exigences du cahier des charges | Constats et décisions |
| --- | --- | --- |
| Ligne type et ses quatre formes (page 1) | UX-13 (un seul patron, mêmes libellés), UX-01 (prochaine action, échéance, responsable), UX-05, UX-14, HUB-08 (accueil), CHR-02, CHR-03 | C-34, C-35, C-38, C-77, C-83 ; D3 ; M3, M4, M11 ; P-10, P-11, P-21 |
| Panneau unique d'une tâche, création comprise (pages 1 et 2) | UX-13 (et ADR 0107), UX-09, CHR-02, CHR-05 (jalons), DAT-07 | C-31, C-32, C-36, C-38, C-90, C-08, C-04 ; D3 ; M1, M11 ; P-11, P-12 |
| « Qui s'en charge » avec les collègues | CHR-02, CHR-04, HUB-03, EVT-06, PAR-10 (« charge par personne ») | C-32, C-85, C-14 (en partie) |
| Écran « Tâches » : création, filtres, groupement, décompte (page 2) | CHR-03, CHR-10, UX-03 (« Ajouter une tâche » en trois gestes), UX-12, HUB-08 | C-31, C-33, C-14 ; P-08, P-13 |
| Changer la date (page 2) | UX-07 (annuler dix secondes), DAT-07 (la date relative cède à la date déplacée à la main), CHR-01 | C-36, C-87, C-09 |
| Sélection en lot (page 2) | UX-07, UX-15 | C-40, C-35, C-36, C-09 ; M2 |
| États vides, mariage repris sans tâches (page 2) | UX-08 (l'écran vide enseigne) | C-37, C-55, C-56 ; D11, C-54 ; P-05, P-01 |
| Tâches faites, « Rouvrir », « Cochée par » (page 2) | UX-07, CHR-04 (le client coche) | D1 ; P-16 |
| Seuil « Bientôt » (page 5) | UX-06, CHR-05 | M10 |
| Barre du haut fixe, menu du compte (page 3) | Patrons d'interface (§ 5 : « En-tête avec recherche, création rapide et notifications »), HUB-02 (changer d'organisation) | C-12, C-13, C-82 (en partie) ; M7 |
| « + Créer » (page 3) | HUB-07 | C-03, C-31, C-81 |
| « Nouvel évènement » et « Où en est-il ? » (page 3) | EVT-01, EVT-05, PAR-01, PAR-02 | C-03, C-25, C-51, C-67 (en partie) ; D8 ; M12, M13 |
| Recherche, premier temps (page 3) | HUB-12, NFR-02 (recherche en moins de 500 ms) | C-12 ; M9 |
| Barre du bas du téléphone et « Plus » (page 3) | Patrons d'interface (« sur téléphone, barre d'onglets en bas, cinq entrées au plus »), UX-05, HUB-06 | C-84, C-81, C-77 ; D4 |
| Message de retour (page 4) | UX-07, UX-15, NFR-16 | C-09, C-17 ; M5, M6 ; P-16, P-07 |
| Trois niveaux de danger (page 4) | UX-07, HUB-17 (corbeille), EVT-05 | C-08, C-87, C-80 (en partie) ; M6 ; P-17 |
| Erreur de saisie (page 4) | UX-10, NFR-16, HUB-19, UX-14 | C-04 ; P-18 |
| Lexique et contrôle automatique des textes (page 5) | UX-10, HUB-19, HUB-20 (test des libellés dans les sources), C1 (bilingue) | C-85, C-87, C-89, C-90, C-03, C-39, C-10 ; M11 ; P-15 |
| États et teintes, répartition A en rôles (page 5) | UX-14, statuts des patrons d'interface (« toujours un libellé et une icône »), langage visuel | C-83, C-34 ; M8 ; D porte 2 § 6 |

---

## 3. Ce qui touche les données, les contrats et les événements

Tout reste dans le schéma `events` (module des tâches), sauf mention. Aucune clé étrangère vers
`hub` (avenant de l'ADR 0012) : l'identifiant d'un membre est contrôlé par le service, comme
`events.event_team_members.user_id` aujourd'hui. Chaque migration a son retour arrière dans
`packages/db/drizzle-rollback/` (ADR 0036). Dernière migration de `main` : **0210**.

### 3.1 Ce qui existe déjà (aucune migration)

- **Tâche sans évènement** : `events.event_tasks.event_id` est déjà facultatif (lot 53), avec la
  répétition (`recurrence`) et la contrainte `event_tasks_standalone_check` (une tâche sans
  évènement est « planner », sans écart en jours, sans prestataire, sans jalon). Ce qui manque est
  à l'écran et dans le service : `listOrganizationTasks` (`modules/events/service.ts:1607`) écarte
  les tâches sans évènement, que l'écran lit à part (`listStandaloneTasks`, `planning.ts`). Ce lot
  les réunit dans une seule liste.
- **Date de fin** : `done_at` existe. **Suppression douce** : `deleted_at`, `deleted_by`.
  **Catégorie** : `category_id` et `events.task_categories`. **Jalon** : `is_milestone`.
  **Rang** : `position`.

### 3.2 Migrations à prévoir (numéros indicatifs, à reprendre au moment du code)

| N° | Fichier | Ce qu'elle fait | Pourquoi |
| --- | --- | --- | --- |
| 0211 | `0211_lot70a_events_task_assignee.sql` | Ajoute `event_tasks.assignee_user_id uuid` (nullable) et un index `(organization_id, assignee_user_id)` ; contrainte : renseigné seulement si `responsible = 'planner'`. **Étape de données** : remplit la colonne des tâches « planner » existantes (règle de la décision A2) | C-32 : nommer un collègue. `responsible` garde ses trois valeurs (`planner`, `clients`, `vendor`) : « planner » veut dire désormais « quelqu'un de l'agence », et `assignee_user_id` dit qui |
| 0212 | `0212_lot70a_events_task_done_by.sql` | Ajoute `event_tasks.done_by_kind` (`member`, `clients`, `vendor`, nullable) et `done_by_user_id uuid` (nullable, seulement si `member`) ; contrainte : les deux sont nuls quand `done_at` est nul. Index `(organization_id, done_at desc)` pour trier les faites. **Étape de données** : remplit ce qui est sûr (décision A9) | D1 : « Faite le », « Cochée par » (qui a coché, pas qui s'en chargeait) |
| 0213 | `0213_lot70a_events_task_note.sql` | Ajoute `event_tasks.note text` (nullable, 2 000 caractères au plus, sans caractère de contrôle) | Le panneau de la maquette a un champ « Note » qui n'existe pas aujourd'hui (décision A7) |
| 0214 | `0214_lot70a_events_soon_days.sql` | Ajoute `events.planning_health_settings.soon_days integer` (1 à 30). Sans ligne ou sans valeur : 7 | M10 : seuil de « Bientôt » réglable par organisation. L'écran de réglage attend le volet « Paramètres » (§ 8) ; la valeur est lue dès ce lot |
| 0215 | `0215_lot70a_events_task_change_snapshots.sql` | Table technique `events.task_change_snapshots` (`id`, `organization_id`, `user_id`, `payload jsonb`, `expires_at`), RLS par organisation, purgée par la tâche horaire après dix minutes | « Annuler » après « Changer la date » ou « Confier à » (C-09) : il faut garder les valeurs d'avant (jusqu'à 500 tâches en lot), que le cookie d'annulation actuel (`lib/undo.ts`, nature et identifiant seulement) ne peut pas porter. Décision A18 |
| 0216 | `0216_lot70a_hub_user_names.sql` | **Schéma `hub`** (accord de Julien, A1, 26/11) : ajoute `hub.users.first_name` et `hub.users.last_name` (`text`, nullables, 1 à 80 caractères, sans caractère de contrôle) | A1 : nommer un collègue (« Bastien ») et ses initiales (« BL ») ; le nom appartient à la personne, pas à l'organisation, d'où `users` et non `memberships` |

La **Corbeille des tâches** (décision A5) ne demande pas de migration : `deleted_at` suffit ; ce
qui change, c'est le délai de purge des tâches (dix minutes aujourd'hui, `ELEMENT_PURGE_MINUTES`,
`packages/contracts/src/trash.ts`) et la liste de la Corbeille. C'est un avenant à l'ADR 0073.

Une seule migration touche le schéma `hub` (0216, A1) ; elle passe par le service du hub et `packages/auth`, jamais par le module `events`.

### 3.3 Contrats (`packages/contracts`)

Changements **compatibles** (ajouts) :

- le type d'une tâche (`service-contract.ts`) gagne `assigneeUserId`, `doneBy` (`{ kind, userId }`),
  `note`, et un état d'échéance calculé `dueState` (`late` avec `days`, `today`, `tomorrow`, `soon`
  avec `days`, `later`) ;
- la liste des tâches de l'organisation accepte les filtres `eventId` (ou « hors évènement »),
  `assignee` (moi, un membre, les clients, les prestataires, tout le monde), `period` (en retard,
  cette semaine, quinze jours, ce mois, entre deux dates), `categoryId`, `state` (à faire,
  faites, toutes), et rend le total et le nombre filtré (« 8 sur 42 ») ;
- les actions en lot gagnent « Fait », « Confier à un membre » et « Toutes au <date> » ;
- `TRASH_KINDS` gagne `task` (si A5 en (a)).

Rien d'incompatible : les anciennes valeurs restent lues. **Aucun nouvel événement
`domain_events`** : les tâches n'en émettent pas aujourd'hui, et ce lot n'en a pas besoin
(la notification d'un collègue à qui l'on confie une tâche est la décision A19).

### 3.4 Droits et isolation (SEC-10 à SEC-13)

- `assignee_user_id` n'accepte qu'un **membre actif de la même organisation** (contrôlé par le
  service à partir de `listTeam`, `packages/auth/src/team.ts`) ; toute autre valeur est refusée
  par une erreur qui ne dit pas si ce compte existe ailleurs.
- Une Planner qui ne voit pas tous les évènements (réglage du lot 52) ne voit dans « Tâches » que
  les tâches des évènements de son équipe et les tâches hors évènement qui lui sont confiées ou
  qu'elle a créées. **À trancher (A20)** : qui voit les tâches hors évènement d'un collègue ?
- Un lien des mariés qui coche une tâche écrit `done_by_kind = 'clients'`, jamais un identifiant
  de compte. Le portail ne montre jamais le nom d'un collègue : seulement « l'agence ».
- L'Admin d'exploitation n'a accès à aucune de ces colonnes (SEC-09).

### 3.5 Registre RGPD (`privacy.registry.yaml`)

À déclarer, chacun avec sa durée et sa règle d'anonymisation :

| Table | Champ | Catégorie | Règle |
| --- | --- | --- | --- |
| `events.event_tasks` | `assignee_user_id` | identifiant | Membre de l'équipe qui s'en charge, jamais son nom. Tant que la tâche existe ; l'identifiant d'un accès retiré ne désigne plus personne (comme `day_checkpoints.user_id`) |
| `events.event_tasks` | `done_by_user_id` | identifiant | Membre qui a coché. Même règle |
| `events.event_tasks` | `note` | contenu_libre | Note interne, jamais montrée aux mariés ni aux prestataires. Effacée par une demande d'oubli qui vise l'évènement (RGPD-03), exportée avec les tâches (HUB-13) |
| `hub.users` | `first_name`, `last_name` | identité | Saisis par la personne dans Mon compte (A1). Montrés aux membres de ses organisations seulement, jamais aux mariés, aux prestataires ni dans un journal. Gardés tant que le compte existe ; effacés avec le compte ; exportés avec l'équipe (HUB-13), non repris par la reprise d'un export dans une autre organisation |
| `events.task_change_snapshots` | `payload` | technique (dates et identifiants) | Aucune donnée personnelle ; purgée après dix minutes |

Le contrat `privacy/v1` du module `events` (find, export, anonymize, erase) couvre ces colonnes.
L'export complet (HUB-13) et sa reprise (lot 35b) suivent les nouvelles colonnes : la reprise
d'un export dans une autre organisation remet `assignee_user_id` et `done_by_user_id` à nul (les
comptes ne sont pas les mêmes).

---

## 4. Le découpage en paquets

Sept paquets. Chacun laisse l'app cohérente, a sa PR, son jeu de tests et son rejeu ciblé. L'ordre
est celui qui évite de refaire deux fois la même chose : les données d'abord, puis les formes
transverses dont la ligne et le panneau ont besoin, puis les écrans.

| Paquet | Contenu | Dépend de | Migrations |
| --- | --- | --- | --- |
| **70a** Données des tâches | Colonnes et service (§ 3) ; « Qui s'en charge » propose les collègues dans les formulaires **actuels** ; la Corbeille des tâches ; le seuil « Bientôt » lu | — | 0211 à 0216 |
| **70b** Retour, danger, erreur | Le message de retour unique ; les trois niveaux de danger ; la validation écrite par Symbola ; « Annuler l'évènement » et « Rétablir » | — (peut partir en même temps que 70a) | — |
| **70c** La ligne type et le panneau | Ligne type sur « Tâches », la fiche, « Aujourd'hui », le téléphone ; panneau unique (édition et création) ; « Changer la date… » ; onglet « Tâches » de la fiche | 70a, 70b | — |
| **70d** L'écran « Tâches » | « Nouvelle tâche » en haut, liste unique avec les tâches hors évènement, filtres, « Grouper par », décompte, sélection en lot, états vides, tâches faites | 70c | — |
| **70e** Barre du haut et « + Créer » | Barre fixe, menu du compte, « Tous les modules », « + Créer », « Nouvel évènement » et « Où en est-il ? », recherche typée (premier temps) | 70b (messages et erreurs) ; peut avancer en parallèle de 70c et 70d (autres fichiers) | — |
| **70f** Le téléphone | Barre du haut de 60 px, barre du bas, « Plus », panneaux du bas | 70e | — |
| **70g** Lexique, teintes et contrôle des textes | Contrôle automatique des mots ; balayage des textes du volet en FR et EN ; rôles des teintes (A15) | tous les autres (il balaie `fr.json` en dernier, comme le C-89 du lot 69) | — |

Proposition de conduite (`feedback` « aller plus vite ») : 70a et 70b en parallèle, puis 70c ;
70e dès que 70b est fusionné, en parallèle de 70c et 70d ; 70f après 70e ; 70g en dernier.

---

## 5. Les paquets en détail

Pour chaque paquet : l'écart entre l'app et la maquette, fichier par fichier ; les critères
d'acceptation (chacun devient un `it`) ; les tests. Les `describe` portent l'identifiant de
l'exigence (`describe('CHR-02 — Qui s'en charge : un collègue', …)`).

### 5.1 Paquet 70a — Les données des tâches

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `packages/db/src/schema/events.ts` (`event_tasks`, `:504-555` ; `planning_health_settings`, `:2072`) | Responsable `planner / clients / vendor`, pas de personne ; `done_at` sans auteur ; pas de note ; seuils de santé sans « Bientôt » | Colonnes du § 3.2 |
| `modules/events/service.ts` (`listOrganizationTasks:1607`, `addEventTask:1632`, `updateEventTask:1645`, `changeEventTasks:1678`) | Liste d'organisation sans les tâches hors évènement ; filtres `vue` et `qui` ; « en retard » recalculé à trois endroits (`service.ts:1625`, `taches/task-table.tsx:55`, `lib/task-counts.ts:14`) | Une seule liste ; les filtres du § 3.3 ; un seul calcul de l'état d'échéance (nouvelle fonction pure `modules/events/due-state.ts`), lu partout |
| `modules/events/planning.ts` (`:42-118`) | Tâches hors évènement à part | Mêmes fonctions, gardées pour la répétition (`setStandaloneTaskDone` crée la suivante) ; la lecture passe par la liste unique |
| `modules/events/repository.ts` (`:927-932`) | Tri échéance, rang, création | Tri par échéance (à faire) ou par `done_at` décroissant (faites) ; filtres en SQL, jamais en mémoire |
| `modules/events/trash.ts` (`:140-158`), `packages/contracts/src/trash.ts`, `lib/trash.ts`, `app/parametres/corbeille/page.tsx` | Tâche = « élément », purgée dix minutes après, absente de la Corbeille ; tâche hors évènement supprimée sans « Annuler » | Si A5 en (a) : une tâche (ou un lot de tâches, en une ligne) reste trente jours dans la Corbeille ; « Annuler » aussi pour une tâche hors évènement |
| `app/events/[id]/task-forms.tsx` (`ResponsibleSelect:20-46`), `app/creation-rapide/actions.ts:163-186`, `app/taches/task-row-actions.ts` (`bulkTasksAction:136`) | Planner, clients, prestataire | « Vous », chaque collègue par son nom (A1), les clients (le mot du type d'évènement), chaque prestataire de l'évènement. Écrans inchangés sinon : la forme vient au paquet 70c |
| `modules/events/links-repository.ts:398,434` (le lien des mariés coche) | Ligne `event_activities` seulement | Écrit aussi `done_by_kind = 'clients'` |
| `lib/today/rank.ts` (`TODAY_HORIZON_DAYS = 14`) | Horizon de l'accueil | Inchangé (l'horizon d'« Aujourd'hui » relève du volet « Aujourd'hui ») ; seul l'état « Bientôt » de la ligne lit `soon_days` |
| `packages/auth/src/team.ts` (`listTeam:23`) | `{id, email, role, …}` | Ajoute `firstName`, `lastName` (A1) |
| Mon compte (`app/compte/…`, écran du profil) | Pas de nom | Deux champs « Prénom » et « Nom », enregistrés seuls (D7 de la porte 2, réglage isolé : « Enregistré » à côté du champ). Tant que le prénom est vide : le début de l'adresse s'affiche (« bastien »), et une ligne discrète sur l'accueil du membre propose « Indiquez votre prénom pour que l'équipe vous reconnaisse » (fermable). À la création d'un compte (`create-account`, invitation d'un membre), le prénom et le nom peuvent être donnés d'avance |

**Critères d'acceptation**

1. Une tâche d'évènement peut être confiée à un membre actif de l'organisation ; elle s'affiche
   « Vous » pour lui, par son nom pour les autres.
2. Confier une tâche à un compte d'une autre organisation, à un compte retiré ou à un identifiant
   inventé est refusé, avec le même message que pour un objet inexistant.
3. Après la migration 0211, chaque tâche « planner » existante a une personne selon la règle A2,
   et la migration se rejoue sans rien changer.
4. Cocher une tâche enregistre qui l'a cochée (`member` et son identifiant, `clients` par le lien
   des mariés) ; « Rouvrir » efface `done_at`, `done_by_kind` et `done_by_user_id`.
5. La liste d'organisation rend dans une même réponse les tâches d'évènement et hors évènement,
   filtrées et comptées (« 8 sur 42 ») ; une tâche d'un évènement annulé ou clôturé n'y est pas
   (règle actuelle, gardée).
6. L'état d'échéance est le même partout : en retard (avant aujourd'hui), aujourd'hui, demain,
   bientôt (jusqu'à `soon_days` jours, 7 par défaut), plus tard ; horloge simulée : veille, jour
   même, lendemain, septième et huitième jour, passage à l'heure d'été (dates en `Europe/Paris`).
7. Si A5 en (a) : une tâche supprimée paraît dans Paramètres › Corbeille et se restaure à sa place
   pendant trente jours ; un lot supprimé y est une seule ligne (« 3 tâches de Léa & Maxime ») ;
   la purge l'efface ensuite.
8. Une note s'enregistre, se lit dans le panneau, n'apparaît dans aucun portail ni aucun lien.

**Tests**

- Unitaires : `due-state.test.ts` (horloge simulée, cas limites ci-dessus) ; filtres et
  regroupements en fonctions pures.
- Intégration (base réelle, `tasks-70a.integration.test.ts`) : critères 1 à 8 ; migration 0211
  et sa reprise de données ; retour arrière de 0211 à 0215.
- **Isolation et abus** (helpers de `packages/testing`) : l'organisation A ne lit ni ne modifie
  les tâches, notes, auteurs ou instantanés d'annulation de B ; confier à un membre de B est
  refusé ; le filtre `qui=<membre de B>` ne rend rien ; un lien des mariés d'un évènement ne coche
  pas la tâche d'un autre ; l'Admin ne lit aucune de ces tables ; une Planner restreinte ne voit
  pas les tâches d'un évènement hors de son équipe.
- RGPD : le registre déclare les nouveaux champs (test existant du registre) ; `find`, `export`,
  `anonymize`, `erase` les couvrent.

### 5.2 Paquet 70b — Retour, danger, erreur

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après (page 4 des maquettes) |
| --- | --- | --- |
| `app/undo-notice.tsx`, `app/undo-banner.tsx`, `lib/undo.ts`, `app/taches/task-undo.tsx` (`TaskUndoProvider`), `app/accueil/today-client.tsx` (`UndoTaskNotice`), `.undo-notice` dans `globals.css:3539-3556` | Trois bandeaux, deux mécanismes (cookie, adresse), posés l'un sur l'autre (`bottom-20`, `bottom-32`) ; « Annuler » en petit mot souligné ; rien après plusieurs actions | **Un seul composant de message** (`app/ui/feedback.tsx`) monté par le gabarit : en bas à gauche du contenu (au-dessus de la barre du bas sur téléphone), un à la fois, le suivant remplace le précédent ; fond `ink`, texte blanc, secondaire `night-ink-muted`, « Annuler » en `night-accent` (bouton de 40 px) ; barre de temps ; dix secondes quand on peut défaire, cinq sinon ; le temps s'arrête sous la souris ou le focus ; `aria-live="polite"`. Les trois mécanismes actuels passent par lui |
| Messages | — | Le catalogue de la page 4 : défaire, supprimer (« Elle reste dans la Corbeille des Paramètres »), créer (« Ouvrir sa fiche », « Voir ses tâches »), copier, échec (« Réessayer », la saisie gardée), enregistrer |
| `app/ui/confirm-dialog.tsx` (4 écrans) | Une seule forme | Trois niveaux : (1) se défait, pas de question ; (2) touche des tiers : fenêtre courte, la question avec le nom de l'objet, la conséquence, « Garder … » à gauche, bouton de danger à droite (sur téléphone, page entière, « Garder … » le plus bas) ; (3) ne se défait pas : en plus, une case « Je comprends que … ne pourra pas être récupéré » |
| `app/events/[id]/change-status-form.tsx` (`:104-116`) | « Annuler l'évènement » en bouton vert plein sans renoncement ; « Réactiver (repasse en Option) » | Niveau 2, texte de la page 4 calé sur ce que fait l'app (repasse en « Option », liens refusés puis rouverts, rappels et acomptes programmés arrêtés, avoir proposé pour chaque facture émise, personne n'est prévenu) ; « Rétablir l'évènement » (M6, « On garde la maquette pour rétablir ») ; « Reporter l'évènement… » au niveau 2 aussi |
| `app/parametres/corbeille/page.tsx` | « Supprimer définitivement » avec `ConfirmDialog` | Niveau 3 (case à cocher) |
| Formulaires du lot (panneau de tâche, « Nouvel évènement », « Changer la date › Autre date ») | Attribut `required` : la bulle du navigateur parle, en anglais selon le navigateur ; erreur du serveur loin du champ (« Le libellé est obligatoire. » à 280 px) | `noValidate` ; validation par Symbola, avec les messages des schémas Zod partagés client et serveur ; sous chaque champ « ! » et le message, avec le mot du libellé ; à partir de deux erreurs, un résumé en tête (« Erreur : 2 champs à remplir… », liens vers les champs) ; focus au premier champ en erreur ; saisie jamais effacée ; bouton jamais grisé sans raison ; format de date « jj/mm/aaaa ». Nouveaux composants `app/ui/field-error.tsx`, `app/ui/error-summary.tsx` |

Le message de retour et les niveaux de danger s'appliquent dans ce lot aux écrans du volet 1 et à
ce qui passe déjà par les trois bandeaux actuels (toutes les suppressions de l'app). La validation
par Symbola s'applique aux formulaires du volet 1 ; les autres formulaires la prennent avec leur
volet (liste au § 8).

**Critères d'acceptation**

1. Après « Fait », une suppression, « Changer la date », « Confier à » ou une action en lot, le
   message dit ce qui s'est passé et sur quoi, avec « Annuler » pendant dix secondes ; « Annuler »
   rend l'état d'avant (droits revérifiés par le serveur).
2. Une seule zone de message dans la page à tout moment ; l'action suivante remplace le message.
3. Le temps s'arrête tant que la souris ou le focus est sur le message ; le message se lit au
   lecteur d'écran.
4. Le message ne couvre ni « Fait », ni l'action principale, ni la barre du bas (mesuré à 1 440,
   911 et 375 px).
5. « Annuler l'évènement… » ouvre une fenêtre qui nomme l'évènement, dit la conséquence réelle et
   propose « Garder l'évènement » ; aucun « Annuler » seul n'y figure.
6. Un évènement annulé se rétablit par « Rétablir l'évènement » ; il revient en « Option ».
7. « Supprimer définitivement » ne répond qu'une fois la case cochée.
8. Un formulaire du lot envoyé vide n'affiche aucune bulle du navigateur ; chaque champ en
   erreur a son message en français dessous ; deux erreurs ou plus donnent un résumé en tête ; la
   saisie reste.

**Tests** : Vitest (composant de message : file d'un seul, temps, pause ; niveaux de danger ;
validation partagée) ; Playwright `lot-70b-retours-danger-erreurs.spec.ts` à 1 440 et 375 px,
axe-core sur la fenêtre de danger et le formulaire en erreur ; contraste mesuré du message
(9,7:1 et 8,4:1) ; test de coupure réseau (NFR-16) : « Erreur : la tâche n'a pas été enregistrée
… Réessayer », saisie gardée. Le test existant `hub-17-ux-07-corbeille.spec.ts` est mis à jour.

### 5.3 Paquet 70c — La ligne type et le panneau

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après (page 1 des maquettes) |
| --- | --- | --- |
| `app/taches/task-table-client.tsx` (`:298-374`), `task-check.tsx` | Sept colonnes : case de sélection, rond « Fait », titre (17 % de la largeur) avec badges, catégorie (« — »), échéance modifiable dans la cellule, responsable en badge ambre ou bleu, « Modifier », « Reporter ▾ », « Supprimer » cerclé de rouge | **Ligne type** (`app/ui/task-row.tsx`, un composant pour les quatre formes) : titre-lien en encre souligné de gris (la moitié de la ligne, seule cible) ; évènement en texte simple (ou « Hors évènement ») ; échéance avec son état en mots et son icône (« ! En retard de 5 jours », « ◷ Dans 4 jours ») ; « Qui s'en charge » (initiales et nom) ; bouton « Fait » ; menu « ⋯ » (« Changer la date… », « Confier à… », « Ouvrir l'évènement », puis à part « Supprimer »). Plus de colonne Catégorie, plus de case hors du mode sélection, plus d'échéance modifiable dans la cellule. Hauteur 60 px |
| `app/events/[id]/page.tsx` (onglet `retroplanning`, `:161`, `:532-537`, `:1130-1322`), `task-forms.tsx` (`AddEventTaskForm:101-140`, `EditEventTaskForm:142` inutilisé) | Onglet « Rétroplanning » ; vue par défaut « Toutes » ; formulaire d'ajout en bas ; « Aucun modèle de rétroplanning pour l'instant. » | Onglet « Tâches » (clé `taches`, l'ancienne adresse `?onglet=retroplanning` redirige) ; sous le titre « 14 faites sur 20 · 2 en retard · rétroplanning « Mariage classique », dates comptées depuis le 12 juin 2027 » avec le lien du modèle ; « Nouvelle tâche » en haut (action principale) ; filtres Qui s'en charge, Période, Catégorie, État (« À faire » par défaut, comme l'écran « Tâches » : A21) ; ligne sans colonne Évènement ; le formulaire du bas et `EditEventTaskForm` disparaissent |
| `app/accueil/today-view.tsx` (`TodayItemLine:78-120`), `events/[id]/cockpit.tsx:96,102` | Titre en lien vert souligné ; « Ouvrir » répète le titre ; « Fait » ; pas d'« Annuler » pour une tâche hors évènement ; « Reporter » seulement dans le cockpit | Ligne allégée (sans menu) : titre-lien en encre, nom du mariage en lien séparé vers sa fiche (M4, 44 px sur téléphone), échéance et état, qui s'en charge, « Fait » (confié aux mariés compris, M3, aucun bouton de relance) ; « Ouvrir » disparaît ; dessous « 3 tâches faites aujourd'hui · Les revoir » (vers « Tâches », état Faites). Les autres sections d'« Aujourd'hui » ne changent pas |
| `app/taches/task-dialog.tsx` (fenêtre courte à 576 px depuis « Tâches », longue à 860 px depuis la fiche), `standalone-tasks.tsx:55-124` (troisième fenêtre) | Trois fenêtres, trois jeux de mots (« Qui la réalise », « Responsable », « Tâche confiée au client », « Rang et jalon ») ; « Supprimer la tâche » à 14 px d'« Enregistrer » ; erreur loin du champ ; jalon proposé seulement si responsable planner ; date au format « 11/29/2026 » | **Un seul panneau** (`app/ui/task-panel.tsx`), fenêtre longue de `DESIGN.md` (860 px, deux colonnes), ouvert depuis « Aujourd'hui », « Tâches », la fiche, une notification et la recherche. En tête : « Léa & Maxime · 12 juin 2027 » en lien vers la fiche (P-11), le titre. Champs : Échéance (le même choix que « Changer la date »), Qui s'en charge (et sa phrase : « Ils la voient dans leur espace, avec un rappel trois jours avant »), Catégorie, Note, Priorité (A6), « Place dans le rétroplanning » (« 195 jours avant le jour J · Étape clé », « Si la date de l'évènement change, l'échéance suit », remise en date relative, monter, descendre), Pièces jointes, Commentaires. Menu « ⋯ » du panneau : « Dupliquer la tâche » (A22), « Ouvrir l'évènement », à part « Supprimer la tâche » avec sa conséquence. Pied : « Fait » à gauche, « Fermer » et « Enregistrer » (seul bouton plein) à droite. Tâche faite : « Faite le 25 nov. à 14 h 40, par vous » et « Rouvrir la tâche », plus de bouton plein |
| Fermer avec des changements | — | « Fermer », la croix, Échap (et « ← Tâches » sur téléphone) demandent **dans le panneau**, à la place de son pied, « Fermer sans enregistrer ? » avec « Revenir à la tâche », « Fermer sans enregistrer », « Enregistrer et fermer » : pas de seconde fenêtre par-dessus (règle « jamais deux fenêtres empilées » de `DESIGN.md` et anti-patron du cahier des charges) |
| Mode création | Formulaire du bas de « Tâches », formulaire du Rétroplanning, « + Créer › Tâche » qui exige un évènement | Le même panneau, titre « Nouvelle tâche », bouton « Créer la tâche ». Premier choix après le titre : « Évènement », avec « Aucun évènement — ce qui ne dépend d'aucun mariage : TVA, assurance, comptabilité » en tête ; déjà choisi depuis la fiche ou quand un évènement est filtré (« Choisi d'office : vous venez de sa fiche ») ; « Répétition » seulement sans évènement ; sur téléphone « + Ajouter une catégorie ou une note » replie le reste. Les jours avant le jour J : A8 |
| `app/taches/task-row-actions.ts` (`PostponeMenu:97-131`, `lib/tasks/postpone.ts`), `DueCell:45-95` | « Reporter ▾ » (demain, dans une semaine, choisir une date) ; échéance modifiable dans la cellule ; « Décaler de… » en lot ; le menu du Rétroplanning s'ouvre coupé | **« Changer la date »**, un petit panneau : « Confirmer la voiture des mariés · prévue le sam. 21 nov. », « Demain jeu. 26 nov. », « Lundi prochain lun. 30 nov. », « Dans une semaine mer. 2 déc. », « Autre date jj/mm/aaaa » et « Enregistrer » ; un raccourci s'applique tout de suite, message « Date changée : lun. 30 nov. … Annuler » ; Échap et un clic ailleurs ferment ; en panneau du bas de toute la largeur sur téléphone. La ligne déplacée garde sa place jusqu'au prochain affichage. Déplacer une tâche de rétroplanning fixe sa date (DAT-07, règle actuelle) |
| « Confier à… » | Lot seulement, planner ou clients | Petit panneau : Vous, chaque collègue, les clients (le mot du type), un prestataire de l'évènement ; message avec « Annuler » |
| Téléphone (`globals.css:6149`, fenêtre en page entière sous 640 px) | Tableau coupé (quatrième colonne à « CA »), 40 cibles sous 44 px, première tâche à 720 px | Ligne sur trois étages (titre sur deux lignes au plus ; évènement · personne ; état · date), « Fait » et « ⋯ » de 44 px ; panneau en page entière avec « ← Tâches » (ou le nom de l'écran d'origine), « Fait » et « Enregistrer » ancrés en bas, barre du bas masquée ; tout choix (personne, date) en panneau du bas |

**Critères d'acceptation**

1. Sur « Tâches », la fiche, « Aujourd'hui » et le téléphone, une tâche montre les mêmes
   informations dans le même ordre, avec les mêmes mots ; la fiche n'a pas la colonne Évènement ;
   « Aujourd'hui » n'a pas de menu et son nom de mariage est un lien séparé.
2. Chaque ligne a une seule cible (le titre), une action rapide nommée « Fait » et un menu ;
   aucune case hors du mode sélection ; « Supprimer » n'est que dans le menu, séparé.
3. L'état d'une échéance se lit sans la couleur (mot et icône) ; le rouge n'apparaît que pour un
   vrai retard.
4. Le même panneau s'ouvre de partout ; il dit « Qui s'en charge », « Place dans le
   rétroplanning », « Étape clé » ; aucun « Responsable », « Qui la réalise », « Rang et jalon ».
5. « Enregistrer » garde tous les changements d'un coup ; « Fait » enregistre aussi les
   changements en cours ; « Fermer » avec des changements demande « Fermer sans enregistrer ? »
   sans ouvrir de seconde fenêtre ; sans changement, il ferme tout de suite.
6. Une tâche faite montre quand et par qui, et « Rouvrir la tâche ».
7. « Nouvelle tâche » crée une tâche avec ou sans évènement ; sans évènement, la répétition est
   proposée ; depuis la fiche, l'évènement est déjà choisi.
8. « Changer la date… » s'ouvre depuis la ligne et le panneau ; un raccourci s'applique, avec
   « Annuler » qui rend la date d'avant et l'état « date relative » d'avant.
9. À 375 px : aucune commande sous 44 px, aucun défilement de côté, la première tâche de
   « Tâches » arrive à 200 px au plus sous le haut de l'écran.
10. L'ancienne adresse `?onglet=retroplanning&tache=<id>` (liens de la recherche, des
    notifications, des e-mails déjà partis) ouvre l'onglet « Tâches » et la bonne tâche.

**Tests** : Vitest (ligne : quatre formes ; panneau : état « changé », confirmation en pied,
création avec et sans évènement) ; intégration (« Fait » qui enregistre aussi, « Annuler » d'un
changement de date, redirection de l'ancien onglet) ; Playwright
`lot-70c-ligne-et-panneau.spec.ts` à 1 440 et 375 px, axe-core sur la ligne, le menu, le panneau,
le petit panneau des dates ; navigation au clavier (Tab, Entrée, Échap) ; tests existants mis à
jour : `chr-02-03-hub-08-lot-63d-taches.spec.ts`, `evt-03-chr-02-fiche-taches.spec.ts`,
`prd-evt-04.spec.ts`, `hub-08-sc-03-lundi-matin.spec.ts`, `chr-10-lot-67b-taches-hors-evenement.spec.ts`.

### 5.4 Paquet 70d — L'écran « Tâches »

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après (page 2 des maquettes) |
| --- | --- | --- |
| `app/taches/page.tsx` | Pas de bouton de création en haut ; deux rangées de pastilles sans nom (`vue` : À faire, En retard, Toutes ; `qui` : Tout le monde, Planner, Mariés) ; groupé par mois seulement ; section « Tâches hors évènement » en bas avec son formulaire ; bouton « Réglages » | En-tête « Tâches · Les tâches de tous vos évènements et de l'agence » et « Nouvelle tâche » (seule action principale) ; barre de filtres de `DESIGN.md` : Évènement (Tous, Hors évènement, chaque évènement avec sa date), Qui s'en charge (Tout le monde, Vous, chaque collègue, Les clients, Les prestataires), Période (Toutes, En retard, Cette semaine, Les 15 prochains jours — retards compris, Ce mois-ci, Entre deux dates…), Catégorie, État (À faire, Faites, Toutes) ; pastille « × » par filtre posé et « Effacer les filtres » ; ligne « 8 tâches à faire sur 42 · 2 en retard », « Grouper par » (Mois, Évènement, Qui s'en charge ; Jour pour les faites), bascule Liste / Calendrier, « Sélectionner » en bouton discret. En-tête de groupe par évènement : « Léa & Maxime · 12 juin 2027 · 2 tâches · Ouvrir la fiche » ; par personne : « Bastien · 2 en retard · 6 à faire ». La section du bas disparaît. Le bouton « Réglages » quitte l'écran (C-11, à confirmer au volet « Paramètres ») |
| Paramètres d'adresse (`page.tsx:27`) | `vue`, `qui`, `affichage`, `mois`, `tache` | `evenement` (identifiant ou `hors`), `qui` (`moi`, identifiant de membre, `clients`, `prestataires`, `tous`), `periode` (`retard`, `semaine`, `15j`, `mois`, `entre` avec `du` et `au`), `categorie`, `etat` (`a-faire`, `faites`, `toutes`), `grouper`, `affichage`, `mois`, `tache`. Des identifiants, jamais un nom (aucune donnée personnelle dans l'adresse). Les anciennes valeurs redirigent (`vue=en-retard` → `periode=retard`, `qui=planner` → `qui=tous`, `qui=clients` → `qui=clients`) |
| `task-table-client.tsx` (`BulkBar:147-221`) | Cocher la première case insère la barre au-dessus du tableau (la liste descend de 74 px) ; actions : décaler de N jours, responsable (planner ou clients), catégorie, supprimer | « Sélectionner » passe en mode sélection : une case en tête de chaque ligne, « Fait » et « ⋯ » s'effacent (décalage de 40 px d'un coup, à la demande), une barre se colle au bas de la liste sans la pousser, bord d'encre et ombre, « 3 tâches sélectionnées » en tête, boutons de taille normale : Fait, Changer la date…, Confier à…, Catégorie…, et dans « ⋯ » Supprimer ; « Tout sélectionner (8) » ; « Terminer » ou Échap. « Changer la date de 3 tâches » : « Décaler de 7 jours » ou « Toutes au jj/mm/aaaa », bouton « Appliquer à 3 tâches ». Sur téléphone, la barre remplace la barre du bas (Fait, Date, Confier, Plus) et chaque choix s'ouvre en panneau du bas. « Un prestataire… » n'est proposé que si toutes les tâches choisies sont du même évènement ; sinon il dit pourquoi |
| États vides (`page.tsx:104`, `EmptyState screen="tasks"`) | « Aucune tâche à faire : tout est à jour. » pour un espace neuf comme pour un mariage repris ; seul bouton plein : « Ajouter la tâche » des tâches hors évènement | Trois textes : « Pas encore de tâche » (avec l'exemple et « Nouvel évènement » en action principale, « Nouvelle tâche hors évènement », « Lire l'aide ») ; « Tout est fait » (« La prochaine arrive le … », « Voir les tâches faites ») ; « Aucune tâche ne répond à ces trois filtres » (ce que ça veut dire, « Effacer les filtres », « Retirer « En retard » »). Mariage repris sans tâches : bandeau « À vérifier : « Léa & Hugo », repris le 24 nov., n'a pas encore de tâches » avec « Reprendre la liste de votre tableur » et « Partir d'un modèle Symbola » (§ 8, A11) ; le décompte dit « · 1 évènement sans tâches » |
| Tâches faites | Mêlées aux autres dans « Toutes », triées par échéance (la tâche cochée par erreur à 8 000 px de défilement) | « État : Faites » trie par date de fin, la plus récente en tête, groupé par jour (« Aujourd'hui », « Hier »…) ; colonnes « Faite le » et « Cochée par » ; « Échéance : 29 nov. » en second ; ligne en gris, sans barré, « Rouvrir » à la place de « Fait ». Sur téléphone : « Cochée à 14 h 40 par vous » |
| Téléphone | Filtres avant la liste (première tâche à 720 px) | « Filtres » (avec le nombre de filtres actifs) et « Mes tâches » en un toucher ; le panneau du bas des filtres s'ouvre sur les réglages en cours, commence par « Mes tâches », « En retard », « Cette semaine », et finit par « Voir les 4 tâches » (seul bouton plein) ; « Nouvelle tâche » flotte au-dessus de la barre du bas, à droite |
| `app/taches/task-calendar.tsx` | Vue calendrier | Inchangée ; garde les filtres et le regroupement (acquis) |
| `lib/task-counts.ts`, pastille « 2 en retard » du menu | Compte les retards | Lit l'état d'échéance unique (70a) ; la pastille passe à 1 après un changement de date qui sort une tâche du retard |

**Critères d'acceptation**

1. « Nouvelle tâche » est en haut de l'écran et ouvre le panneau en création.
2. Chaque filtre a un nom ; chaque filtre posé est une pastille qui se retire seule ; « Effacer les
   filtres » paraît dès le premier filtre ; les filtres restent en passant au calendrier et au
   retour d'une fiche.
3. Le décompte dit combien de tâches la liste montre sur combien (« 4 tâches sur 11 à faire ·
   filtrées »), et il se recoupe (à faire + faites = total).
4. « Période : En retard » groupé par « Qui s'en charge » donne les retards de chaque personne,
   avec le compte de chacun.
5. « Mes tâches » donne les tâches de la personne connectée en un geste, à l'ordinateur et sur
   téléphone.
6. En mode sélection, cocher une ligne ne déplace aucune autre ligne ; la barre reste au même
   endroit ; chaque action dit combien de tâches elle touche ; elle s'annule pendant dix secondes.
7. Les quatre états vides ont leur texte et leur action ; dans un espace neuf, aucune pastille de
   retard et une seule action principale (« Nouvel évènement »).
8. Une tâche cochée par erreur se retrouve en deux gestes (« État : Faites », ou « Les revoir »
   depuis l'accueil) en tête de liste, et « Rouvrir » la remet à faire.
9. Une tâche hors évènement se crée, s'affiche, se filtre (« Hors évènement ») et se coche comme
   une autre ; sa répétition crée la suivante quand elle est faite (règle actuelle).
10. Les anciennes adresses de « Tâches » mènent à la vue équivalente.

**Tests** : Vitest (paramètres d'adresse et redirections ; regroupements ; décomptes) ;
intégration (filtres en SQL, sur le jeu `symbola_lot24`) ; performance (NFR-02 : la liste filtrée
d'une agence de 500 tâches en moins de 300 ms, mesurée comme à l'ADR 0115) ; Playwright
`lot-70d-ecran-taches.spec.ts` à 1 440 et 375 px, axe-core sur chaque état vide, la barre de
sélection et le panneau des filtres ; tests d'abus sur les filtres (`evenement` et `qui` d'une
autre organisation).

### 5.5 Paquet 70e — La barre du haut et « + Créer »

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après (page 3 des maquettes) |
| --- | --- | --- |
| `app/app-shell.tsx` (`section.app-topbar`, `:638-645`) | La barre part avec la page ; recherche, « Créer », cloche, « ? » | Barre blanche de 68 px, **fixée en haut** : recherche, « + Créer » (bouton secondaire), notifications, aide de l'écran, compte (initiales et prénom). Sous 760 px de barre, le texte d'aide de la recherche devient « Rechercher… » (M7, mesuré à 911 px) ; toutes les commandes font 44 px de haut |
| Bloc du compte (`div.app-user`, `:628-633`), `OrganizationSwitcher` | En bas du menu latéral : « Connecté comme {email} » (coupé), changer d'organisation, « Se déconnecter » | Menu sous le prénom : nom et adresse en entier (à la ligne), « Atelier Roussel · titulaire », « Mon compte — nom, connexion, sécurité », « Changer d'organisation — ou en créer une autre », puis à part « Se déconnecter » en encre. Le menu latéral perd ce bloc (200 px) |
| `app/app-sidebar.tsx`, `Home.apps` (`fr:119`) | « Apps » | « Tous les modules » |
| `app/creation-rapide/quick-create.tsx` (`:52-56`), `actions.ts` | Prospect, Tâche (évènement exigé), Dépense, Devis ; « Raccourci : touche N » | Six entrées dans l'ordre de la journée, chacune avec sa phrase : « Nouvel évènement — Une demande, un mariage signé, ou un mariage que vous reprenez », « Tâche (pour Léa & Maxime) — Ou sans évènement : vous le choisirez dans le formulaire », « Prestataire — Une fiche dans votre carnet », « Contact — Un client, un proche, un lieu », « Devis (pour Léa & Maxime) », « Dépense (pour Léa & Maxime) — Une ligne réelle dans son budget » ; « Touche N pour ouvrir ce menu » en bas, sur ordinateur seulement. Une entrée dont le module n'est pas souscrit n'apparaît pas (HUB-06). « Tâche » ouvre le panneau de tâche (70c) ; « Prospect » disparaît (A12) |
| `app/events/new-event-menu.tsx`, `new/new-event-mode.ts`, `new/new-prospect-form.tsx` | Bouton « Nouveau » à trois entrées (Prospect, Évènement confirmé, Pour un client existant) ; formulaire à onze champs | **Une seule entrée « Nouvel évènement »** (bouton d'« Évènements », « + Créer », état vide) ouvrant une fenêtre courte : « Où en est-il ? * » avec deux réponses, aucune cochée d'avance (« Une demande en cours — Vous en parlez, rien n'est signé. » ; « Signé, en préparation — Le contrat est signé, même si vous aviez commencé sur papier : la liste des tâches se crée aujourd'hui. ») ; dessous, à part : « Vous le suivez déjà dans un autre logiciel ou un tableur ? Reprendre ses fichiers » (vers la page de reprise actuelle) ; « Nom de l'évènement * », « Date — Pas encore fixée », « Client — Nouveau client, ou chercher dans vos contacts » (le « client existant » devient ce champ), « Type » (A13) ; les autres champs repliés (A14). « Créer l'évènement » reste actif : sans réponse, « Choisissez où en est cet évènement » sous la question. Message après la création : « Évènement créé · Avec 42 tâches et son budget · Voir ses tâches » |
| Statut créé (`modules/events/lifecycle.ts`) | Option ou Confirmé selon l'entrée | « Une demande en cours » → Option ; « Signé, en préparation » → Confirmé (A10) |
| `app/search-box.tsx`, `lib/search/run-search.ts:61-137` | Groupes par type, dont « Tâches et prestataires » mêlés ; groupe « Actions » en premier ; Entrée ouvre la page de résultats ; une tâche ouvre `?onglet=retroplanning&tache=` | Premier temps de M9 : groupes « Tâches · 2 », « Évènements », « Contacts », « Prestataires », « Devis et factures », « Aide », chacun compté, chaque résultat dit où il mène (« Léa & Maxime · dans 6 jours ») ; le premier résultat surligné, Entrée l'ouvre, flèches pour choisir, « tous les résultats pour … » en bas ; une tâche ouvre le panneau. Les réglages viennent au volet « Paramètres ». Place du groupe « Actions » : A15 bis (voir § 7) |

**Critères d'acceptation**

1. La barre reste visible après 1 200 px de défilement ; « + Créer » et la recherche sont à un
   geste depuis le milieu d'une fiche.
2. À 911 × 512, la barre tient sur une ligne sans rien couper et le menu latéral montre toutes ses
   entrées sans défiler (mesure par script, comme au contrôle de M7).
3. L'adresse du compte se lit en entier ; « Se déconnecter » est la dernière ligne, à part.
4. « + Créer » propose les six entrées (moins les modules non souscrits), avec le contexte écrit
   depuis une fiche ; Échap et un clic ailleurs ferment.
5. « Nouvel évènement » n'a qu'une forme, depuis tous ses points d'entrée ; aucune réponse n'est
   choisie d'avance ; cliqué sans réponse, il le dit sous la question ; le statut créé suit la
   réponse.
6. « Reprendre ses fichiers » mène à la page de reprise sans créer d'évènement.
7. La recherche range ses résultats par type, avec leur nombre ; Entrée ouvre le résultat
   surligné ; résultats en moins de 500 ms, limités aux droits (HUB-12).

**Tests** : Vitest (entrées de « + Créer » selon les modules souscrits et le contexte ; statut
selon la réponse) ; Playwright `lot-70e-barre-et-creer.spec.ts` à 1 440, 911 × 512 et 375 px,
axe-core sur les menus et la fenêtre « Nouvel évènement » ; tests mis à jour :
`hub-07-creation-rapide.spec.ts`, `lot-10-recherche.spec.ts`, `lot-65f-menu-reductible.spec.ts`,
`nfr-19-zoom.spec.ts` ; tests d'abus : un module non souscrit ne paraît pas et sa route refuse.

### 5.6 Paquet 70f — Le téléphone

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après (page 3 des maquettes) |
| --- | --- | --- |
| `app/app-sidebar.tsx` (`.app-menu-toggle`, `:96-98`), `globals.css:345-386` (point de rupture 768 px) | Barre du haut de 160 px, bouton « Menu » qui déplie le menu au-dessus de la page et la pousse de 788 px, sans Échap, « Se déconnecter » à la fin | Sous 768 px : barre du haut de 60 px (nom de l'écran, puis recherche, créer, notifications, aide, en boutons de 44 px ; ni « ⌘K » ni « touche N ») ; **barre du bas** : Aujourd'hui, Évènements, Tâches (pastille « 2 », nom accessible « 2 en retard »), Prestataires, Plus ; libellés 13 px sur une ligne ; l'entrée active porte un trait et sa couleur. « Plus » ouvre un panneau du bas (Contacts, Rendez-vous, Devis et factures, Encaissements, Tous les modules, Paramètres, Tutoriels, Aide, puis « Camille · Atelier Roussel » et « Se déconnecter » à part), fermé par Échap, un glissé ou un clic dehors. La loupe ouvre la recherche en page entière ; « + » ouvre « Créer » en panneau du bas. Entrée d'un module non souscrit : A17 |
| Messages et panneaux | — | Le message de retour se pose au-dessus de la barre du bas ; la barre du bas se masque quand un panneau de tâche est ouvert, et la barre de sélection la remplace en mode sélection |
| `e2e/helpers.ts:18-28` | Aide de test qui ouvre « Menu » | Aide de test qui passe par la barre du bas ou « Plus » |

**Critères d'acceptation**

1. À 375 px (et mesuré à 360 px), cinq entrées en bas, sur une ligne, cibles de 44 px ; la barre
   du haut fait 60 px ; le contenu commence dessous.
2. « Plus » se ferme par Échap, un glissé, un clic dehors ; il ne pousse pas la page.
3. Chaque entrée se lit sans la couleur (trait de l'entrée active) ; la pastille a un nom
   accessible.
4. Aucun écran du lot ne glisse sous la barre du bas : l'action flottante, le message de retour
   et la dernière ligne restent visibles.

**Tests** : Playwright `lot-70f-telephone.spec.ts` à 375 et 360 px, axe-core ; tous les tests
qui ouvrent « Menu » passent par la nouvelle aide de test.

### 5.7 Paquet 70g — Lexique, teintes et contrôle des textes

**Contrôle automatique des textes (P-15)** : un test (`packages/i18n/src/lexique.test.ts`) lit
`fr.json` (et les fichiers de vocabulaire) et refuse les mots de la colonne « On n'écrit plus » de
la page 5, chacun avec sa règle (un mot seul ou dans une expression). Il fonctionne **en
cliquet** (A16) : une liste d'exceptions (`lexique-exceptions.json`, par clé de texte) tient les
occurrences des volets pas encore réalisés ; toute occurrence nouvelle fait échouer le test ;
retirer une exception est le travail de chaque volet. Le test C-89 du lot 69
(`lot-69-textes.test.ts`) y est rattaché. Un pendant anglais vérifie que chaque nouvelle clé a sa
traduction (`scripts/check-messages.ts`, existant).

Mots retirés **dans ce lot** (pas d'exception pour eux) : « Qui la réalise », « Responsable »
(pour une tâche ; « Responsable de traitement » du RGPD reste, par exception de clé),
« Rang et jalon », « Rétroplanning » comme nom d'onglet, « Planner » et « Planner principal » comme
valeur de « Qui s'en charge », « Tâche confiée au client », « Tâches hors évènement » comme
section, « Reporter » et « Décaler de… » pour une tâche, « Marquer comme faite », « Apps »,
« Réactiver », « Annuler » pour fermer une fenêtre (dans les fenêtres du lot), « Nouveau » seul,
« Valider » à la création. Mots tenus en exception jusqu'à leur volet : « poste », « ligne du
budget », « Réglages », « Reprendre » dans ses cinq sens, « le radar », « Plage occupée »,
« chrono », « rapport des écarts », « rapprochement », « JSON », « famille », « vos modules ».

**Teintes, répartition A en rôles** (A15) : titre-lien d'une tâche en encre souligné de gris ;
« Faite » et l'attente d'un tiers en neutre avec icône (l'ambre quitte les listes de tâches et la
pastille « Mariés ») ; « Bientôt » neutre avec horloge ; rouge pour le seul vrai retard, plus sur
« Supprimer » ; **option active de toutes les bascules et de tous les filtres de l'app en encre
pleine, texte blanc** (M8 : `.pills`, `.segmented` de `globals.css`). Les bandeaux d'information
gardent leur fond actuel jusqu'à la réécriture du Design System (§ 9).

**Critères d'acceptation** : le test du lexique passe et échoue sur une occurrence ajoutée exprès ;
aucun mot retiré ne paraît sur les écrans du volet (Playwright, texte de la page) ; l'option
active d'une bascule a un contraste de 4,5:1 au moins et se lit sans la couleur (axe-core et
mesure).

---

## 6. Les textes à créer ou à changer (français et anglais)

Clés indicatives, regroupées par paquet. Le français est celui des maquettes validées ; l'anglais
est proposé ici (C1) et relu par Julien avec la PR de chaque paquet.

| Où | Français | Anglais |
| --- | --- | --- |
| Colonne, filtre, panneau | Qui s'en charge | Who's doing it |
| Valeurs | Vous · {prénom} · Les mariés (mot du type) · Les clients · Les prestataires · Tout le monde | You · {first name} · The couple (type term) · Clients · Vendors · Everyone |
| Évènement d'une tâche | Hors évènement · Aucun évènement — Ce qui ne dépend d'aucun mariage : TVA, assurance, comptabilité | No event · No event — Anything not tied to an event: VAT, insurance, accounting |
| États d'échéance | En retard de {n, plural, one {# jour} other {# jours}} · Aujourd'hui · Demain · Dans {n} jours | {n, plural, one {# day} other {# days}} late · Today · Tomorrow · In {n} days |
| Ligne | Fait · Rouvrir · Faite à l'instant · Faite | Done · Reopen · Just done · Done |
| Menu de ligne | Changer la date… · Confier à… · Ouvrir l'évènement · Supprimer | Change date… · Assign to… · Open event · Delete |
| Phrases du menu | Demain, dans une semaine, ou une date · Vous, un collègue, les mariés, un prestataire · {évènement}, onglet Tâches · Elle va dans la Corbeille ; « Annuler » pendant dix secondes | Tomorrow, in a week, or a date · You, a colleague, the couple, a vendor · {event}, Tasks tab · It goes to the Bin; "Undo" for ten seconds |
| Panneau | Nouvelle tâche · Créer la tâche · Enregistrer · Fermer · Place dans le rétroplanning · {n} jours avant le jour J · Étape clé · Si la date de l'évènement change, l'échéance suit. · Note · Facultatif · Pièces jointes · Ajouter une pièce · Commentaires · Écrire un commentaire… · Dupliquer la tâche · Supprimer la tâche · Faite le {date} à {heure}, par {qui} · Rouvrir la tâche · + Ajouter une catégorie ou une note · Choisi d'office : vous venez de sa fiche. · Répétition · La suivante se crée quand celle-ci est faite. | New task · Create task · Save · Close · Place in the planning · {n} days before the big day · Key step · If the event date changes, the due date follows. · Note · Optional · Attachments · Add a file · Comments · Write a comment… · Duplicate task · Delete task · Done on {date} at {time}, by {who} · Reopen task · + Add a category or a note · Preselected: you came from its page. · Repeat · The next one is created when this one is done. |
| Fermer avec des changements | Fermer sans enregistrer ? · {champs} de « {tâche} » ont changé et ne sont pas enregistrés. · Revenir à la tâche · Fermer sans enregistrer · Enregistrer et fermer | Close without saving? · {fields} of "{task}" changed and are not saved. · Back to the task · Close without saving · Save and close |
| Changer la date | Changer la date · {tâche} · prévue le {date} · Demain · Lundi prochain · Dans une semaine · Autre date · Un clic ailleurs ferme sans rien changer. · Changer la date de {n} tâches · Décaler de {n} jours · Toutes au · Appliquer à {n} tâches | Change date · {task} · due {date} · Tomorrow · Next Monday · In a week · Other date · Click outside to close without changes. · Change the date of {n} tasks · Shift by {n} days · All on · Apply to {n} tasks |
| Écran « Tâches » | Les tâches de tous vos évènements et de l'agence · {n} tâches à faire sur {total} · {n} en retard · filtrées · Grouper par · Mois · Évènement · Jour · Sélectionner · Tout sélectionner ({n}) · Terminer · {n} tâches sélectionnées · Mes tâches · Filtres · Effacer · Voir les {n} tâches · Ouvrir la fiche · Faite le · Cochée par · Échéance : {date} · Cochée à {heure} par {qui} | Tasks from all your events and your business · {n} to do out of {total} · {n} late · filtered · Group by · Month · Event · Day · Select · Select all ({n}) · Done selecting · {n} tasks selected · My tasks · Filters · Clear · Show {n} tasks · Open its page · Done on · Ticked by · Due: {date} · Ticked at {time} by {who} |
| Période | Toutes · En retard · Cette semaine · Les 15 prochains jours · Retards compris · Ce mois-ci · Entre deux dates… | All · Late · This week · Next 15 days · Including late · This month · Between two dates… |
| États vides | Pas encore de tâche · (phrase et exemple de la page 2) · Nouvelle tâche hors évènement · Lire l'aide · Tout est fait · La prochaine arrive le {date} ({évènement}). · Voir les tâches faites · Aucune tâche ne répond à ces {n} filtres · Retirer « {filtre} » · À vérifier : « {évènement} », repris le {date}, n'a pas encore de tâches. · Reprendre la liste de votre tableur · Partir d'un modèle Symbola | No tasks yet · … · New task without event · Read the help · All done · The next one is due on {date} ({event}). · See done tasks · No task matches these {n} filters · Remove "{filter}" · To check: "{event}", imported on {date}, has no tasks yet. · Import your spreadsheet list · Start from a Symbola template |
| Fiche | Tâches (onglet) · {faites} faites sur {total} · {n} en retard · rétroplanning « {modèle} », dates comptées depuis le {date} | Tasks (tab) · {done} done out of {total} · {n} late · "{template}" planning, dates counted from {date} |
| Accueil | {n} tâches faites aujourd'hui · Les revoir | {n} tasks done today · Review them |
| Barre du haut | Rechercher un évènement, une tâche, un prestataire… · Rechercher… · Mon compte · Nom, connexion, sécurité · Changer d'organisation · Ou en créer une autre · Se déconnecter · Tous les modules · {organisation} · titulaire | Search an event, a task, a vendor… · Search… · My account · Name, sign-in, security · Switch organization · Or create another · Sign out · All modules · {organization} · owner |
| « + Créer » | les six entrées et leurs phrases (§ 5.5) · Tâche pour {évènement} · Touche N pour ouvrir ce menu | the six entries and their lines · Task for {event} · Press N to open this menu |
| Nouvel évènement | Où en est-il ? · Une demande en cours · Vous en parlez, rien n'est signé. · Signé, en préparation · Le contrat est signé, même si vous aviez commencé sur papier : la liste des tâches se crée aujourd'hui. · Choisissez où en est cet évènement. · Vous le suivez déjà dans un autre logiciel ou un tableur ? · Reprendre ses fichiers · Nom de l'évènement · Par exemple : Léa & Maxime · Pas encore fixée · Nouveau client, ou chercher dans vos contacts · Créer l'évènement | Where does it stand? · An ongoing enquiry · You're discussing it, nothing is signed. · Signed, in preparation · The contract is signed, even if you started on paper: the task list is created today. · Choose where this event stands. · Already tracking it in another tool or a spreadsheet? · Import your files · Event name · For example: Léa & Maxime · Not set yet · New client, or search your contacts · Create event |
| Recherche | Tâches · {n} … · Entrée ouvre le résultat surligné · flèches pour choisir · tous les résultats pour « {texte} » | Tasks · {n} … · Enter opens the highlighted result · arrows to choose · all results for "{text}" |
| Mon compte (A1) | Prénom · Nom · Enregistré · Indiquez votre prénom pour que l'équipe vous reconnaisse. | First name · Last name · Saved · Add your first name so your team recognises you. |
| Téléphone | Plus · {n} en retard (nom accessible) | More · {n} late |
| Messages de retour | Tâche faite : {tâche} · « Annuler » reste 10 secondes ; ensuite, « Rouvrir » dans les tâches faites · Date changée : {date} · {n} tâches décalées de {j} jours · Tâche supprimée : {tâche} · Elle reste dans la Corbeille des Paramètres · Tâche enregistrée : {tâche} · Évènement créé · Avec {n} tâches et son budget · Voir ses tâches · Erreur : la tâche n'a pas été enregistrée · Connexion perdue. Votre saisie est gardée. · Réessayer · Annuler | Task done: {task} · "Undo" stays 10 seconds; then "Reopen" in done tasks · Date changed: {date} · {n} tasks shifted by {d} days · Task deleted: {task} · It stays in the Bin in Settings · Task saved: {task} · Event created · With {n} tasks and its budget · See its tasks · Error: the task wasn't saved · Connection lost. Your input is kept. · Try again · Undo |
| Danger | Annuler l'évènement « {nom} » ? · (conséquences, § 5.2) · Garder l'évènement · Annuler l'évènement · Rétablir l'évènement · Motif (pour vous) · Je comprends que {objet} ne pourra pas être récupéré | Cancel the event "{name}"? · … · Keep the event · Cancel the event · Restore the event · Reason (for you) · I understand that {object} can't be recovered |
| Erreurs de saisie | Erreur : {n} champs à remplir avant de créer la tâche. · Donnez un nom à la tâche, par exemple « Réserver la navette ». · Choisissez une date d'échéance. · jj/mm/aaaa | Error: {n} fields to fill in before creating the task. · Give the task a name, for example "Book the shuttle". · Choose a due date. · dd/mm/yyyy |

Textes **retirés** : `Events.tasksTitle` « Rétroplanning » (comme nom d'onglet),
`taskColumnResponsible` « Qui la réalise », `taskResponsible` « Responsable »,
`responsiblePlanner` « Planner » (comme valeur), `taskDialogMore` « Rang et jalon »,
`taskPostpone*` (« Reporter »), `tasksBulk*` « Décaler de… », `allTasksEmpty` « Aucune tâche à
faire : tout est à jour. », `StandaloneTasks.*` (section du bas), `Events.reactivate`
« Réactiver (repasse en Option) », `Home.apps` « Apps », `QuickCreate` « Prospect » et
« Raccourci : touche N ». Les textes du portail des mariés sur leurs tâches ne changent pas.

---

## 7. Ambiguïtés et décisions à prendre par Julien

Numérotées A1 à A22 (propres à ce lot). Pour chacune : la question, ce que je recommande, et
l'autre voie. Celles qui touchent le cahier des charges sont aussi dans `docs/QUESTIONS.md`
(Q47).

| # | Question | Recommandation | Autre voie |
| --- | --- | --- | --- |
| A1 | **Quel nom pour un collègue ?** Un compte n'a pas de nom chez Symbola (`hub.users` n'a que l'e-mail). | **Tranché le 26/11 par Julien : « je préfère les champs qui reprennent prénom/nom dans mon compte. »** Deux champs « Prénom » et « Nom » dans Mon compte (migration 0216 du schéma `hub`) ; sur une ligne, le prénom ; dans le panneau et les menus, prénom et nom ; initiales des deux. En attendant qu'ils soient remplis, le début de l'adresse | (écartée) le nom de la signature d'e-mails, sinon le début de l'adresse |
| A2 | **À qui reviennent les tâches « Planner » existantes ?** | **Tranché le 26/11 par Julien : « Oui, cette règle ».** Au planner principal de l'évènement (lot 52) s'il y en a un ; sinon à la personne qui a créé la tâche, si elle est encore membre ; sinon à la titulaire. Tâches hors évènement : à leur créatrice | Laisser la personne vide (« À attribuer ») et laisser l'agence trier |
| A3 | **Une nouvelle tâche, par défaut, est à qui ?** | **Tranché le 26/11 par Julien : « Oui, à qui la crée ».** À la personne qui la crée (« Vous »), depuis tous les écrans | Au planner principal de l'évènement quand on crée depuis la fiche |
| A4 | **Tâches d'un membre dont l'accès est retiré.** | **Tranché le 26/11 par Julien : « Oui, restent ».** Elles restent à son nom, affiché « {nom} (accès retiré) » ; au retrait de l'accès, la titulaire voit « 12 tâches restent à son nom · Les confier à… » ; rien n'est réattribué sans elle | Les passer d'office à la titulaire |
| A5 | **Une tâche supprimée va-t-elle dans la Corbeille ?** La maquette validée le dit ; l'ADR 0073 (D6) en fait un « élément » qui s'annule dix secondes puis disparaît. | **Tranché le 26/11 par Julien : « Oui, Corbeille ».** (a) Oui, trente jours, un lot en une seule ligne : c'est ce que la planner a validé, et ce que dit UX-07. Avenant à l'ADR 0073 | (b) Garder l'ADR 0073 et corriger le texte de la maquette (« Annuler » seulement, pas de Corbeille) |
| A6 | **La « Priorité » (Haute) disparaît des maquettes.** Elle a été ajoutée au lot 63 à la demande de la planner. | **Tranché le 26/11 par Julien : « Oui, la garder ».** La garder dans le panneau (case « Prioritaire ») et sur la ligne en mot et icône neutres (« ↑ Prioritaire »), sans ambre | La retirer de l'écran (les données restent) |
| A7 | **Ajouter une « Note » à la tâche** (nouvelle colonne). | **Tranché le 26/11 par Julien : « Oui, une note ».** Oui, 2 000 caractères, interne à l'agence, jamais vue des mariés ni des prestataires, marquée « Note interne » | Pas de note : on se sert des commentaires |
| A8 | **Échéance « en jours avant le jour J »** à la création depuis la fiche (question laissée ouverte par la maquette). | **Tranché le 26/11 par Julien : « Oui, les deux ».** Oui : « Choisir une date » ou « {n} jours avant le jour J » ; la tâche garde alors sa date relative (DAT-07) et suit la date de l'évènement | Une date seulement ; la date relative reste réservée aux tâches nées d'un modèle |
| A9 | **« Cochée par » pour les tâches déjà faites** (l'auteur n'a jamais été gardé). | **Tranché le 26/11 par Julien : « Oui, le sûr ».** Ne remplir que ce qui est sûr : « Les mariés » quand le journal de l'évènement le dit ; sinon « — » (non connu) ; le tri par date de fin marche pour toutes | Prendre la dernière personne qui a modifié la tâche (`updated_by`), au risque d'erreur |
| A10 | **« Signé, en préparation » donne quel statut ?** Les statuts sont Option, Confirmé, En préparation, Clôturé, Reporté, Annulé (EVT-05). | **Tranché le 26/11 par Julien : « Oui, Confirmé ».** « Confirmé » : c'est ce que fait l'entrée « Évènement confirmé » aujourd'hui ; « En préparation » reste un statut que l'on pose ensuite | « En préparation » directement |
| A11 | **Mariage signé ou repris : les échéances déjà passées** (C-67, P-01 : « née en retard de 166 jours »). | **Tranché le 26/11 par Julien : « Oui, attendre ».** Ne pas trancher ici : la règle est renvoyée aux volets « Reprise » et « Premiers pas ». Dans ce lot, « Partir d'un modèle Symbola » sur un mariage repris garde le comportement actuel (ADR 0106 : rétroplanning proposé) | Écrire la règle dès ce lot : les tâches dont l'échéance est passée à la création naissent « faites » (ou « à vérifier ») |
| A12 | **« Prospect » quitte « + Créer »** (HUB-07 le cite). | Oui, comme D8 le veut : « Nouvel évènement › Une demande en cours » crée exactement ce que créait « Prospect » ; la ligne de `gap.csv` le dit | Garder « Prospect » en raccourci de « Nouvel évènement » déjà réglé sur « demande » |
| A13 | **Le type d'évènement** manque dans la maquette ; EVT-01 dit « trois champs suffisent : nom, date, type ». | Champ « Type » affiché seulement si l'organisation a plusieurs types ; sinon le seul type est pris | Toujours le demander |
| A14 | **Les autres champs de la création actuelle** (source, lieu, ville, second client). | Repliés sous « Plus de détails » jusqu'au volet « Évènements », qui dessine la création complète | Les retirer de la création (ils se remplissent sur la fiche) |
| A15 | **Teintes : qu'applique-t-on avant la réécriture de `DESIGN.md` ?** | Les rôles de la répartition A sur les écrans du volet (tâches, barres, messages) et M8 sur toute l'app (bascules et filtres, simple règle de style) ; les bandeaux d'information et les autres écrans attendent le Design System | Tout attendre le Design System (les écrans du volet gardent l'ambre et le vert) |
| A15 bis | **Recherche : le groupe « Actions »** (palette de commandes, HUB-12) passe-t-il avant les résultats ? | Après les résultats, et seulement s'il répond au texte tapé, pour qu'Entrée ouvre un vrai résultat | Garder les actions en premier |
| A16 | **Contrôle des textes en cliquet** (les mots des autres volets tenus en exception). | Oui | Tout corriger dans ce lot (déborde sur les volets pas encore maquettés) |
| A17 | **Barre du bas si « Prestataires » n'est pas souscrit.** | La quatrième place prend la première entrée de « Plus » disponible (Contacts) ; jamais une entrée « indisponible » dans la barre | Quatre entrées seulement |
| A18 | **« Annuler » après un changement de date ou de personne** demande de garder les valeurs d'avant : une table technique (migration 0215), purgée après dix minutes. | Oui | Pas d'« Annuler » sur ces gestes (contraire à C-09 et UX-07) |
| A19 | **Prévenir un collègue** à qui l'on confie une tâche ? | Pas dans ce lot : il la voit dans « Mes tâches » et sur son accueil ; la notification (HUB-15, lot 53) se décide au volet « Aujourd'hui » | Une notification dans l'app dès ce lot (nouvel événement `events.task.assigned`) |
| A20 | **Qui voit les tâches hors évènement ?** | Toute l'équipe (ce sont les tâches de l'agence), comme aujourd'hui ; une Planner restreinte ne voit que les siennes et celles qui n'ont pas de personne | Chacun ne voit que les siennes |
| A21 | **Vue par défaut de l'onglet « Tâches » de la fiche** : aujourd'hui « Toutes » ; la maquette montre « À faire ». | « À faire », comme l'écran « Tâches » (un seul patron) ; « 14 faites sur 20 » reste en tête | Garder « Toutes » dans la fiche |
| A22 | **« Dupliquer la tâche »** apparaît dans le menu du panneau, sans exister aujourd'hui. | Oui : copie titre, évènement, personne, catégorie, note ; échéance vide à choisir | Le retirer du menu |

**Points qui ne demandent pas de décision mais méritent d'être sus** :

- Le panneau actuel s'enregistre déjà par un bouton (pas champ par champ) : M1 confirme
  l'existant et l'écrit ; c'est l'écart avec le cahier des charges du § 9, point 1.
- `EditEventTaskForm` (`task-forms.tsx:142`) n'est plus utilisé : il est retiré au paquet 70c.
- Les visites guidées et le tutoriel citent l'écran « Tâches », l'onglet « Rétroplanning » et le
  bouton « Menu » : leurs étapes sont mises à jour avec chaque paquet (`lib/help/tours.ts`,
  `tours.json`), sans changer leur forme (volet « Premiers pas »).

---

## 8. Ce qui dépend des volets suivants et doit attendre

| Ce qui attend | Volet | Ce que fait ce lot en attendant |
| --- | --- | --- |
| La recherche dans les réglages (M9, deuxième temps ; C-74) | Paramètres | Résultats typés sans les réglages |
| La rubrique qui portera le seuil « Bientôt » (M10) | Paramètres | La valeur est gardée (0214) et lue ; 7 jours pour tout le monde ; pas d'écran de réglage |
| Le sort du bouton « Réglages » des écrans (C-11) | Paramètres | Il quitte « Tâches » et l'onglet de la fiche (le lien du modèle est dans la phrase) ; ailleurs il reste |
| La mesure du menu et du panneau d'aide à 911 × 512 hors barre (C-82) | Paramètres | Seule la barre et le menu latéral sont mesurés |
| Les autres sections d'« Aujourd'hui », ses compteurs (C-20), la vue d'agence (C-14), la notification d'un collègue (A19) | Aujourd'hui | Seule la ligne des tâches change, et « Les revoir » |
| L'en-tête de la fiche en 200 px, l'ordre et le dessin des onglets (C-80, P-09), « Grouper par » dans la fiche, la création complète d'un évènement (C-25) | Évènements | L'onglet est renommé ; la création pose « Où en est-il ? », le reste replié (A14) |
| « Contacts » et « Prestataires » côte à côte dans « Plus » ; les mots du budget (« poste ») ; « famille » | Prestataires, Contacts | Entrées gardées telles quelles ; mots en exception du lexique |
| La règle des échéances passées d'un mariage repris ou signé (P-01, C-67, A11) ; « Reprendre la liste de votre tableur » vers la page de reprise refaite (C-54) | Reprise et import (maquettes du volet 2, pas encore réalisées) ; Premiers pas | Les deux liens mènent aux écrans actuels (page d'import, application d'un modèle) |
| Les visites proposées et non imposées (D2), les deux parcours de tutoriels (D6) | Premiers pas et aide | Textes des étapes mis à jour, rien d'autre |
| Les valeurs du bleu, de l'orange et du crème | Design System (porte 3 de tous les volets) | Rôles appliqués aux jetons actuels (A15) |
| Les vues enregistrées (demandées par Valérie au rejeu) | Hors maquettes | Rien ; à proposer si Julien les veut |

---

## 9. Divergences avec le cahier des charges et avec `DESIGN.md`

À signaler ; **aucun ADR n'est écrit dans cette PR**. Chacun sera écrit avec le paquet qui le
réalise, si Julien confirme.

1. **Enregistrer par un bouton (M1)** contre le cahier des charges : « Fermer le panneau
   enregistre » (patrons d'interface), UX-09 « Enregistrement automatique », et l'anti-patron « Un
   bouton « Enregistrer » dont l'oubli fait perdre le travail ». La garde « Fermer sans
   enregistrer ? » empêche la perte silencieuse ; le brouillon (`DraftKeeper`, ADR 0074) peut
   garder la saisie si l'onglet se ferme. → **ADR à écrire** (paquet 70c), complète les ADR 0074
   et 0107.
2. **La tâche dans la Corbeille (A5, tranchée en (a) le 26/11)** : avenant à l'ADR 0073 (D6), dans le sens d'UX-07 et
   de HUB-17.
3. **L'onglet « Tâches » de la fiche** : le cahier des charges nomme les onglets du cockpit
   « Synthèse, Planning, Budget… » ; l'app disait « Rétroplanning », la maquette dit « Tâches »
   (M11). → à noter dans `gap.csv` ; ADR court si Julien le souhaite.
4. **Les états d'une tâche** : le cahier des charges cite « À faire, En cours, En attente d'un
   tiers, Fait, En retard ». Les maquettes n'ont pas « En cours », ajoutent « Bientôt » (« Dans N
   jours ») et disent l'attente par la personne (« Les mariés »). → à confirmer (Q47) ; ADR si
   « En cours » est écarté.
5. **« Prospect » hors de « + Créer » (HUB-07)**, remplacé par « Nouvel évènement › Une demande en
   cours » (D8, A12). Pas de perte de fonction ; à noter dans `gap.csv`.
6. **Trois champs pour créer un évènement (EVT-01 : nom, date, type)** : la maquette n'a pas le
   type (A13).
7. **`DESIGN.md`** (non réécrit dans ce lot, écarts à porter à la réécriture) : « Statut ambre pour
   en attente d'un tiers » (devient neutre) ; « Entrée de navigation active : fond `primary-soft` »
   et pastilles actives (deviennent encre, M8) ; « Messages : confirmation ou information en
   `primary-soft` » (le message de retour devient encre ; l'information, neutre bordée, attend) ;
   « Fenêtre longue … enregistrement à chaque rubrique » (le panneau de tâche s'enregistre d'un
   seul bouton, M1) ; nouveaux composants : ligne type, panneau de tâche, petit panneau des dates,
   barre de sélection, barre du bas, message de retour, niveaux de danger, erreur sous le champ.

---

## 10. Aide d'écran, captures, rejeu et `gap.csv`

- **Aide contextuelle** (`lib/help/screens.ts`) : réécrire `Help.allTasks` (filtres, « Mes
  tâches », sélection, tâches faites, tâches hors évènement) ; retirer `Help.standaloneTasks`
  (l'écran n'a plus de section à part) ; mettre à jour `Help.home` (« Les revoir ») et l'aide de
  l'onglet « Tâches » de la fiche ; ajouter l'aide du panneau de tâche (« Qui s'en charge », « Place
  dans le rétroplanning »).
- **Centre d'aide** : articles qui parlent du Rétroplanning comme onglet, de « Reporter » une
  tâche, du menu du téléphone, de « Apps ». Captures à régénérer (`pnpm --filter @symbola/app
  help:captures`) : `allTasks.jpg`, `home.jpg`, et celles qui montrent la barre du haut ou le
  menu.
- **Visites et tutoriels** : sélecteurs et textes des étapes de « Tâches », de la fiche et du
  téléphone (`lib/help/tours.ts`, `tours.json`).
- **Rejeu** (C4) : SC-03 « Lundi matin » (PAR-03, le cœur du lot) à chaque paquet qui touche la
  ligne ou l'écran ; SC-01 « Le premier quart d'heure » pour « Nouvel évènement » (70e) ; SC-06
  pour la tâche cochée par les mariés (70a) ; comptes rendus `docs/recette/SC-03.md` et
  `SC-01.md` mis à jour ; parcours PC-06 du panel (deux gestes pour la liste d'une personne).
- **`gap.csv`** : lignes CHR-02, CHR-03, CHR-04, CHR-10, HUB-07, HUB-08, HUB-12, HUB-17, UX-03,
  UX-05, UX-07, UX-08, UX-10, UX-13, UX-14, EVT-01, EVT-05 mises à jour par le paquet qui les
  touche.
- **Chaîne de sécurité** (SEC-30 à SEC-36) verte à chaque PR ; tests d'abus du § 5.1 obligatoires
  (nouvelles colonnes, nouvelle table, filtres d'adresse).
