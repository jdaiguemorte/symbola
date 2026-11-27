# Lot 71 — Réaliser le volet 2 des maquettes : la reprise d'un mariage en cours et l'import

**Statut** : **spécification validée par Julien le 27/11/2026**, décisions I1 à I11 tranchées (§ 7).
La validation vaut accord pour toucher les schémas `hub`, `events` et `budget` (migrations 0218 à
0223) et le parcours P0 PAR-01. L'ADR 0119 s'écrit au paquet 71a ; 71b attend la fusion de 70b (#189).
**Branche de la spécification** : `lot-71-reprise-et-import` (une PR vers `main`, ce fichier et
`docs/QUESTIONS.md` seulement). Chaque paquet aura ensuite sa branche `lot-71<x>-…` et sa PR.
**Date** : 27/11/2026, par Claude Code.

Sources, dans l'ordre où elles font foi :

1. `docs/audits/2026-11-ux-parcours/06-decisions-porte-2.md` (D5, D6, D8, D11) ;
2. `docs/audits/2026-11-ux-parcours/08-maquettes-reprise-import.md` (R1 à R18, tranchés le 25/11 :
   « Tout en proposition, sauf R11 = b ») et son § 4, « ce que les maquettes supposent de l'app » ;
3. les sept maquettes `docs/maquette/lot-68/06-reprise-page.html` à `12-reprise-erreurs.html` ;
4. `docs/audits/2026-11-ux-parcours/05-matrice-repris-cree.md` et `04-synthese.md` (C-51 à C-66,
   principes P-nn) ;
5. `DESIGN.md`, réécrit par la phase 6 du lot 68 (PR #193) : il porte déjà les formes de ce volet
   (« Repris », « À compléter après la reprise », « non renseigné », la page de reprise, « Retirer cet
   import… ») ; ce lot les applique, il ne le réécrit pas ;
6. `docs/CAHIER_DES_CHARGES.md` pour les exigences ; `docs/lots/lot-70-taches-et-transverse.md` pour
   ce qu'il laisse à ce lot (§ 8 : la règle des échéances passées d'un mariage repris, le lien
   « Reprendre la liste de votre tableur », la ligne à part de « Nouvel évènement »).

Règle de lecture : quand une maquette plus récente (volets 3 à 6) dessine autrement un écran que ce
volet touche, la plus récente l'emporte, sans perdre de fonction (décision de Julien du 26/11) ; les
cas sont listés au § 8 et, quand il faut choisir, dans les décisions du § 7.

Fichiers sous `apps/symbola/` sauf mention ; `fr` = `packages/i18n/src/messages/fr.json`.

---

## 1. Ce qui change pour la planner, en clair

Une fois le lot livré, Camille, qui suit ses mariages dans un tableur ou un logiciel de planning,
verra :

- **Une seule page pour reprendre un mariage en cours** : « Reprendre un mariage en cours ». Elle y
  arrive par « Nouvel évènement › Reprendre ses fichiers » ou, à la fin de l'assistant de démarrage,
  par le bouton principal quand elle a dit suivre ses mariages dans un tableur ou un logiciel. La page
  liste six fichiers dans l'ordre où les déposer : le carnet de prestataires (une fois pour toute
  l'agence), le mariage (sa fiche PDF, ou simplement son nom et sa date), le budget, les prestataires
  retenus, la liste « à faire », le programme du jour J. Chaque ligne dit où elle en est (fait, en
  cours, à faire, pas de fichier), la suivante porte le seul bouton principal, « Je n'ai pas ce
  fichier » la règle sans la laisser en suspens, et un import laissé en plan se retrouve à sa ligne
  avec « Continuer ». Elle compte « 3 fichiers sur 6 ».
- **L'assistant demande au lieu de rejeter.** Un budget sans colonne « mariage » n'est plus refusé
  ligne par ligne : depuis la page de reprise, le mariage est connu ; ailleurs, la première question
  est « Pour quel mariage est ce budget ? », avec la possibilité de le créer là. Les autres
  questions, posées une fois, chacune avec son résultat en euros ou en nombre : les acomptes du
  fichier ont-ils été payés ? les contrats des prestataires sont-ils signés ? que faire des tâches non
  faites dont l'échéance est passée ? quel type d'évènement, et où en est-il ? D'où vient le couple
  (facultatif) ? Aucune réponse n'est cochée d'avance. À côté, « Ce que Symbola a compris » écrit ce
  qu'il a déduit seul (« Réel vide → non renseigné, pas 0 € »).
- **Un import ne crée ni retard ni relance.** Ce qui était payé arrive payé, ce qui était signé
  arrive signé, ce qui était fait arrive fait, sans date inventée. Le lendemain d'une reprise,
  « Aujourd'hui » ne s'ouvre plus sur douze « Contrat de … à faire signer » ni sur des acomptes « en
  retard de 81 jours ». Seul un retard qui était déjà dans le tableur peut arriver en retard, et
  seulement si Camille choisit de le garder.
- **Ce que le fichier ne dit pas reste « non renseigné »**, jamais « — » seul ni « 0,00 € » : une
  heure de fin, une date de signature, un montant réel, la source du couple.
- **Rien n'est fondu.** Trois lignes « Traiteur » du tableur restent trois lignes ; chaque poste du
  fichier est rangé sous un poste de l'agence (« Lieu » sous « Lieu de réception ») ; un poste de
  départ sans ligne dans le fichier se garde « à trouver » ou se retire. Un prestataire qui ressemble à
  une fiche du carnet est montré à côté d'elle, colonne par colonne, avec « Si c'est la même ».
- **« Vérifier » et le bilan disent les mêmes nombres, avec les mêmes mots** (lignes, prévu, réel,
  réglé, à payer, prestataires retenus). Le bilan dit ce qui n'a pas été repris et ce que Camille a
  choisi ; « Retirer cet import… » est un bouton visible, avec sa date limite, et une fenêtre qui dit
  ce qui part et ce qui reste. Les prestataires retenus et le programme ont enfin un bilan et un
  retrait d'ensemble, comme les autres imports.
- **Le fichier d'un autre couple arrête tout.** Si le PDF des prestataires retenus ou du programme
  nomme d'autres mariés que ceux de la fiche, l'assistant le dit et propose d'abord de choisir un autre
  fichier.
- **Le programme repris d'un PDF n'invente aucune heure.** « Fin non renseignée » à la place d'une
  durée déduite ; « 19 h – 2 h, le lendemain » ; un repère (« Coucher du soleil ») sans durée ; un
  moment peut être dit « Ponctuel ». L'onglet du programme porte « À compléter : 5 heures de fin » tant
  qu'elles manquent, et le diffuser incomplet passe d'abord par une fenêtre qui le dit. L'annuaire
  des intervenants n'est plus perdu : le bilan propose d'ajouter leurs téléphones au carnet.
- **La fiche d'un mariage repris** dit « Repris le 24 nov. de 4 fichiers · Voir la reprise », et un
  bloc « À compléter après la reprise » remplace « Rien à faire : tout est à jour » : les montants à
  répartir, les contrats non signés, les tâches, les heures du programme, les liens des mariés, le
  nombre d'invités, chacun avec son bouton. La santé dit « Pas encore de tâches : pas d'avis » au lieu
  de « Bon ». « D'où viennent ces valeurs ? » montre, à la demande, le fichier de chaque valeur. Plus
  de « Champs importés » : le total du fichier va en tête du budget, « à répartir », la note dans
  « Notes », les noms à la casse de l'app (« Léa Martin », « Poitiers »).
- **Dans la liste des évènements**, une étiquette « Repris · 3 fichiers sur 6 » et un filtre
  « Origine » ; sur « Aujourd'hui », une section « Reprises en cours », une ligne par mariage.
- **Les erreurs de l'import** sont écrites sous ce qui est en cause, disent quoi faire et où aller :
  un programme déposé à la place d'une fiche est reconnu et envoyé à sa ligne ; une erreur de colonne
  s'affiche à sa ligne sans défaire les autres choix ; une ligne en défaut (« 31/02/2027 »,
  « 1.950 ») se corrige à l'écran au lieu d'être renvoyée au tableur.
- **L'écran d'import des Paramètres** ne garde que ce qui n'est pas un mariage (contacts, carnet,
  listes de l'espace), renvoie la reprise vers sa page, et montre en tête un import laissé en plan.

Ce qui **ne change pas** dans ce lot : l'en-tête et l'ordre des onglets de la fiche (volet 3), le
tableau complet du budget et le carnet « à classer » (volet 4), les questions de l'assistant de
démarrage (volet 5), la place des Paramètres (volet 6), l'import des contacts au-delà des messages
d'erreur (C-65 reporté, D11), l'import des invités (lot 49).

---

## 2. Exigences et constats traités

| Élément des maquettes | Exigences du cahier des charges | Constats et décisions |
| --- | --- | --- |
| Page de reprise, ses six lignes et ses états (page 6) | HUB-14 (import avec aperçu, doublons, annulation), PAR-01 (démarrer), UX-02 (zéro ressaisie), UX-08, UX-12 | C-51, C-52, C-54, C-59 ; D6, D8, D11 ; R1, R2, R4 ; P-04, P-07 |
| Les portes : fin de l'assistant, « Nouvel évènement », écran « Importer » (page 6) | PAR-01, HUB-09 (questionnaire), HUB-14 | C-51, C-68 (en partie) ; D6, D8 ; R3, R18 |
| L'assistant qui demande : mariage visé, acomptes, contrats, type, statut, source, échéances passées (page 7) | HUB-14, BUD-01 (cinq montants), EVT-01, EVT-05, CHR-01, CHR-02, UX-10 | C-52, C-53, C-54, C-64 ; P-01 à P-03 ; R5, R16 |
| Postes et doublons sans fondre (page 8) | HUB-14 (« détection des doublons »), PRE-01, BUD-01 | C-57, C-61 ; R17 ; P-03 |
| « Vérifier », bilan, « Retirer cet import… » (page 8) | HUB-14 (« un import s'annule en bloc »), UX-07, UX-15 | C-58, C-66 ; R6 ; P-07, P-16, P-17 |
| Fiche d'un mariage repris, « À compléter », provenance, liste, « Aujourd'hui » (page 9) | EVT-02 (cockpit), EVT-07 (portefeuille), HUB-08 (accueil), UX-01, UX-06, BUD-01 | C-53, C-55, C-56, C-61, C-64 ; R7, R8, R9 ; P-05, P-06 |
| Prestataires retenus : autre couple, aperçu, contrats, bilan (page 10) | PRE-01, PRE-02, HUB-14, UX-17 (voir avant d'envoyer) | C-53, C-62, C-66 ; D11 ; R10 |
| Programme repris d'un PDF (page 11) | CHR-06, CHR-08 (« un chrono existant s'importe »), EVT-04, UX-17 | C-63 ; D5 ; R11 (b), R12, R13, R14, R15 |
| Erreurs de l'import (page 12) | UX-10, HUB-19, NFR-16, SEC-21 | C-60 ; P-18 |
| Mots de l'import (page 12, lexique de `DESIGN.md`) | UX-10, HUB-20 | C-57, C-88, C-90 ; R6, R15 |

Hérités du lot 70 (§ 8) : la règle des échéances passées d'un mariage repris (A11, ici I3 et R16) ;
« Reprendre la liste de votre tableur » (état vide de « Tâches », paquet 70d) mène à la ligne 5 de la
page de reprise ; « Reprendre ses fichiers » (« Nouvel évènement », paquet 70e) mène à la page de
reprise.

---

## 3. L'app d'aujourd'hui, en bref

Lu dans `main` (`be343aaa`, lot 70a compris), sans lancer l'app. Ce qui compte pour ce lot :

- **L'import générique** vit dans le hub : `modules/hub/imports.ts` (`startImport:103`,
  `startEventSheetsImport:167`, décisions `:532-670`, `recordAppliedImport:676`), avec `lib/import/`
  (`apply.ts`, `matching.ts`, `wizard.ts`, `columns.ts`, `gaps.ts`, `vendor-compare.ts`) et les
  écrans `app/import/**` (étapes Fichier, Colonnes, Types, Lignes, Rapprochements, Confirmation,
  Journal). Onze sortes de fichiers (`packages/contracts/src/import/fields.ts:8-21`).
- **Un import n'est lié à aucun mariage**, sauf `hub.imports.target_event_id` pour le budget et les
  tâches (`packages/db/src/schema/hub.ts:636`). `hub.import_items` sait quel import a écrit quel
  élément (`:651-671`).
- **Les prestataires retenus (PDF) et le programme (PDF)** passent par des actions serveur à part
  (`lib/vendors/event-vendors-import.ts:57`, `modules/events/program-import.ts`), **sans journal dans
  `hub.imports`, sans bilan, sans retrait d'ensemble** ; seule une ligne d'audit les trace.
- **Trois calculs différents des nombres** : la frise de l'assistant (`wizard.ts:114-127`), la
  confirmation (`apply.ts:138-149`) et le bilan (`apply.ts:279-290`, « ignorées » =
  `rejected + unchanged`, `journal/page.tsx:128`).
- **Les règles qui fabriquent de faux retards et de fausses relances** :
  - « Acompte versé » est un synonyme du *montant* de l'acompte (`starter-templates/src/import-synonyms.json:340`) ;
    l'échéance n'est payée que si la colonne « Réglé » tombe sur le cumul (`modules/budget/import.ts:48-69`) ;
  - « Contrat de … à faire signer » vient de tout prestataire au statut `retained` d'un mariage à venir
    (`modules/events/today-sources.ts:31-50`) ;
  - l'historique de statut d'un évènement importé est daté du jour de l'import
    (`modules/events/import.ts:366-372`, `event_status_history.changed_at` par défaut `now()`) ;
  - une tâche importée faite reçoit l'heure de l'import (`modules/events/import.ts:445`).
- **Ce qui se fond ou se perd** : deux lignes d'un même poste et d'un même libellé écrivent sur la
  même ligne (`modules/budget/import.ts:106-111`, la dernière gagne pour l'estimé et l'engagé, la
  première pour le reste) ; les totaux et la note d'une fiche PDF vont dans `events.imported_fields`
  (« Champs importés ») ; l'annuaire du programme sert au rattachement puis disparaît.
- **Ce qui est exigé ou laissé** : la fiche PDF exige une source du prospect et ne pose jamais le type
  (`events.event_type_id` reste nul) ; son statut est déduit (`import-engine/src/third-party/event-sheet-row.ts:77-82`) ;
  le contrôle d'en-tête des prestataires retenus ne compare que la date
  (`lib/vendors/event-vendors-import-rules.ts:80-83`).
- **L'assistant de démarrage** enregistre « Que voulez-vous remplacer ? » dans
  `hub.organization_profiles.replaced_tools` (`hub.ts:351`) sans aucun effet sur sa fin
  (`app/demarrage/pret/page.tsx`).
- **Le contrôle des fichiers** (SEC-21) est en place pour l'import générique : type lu dans le
  contenu (`import-engine/src/read.ts:12-50`), 10 Mo, ClamAV (`modules/hub/imports.ts:111`,
  `import-jobs.ts:199`, `program-import.ts:102`, `event-vendors-import.ts:76`), neutralisation des
  cellules `= + - @` (`import-engine/src/neutralize.ts:10-24`, appliquée dans `table.ts:22`), fichier
  jamais gardé (sauf les fiches PDF, chiffrées le temps de leur lecture). Deux trous : la
  neutralisation ne s'applique pas aux textes lus dans les PDF de programme et de prestataires
  (`neutralizedCells: 0`) ; la purge des brouillons expirés (`import-repository.ts:44-53`) n'appelle
  pas `cancelImportJobs`, donc une fiche PDF jamais lue peut rester dans le stockage (à vérifier au
  paquet 71a).

---

## 4. Ce qui touche les données, les contrats et les événements

Chaque migration a son retour arrière dans `packages/db/drizzle-rollback/` (ADR 0036) et ne touche que
le schéma de son module (DAT-09). Aucune clé étrangère entre schémas (avenant de l'ADR 0012) : un
identifiant d'évènement dans `hub` est contrôlé par le service, comme `hub.imports.target_event_id`
aujourd'hui. Dernière migration de `main` : **0217** ; numéros indicatifs, à reprendre au moment du
code (les paquets 70c à 70g n'ont pas de migration).

**Ce lot touche trois schémas** : `hub` (la reprise et le journal des imports), `events` (origine,
dates inconnues, contrat déclaré, moments du programme), `budget` (total à répartir). Chaque module
écrit dans le sien, par son `service.ts` ; c'est la validation de cette spécification qui vaut accord
pour toucher les trois (règle du § 8 de `CLAUDE.md`).

### 4.1 La reprise, nouvel objet du hub

Une **reprise** est rattachée à un mariage et regroupe ses imports. Elle appartient au hub, qui
orchestre déjà l'import et l'écran (`CLAUDE.md`, § 4 : « hub : … import (écran) »).

| N° | Fichier | Ce qu'elle fait | Pourquoi |
| --- | --- | --- | --- |
| 0218 | `0218_lot71a_hub_takeovers.sql` | Tables `hub.takeovers` (`id`, `organization_id`, `event_id` nullable tant que le mariage n'existe pas, `created_by`, `created_at`, `completed_at` nullable, `checklist_closed_at` nullable) et `hub.takeover_steps` (`id`, `organization_id`, `takeover_id`, `kind` parmi `vendor_book`, `event`, `budget`, `event_vendors`, `tasks`, `program`, `state` parmi `todo`, `in_progress`, `done`, `no_file`, `covered`, `import_id` nullable, `covered_by_step_id` nullable, `decided_at`, `decided_by`). Une ligne par sorte et par reprise (unicité). RLS par organisation ; index `(organization_id, event_id)` | R1 (une page par mariage), R4 (compteur), « Je n'ai pas ce fichier » (`no_file`), la ligne 4 couverte par le budget (`covered`). La ligne du carnet est partagée : `vendor_book` d'une reprise neuve est `done` dès qu'un import de carnet a été appliqué dans l'organisation (R2, « déjà faite au deuxième mariage ») |
| 0219 | `0219_lot71a_hub_imports_takeover.sql` | `hub.imports.takeover_id uuid` nullable (index) ; ajoute `event_vendors` et `program` à l'énumération `import_entity_type` ; `hub.import_items.fields text[]` (noms des champs écrits, sans valeur) ; `hub.imports.leftovers jsonb` (ce qui est resté dans le fichier et peut être repris plus tard : l'annuaire du programme). **Étape de données** : aucune (les imports d'avant restent sans reprise, décision I8) | Les prestataires retenus et le programme entrent dans le journal commun, avec bilan et retrait (C-66) ; « D'où viennent ces valeurs ? » (R7) lit `fields` ; l'annuaire proposé au carnet (R14) |

Le retour arrière de 0219 retire les deux valeurs d'énumération après avoir effacé les imports de ces
sortes (en recréant l'énumération, PostgreSQL ne sachant pas retirer une valeur).

### 4.2 Dans le module `events`

| N° | Fichier | Ce qu'elle fait | Pourquoi |
| --- | --- | --- | --- |
| 0220 | `0220_lot71a_events_origin_and_unknown_dates.sql` | `events.events.origin text not null default 'created'` (`created` ou `takeover`) et index `(organization_id, origin)` ; `events.event_status_history.date_known boolean not null default true` ; `events.event_tasks.done_date_known boolean not null default true` | Le filtre « Origine » et l'étiquette « Repris » (P-06) se lisent en SQL dans le module, sans aller chercher le hub à chaque ligne ; « Signé le : non renseigné » (C-64) ; « Faite · date de fin non renseignée » (P-01). On garde une date technique (l'heure de l'import) pour ne casser ni les tris ni la contrainte `event_tasks_done_by_check` du lot 70a, et la marque dit qu'elle n'est pas la vraie |
| 0221 | `0221_lot71a_events_takeover_contract.sql` | `events.event_vendor_candidates.takeover_contract text` nullable (`signed`, `unsigned`, `unknown`) ; nul pour un prestataire retenu hors reprise | C-53 : un prestataire retenu par une reprise ne fabrique pas de « Contrat … à faire signer » ; « Non signé » est un fait dit par la planner, listé dans « À compléter », pas une relance (I2). `signed` pose en plus le statut `contract_signed` (existant) |
| 0222 | `0222_lot71a_events_program_timing.sql` | `events.program_items.timing text not null default 'span'` (`span` : un début et une fin ; `point` : ponctuel ; `marker` : repère) | R12 (« Ponctuel » retire le moment du compte des heures manquantes) ; le repère sans durée (page 11). « Le lendemain » se calcule (fin plus tôt que le début), comme aujourd'hui |

### 4.3 Dans le module `budget`

| N° | Fichier | Ce qu'elle fait | Pourquoi |
| --- | --- | --- | --- |
| 0223 | `0223_lot71a_budget_unallocated_totals.sql` | Table `budget.unallocated_totals` (`id`, `organization_id`, `event_id`, `committed_cents`, `paid_cents`, `currency` = `EUR`, `source_import_id`, `created_at`), une ligne par mariage au plus ; RLS ; montants en centimes, entiers | C-56 : « 21 650,50 € engagés selon votre fichier, dont 3 200,00 € réglés · 0,00 € répartis sur les postes ». Le reste à répartir se calcule (total du fichier moins somme des postes) ; la ligne disparaît quand la planner la ferme ou quand tout est réparti |

`events.imported_fields` reste (lecture seule des anciennes fiches) mais **n'est plus rempli** par la
fiche PDF : chaque valeur va à sa place (total → `budget.unallocated_totals`, note → `notes`). Les
fiches déjà importées gardent leurs « Champs importés » (décision I8).

### 4.4 Contrats (`packages/contracts`)

Changements **compatibles** (ajouts) :

- `import/fields.ts` : `IMPORT_ENTITY_TYPES` gagne `event_vendors` et `program` ; les tâches
  reconnaissent « Quoi » et « Pour quand » (synonymes dans `starter-templates/src/import-synonyms.json`,
  des données, pas du code) ;
- un nouveau contrat `import/questions.ts` : les questions de l'étape « Questions » et leurs réponses
  (`target_event`, `deposits_paid` : `yes`, `no`, `some` avec la liste des lignes ; `contracts` : `all`,
  `none`, `per_line` ; `past_due_tasks` : `keep`, `redate` avec une date, `done` ; `event_type` ;
  `event_stage` : `enquiry`, `signed` ; `prospect_source` facultatif ; `name_case` : `app`, `keep`),
  gardées dans `hub.imports.matching` (déjà en `jsonb`) ;
- `import/counts.ts` : **une seule fonction de compte** (`importFigures`) qui rend, pour une sorte de
  fichier, les nombres de « Vérifier », du bilan et de la page de reprise (lignes, prévu, réel, réglé,
  à payer, prestataires retenus ; journées, moments, fins non renseignées ; fiches trouvées et créées,
  contrats signés et non signés) ;
- `takeover.ts` : sortes et états d'une ligne de reprise, points de « À compléter » ;
- `import/apply.ts` : `ImportApplyRow` gagne les corrections faites à l'écran (§ 5.7) ;
- les types d'évènement et de tâche gagnent `origin`, `statusDateKnown`, `doneDateKnown`,
  `takeoverContract`, `timing`.

Rien d'incompatible : les anciennes valeurs restent lues ; un import en cours au moment du
déploiement se termine avec les règles d'avant (son `matching` n'a pas de questions).

### 4.5 Événements internes (`domain_events`)

**Aucun nouvel événement.** La reprise est tenue par le hub, qui écrit l'import et l'état de la
ligne dans la même transaction. Le reste se lit par les services : la fiche demande au hub l'état de
la reprise de son mariage (`hub/service.ts`, nouvelle fonction `getEventTakeover`), le hub demande
aux modules ce qui reste à compléter (§ 5.6). Les audits existants `events.vendors.imported` et
`events.program.imported` restent.

### 4.6 Droits et isolation (SEC-10 à SEC-13)

- Toute nouvelle table a `organization_id`, indexé, protégé par RLS ; le rôle de l'app n'en est pas
  propriétaire (SEC-11).
- Une reprise ne peut viser qu'un évènement de la même organisation (contrôlé par le service des
  évènements) ; un `event_id`, un `takeover_id` ou un `import_id` d'une autre organisation donne la
  même réponse qu'un objet inexistant (SEC-13).
- Une Planner qui ne voit pas tous les évènements (lot 52) ne voit que les reprises des évènements de
  son équipe, et les imports qu'elle a lancés.
- Un évènement de démonstration (`is_demo`) ne peut pas être repris ; un import n'écrit jamais dans
  un évènement de démonstration (règle actuelle, gardée).
- L'Admin d'exploitation n'a accès à aucune de ces tables (SEC-09).
- Les adresses portent des identifiants, jamais un nom (`/reprise/<id>`, `?evenement=<id>`).

### 4.7 Registre RGPD (`privacy.registry.yaml`)

| Table | Champ | Catégorie | Règle |
| --- | --- | --- | --- |
| `hub.takeovers`, `hub.takeover_steps` | tous | technique (identifiants, dates, états) | Aucune donnée personnelle. Effacés avec l'évènement (demande d'oubli qui le vise, RGPD-03) ; exportés avec l'organisation (HUB-13) |
| `hub.imports` | `leftovers` | identité et coordonnées (noms, rôles, téléphones des intervenants du programme) | Gardé **90 jours** après l'import, comme `import_items.previous` (décision I4, tranchée le 27/11), puis effacé par la purge horaire ; effacé aussi au retrait de l'import et dès que la planner a ajouté ou écarté l'annuaire ; jamais exporté ; jamais montré hors du bilan |
| `hub.import_items` | `fields` | technique (noms de champs) | Aucune valeur ; gardé tant que l'élément existe (décision I9) |
| `budget.unallocated_totals` | montants | financier, sans personne | Suit le budget de l'évènement |
| `events.events` | `origin` | technique | — |
| objets `imports/<org>/<id>/<n>.bin` du stockage | contenu des fiches PDF | toutes celles d'une fiche | **Entrée à ajouter** (absente aujourd'hui) : chiffrés, effacés après lecture, à l'abandon et à l'expiration du brouillon (correction du § 3) |

Le contrat `privacy/v1` du hub (find, export, anonymize, erase) couvre les nouvelles tables ;
`leftovers` est trouvé et effacé par une demande qui vise un nom ou un téléphone qu'il contient.
**Durée de l'annuaire** (I4, Julien, 27/11) : 90 jours pour les invités du mariage qu'il nomme
(famille, témoins), qui ne vont jamais au carnet ; les professionnels ajoutés au carnet suivent
ensuite la conservation du carnet. **Effacement d'un mariage** (27/11) : l'effacement définitif d'un
évènement efface aussi le journal de ses imports, qui aujourd'hui lui survit (§ 5.1). À porter à la fiche du DPO (`docs/conformite/`) avec le paquet
71e ; aucune autre catégorie nouvelle.

---

## 5. Les paquets en détail

Pour chaque paquet : l'écart entre l'app et la maquette, fichier par fichier ; les critères
d'acceptation (chacun devient un `it`) ; les tests. Les `describe` portent l'identifiant de
l'exigence (`describe('HUB-14 — Un import ne crée ni retard ni relance', …)`).

### 5.1 Paquet 71a — Le socle : la reprise et les règles de fond

Les migrations du § 4, et les règles qui empêchent un import de mentir, sans changer encore les
écrans (sauf ce qui en découle tout seul : moins de fausses relances sur « Aujourd'hui »).

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `packages/db/src/schema/hub.ts`, `events.ts`, `budget.ts` | — | Tables et colonnes du § 4 |
| `modules/hub/takeovers.ts` (nouveau), `hub/service.ts` | — | Créer une reprise, la lire, régler une ligne (`no_file`, `covered`), rattacher un import à sa ligne, calculer le compteur (R4 : `done`, `no_file`, `covered` et `in_progress` couvrant une autre ligne comptent), marquer `completed_at` |
| `modules/events/import.ts:336,366-372` | Statut `option` par défaut, ou déduit ; étape datée du jour | Statut selon la réponse « Où en est-il ? » (`enquiry` → Option, `signed` → Confirmé, comme A10 du lot 70) ; ligne d'historique avec `date_known = false` ; `origin = 'takeover'` pour un évènement créé par une reprise |
| `modules/events/import.ts` (source, type) | Source par défaut exigée ; type jamais posé | Source facultative (`prospect_source_id` reste nul, « non renseignée », comptée à part dans les statistiques) ; type posé quand l'organisation n'en a qu'un, sinon pris de la réponse |
| `modules/events/import.ts:445,462` | `doneAt: new Date()` | `doneAt` technique, `done_date_known = false`, `done_by_kind` nul |
| `modules/events/import.ts:502` | Prestataire d'une ligne de budget : `retained` si un réel est donné, sinon `shortlisted` (« Pressenti ») | `retained` dès qu'un nom est sur la ligne (« Ce que Symbola a compris : Prestataire → Retenu sur la ligne »), `takeover_contract` selon la réponse (I1) |
| `modules/events/today-sources.ts:31-50` (`findUncontractedVendors`) | Tout `retained` d'un mariage à venir | Sauf `takeover_contract is not null` : la reprise n'en fait jamais une relance (I2) |
| `modules/budget/import.ts:48-69` (échéances) | Payé seulement si « Réglé » tombe sur le cumul | Selon la réponse `deposits_paid` : `yes` → l'acompte devient une échéance payée à sa date (`paid_on = due_on`) ; `no` → une échéance due ; `some` → selon la liste ; sans question (pas d'acompte daté), la règle actuelle |
| `modules/budget/import.ts:106-111` (`targetLine`) | Deux lignes d'un même poste écrivent sur la même ligne | **Dans un même fichier, chaque ligne du fichier est une ligne du budget**, jamais fondue ; contre le budget existant, une ligne de même poste et de même détail est un doublon possible à décider (§ 5.4) |
| `modules/budget/service.ts`, `unallocated.ts` (nouveau) | Totaux d'une fiche dans `events.imported_fields` | `setUnallocatedTotals`, `getUnallocatedTotals` (reste à répartir calculé) ; la fiche PDF n'écrit plus `imported_fields` |
| `packages/import-engine/src/third-party/event-sheet-row.ts:42,77-82` | `note`, `paid`, `balance`, `total` en champ libre ; statut déduit | Note → `notes` ; total et payé → `unallocated_totals` ; solde et pourcentage non repris (recalculés) ; statut demandé, plus déduit |
| `packages/import-engine/src/values.ts` (casse) | « MARTIN » reste en capitales | `appNameCase` : prénom et nom à la casse de l'app (particules et noms composés gardés : « de La Tour », « Le Gall », « Saint-Exemple ») ; la ville aussi ; « Garder les capitales » l'annule pour un import |
| `lib/import-purge.ts`, `import-repository.ts:44-53` | Les brouillons expirés gardent leurs fiches PDF chiffrées | La purge appelle `cancelImportJobs` (efface les objets) ; et efface `leftovers` après 90 jours |
| `lib/trash.ts:236` (`purgeEvents`), `modules/hub/imports.ts` | L'effacement définitif d'un évènement (corbeille, 30 jours) efface budget, devis, invités et plans, **mais pas le journal de ses imports** : `import_items.previous` et les valeurs écrites (noms, téléphones) restent jusqu'à 90 jours, `leftovers` aussi | `purgeEvents` appelle une fonction du hub (`eraseEventImports`, par `service.ts`) qui efface, pour les imports de cet évènement, les valeurs d'avant, les valeurs écrites, `leftovers` et `fields` ; il ne reste que la trace sans donnée personnelle (date, sorte de fichier, nombres du bilan, « retiré le … »). « Retirer toute la reprise… » (I10, 71d) l'appelle aussitôt. Correction demandée par Julien le 27/11 ; action jugée très rare (mariage importé par erreur, essai fait en production) |
| `program-import.ts:60`, `event-vendors-import.ts` | Textes des PDF non neutralisés | Chaque texte lu passe par `neutralizeCell` (SEC, § 6) |

**Critères d'acceptation**

1. Une reprise se crée sans évènement, reçoit son évènement à la ligne 2, et ne peut viser qu'un
   évènement de son organisation.
2. Le compteur d'une reprise compte les lignes `done`, `no_file`, `covered` (R4 : une ligne couverte
   par un import encore en cours compte).
3. Le budget de `budget.csv` (corpus) répondu « Oui, payés » donne 8 727,00 € réglés, 18 775,00 € à
   payer, aucune échéance en retard au 24/11/2026 ; répondu « Non », 6 échéances en retard.
4. Les trois lignes « Traiteur » de `budget.csv` donnent trois lignes du budget, chacune avec son
   détail et ses montants ; le prévu total reste 36 450,00 €.
5. Un prestataire retenu par une reprise, signé, non signé ou non renseigné, ne paraît jamais dans
   « Contrat de … à faire signer » ; un prestataire retenu à la main ensuite y paraît (règle actuelle).
6. Une fiche PDF importée « Signé, en préparation » donne un évènement Confirmé, une ligne
   d'historique « date non renseignée », aucune source, le type de l'espace s'il n'y en a qu'un, la
   note dans « Notes », 21 650,50 € et 3 200,00 € dans le total à répartir, rien dans
   `imported_fields`.
7. Une tâche cochée « x » dans `a-faire.csv` arrive faite, date de fin non renseignée, sans auteur.
8. « Léa MARTIN », « POITIERS » deviennent « Léa Martin », « Poitiers » ; « Garder les capitales »
   les laisse.
9. Un brouillon de fiche PDF expiré n'a plus d'objet dans le stockage après la purge.
10. Une cellule « =HYPERLINK(…) » lue dans un PDF de programme est neutralisée.
11. Un mariage repris, supprimé puis effacé de la corbeille, ne laisse aucune valeur dans le journal de
    ses imports (`previous`, valeurs écrites, `leftovers`, `fields`) ; la trace qui reste ne contient
    ni nom, ni téléphone, ni nom de fichier. Restauré avant 30 jours, il garde son journal intact.

**Tests**

- Unitaires : compteur (R4) ; `importedPaymentSchedule` selon les trois réponses, **à l'horloge
  simulée** (acompte daté de la veille, du jour même, du lendemain ; solde le 28/03/2027, jour du
  passage à l'heure d'été) ; `appNameCase` (particules, traits d'union, accents, « MC », initiales) ;
  `targetLine` (aucune fusion dans un fichier) ; `findUncontractedVendors` en règle pure.
- Intégration (base réelle, `takeovers-71a.integration.test.ts`) : critères 1 à 9 et 11 (horloge
  simulée : effacement au 30e jour de corbeille, restauration au 29e) ; migrations 0218 à
  0223 et leurs retours arrière (`rollback.integration.test.ts`).
- **Isolation et abus** (helpers de `packages/testing`) : l'organisation A ne lit ni ne modifie les
  reprises, lignes, imports, totaux à répartir de B ; une reprise de A ne peut pas viser un évènement
  de B ; un `import_id` de B rattaché à une ligne de A est refusé ; une Planner restreinte ne voit pas
  la reprise d'un évènement hors de son équipe ; l'Admin ne lit aucune de ces tables ; un évènement
  de démonstration ne peut pas être repris.
- RGPD : le registre déclare les nouveaux champs (test du registre existant) ; `find`, `export`,
  `anonymize`, `erase` couvrent `leftovers` ; la purge efface `leftovers` à 90 jours (horloge simulée :
  89e, 90e, 91e jour).

### 5.2 Paquet 71b — La page de reprise et ses portes (page 6)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/reprise/page.tsx`, `app/reprise/[takeoverId]/page.tsx` (nouveaux) | Aucune page ; quatre portes sans ordre (C-51) | **« Reprendre un mariage en cours »** : titre, phrase (« Déposez les fichiers de votre ancien outil, dans cet ordre. Rien n'est écrit avant votre accord ; chaque import se retire pendant 90 jours. »), compteur « 0 fichier sur 6 », six lignes numérotées (`app/reprise/takeover-step.tsx`) : nom, phrase, état en mots et par une forme (rond plein et coche, rond tracé, pointillés, tiret ; jamais par la seule couleur), un ou deux boutons. La ligne suivante a le trait d'encre et le seul bouton plein. Les lignes 3 à 6 disent « Après le mariage » tant qu'il n'existe pas (pas de bouton grisé). « Un fichier qui contient plusieurs choses coche toutes les lignes qu'il remplit » ; « Comment exporter depuis mon logiciel ? » (aide) |
| Ligne 2, « Saisir les noms et la date » | Créer le mariage à la main, ailleurs, onze champs | Petit formulaire : « Nom de l'évènement * », « Date », « Client » (le champ du lot 70e), avec la phrase « Il sera « Signé, en préparation » ; ses tâches viendront de votre liste, pas d'un modèle » ; « Continuer la reprise ». **Aucun modèle de rétroplanning n'est appliqué** à un mariage repris (C-67) ; le budget de départ (postes) l'est, puisque l'étape « Doublons » s'y range |
| États « En cours » et « Terminé » | — | En cours : titre « Reprendre « Juliette & Romain » », « Mariage du 20 mars 2027 · reprise commencée aujourd'hui à 9 h 40 » ; ligne faite : fichier, heure, nombres du bilan (mêmes mots, § 5.4), « Voir le bilan » ; ligne en cours : « Arrêté à « Questions » : 1 réponse à donner », « Continuer », « Abandonner cet import… » ; ligne couverte : « Votre budget nomme 7 prestataires : ils seront retenus avec lui », « Déposer un fichier quand même ». Terminé : « Reprise terminée. Il reste 6 points à compléter à la main. » (jamais « tout est à jour »), la liste en une phrase, « Ouvrir « À compléter » », la date limite de retrait, « Reprendre un autre mariage » (page neuve, carnet déjà fait) |
| Chaque import ouvert depuis la page | Revient aux Paramètres | Porte la reprise (`?reprise=<id>`), le dit en tête (« ← Reprendre « Juliette & Romain » »), y revient à la fin ; le message de retour du lot 70b (« Budget repris : 14 lignes · Voir le budget ») |
| `app/events/new/…` (fenêtre « Nouvel évènement », paquet 70e) | « Reprendre ses fichiers » mène à l'import actuel | Mène à `/reprise` |
| `app/taches/…` (état vide « mariage repris sans tâches », paquet 70d) | « Reprendre la liste de votre tableur » mène à l'import actuel | Mène à la ligne 5 de la reprise du mariage (ou en crée une) |
| `app/demarrage/pret/page.tsx` | Ne propose que de créer | R3 : si `replaced_tools` contient un tableur ou un logiciel, « Reprendre un mariage en cours » en bouton plein, avec la phrase (six fichiers, trente minutes, rien n'est écrit avant votre accord) et « Créer un nouveau mariage » en second ; sinon l'inverse (décision I5) |
| `app/import/page.tsx` | « Que voulez-vous reprendre ? », trois tuiles de reprise et « Un autre fichier » ; journal en bas, « Reprendre » | **« Reprendre et importer »** (lexique, G6 du volet 6 ; décision I6) : « Contacts, carnet de prestataires, listes de votre espace » ; bandeau « Un mariage en cours ? Passez par sa page de reprise » ; en tête, l'import laissé en plan (« Import en cours : budget.csv, pour « Juliette & Romain ». Arrêté à « Questions »… Continuer ») ; trois boutons de même rang (Des contacts, Un carnet de prestataires, Une autre liste) ; journal à colonnes Fichier, Pour, Date, État, un lien par ligne (« Continuer », « Voir le bilan »). R18 : un budget, des tâches ou une fiche déposés ici restent acceptés et passent par « Pour quel mariage ? » (§ 5.3) |
| Menus et recherche | « Importer » dans les listes et la recherche | « Reprendre et importer » dans les menus « ⋯ » d'Évènements, du carnet et des contacts, et dans la recherche (action « Reprendre un mariage en cours ») |

**Critères d'acceptation**

1. La page vide montre six lignes dans l'ordre R2, une seule action principale (la ligne 1), et les
   lignes 3 à 6 disent pourquoi elles attendent.
2. « Je n'ai pas ce fichier » règle la ligne (« Pas de fichier · choisi le … »), la fait compter, et
   peut être défait par « Déposer un fichier ».
3. Saisir « Juliette & Romain », 20/03/2027 crée un évènement Confirmé, d'origine « reprise », sans
   aucune tâche, et coche la ligne 2.
4. Un budget qui nomme ses prestataires coche la ligne 4 (« Avec le budget ») dès qu'il est en cours.
5. Un import laissé en plan se retrouve à sa ligne (« Continuer » et ce qui l'arrête) et en tête de
   « Reprendre et importer ».
6. La page terminée compte ce qui reste et mène à « À compléter » ; elle n'écrit jamais « à jour ».
7. Au deuxième mariage, la ligne 1 est déjà faite.
8. « Nouvel évènement › Reprendre ses fichiers », la fin de l'assistant (réponse « un tableur »), la
   recherche et l'état vide de « Tâches » mènent à la page de reprise.
9. À 375 px : aucune commande sous 44 px, aucun défilement de côté ; les deux boutons de la fin de
   l'assistant collés en bas, le principal en haut.

**Tests** : Vitest (état et forme de chaque ligne, compteur, ligne suivante) ; intégration (créer,
régler, couvrir ; deuxième reprise) ; Playwright `lot-71b-page-de-reprise.spec.ts` à 1 440 et 375 px,
axe-core sur la page vide, en cours, terminée et sur « Reprendre et importer » ; tests mis à jour :
`imp-09-reprise.spec.ts`, `imp-08-fiches-evenement.spec.ts`, `hub-09-10-*` (fin de l'assistant),
`sc-01-sc-10-demarrage.spec.ts` ; abus : la page d'une reprise de B répond comme une page inexistante.

### 5.3 Paquet 71c — L'assistant qui demande (page 7)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `lib/import/wizard.ts:10-23` | Fichier, Colonnes, Types, Lignes, Rapprochements, Confirmation | Fichier, Colonnes, (Métiers pour le carnet), **Questions** (nouvelle, seulement s'il y a une question), Doublons, Vérifier. La frise dit « Étape 3 sur 5 · Questions » sur téléphone ; l'étape en cours est marquée en encre (S6 du Design System) ; les étapes à venir estompées disent ce qui les débloque |
| `app/import/[importId]/questions/page.tsx` (nouveau), `questions-form.tsx` | — | Une question par bloc, aucune réponse cochée d'avance (R5), chaque réponse avec son résultat chiffré ; « Continuer » sans réponse écrit sous la question « Choisissez … » (forme du lot 70b) ; « Ce que Symbola a compris » à droite (colonne « Votre fichier » → « Dans Symbola », avec « Voir » vers les lignes) |
| Le mariage visé (budget, tâches sans colonne évènement) | `matching.ts` rejette « Événement introuvable ou ambigu » ligne par ligne, au quatrième écran | Depuis la reprise : écrit en tête, pas demandé. Ailleurs : première question « Pour quel mariage est ce budget ? » (les mariages à venir, chacun avec son état de budget : « budget vide », « 9 postes, 6 pourvus ») et « Un mariage pas encore dans Symbola » (nom et date ; il est créé à l'écriture, avec une reprise). Un fichier **avec** une colonne évènement garde le rattachement actuel ; une ligne au mariage introuvable devient une ligne à corriger (§ 5.7), jamais un rejet muet |
| Les acomptes | Échéance due, « En retard » | « Les montants de « Acompte versé » ont-ils été payés ? » avec le nombre de lignes et leurs dates ; Oui (« Réglé 8 727,00 € · reste à payer 18 775,00 € · aucune échéance en retard »), Non (« … 6 échéances en retard »), Certains seulement (cases ligne par ligne à « Vérifier », total mis à jour). Posée seulement si une colonne d'acompte est datée et que rien ne dit déjà « payé » |
| Les contrats (budget qui nomme des prestataires ; prestataires retenus, § 5.5) | Rien | « Leurs contrats sont-ils signés ? » Tous, Aucun, Ligne par ligne ; « Aucune relance n'est créée, quelle que soit la réponse » (I1) |
| La fiche d'un logiciel | Type non posé, statut déduit, source exigée | « Quel type d'évènement ? » (ou « Type : Mariage, le seul de votre espace ») ; « Où en est-il ? » avec les mots de « Nouvel évènement » (« Signé, en préparation — Date de signature : non renseignée. Aucun modèle de tâches n'est appliqué. ») ; « Comment ce couple vous a-t-il connue ? (facultatif) », « Non renseignée » ; à droite « Ce qui sera écrit » (noms à la casse de l'app et « Écrits ainsi dans le fichier : … · Garder les capitales », date en toutes lettres, lieux, ville, budget souhaité, « Déjà engagé 21 650,50 €, dont 3 200,00 € réglés · à répartir », notes) et « Non repris : … » avec la raison |
| La liste « à faire » | « Quoi » et « Pour quand » non reconnus ; pas de porte | Synonymes ajoutés ; question « 2 tâches non faites ont une échéance déjà passée » (les nomme) : les garder à leur date (« 2 tâches en retard, comme dans votre tableur »), leur donner une nouvelle date (choisie à « Vérifier »), « Elles sont faites, je n'avais pas coché » ; « Ce que Symbola a compris » : « x » → Faite (date de fin non renseignée), vide → À faire, « moi » → Vous (la personne qui importe, lot 70a), « mariés » → Les mariés, un prénom de collègue → ce collègue (proposé, modifiable) ; « Les tâches arrivent dans l'onglet « Tâches » du mariage. Aucun modèle n'est ajouté ; aucune relance n'est créée. » Après l'import, l'onglet dit sous son titre « 12 à faire sur 17 · reprises de a-faire.csv aujourd'hui », lignes à la forme du lot 70c, sans marque sur chaque ligne |
| « Partir d'un modèle » (point « Les tâches » d'« À compléter ») | ADR 0106 : rétroplanning proposé, échéances passées en retard (C-67) | La même question que pour la liste reprise, sur les tâches du modèle dont l'échéance est passée (I3) |
| `import-header.tsx:31-49` | « Abandonner l'import » (lien souligné) | « Abandonner cet import… » (bouton secondaire, à chaque étape), même fenêtre, texte gardé (« rien n'a encore été importé ») ; message de retour ensuite, retour à la page d'où l'on vient |

**Critères d'acceptation**

1. Un budget sans colonne évènement, déposé dans « Reprendre et importer », n'est jamais rejeté
   faute de mariage : la question vient en premier ; « Un mariage pas encore dans Symbola » crée le
   mariage et sa reprise à l'écriture.
2. Depuis la page de reprise, le mariage n'est pas demandé.
3. Aucune question n'a de réponse cochée ; chaque réponse affiche son résultat, recalculé sur le
   fichier ; « Continuer » sans réponse dit ce qui manque sous la question.
4. « Certains seulement » coche ligne par ligne et le total réglé suit.
5. La fiche PDF d'un espace à un seul type ne demande pas le type ; à plusieurs, elle le demande.
6. La source laissée vide est « non renseignée » et l'import passe.
7. `a-faire.csv` : « Quoi » et « Pour quand » reconnus d'office ; la question des deux échéances
   passées est posée, et chaque réponse donne ce qu'elle annonce (2 en retard, 2 redatées, 7 faites).
8. Aucun modèle de tâches n'est appliqué à un mariage repris, sauf par « Partir d'un modèle », qui
   pose la même question sur les échéances passées.

**Tests** : Vitest (règles de chaque question et de son résultat chiffré ; synonymes ; « Ce que
Symbola a compris ») ; intégration (les trois fichiers du tableur fictif, de bout en bout, chaque
réponse) ; **horloge simulée** pour les échéances passées (la veille, le jour même : une tâche due
aujourd'hui n'est pas « passée », le lendemain ; passage à l'heure d'été) ; Playwright
`lot-71c-questions.spec.ts` à 1 440 et 375 px, axe-core sur chaque question ; abus : la question « Pour
quel mariage » ne propose jamais un mariage de B, et un identifiant de B posté à la main est refusé.

### 5.4 Paquet 71d — Doublons, « Vérifier », bilan, retrait (page 8)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/import/[importId]/rapprochements/page.tsx`, `lib/import/matching.ts`, `vendor-compare.ts` | « 25 rapprochements attendent votre décision », ressemblance en pourcentage, trois boutons de lot | **« Doublons »** en deux parties. *Postes* : « 8 postes du fichier, 9 postes dans ce mariage · Chaque ligne du fichier reste une ligne » ; tableau Dans votre fichier → Rangé sous le poste → Pourquoi (« Nom proche », « Même nom », « Nouveau poste », un poste du fichier réparti entre deux postes d'après le détail, marqué « À vérifier » et « C'est juste ») ; « Rien dans votre fichier : Tenues, poste de départ, à trouver » avec « Le garder « à trouver » » et « Le retirer de ce mariage » (R17). *Prestataires* : « 7 noms, 6 trouvés tels quels dans votre carnet » ; chaque doublon possible comparé colonne par colonne (Dans votre fichier, Dans votre carnet, Si c'est la même, la valeur qui change en gras), « Ce qui les rapproche » en mots, « C'est la même fiche » ou « Ce n'est pas la même : créer une fiche ». « Continuer » répond toujours et nomme les choix qui restent, avec un lien vers chacun. Sur téléphone, un choix par écran |
| Rangement des postes (`similarity.ts`, `event-vendors-import-rules.ts:34` `proposeImportSlot`) | La règle du préfixe ne vaut que pour les prestataires retenus ; « Lieu » / « Lieu de réception » sous le seuil de 60 | Une seule fonction de rangement pour le budget et les prestataires retenus : même nom, préfixe, synonymes de métiers (`starterVendorTypeSynonymGroups`), puis ressemblance ; un poste du fichier peut se répartir entre deux postes d'après le détail de chaque ligne (« Reportage photo » → Photographe, « Film » → Vidéaste) ; sinon un nouveau poste aux mots du fichier, modifiable |
| `app/import/[importId]/confirmation/page.tsx`, `apply.ts:138-149` | « Fiches créées », « Fiches mises à jour » | **« Vérifier : ce qui va être écrit »** : les nombres de `importFigures` (« 14 lignes dans 9 postes, dont 1 nouveau · 36 450,00 € prévus · 27 502,00 € réels (7 lignes non renseignées) · 8 727,00 € réglés : 6 acomptes · 18 775,00 € à payer : 5 soldes, du 20 févr. au 20 mars 2027 · 7 prestataires retenus ») et ce que l'import ne fera pas (« aucune échéance en retard, aucune relance, aucune tâche créée · non repris : rien ») ; le budget tel qu'il sera, poste par poste, deux postes puis « tout afficher » ; chiffres de même largeur, à droite, espace des milliers et « € » ; bouton « Importer les 14 lignes » |
| `app/import/[importId]/journal/page.tsx` | Trois pastilles vertes ; « 14 créés · 0 mis à jour » ; « Annuler cet import » à déplier | **Le bilan** : « Budget repris dans « Juliette & Romain » · importé aujourd'hui à 10 h 21 par Camille », les mêmes nombres, mot pour mot ; « Ce qui n'a pas été repris » (avec la raison et une suite) ; « Ce que vous avez choisi » (les réponses et les choix de « Doublons ») ; « Et maintenant » (« Ligne 3 de la reprise cochée. Suivant : Liste « à faire » », « Retour à la reprise ») ; « Voir le budget » en action principale ; la date limite et **« Retirer cet import… »** en bouton de danger (forme du lot 70b) |
| `lib/import/apply.ts:435` (`undoImport`), fenêtre | Deux modes peu lisibles ; ce qui reste n'est pas dit | Danger de niveau 2 (lot 70b) : « Retirer l'import « budget.csv » ? », « Le budget de « Juliette & Romain » revient à ce qu'il était avant 10 h 21 aujourd'hui », « Partent : … », « Restent : … » (fiches venues d'un autre import, poste de départ remis « à trouver », lignes modifiées depuis à la main), case « Retirer aussi les 2 lignes modifiées depuis », « Garder l'import » à gauche, « Retirer l'import » ; la ligne de la reprise repasse « à faire ». Le retrait de la fiche d'un mariage : « Retirer toute la reprise… » (décision I10, critère 8) |
| Les nombres | Trois calculs (`wizard.ts`, `apply.ts` ×2) | `importFigures` partout : frise, « Vérifier », bilan, journal, page de reprise ; « mises à jour », « inchangées » et « ignorées » ne s'affichent plus comme des nombres concurrents |

**Critères d'acceptation**

1. Sur `budget.csv` : les 14 lignes restent 14 lignes ; « Lieu » est rangé sous « Lieu de
   réception », « Photo et vidéo » réparti entre Photographe et Vidéaste (« À vérifier »).
2. Un poste de départ sans ligne demande « garder » ou « retirer » ; retiré, il n'est plus « à
   trouver » dans ce mariage.
3. « Élodie Beauté » est comparée à « Élodie Perrot · Beauté » ; « C'est la même fiche » retient la
   fiche du carnet sur « Coiffure et maquillage ».
4. « Continuer » avec des choix restants les nomme et mène au premier.
5. **Les cinq nombres de « Vérifier » et du bilan sont identiques** (test sur chaque fichier du
   corpus et des tableurs fictifs), et la page de reprise redit ceux du bilan.
6. « Retirer cet import… » rend le budget d'avant ; « Restent » dit exactement ce qui reste ; la case
   retire aussi les lignes modifiées ; la ligne de la reprise repasse « à faire ».
7. Le retrait est refusé après la date limite (90 jours), avec la raison.
8. **Retirer toute la reprise** (I10) : sur le bilan de la fiche d'un mariage qui a d'autres imports,
   « Retirer l'import » laisse place à « Retirer toute la reprise… ». Danger de niveau 3 : la fenêtre
   nomme le mariage et chaque import qui part (« budget.csv, prestataires.pdf, programme.pdf, puis la
   fiche et le mariage « Juliette & Romain » »), dit ce qui reste (fiches du carnet venues d'un autre
   import, lignes modifiées à la main), et demande de cocher « Je comprends que le mariage et tout ce
   que ces imports ont écrit seront retirés ». Les imports partent du plus récent au plus ancien, puis
   le mariage, dans une seule transaction : en cas d'échec, rien n'est retiré. Si l'un des imports a
   passé sa date limite, le bouton n'est pas proposé et la fenêtre dit lequel. Seul, le retrait de la
   fiche retire le mariage (niveau 2, qui le nomme).

**Tests** : Vitest (`importFigures` : propriété « Vérifier = bilan » sur tous les fichiers du corpus ;
rangement des postes ; répartition par détail) ; intégration (retrait avec et sans lignes modifiées ;
**horloge simulée** sur la date limite : 89e, 90e, 91e jour, et la date affichée) ; Playwright
`lot-71d-doublons-bilan.spec.ts` à 1 440 et 375 px, axe-core sur « Doublons », « Vérifier », bilan et
fenêtre de retrait ; tests mis à jour : `imp-03-rapprochements`, `imp-05-confirmation`,
`hub-14-lot-63b-import` ; abus : retirer l'import de B est refusé comme un objet inexistant ; retirer toute la reprise de B aussi. Intégration du critère 8 : retrait d'ensemble réussi, échec d'un retrait au milieu (rien n'est retiré), un import au-delà de 90 jours (bouton absent).

### 5.5 Paquet 71e — Les prestataires retenus et le programme (pages 10 et 11)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `app/events/[id]/vendors-import-form.tsx`, `vendors-import-actions.ts:46`, `lib/vendors/event-vendors-import.ts` | Action serveur à part, aperçu de 620 px, une lettre par menu, « Fichier de : … » en texte, pas de journal | Le PDF passe par l'assistant commun (`/import/envoi`, entité `event_vendors`, journal, bilan, retrait d'ensemble). Étapes Fichier, Questions, Postes, Vérifier. Aperçu pleine largeur : Dans votre fichier, Fiche du carnet (« Trouvée dans le carnet », « Nouvelle fiche »), Poste du budget en entier, Contrat (si « Ligne par ligne »), Reprendre (case) ; seules les lignes incertaines ont « À vérifier » et la raison (« Pas de poste « Brunch » ») ; « Ligne non reprise : « Belle Journée », votre agence » (acquis gardé). Sur téléphone, les lignes à vérifier d'abord |
| `event-vendors-import-rules.ts:80-83` (`importHeaderCheck`) et le programme | Seule la date est comparée | `sameCouple(fichier, fiche)` : **un autre couple quand aucun des deux mariés ne concorde, prénom et nom, accents et casse ignorés** (R10) ; alors l'étape Fichier s'arrête : « Ce fichier est-il bien celui de Léa et Hugo ? », tableau Dans le fichier / Sur la fiche (ce qui diffère en gras), « Choisir un autre fichier » (bouton plein), « C'est bien ce mariage, continuer » (réponse gardée au bilan). Rien n'est demandé si la fiche n'a pas de mariés ou si le fichier n'en nomme pas |
| Bilan des prestataires retenus | Aucun | « 12 prestataires retenus sur « Léa & Hugo » » : Trouvés dans le carnet 8 · Fiches créées 4 · Contrats signés 10 · Non signés 2 · Nouveaux postes 2 ; « Non repris : aucun montant, votre fichier n'en donne pas. 21 650,50 € restent à répartir sur la fiche. » ; « Retirer cet import… » défait les douze |
| `app/events/[id]/program-import-form.tsx`, `program-actions.ts:263`, `modules/events/program-import.ts` | Action serveur à part ; pas de journal | Assistant commun (entité `program`) : Fichier (contrôle du couple), Interlocuteurs, Vérifier. Aperçu : « 3 journées · 12 moments, dont 1 repère · 7 heures de fin non renseignées · 1 moment caché des mariés · Non repris : l'annuaire (8 intervenants et leurs téléphones) » ; journées « Veille », « Jour J », « Lendemain » (R11 = b, règle du lot 67d gardée), date complète à côté ; « 12 h · Fin non renseignée », « 19 h – 2 h le lendemain », « 21 h 18 · repère » ; une fin à minuit dans l'export : « Votre fichier donnait « 11:00 - 00:00 » : une fin à minuit, laissée vide » ; « Qui » dit le poste et la personne (« Traiteur (Paul) ») ; les lieux et heures de la fiche restent des lieux, ils ne deviennent plus des moments ; heures à la française (« 12 h 15 ») |
| `program-import-rules.ts`, `third-party/program-export.ts:113` | Fins non déduites dans le code ; l'audit en a vu (« 00:30 – 11:00 ») | **Aucune heure de fin déduite, nulle part** (test sur chaque PDF du corpus) ; une ligne sans interlocuteur ni fin devient un repère (`timing = 'marker'`), écrit dans « Ce que Symbola a compris », modifiable |
| L'onglet « Programme du jour J » (`app/events/[id]/page.tsx:1330`…) | « Pas encore diffusé… », rien ne dit ce qui manque | Bandeau « À compléter : 5 heures de fin non renseignées. Votre PDF ne les donnait pas. Saisissez-les, ou indiquez qu'un moment est ponctuel. Le programme n'est pas encore partagé. · Aller à la première » ; sur chaque moment concerné, « Heure de fin » et « Ponctuel » (fond d'« À vérifier ») ; le bandeau disparaît à zéro ; « séquence » devient « moment » dans l'onglet (R15) |
| Diffuser un programme incomplet (`programPublish`, `fr:2228`) | Diffusé tel quel | Fenêtre courte (pas de danger) : « Le programme n'est pas complet · 5 heures de fin sont non renseignées. Les mariés et les prestataires verraient ces moments sans fin, marqués « heure de fin à venir ». », la liste par journée, « Compléter d'abord » (bouton plein), « Diffuser quand même » (R13) ; dans l'espace des mariés, la page du prestataire et le PDF, « heure de fin à venir » |
| Bilan du programme et annuaire | L'annuaire disparaît | Bilan : Journées 3 · Moments 12, dont 1 repère · Fins non renseignées 7 ; « Non repris : l'annuaire, 8 intervenants et leurs téléphones » ; « Les ajouter au carnet » : les intervenants déjà au carnet sont reconnus (« ajouter le 06 39 98 02 02 », « déjà à jour »), un absent y serait créé, les mariés et l'agence sont écartés et le disent ; « Ajouter les 3 téléphones » (R14). L'annuaire est gardé dans `hub.imports.leftovers` le temps décidé en I4 |

**Critères d'acceptation**

1. `prestataires-evenement.pdf` du corpus (« Clémence MARTIN, Bastien LEROY ») déposé sur « Léa &
   Hugo » (« Léa Martin, Hugo Bernard ») arrête l'import à l'étape Fichier ; « Léa MARTIN » seule
   suffit à ne rien demander ; « Martin » seul ne suffit pas.
2. L'aperçu se lit sans ouvrir aucun menu ; trois lignes seulement sont « À vérifier ».
3. Tous, Aucun, Ligne par ligne donnent les contrats annoncés ; aucun « à faire signer » n'en naît.
4. Le bilan des prestataires redit 8 + 4 = 12 et 10 + 2 = 12 ; « Retirer cet import… » retire les
   douze retenues, les postes créés, et les fiches créées si rien d'autre ne s'y rattache.
5. Aucun PDF du corpus ne donne une heure de fin qui n'est pas dans le fichier ; la soirée de la
   veille finit « 2 h le lendemain ».
6. L'onglet compte les fins manquantes ; « Ponctuel » et une heure saisie font baisser le compte ; à
   zéro, le bandeau disparaît.
7. « Diffuser… » sur un programme incomplet ouvre la fenêtre ; « Diffuser quand même » diffuse, et
   les destinataires lisent « heure de fin à venir ».
8. « Ajouter les 3 téléphones » complète les fiches du carnet sans en créer de double ; les mariés et
   l'agence ne sont jamais ajoutés.

**Tests** : Vitest (`sameCouple` : accents, casse, inversion prénom et nom, un seul marié, noms
composés ; règles des fins ; repère) ; intégration (deux PDF de bout en bout, retrait d'ensemble) ;
**horloge simulée et fuseau** : un moment de 23 h à 1 h la nuit du 27 au 28 mars 2027 (heure d'été)
garde ses heures locales et finit « le lendemain » ; Playwright `lot-71e-retenus-programme.spec.ts` à
1 440 et 375 px, axe-core sur l'arrêt « autre couple », l'aperçu, l'onglet et la fenêtre de
diffusion ; tests mis à jour : `hub-14-lot-67e-prestataires-retenus`, `lot-65g-retours-testeuse`,
`program-pdf-import.integration.test.ts` ; abus : un lien de prestataire ne voit que ses moments,
« heure de fin à venir » compris, et jamais l'annuaire.

### 5.6 Paquet 71f — La fiche d'un mariage repris et ses reflets (page 9)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| En-tête de la fiche (`app/events/[id]/page.tsx`) | Rien ne dit la reprise | Sous l'en-tête actuel : « Repris le 24 nov. de 4 fichiers · Voir la reprise » (étiquette neutre, icône de fichier). L'en-tête en 200 px reste au volet 3 |
| `app/events/[id]/cockpit.tsx` (Synthèse) | « Rien à faire pour le moment : tout est à jour. » ; bandeau « Prochaine étape : créer les liens » ; santé « Bon » sur zéro tâche ; « Champs importés » | Bloc **« À compléter après la reprise »** à la place de « Prochaine action » et du bandeau, tant qu'un point reste : « 6 points · 0 fait », un point par ligne avec son nombre, sa phrase et son bouton (Montants de 12 prestataires · Saisir les montants ; 2 contrats non signés · Voir les postes ; Les tâches · Reprendre une liste · Partir d'un modèle ; 7 heures de fin · Compléter ; Le lien personnel des mariés · Créer les liens ; Le nombre d'invités · Saisir) ; un point fait passe en bas, coché. Une fois tout fait : « ✓ Reprise complétée le 2 déc. · Revoir la liste », puis le bloc disparaît au bout de sept jours (R9) et « Prochaine action » revient. Santé : « Pas encore de tâches : pas d'avis » ; budget « 21 650,50 € engagés · enveloppe 25 000,00 € · Selon votre fichier ; dont 3 200,00 € réglés ; 0,00 € réparti sur les postes » ; prestataires « 12 retenus · 10 contrats signés ». « Champs importés » ne s'affiche plus pour un mariage repris par ce lot |
| « D'où viennent ces valeurs ? » | — | Interrupteur dans « Informations » (R7) : à côté de chaque valeur reprise, le nom du fichier (`import_items.fields`) ; une valeur modifiée depuis à la main ne porte plus de marque ; « vous, à la reprise » pour ce qui a été saisi sur la page de reprise ; « non renseigné » en gris pour ce qui manque |
| Les points de « À compléter » (`modules/hub/takeovers.ts`, par les services) | — | Calculés à chaque lecture, jamais stockés : montants (lignes retenues sans prévu, et le reste à répartir), contrats (`takeover_contract` `unsigned` ou `unknown` encore non signés), tâches (aucune tâche), heures (moments `span` sans fin), liens des mariés (aucun lien actif), invités (nombre non renseigné). `completed_at` posé la première fois que la liste est vide |
| Onglet « Budget et prestataires » | « 11/17 », « 11 lignes pourvues sur 17 », « — » partout, « Champs importés » | Bandeau « À compléter : 21 650,50 € engagés selon votre fichier, dont 3 200,00 € réglés. Votre logiciel n'a pas exporté le détail par prestataire. Saisissez le montant de chaque poste : le reste à répartir baisse à mesure. » ; « 25 000,00 € enveloppe · 21 650,50 € engagés selon le fichier · 0,00 € répartis sur les postes » ; colonne « Contrat » (Signé, Non signé, non renseigné) ; « non renseigné » au lieu de « — » ; compteur de l'onglet : décision I7 |
| `app/events/page.tsx`, `lib/portfolio/portfolio.ts` | Aucune marque d'origine | Étiquette neutre « Repris · 3 fichiers sur 6 » (reprise en cours) ou « Repris · 6 points à compléter » (terminée, points restants), qui mène à la page de reprise ; disparaît une fois la reprise complétée ; filtre « Origine » (Toutes, Repris, Créés dans Symbola), lu sur `events.origin` |
| « Aujourd'hui » (`app/accueil/today-view.tsx`, `lib/today/load.ts`) | Douze « Contrat de … à faire signer · Depuis le 24 novembre » | Section **« Reprises en cours »** en tête, une ligne par mariage en reprise (« Léa & Hugo · reprise terminée hier · 6 points à compléter · Voir ce qui reste » ; « Juliette & Romain · 3 fichiers sur 6 · import du budget en cours · Continuer ») ; le nom du mariage en lien séparé (M4) ; le compteur « 4 points » ne compte pas les reprises (C-20). Les autres sections ne changent pas (volet 3) |

**Critères d'acceptation**

1. Le lendemain de la reprise de « Léa & Hugo », la Synthèse ne contient ni « tout est à jour », ni
   « Bon », ni « Champs importés », ni « 0,00 € engagés » ; elle montre les six points.
2. Faire un point le fait passer en bas, coché, sans recharger la page ; les six faits donnent
   « Reprise complétée le … » ; au huitième jour (horloge simulée : 6e, 7e, 8e jour), le bloc a
   disparu et « Prochaine action » revient.
3. « D'où viennent ces valeurs ? » montre le fichier de chaque valeur reprise et rien sur une valeur
   modifiée depuis.
4. Le reste à répartir baisse quand un montant est saisi sur un poste ; à zéro, le bandeau du budget
   disparaît.
5. La liste des évènements filtre par origine ; l'étiquette mène à la reprise et quitte la ligne une
   fois la reprise complétée.
6. « Aujourd'hui » au lendemain d'une reprise n'a aucune ligne née de l'import, et a sa section
   « Reprises en cours ».
7. Un mariage créé dans Symbola n'a ni étiquette, ni bloc, ni interrupteur (rien ne change pour lui).

**Tests** : Vitest (points d'« À compléter » en règles pures ; R9 à l'horloge simulée) ; intégration
(points par module à travers les services ; filtre d'origine en SQL) ; performance (NFR-02 : la liste
des évènements avec le filtre et l'étiquette, une agence de 200 évènements, sous le seuil de
l'ADR 0115) ; Playwright `lot-71f-fiche-reprise.spec.ts` à 1 440 et 375 px, axe-core ; tests mis à
jour : `hub-08-sc-03-lundi-matin`, `evt-03-chr-02-fiche-taches`, `ux-13-lot-62c-fiche-evenement` ;
abus : le filtre `origine` et l'étiquette ne révèlent rien d'une autre organisation ; le portail des
mariés ne montre ni « À compléter » ni la provenance.

### 5.7 Paquet 71g — Les erreurs de l'import et ses mots (page 12)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `packages/import-engine/src/detect.ts` (nouveau), route `/import/envoi` | Un programme déposé comme fiche : « trop de pages pour une fiche » ; un budget comme contacts : « reconnu 0 sur 9 » | `detectImportKind` : à partir du contenu (profils du logiciel tiers, colonnes reconnues par sorte), la sorte la plus probable. Sous la zone de dépôt : « ! Erreur : ce fichier n'est pas une fiche d'évènement. C'est un programme du jour J : trois journées, des heures et des moments. », « Le reprendre comme programme du jour J ? Il ira à la ligne 6 de la reprise, une fois le mariage créé », « Le garder pour la ligne 6 », « Saisir les noms et la date à la place ». Le fichier déposé est gardé le temps du brouillon, jamais à redéposer |
| `app/import/[importId]/colonnes/columns-form.tsx` | « Continuer » ne bouge pas ; erreur hors de vue ; tous les menus à « Nom du prestata… » | Erreur sous la ligne en cause, focus sur elle, autres choix intacts ; résumé en tête à partir de deux erreurs (« Erreur : 2 colonnes à revoir avant de continuer » et liens) ; colonne « Exemple (ligne 2) » ; ce que l'import a corrigé sans le dire est écrit (« Dans votre export, ces deux colonnes sont inversées : Symbola les avait remises à l'endroit · Revenir à la proposition ») |
| `app/import/[importId]/ecarts/…`, `lib/import/gaps.ts`, `report-csv.ts` | « Téléchargez le rapport pour les corriger dans votre tableur, puis réimportez-les » | À « Vérifier », « Erreur : 3 lignes sur 22 ne peuvent pas être reprises telles quelles » ; tableau Ligne, Poste · détail, Valeur lue, Ce qu'il faut (« Cette date n'existe pas » et un champ jj/mm/aaaa ; « Montant ambigu : 1 950 € ou 1,95 € ? » et deux boutons qui écrivent les deux montants ; « Pas de poste… Choisissez-en un ») ; « Laisser ces 3 lignes de côté » (listées au bilan), « Télécharger ces 3 lignes (CSV) » en second ; le bouton suit (« Importer les 22 lignes » ou « … les 19 lignes »). Sur téléphone, une ligne par écran. **Chaque valeur corrigée repasse par la validation Zod et par la neutralisation** |
| Messages (`fr` : `Import.blocker.*`, `Import.*`) | Mots techniques (« JSON », « encodage », « séparateur », « tableau ») | Le catalogue de la page 12, chacun « Erreur : » + ce qui ne va pas + quoi faire + un bouton : format non pris en charge (« .pages : exportez en PDF ou en Excel »), PDF scanné (une image), trop de pages pour une fiche, aucune colonne reconnue, fichier trop lourd (avec la vraie limite : 10 Mo), échec pendant l'écriture (message de retour du lot 70b : « Rien n'a été écrit. Vos choix sont gardés. · Réessayer ») ; rôle « alert », placé sous la zone en cause |
| Lexique (`packages/i18n/src/lexique.test.ts`, `lexique-exceptions.json`, paquet 70g) | « rapprochement », « chrono », « séquence », « rapport des écarts », « JSON » tenus en exception | Mots de la page 12 retirés des écrans de l'import et du programme, et leurs exceptions effacées : « rapprochement », « ressemblance … % », « propositions sûres », « rapport des écarts », « lignes rejetées », « Annuler cet import », « Abandonner l'import » (lien), « en cours · Reprendre », « Champs importés », « chrono », « séquence », « JSON » ; « Reprendre » ne désigne plus que le parcours de reprise |

**Critères d'acceptation**

1. Le programme du corpus déposé à la ligne « Le mariage » est reconnu, et « Le garder pour la ligne
   6 » le retrouve à la ligne 6 sans le redéposer.
2. `budget.csv` déposé dans « Des contacts » est reconnu comme budget et « Le reprendre comme
   budget » mène à « Pour quel mariage ? ».
3. Une erreur de colonne n'efface aucun autre choix et reçoit le focus ; deux erreurs donnent un
   résumé.
4. Les trois lignes en défaut du budget fictif se corrigent à l'écran ; une date impossible, un
   montant ambigu, un poste manquant ont chacun leur message ; laissées de côté, elles sont au bilan.
5. Une correction qui commence par « = » est neutralisée ; une correction invalide est refusée par le
   serveur même si l'écran est contourné.
6. Aucun message de l'import ne contient « JSON », « encodage », « séparateur » (test du lexique) ;
   chaque message a sa traduction anglaise.

**Tests** : Vitest (`detectImportKind` sur chaque fichier du corpus, y compris les refusés ; messages ;
validation des corrections) ; intégration (correction à l'écran jusqu'à l'écriture) ; Playwright
`lot-71g-erreurs.spec.ts` à 1 440 et 375 px, axe-core sur chaque message et le tableau des lignes à
corriger, navigation au clavier ; test du lexique en cliquet (une occurrence ajoutée exprès échoue) ;
tests mis à jour : `imp-01-formats`, `imp-02-colonnes`, `imp-04-ecarts`, `hub-14-sc-10-contacts`.

---

## 6. Neutralisation des cellules et contrôle des fichiers (SEC-21)

Ce qui existe est gardé ; ce lot ferme trois trous et n'ajoute aucune brique.

- **Une seule porte d'entrée des fichiers** : les PDF des prestataires retenus et du programme
  quittent leurs actions serveur et passent par la route `/import/envoi` (71e), donc par les mêmes
  contrôles que les autres : type lu dans le contenu (signatures, `looksLikePdf`), 10 Mo
  (`platform_settings`), trois pages, dix secondes de lecture, ClamAV avant toute lecture, nom
  régénéré, fichier jamais gardé (les PDF chiffrés le temps de leur lecture, effacés ensuite). Cela
  règle au passage la limite d'une action serveur, plus basse que celle de l'import (à mesurer au
  paquet 71e).
- **Neutralisation partout** : chaque cellule d'un tableur (acquis, `table.ts:22`), chaque texte lu
  dans un PDF (fiche, programme, prestataires retenus, annuaire), chaque valeur corrigée à l'écran
  (71g) passe par `neutralizeCell` avant d'être gardée ; le CSV des lignes laissées de côté est
  re-neutralisé (acquis, `report-csv.ts`). Les nombres signés restent des nombres (acquis).
- **Purge** : les objets des fiches PDF d'un brouillon expiré sont effacés (71a) ; `leftovers` est
  purgé (I4).
- **Tests obligatoires** : le fichier de test antivirus standard (EICAR) est refusé par chacune des
  portes, PDF des prestataires et du programme compris ; un PDF renommé en `.csv`, un `.xlsx` qui est
  un zip quelconque, un `.pages`, un PDF scanné, un fichier de 32 Mo sont refusés avec leur message ;
  `formules.csv` du corpus et un PDF de programme qui contient « =1+1 » ressortent neutralisés à
  l'écran, dans la base et dans tout export (HUB-13, BUD-10).
- **Journaux** (SEC-20) : identifiants seulement, jamais un nom de fichier ni un nom de marié ; les
  audits `events.*.imported` gardent leur forme.

---

## 7. Ambiguïtés et décisions à prendre par Julien

Numérotées **I1 à I11** (propres à ce lot ; « A » est pris par le lot 70, « R » par les maquettes).
Pour chacune : la question, où regarder, ma recommandation et l'autre voie. Je les poserai une par
une. Celle qui touche le cahier des charges est aussi dans `docs/QUESTIONS.md` (Q48).

| # | Question | Où regarder | Recommandation | L'autre voie |
| --- | --- | --- | --- | --- |
| I1 | **Le budget d'un tableur nomme des prestataires : demande-t-on si leurs contrats sont signés ?** La maquette ne pose la question que pour le PDF des prestataires retenus (page 10) ; pour le budget (page 7), elle écrit seulement « Prestataire → Retenu sur la ligne ». | Page 7, « Ce que Symbola a compris » ; page 10, « L'aperçu » ; page 9, colonne « Contrat » | **Oui** : la même question (« Tous, Aucun, Ligne par ligne ») à l'étape « Questions » du budget, quand il nomme des prestataires. Une réponse de plus, mais les contrats arrivent justes et « Non signé » va dans « À compléter ». **Tranché le 27/11 par Julien : oui, on demande aussi pour un budget de tableur** | Ne rien demander : contrat « non renseigné » pour tous, et un seul point « 7 contrats non renseignés » dans « À compléter » |
| I2 | **Un contrat « non signé » ou « non renseigné » à la reprise : la relance « à faire signer » revient-elle un jour ?** La règle de fond dit « un import ne crée ni relance » ; elle ne dit pas jusqu'à quand. | Page 9, « Aujourd'hui » et « 2 contrats non signés » ; `today-sources.ts` | **Jamais d'office** : le contrat reste un point d'« À compléter » jusqu'à ce qu'il soit signé ; la planner peut noter une relance elle-même (lot 65d), qui revient alors à sa date. **Tranché le 27/11 par Julien : jamais d'office** | La relance revient d'office, par exemple 60 jours avant le jour J |
| I3 | **« Partir d'un modèle » sur un mariage repris : que deviennent les tâches du modèle dont l'échéance est déjà passée ?** Le lot 70 (A11) a renvoyé la règle ici ; le volet 5 (B7) dessine pour un mariage créé « déjà fait ou à faire, redaté d'ici 4 semaines ». | Page 9, « Les tâches » ; lot 70, A11 ; maquette 23 (volet 5) | **La même question que pour la liste reprise (R16)** : les garder en retard, leur donner une nouvelle date, ou les dire faites, une fois pour toutes, avec le nombre. Le volet 5 reprendra le même composant pour B7. **Tranché le 27/11 par Julien : la même question** | Attendre le volet 5 et appliquer B7 tel quel, plus tard ; d'ici là, le modèle garde le comportement actuel (retards) |
| I4 | **Combien de temps garder l'annuaire du programme** (noms, rôles et téléphones des intervenants) **pour le proposer au carnet ?** C'est une durée de conservation de données personnelles. | Page 11, « Le bilan et l'annuaire » ; § 4.7 | **90 jours**, comme les valeurs d'annulation d'un import ; effacé plus tôt s'il est ajouté, écarté ou si l'import est retiré. À faire confirmer par le DPO. **Tranché le 27/11 par Julien : 90 jours pour les intervenants qui sont des invités du mariage (famille, témoins) ; les autres (prestataires, professionnels) relèvent du carnet d'adresses de la planner** : une fois ajoutés par « Les ajouter au carnet », ils suivent la conservation du carnet ; l'annuaire, lui, n'en garde aucune copie au-delà de 90 jours | 7 jours, comme un brouillon d'import |
| I5 | **La fin de l'assistant de démarrage dès ce lot ?** R3 choisit le bouton principal selon la réponse « Que voulez-vous remplacer ? ». Le volet 5 (B2, B3, B6) refera les questions et cette page, sans être encore programmé. | Page 6, « Les portes » ; note 11, B3 et § « R3 (volet 2) » | **Oui, R3 seul, sur l'écran actuel** : une réponse « tableur » ou « logiciel » met « Reprendre un mariage en cours » en bouton plein. Le volet 5 ajoutera sa question et le récapitulatif. **Tranché le 27/11 par Julien : oui, dès ce lot** | Ne pas toucher l'assistant ; la reprise ne s'ouvre que par « Nouvel évènement » et la recherche jusqu'au volet 5 |
| I6 | **Le nom de l'écran d'import des Paramètres.** La maquette 6 l'appelle « Importer un fichier » ; le volet 6 (G6), plus récent, le renomme « Reprendre et importer » et le sort des Paramètres. | Page 6, « « Importer » des Paramètres » ; note 12, G6 | **« Reprendre et importer » dès ce lot**, à sa place actuelle ; il quittera les Paramètres avec le volet 6. **Tranché le 27/11 par Julien : oui, dès ce lot** | Garder « Importer un fichier » jusqu'au volet 6 |
| I7 | **Le compteur de l'onglet « Budget et prestataires ».** R8 compte les lignes complètes (« 0 sur 12 », prestataire retenu et prévu connu) ; le volet 4, plus récent, écrit « 6 postes retenus sur 9 » pour un mariage créé. | Page 9, « Budget et prestataires » ; note 10, ligne « Budget, en-tête » | **Une seule règle pour tous les mariages : les lignes complètes de R8**, avec le mot du volet 4 (« 6 postes complets sur 9 ») ; pour un mariage créé dans Symbola, une ligne retenue sans prévu est rare, le nombre change peu. **Tranché le 27/11 par Julien : postes complets** | « Postes retenus » (volet 4) pour tous, et « lignes complètes » seulement dans le bandeau « à répartir » d'un mariage repris |
| I8 | **Les mariages déjà repris avant ce lot** (par l'import d'aujourd'hui, en production depuis le 19/11) : leur donne-t-on l'étiquette « Repris » et une page de reprise ? | § 4.1 (étape de données de 0219) | **Non** : rien n'est reconstruit ; ils gardent leurs « Champs importés » et leur journal. Seuls les mariages repris après le lot ont une reprise. **Tranché le 27/11 par Julien : rien n'est reconstruit** | Reconstruire, pour chaque évènement créé par une fiche PDF, une reprise « terminée » à partir du journal, avec l'étiquette et « À compléter » |
| I9 | **Combien de temps « D'où viennent ces valeurs ? » sait-il d'où vient une valeur ?** Le journal efface les valeurs écrites après 90 jours. | Page 9, « Informations » ; § 4.7 | **Tant que l'objet existe**, par les seuls noms de champs (aucune valeur gardée). **Tranché le 27/11 par Julien : tant que l'objet existe** ; les données importées elles-mêmes ne sont jamais effacées par le journal, seules les valeurs d'annulation le sont à 90 jours | 90 jours, comme le retrait d'un import ; ensuite l'interrupteur disparaît |
| I10 | **Retirer l'import de la fiche d'un mariage** (celui qui a créé le mariage) quand d'autres imports y sont rattachés. La maquette ne le dessine pas. | Page 8, « Retirer un import » ; `undoImport` | Le refuser en le disant : « Retirez d'abord les 3 autres imports de ce mariage (budget, prestataires, programme) », avec un lien vers chaque bilan ; seul, le retrait de la fiche retire le mariage (niveau 2, qui le nomme) | « Retirer toute la reprise… » d'un geste : tous les imports du mariage, puis le mariage (niveau 3, case à cocher). **Tranché le 27/11 par Julien : tout retirer d'un geste** (voir le critère 8 du paquet 71d) |
| I11 | **Un scénario de rejeu pour la reprise.** Aucun scénario du cahier des charges (§ 17) ne reprend un mariage en cours : SC-10 ne reprend que des contacts, SC-01 crée un mariage. La règle C4 veut un rejeu par lot. | `docs/CAHIER_DES_CHARGES.md` § 17 ; PC-02 de l'audit | **Écrire un scénario local `SC-R1 · Reprendre un mariage en cours`** (Camille, SU-01, les tableurs fictifs ; puis Sophie, SU-04, à 150 %) dans `docs/recette/`, rejoué à chaque paquet, et demander en Q48 s'il entre au cahier des charges. **Tranché le 27/11 par Julien : oui pour le scénario local** (son entrée au § 17 reste ouverte, Q48) | Rejouer SC-10 et SC-01 seulement, et les parcours PC-02 et PC-09 du panel |

**Points qui ne demandent pas de décision mais méritent d'être sus**

- **Un mariage saisi sur la page de reprise est « Signé, en préparation »** sans question (maquette
  page 6, 375 px) ; la fiche PDF, elle, pose « Où en est-il ? ». Un mariage qu'on reprend est presque
  toujours signé ; s'il ne l'est pas, son statut se change sur la fiche.
- **La règle du repère** (« une ligne sans interlocuteur ni fin est un repère ») est une déduction :
  elle est écrite dans « Ce que Symbola a compris » et se change moment par moment.
- **Les limites réelles** remplacent les exemples des maquettes : 10 Mo, trois pages pour un PDF,
  une page pour une fiche (règle actuelle), 5 000 lignes.
- **« Diffuser » et « Partager… »** : la maquette 11 dit « Partager… » ; l'app dit « Diffuser le
  programme » et la maquette 17 (volet 3) refait ce bouton. Ce lot garde le mot de l'app et lui ajoute
  la fenêtre ; le volet 3 tranchera le mot.
- **L'étape en cours de l'assistant** est marquée en encre (recommandation S6 du Design System, porte
  4) ; si Julien tranche S6 autrement, seule la teinte change.
- **Les « 30 minutes par mariage »** restent une cible : le rejeu (I11) les mesure, sans en faire un
  critère bloquant.

---

## 8. Le découpage en paquets, et ce qui attend d'autres lots

### 8.1 L'ordre

Sept paquets. Chacun laisse l'app cohérente, a sa PR, ses tests et son rejeu ciblé (SC-R1, I11).

| Paquet | Contenu | Dépend de | Migrations |
| --- | --- | --- | --- |
| **71a** Le socle et les règles de fond | Tables de la reprise, journal commun, origine, dates inconnues, contrat déclaré, moments ponctuels, total à répartir ; aucun retard ni relance né d'un import ; lignes jamais fondues ; casse ; purge et neutralisation | — | 0218 à 0223 |
| **71b** La page de reprise et ses portes | Page, six lignes, états ; « Saisir les noms et la date » ; « Reprendre et importer » ; fin de l'assistant (I5) ; liens de « Nouvel évènement » et de l'état vide de « Tâches » | 71a ; **70b** fusionné (message de retour, danger, erreur) | — |
| **71c** L'assistant qui demande | Étape « Questions » et ses six questions ; « Ce que Symbola a compris » ; la liste « à faire » ; « Partir d'un modèle » (I3) ; « Abandonner cet import… » | 71b | — |
| **71d** Doublons, Vérifier, bilan, retrait | Rangement des postes, doublons comparés, `importFigures`, bilan, « Retirer cet import… » | 71c (mêmes fichiers de l'assistant) | — |
| **71e** Prestataires retenus et programme | Passage par l'assistant commun, « autre couple », aperçu, contrats, bilans, « Ponctuel », « À compléter » de l'onglet, fenêtre de diffusion, annuaire au carnet | 71d (gabarit du bilan et `importFigures`) | — |
| **71f** La fiche d'un mariage repris | En-tête, « À compléter », provenance, santé, budget « à répartir », liste et filtre « Origine », « Reprises en cours » | 71a ; peut avancer en parallèle de 71c à 71e (autres fichiers), ses points se remplissent à mesure | — |
| **71g** Erreurs et mots | Fichier au mauvais endroit, erreurs de colonne, lignes à corriger, catalogue des messages, lexique | 71e (toutes les étapes en place) ; **70g** fusionné (contrôle du lexique) | — |

Conduite proposée (règle « aller plus vite ») : 71a seul d'abord (il porte les migrations) ; puis 71b ;
71f en parallèle de 71c, dans sa propre session ; 71d, 71e, 71g à la suite, parce qu'ils touchent les
mêmes fichiers de l'assistant.

### 8.2 Ce qui dépend du lot 70, pas encore fusionné

| Paquet du lot 70 | État au 27/11 | Ce que ce lot en attend |
| --- | --- | --- |
| 70a Données des tâches | Fusionné (PR #190) | « moi » → la personne qui importe ; `done_by_kind` nul pour une tâche reprise |
| 70b Retour, danger, erreur | PR #189 ouverte | Le message de retour, le danger de niveau 2 (« Retirer cet import… »), l'erreur sous le champ : 71b ne part qu'après sa fusion |
| 70c Ligne type et panneau | En cours | Les tâches reprises s'affichent à la ligne type ; si 71c passe avant, elles prennent la ligne d'aujourd'hui, et 70c les reprend sans rien changer ici |
| 70d Écran « Tâches » | Pas commencé | L'état vide « mariage repris sans tâches » et son lien : 71b pose le lien vers la reprise dans 70d s'il est fusionné, sinon 70d le pose en pointant `/reprise` |
| 70e Barre du haut et « + Créer » | En cours | « Nouvel évènement › Reprendre ses fichiers » : la même chose, dans l'autre sens |
| 70g Lexique | Pas commencé | Le contrôle en cliquet dont 71g retire les exceptions |

### 8.3 Ce qui dépend des volets pas encore réalisés

| Ce qui attend | Volet | Ce que fait ce lot en attendant |
| --- | --- | --- |
| L'en-tête de la fiche en 200 px, l'ordre et le dessin des onglets, la fenêtre « Modifier les informations » (« Venu par ») | 3, Évènements | Une ligne « Repris le … » sous l'en-tête actuel ; la source se complète par la fiche actuelle |
| La liste des évènements refaite, l'accueil refait (C-15, C-20), « Partager… » ou « Diffuser » | 3, Aujourd'hui et Évènements | Étiquette et filtre sur la liste actuelle ; « Reprises en cours » en tête de l'accueil actuel ; mot « Diffuser » gardé |
| Le tableau complet du budget (V12, V13), le carnet « tout juste importé » et « Classer les 37 fiches » (V6) | 4, Prestataires | Colonne « Contrat » et « non renseigné » sur le tableau actuel ; le carnet repris arrive comme aujourd'hui, avec ses fiches « à classer » |
| Les questions de l'assistant de démarrage, sa fin complète, les deux parcours de tutoriels (B2, B3, B6, B15, D6) | 5, Premiers pas et aide | R3 seul sur la fin actuelle (I5) ; la règle des échéances passées partagée (I3) |
| La place de « Reprendre et importer » hors des Paramètres (G6) | 6, Paramètres | Le nom change, pas la place (I6) |
| Les contacts repris, doublons par nom (C-65) | « Contacts », non maquetté | Rien, sauf les messages d'erreur communs (71g) |
| Les valeurs du bleu, de l'orange et du crème | Design System | Jetons actuels de `DESIGN.md` |

---

## 9. Divergences avec le cahier des charges, et ADR à prévoir

À signaler ; **aucun ADR n'est écrit dans cette PR**. Chacun sera écrit avec le paquet qui le
réalise, si Julien confirme.

1. **La reprise, un objet du hub qui regroupe les imports d'un mariage** (tables `hub.takeovers`,
   `hub.takeover_steps`), et la règle de fond « un import ne crée ni retard ni relance ; ce que le
   fichier ne dit pas est non renseigné » (dates inconnues gardées par une marque plutôt que par une
   date vide). Décision structurante → **ADR à écrire** au paquet 71a (numéro libre : 0119). **Accord de
   Julien le 27/11.**
2. **Les PDF des prestataires retenus et du programme entrent dans le journal commun des imports**
   (deux sortes nouvelles, retrait d'ensemble) : complète HUB-14 (« un import s'annule en bloc »),
   que ces deux imports ne respectaient pas. À noter dans l'ADR du point 1 et dans `gap.csv`.
3. **Le moment ponctuel et le repère** (`program_items.timing`) : CHR-06 décrit une séquence par un
   début et une fin. Notion nouvelle validée en R12 → dans `gap.csv` (CHR-06, CHR-08), sans ADR.
4. **Aucun scénario du § 17 pour la reprise d'un mariage** (I11) → `docs/QUESTIONS.md`, Q48.
5. **`DESIGN.md`** n'est pas réécrit : il porte déjà les formes de ce volet (phase 6, PR #193). Si un
   écart apparaît au code, il est noté pour la phase 7.

---

## 10. Textes (français et anglais), aide d'écran, rejeu et `gap.csv`

### 10.1 Les textes à créer ou à changer

Clés indicatives, regroupées. Le français est celui des maquettes validées ; l'anglais est proposé
ici (C1) et relu par Julien avec la PR de chaque paquet. Le namespace est `Takeover` pour la page de
reprise, `Import` pour l'assistant.

| Où | Français | Anglais |
| --- | --- | --- |
| Page de reprise | Reprendre un mariage en cours · Reprendre « {mariage} » · Déposez les fichiers de votre ancien outil, dans cet ordre. Rien n'est écrit avant votre accord ; chaque import se retire pendant 90 jours. · {n} fichier(s) sur 6 · Reprendre un autre mariage | Take over an ongoing wedding · Take over "{event}" · Drop the files from your previous tool, in this order. Nothing is written without your approval; each import can be removed for 90 days. · {n} of 6 files · Take over another wedding |
| Les six lignes | Carnet de prestataires · Le mariage · Budget · Prestataires retenus · Liste « à faire » · Programme du jour J · (et leurs phrases, page 6) | Vendor book · The wedding · Budget · Booked vendors · To-do list · Day-of schedule |
| États d'une ligne | À faire · En cours · Repris à {heure} · Repris le {date} · Pas de fichier · Choisi le {date} · Avec le budget · Après le mariage · Arrêté à « {étape} » : {n} réponse(s) à donner | To do · In progress · Imported at {time} · Imported on {date} · No file · Chosen on {date} · With the budget · After the wedding · Stopped at "{step}": {n} answer(s) to give |
| Boutons | Déposer le fichier · Déposer la fiche · Saisir les noms et la date · Je n'ai pas ce fichier · Continuer · Voir le bilan · Ouvrir la fiche · Déposer un fichier quand même · Continuer la reprise | Drop the file · Drop the sheet · Enter names and date · I don't have this file · Continue · See the summary · Open the event · Drop a file anyway · Continue the takeover |
| Fin | Reprise terminée. Il reste {n} points à compléter à la main. · Ouvrir « À compléter » · Chaque import se retire depuis son bilan jusqu'au {date} (90 jours). | Takeover done. {n} items are left to complete by hand. · Open "To complete" · Each import can be removed from its summary until {date} (90 days). |
| Fin de l'assistant (I5) | Vous suivez aujourd'hui vos mariages dans {outils}. Pour ne rien ressaisir, reprenez d'abord un mariage en cours : Symbola vous dit quels fichiers déposer, dans quel ordre. · Six fichiers au plus… Environ 30 minutes par mariage. Rien n'est écrit avant votre accord. · Créer un nouveau mariage | You track your weddings in {tools} today. To avoid retyping, take over an ongoing wedding first: Symbola tells you which files to drop, in which order. · Six files at most… About 30 minutes per wedding. Nothing is written without your approval. · Create a new wedding |
| Reprendre et importer | Reprendre et importer · Un mariage en cours ? Passez par sa page de reprise… · Import en cours : {fichier}, pour « {mariage} ». · Des contacts · Un carnet de prestataires · Une autre liste · Vos imports · Fichier · Pour · Date · État | Import and take over · An ongoing wedding? Use its takeover page… · Import in progress: {file}, for "{event}". · Contacts · A vendor book · Another list · Your imports · File · For · Date · Status |
| Questions | Questions · Pour quel mariage est ce budget ? · Un mariage qui n'est pas encore dans Symbola · Les montants de « {colonne} » ont-ils été payés ? · Oui, payés aux dates du fichier · Non, ils restent à payer · Certains seulement · Leurs contrats sont-ils signés ? · Tous · Aucun · Ligne par ligne · Aucune relance n'est créée, quelle que soit la réponse. · Quel type d'évènement ? · Type : {type}, le seul de votre espace. · Comment ce couple vous a-t-il connue ? (facultatif) · {n} tâches non faites ont une échéance déjà passée · Les garder à leur date · Leur donner une nouvelle date · Elles sont faites, je n'avais pas coché · Choisissez {quoi}. | Questions · Which wedding is this budget for? · A wedding not yet in Symbola · Were the "{column}" amounts paid? · Yes, paid on the file's dates · No, they are still due · Only some · Are their contracts signed? · All · None · Line by line · No reminder is created, whatever the answer. · Which event type? · Type: {type}, the only one in your workspace. · How did this couple find you? (optional) · {n} open tasks are already past due · Keep their dates · Give them a new date · They're done, I hadn't ticked them · Choose {what}. |
| Ce que Symbola a compris | Ce que Symbola a compris · Votre fichier · Dans Symbola · Celui de la ligne du dessus · Non renseigné, pas 0 € · Retenu sur la ligne · Ce qui sera écrit · Écrits ainsi dans le fichier : {valeurs} · Garder les capitales · Non repris : {quoi} | What Symbola understood · Your file · In Symbola · The one on the line above · Not provided, not €0 · Booked on the line · What will be written · Written this way in the file: {values} · Keep capitals · Not imported: {what} |
| Doublons, Vérifier, bilan | Doublons · Rangé sous le poste · Pourquoi · Nom proche · Même nom · Nouveau poste · Le garder « à trouver » · Le retirer de ce mariage · Doublon possible · Si c'est la même · Ce qui les rapproche · C'est la même fiche · Ce n'est pas la même : créer une fiche · Encore {n} choix · Vérifier · Ce qui va être écrit · Importer les {n} lignes · Ce qui n'a pas été repris · Ce que vous avez choisi · Et maintenant · Retour à la reprise · Retirer cet import… · Retirer l'import « {fichier} » ? · Partent · Restent · Retirer aussi les {n} lignes modifiées depuis · Garder l'import · Retirer l'import · Retirer toute la reprise… · Retirer toute la reprise de « {mariage} » ? · Je comprends que le mariage et tout ce que ces imports ont écrit seront retirés · L'import « {fichier} » a passé sa date limite : la reprise ne se retire plus d'un geste | Duplicates · Filed under · Why · Similar name · Same name · New item · Keep it "to find" · Remove it from this wedding · Possible duplicate · If it's the same · What brings them together · It's the same record · It's not the same: create a record · {n} choices left · Review · What will be written · Import {n} lines · What wasn't imported · What you chose · Next · Back to the takeover · Remove this import… · Remove the import "{file}"? · Removed · Kept · Also remove the {n} lines edited since · Keep the import · Remove the import · Remove the whole takeover… · Remove the whole takeover of "{event}"? · I understand the wedding and everything these imports wrote will be removed · The import "{file}" is past its deadline: the takeover can no longer be removed in one go |
| Prestataires retenus | Ce fichier est-il bien celui de {mariés} ? · Il nomme un autre couple. · Dans le fichier · Sur la fiche · Choisir un autre fichier · C'est bien ce mariage, continuer · Trouvée dans le carnet · Nouvelle fiche · Poste du budget · Contrat · Signé · Non signé · Ligne non reprise : « {nom} », votre agence. | Is this file really {couple}'s? · It names another couple. · In the file · On the event · Choose another file · It is this wedding, continue · Found in the book · New record · Budget item · Contract · Signed · Not signed · Line not imported: "{name}", your business. |
| Programme | Veille · Jour J · Lendemain (acquis) · Fin non renseignée · {heure} le lendemain · repère · Ponctuel · Heure de fin · À compléter : {n} heures de fin non renseignées… · Aller à la première · Le programme n'est pas complet · heure de fin à venir · Compléter d'abord · Diffuser quand même · L'annuaire du programme · Les ajouter au carnet · Ajouter les {n} téléphones · moment | Day before · Big day · Day after · End not provided · {time} the next day · marker · Point in time · End time · To complete: {n} end times not provided… · Go to the first · The schedule isn't complete · end time to come · Complete first · Share anyway · The schedule's directory · Add them to the book · Add the {n} phone numbers · moment |
| Fiche | Repris le {date} de {n} fichiers · Voir la reprise · À compléter après la reprise · {n} points · {n} fait(s) · Montants de {n} prestataires · {n} contrats non signés · Les tâches · Reprendre une liste · Partir d'un modèle · {n} heures de fin dans le programme · Le lien personnel des mariés · Le nombre d'invités · Reprise complétée le {date} · Revoir la liste · Pas encore de tâches : pas d'avis · {montant} engagés selon votre fichier · à répartir · D'où viennent ces valeurs ? · non renseigné · vous, à la reprise | Imported on {date} from {n} files · See the takeover · To complete after the takeover · {n} items · {n} done · Amounts for {n} vendors · {n} unsigned contracts · Tasks · Import a list · Start from a template · {n} end times in the schedule · The couple's personal link · Number of guests · Takeover completed on {date} · Review the list · No tasks yet: no opinion · {amount} committed per your file · to allocate · Where do these values come from? · not provided · you, during the takeover |
| Liste, accueil | Repris · {n} fichiers sur 6 · {n} points à compléter · Origine · Repris · Créés dans Symbola · Reprises en cours · Voir ce qui reste | Imported · {n} of 6 files · {n} items to complete · Origin · Imported · Created in Symbola · Takeovers in progress · See what's left |
| Erreurs | Erreur : ce fichier n'est pas {sorte}. C'est {autre sorte} : {indices}. · Le garder pour la ligne {n} · Le reprendre comme {sorte} · Erreur : {n} colonnes à revoir avant de continuer. · Revenir à la proposition · Erreur : {n} lignes sur {total} ne peuvent pas être reprises telles quelles… · Cette date n'existe pas. · Montant ambigu : {a} ou {b} ? · Laisser ces {n} lignes de côté · Télécharger ces {n} lignes (CSV) · Ligne suivante · (le catalogue de la page 12) | Error: this file isn't {kind}. It's {other kind}: {hints}. · Keep it for line {n} · Import it as {kind} · Error: {n} columns to fix before continuing. · Back to the suggestion · Error: {n} of {total} lines can't be imported as they are… · This date doesn't exist. · Ambiguous amount: {a} or {b}? · Leave these {n} lines aside · Download these {n} lines (CSV) · Next line |

**Textes retirés** : `Import.takeover.*` (les trois tuiles « Reprendre mes … »), `Import.startQuestion`
(« Que voulez-vous reprendre ? »), « Deux PDF sont repris ailleurs », « Annuler cet import » et
son texte (« … et remet rien d'autre »), « Abandonner l'import » (lien), « en cours · Reprendre »,
« Champs importés » (sauf la lecture des anciennes fiches, I8), « Téléchargez le rapport pour les
corriger dans votre tableur, puis réimportez-les », « Événement introuvable ou ambigu » (devenu une
ligne à corriger), `EventVendorsImport.header` (« Fichier de : … »), « séquence » et « chrono » dans
l'onglet du programme.

### 10.2 Aide d'écran et centre d'aide

- **Aide contextuelle** (`lib/help/screens.ts`) : nouvelle aide `takeover` (la page, l'ordre, « Je
  n'ai pas ce fichier », la date limite) et `importQuestions` ; réécrire `importFile` (« Reprendre et
  importer »), `importMatches` (« Doublons »), `importConfirm` (« Vérifier »), `importUndo` (« Retirer
  cet import »), `importGaps` (lignes à corriger), `programImport` (fins non renseignées, « Ponctuel »,
  diffusion), l'aide de l'onglet budget (à répartir). `importRows` (étape « Lignes » des contacts)
  reste telle quelle (C-65 reporté).
- **Centre d'aide** : l'article « Comment exporter depuis mon logiciel ? » (lien de la page de
  reprise), « Reprendre un mariage en cours », et la mise à jour des articles qui citent « Annuler cet
  import », les tuiles « Reprendre mes … », « chrono ». Captures à régénérer (`pnpm --filter
  @symbola/app help:captures`) : écran d'import, page de reprise, bilan, onglet du programme.
- **Visites et tutoriels** : étapes de l'import mises à jour ; le parcours « Je reprends mes mariages
  en cours » (D6) relève du volet 5.

### 10.3 Corpus et rejeu

- **Corpus** (`packages/testing/import-corpus/files/`) : ajouter `tableur-planner/` (les trois CSV
  fictifs de `docs/audits/2026-11-ux-parcours/donnees/tableur-planner/`, plus `budget-clara-yanis.xlsx`
  avec ses trois lignes en défaut : « 31/02/2027 », « 1.950 », poste manquant) ; dans
  `logiciel-tiers/`, un programme avec une soirée qui franchit minuit et une fin « 00:00 », un PDF
  scanné (une image), un `.pages` ; un PDF de programme contenant « =1+1 ». Générateurs
  `generate*.py` mis à jour ; aucune donnée réelle.
- **Rejeu** (C4) : `SC-R1 · Reprendre un mariage en cours` (I11), à chaque paquet qui touche le
  parcours, compte rendu `docs/recette/SC-R1.md` ; SC-10 (contacts, messages d'erreur, 71g) ; SC-01
  (fin de l'assistant, 71b) ; SC-03 (« Lundi matin » le lendemain d'une reprise, 71f).

### 10.4 `gap.csv`

Lignes mises à jour par le paquet qui les touche : HUB-14, PAR-01, UX-02, UX-08, UX-10, UX-17,
CHR-06, CHR-08, PRE-01, PRE-02, BUD-01, EVT-02, EVT-05, EVT-07, HUB-08, SEC-21.

### 10.5 Chaîne de sécurité

SEC-30 à SEC-36 verts à chaque PR ; tests d'abus des § 5.1 à 5.6 obligatoires (nouvelles tables,
nouvelles routes `/reprise/…` et `/import/[id]/questions`, filtre d'origine, contrôle du couple).
