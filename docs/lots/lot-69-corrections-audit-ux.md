# Lot 69 — Corrections simples de l'audit UX des parcours (lot 68)

**Statut** : spécification validée par Julien le 25/11/2026 (« Valider, attendre #180 ») ; lot 67 fusionné (#180), branche rebasée sur `main` ; **réalisée** (voir § 7).
**Branche** : `lot-69-corrections-audit-ux` (une pull request vers `main`).

Sources, à lire par `git show origin/lot-68-audit-ux-parcours:<chemin>` tant que la PR #181 n'est pas
fusionnée :
- `docs/audits/2026-11-ux-parcours/06-decisions-porte-2.md` (fait foi, § 4 : ces corrections partent
  dans un lot à part, sans attendre le Design System) ;
- `docs/audits/2026-11-ux-parcours/04-synthese.md`, § 9 « Corrections simples, sans maquette » et la
  ligne de chaque constat ; preuves dans `preuves/`, journaux dans `03-panel/`.

## 1. Prérequis : le lot 67 n'est pas dans `main`

L'audit a regardé l'app avec le lot 67 (PR #180, ouverte, mergeable, six vérifications vertes). Cette
branche est cependant à jour de `main` seulement (38b47b38) : **elle n'a pas le lot 67**. Trois
conséquences :

- le message `Import.pdfHint` (C-51, « Deux PDF repris ailleurs… ») n'existe que dans le lot 67 ;
- le lot 67 change `fr.json` et `en.json` (+84 lignes chacun), `app-shell.tsx`, `today-view.tsx`,
  `events/[id]/page.tsx`, `new-import-form.tsx` et les pages d'import : mêmes fichiers que les
  corrections C-89, C-51, C-39, C-13, C-17 ;
- la correction d'orthographe (C-89) balaie tout `fr.json` : elle doit se faire **après** la fusion
  pour ne pas laisser de « événement » entrer par le lot 67.

**Proposition** : on attend la fusion de la PR #180, puis on rebase cette branche sur `main` avant le
premier test. La spécification ci-dessous a été écrite sur `main` et relue contre le lot 67 pour les
points qui le touchent.

## 2. Ce qui est retenu, ce qui est écarté

Dix-huit lignes au tableau du § 9. **Seize sont retenues** (dont deux partiellement), **deux sont
écartées** parce qu'elles demandent un choix de conception qui appartient aux maquettes.

| Constat | Décision | Pourquoi |
| --- | --- | --- |
| C-20 « 6 points » pour sept lignes | **Écarté** → maquette « Aujourd'hui » (qui liste déjà « les compteurs (C-20) ») | Les compteurs sont ceux de M15, voulus par Julien (lot 65c) : « 6 points » = attention (hors « à venir »), les sept lignes = les sept premiers y compris « à venir », « Tâches (8) » = tous les éléments de la nature, pas ceux montrés. Aligner l'un sur l'autre est un choix (que compte « un point » ?), pas une correction de texte |
| C-06 « Revoir la visite » absent de l'aide de « Nouveau prestataire » | **Écarté** → maquette « Premiers pas et aide » (C-01, C-06, D2) | Ce panneau est celui d'un écran **sans visite** (`ScreenHelp` déclare `steps: []`) : rien à rejouer. D2 décide que le lien est « toujours présent sous le ? » et que les visites sont proposées, pas imposées : c'est la refonte des visites, pas une correction |
| C-02 | **Partiel** : phrases pour téléphone + dernière bulle. Écartés : « étape sans cadre », « visite devant un espace vide » | Ces deux défauts dépendent de D2 (quand une visite se propose) |
| C-51 / C-59 | **Partiel** : phrase `pdfHint` et tuile encadrée. Écartés : ordre des fichiers, cartes sans air de bouton, « huit choix » | Page de reprise = maquette « Reprise et import » |

Hors tableau, deux points à instruire (demandés) :
- **« (Today.source.vendors) »** : retenu (n° 1), cause trouvée ;
- **« Statut : confirmed », « 2027-06-12 », « Ch&acirc;teau »** : retenus (n° 9), cause trouvée.

## 3. Les corrections

Exigences : numéros du cahier des charges. UX-10 « aucun terme technique », UX-13 « mêmes libellés
partout », UX-05 « téléphone d'abord », UX-14 « accessible » (WCAG 2.2 AA, aussi NFR-17), NFR-16
« ni page blanche ni message technique ». Fichiers sous `apps/symbola/` sauf mention. Le **test**
est écrit avant le code et vu échouer (CLAUDE.md § 6).

### Paquet A — Textes (fr et en, aucun texte en dur)

**1. Message « (Today.source.vendors) » — C-17.** Exigences : UX-10, NFR-16, HUB-08.
*Cause* : `app/accueil/today-view.tsx:233` écrit `t("source.${source}")` ; la liste `TodaySource`
(`lib/today/load.ts:42`) compte six sources, mais `Today.source` n'en traduit que cinq : « vendors »
manque. next-intl affiche alors la clé. *Correction* : ajouter `Today.source.vendors` (« les
prestataires » ; la phrase dit déjà « ne répond pas pour le moment (… ») donc « prestataires ») dans
`packages/i18n/src/messages/fr.json` et `en.json`. *Critère* : toute source possible se lit en mots,
dans les deux langues ; ce qui est dit après « Annuler » ne montre jamais de nom technique. *Test* :
`lib/today/sources-textes.test.ts` (nouveau) : une table `satisfies Record<TodaySource, true>` (le
compilateur refuse une source de plus sans mot) et, pour chacune, la clé existe dans `fr` et `en`
(`Today.source` et `Today.calendar.source`). *Reste hors lot* : pourquoi la source « prestataires » ne
répond pas dans l'agence d'essai (délai ?) : à regarder au rejeu ; si c'est un vrai défaut,
question dans `docs/QUESTIONS.md`.

**2. « {{terme_clients}} » affiché tel quel — C-76.** Exigences : UX-10, HUB-24. *Fichiers* :
`messages/fr.json` et `en.json` : `Help.clientTerms.body` (l. 1415) et `ClientTerms.intro` (l. 11354).
*Correction* : remplacer la formule technique par des mots (« …et se glisse dans vos e-mails et vos
documents à venir »). *Ambiguïté* : la planner qui écrit un modèle d'e-mail a besoin du nom de
variable ; on vérifie à l'implémentation que l'éditeur de modèles (`parametres/emails/…`) le liste
déjà ; sinon la formule reste **là** et seule l'aide d'écran change. Même lot, une ligne : l'espace
manquant dans « Devis signéImmédiat » (`parametres/notifications/notification-forms.tsx:35`, une
espace avant le badge). Non reproduit : à contrôler au rendu. Hors lot : « PUSH », « E-reporting »,
« ZIP », « JSON » (lexique, C-87, maquette « Transverse »). *Test* : `packages/i18n/src/lot-69-textes.test.ts`
(nouveau) : ces deux textes ne contiennent ni « {{ » ni « _ » entre mots minuscules.

**3. Une seule graphie « évènement » — C-89.** Exigences : UX-10, UX-13, HUB-19. *Règle* : la graphie
du cahier des charges (141 « évènement », 0 « événement » ; « évènementiel » ×2) et de CLAUDE.md :
**« évènement »**. *Périmètre* : valeurs de `fr.json` (209 lignes en « événement ») et de
`messages/vocabulary/clients.fr.json` ; textes affichés des modèles de départ
(`packages/starter-templates/src/*.json`) hors clés `_source` ; la description de `app/layout.tsx`.
*Non touché* : les **synonymes de reconnaissance de colonnes** (`import-synonyms.json`,
`import-profiles.json`, `vendor-type-synonyms.json` : les deux graphies restent reconnues, c'est un
fichier venu d'ailleurs) ; commentaires, erreurs internes et journaux, jamais montrés ; `en.json`.
*Critère* : aucune occurrence de « événement » (casse comprise) dans les textes affichés. *Test* :
`lot-69-textes.test.ts` : parcourt les valeurs de `fr.json`, `clients.fr.json` et les textes des
modèles, interdit `/[ÉéEe]vénement/` hors liste blanche (synonymes). *Risque* : des tests (e2e,
unitaires) citent l'ancienne graphie ; on les met à jour (recherche systématique). **Remplacement
mécanique rejoué après la fusion du lot 67** (§ 1).

**4. « … et remet rien d'autre. » — C-66.** Exigences : UX-10, HUB-14. *Fichier* : clé `Import.undoWhat`
(fr l. 3556, en idem), utilisée par `app/import/[importId]/journal/page.tsx:273`. *Correction* : une
phrase qui se lit dans les quatre cas : « L'annulation ne supprime rien. » / « …supprime l'élément
créé. » / « …supprime les 3 éléments créés et remet 2 éléments mis à jour comme avant. » ; en
anglais de même. *Test* : `lot-69-textes.test.ts` : formate la clé (createTranslator de next-intl)
pour (0,0), (1,0), (0,2), (3,1), (0,1) et compare les phrases. *Hors lot* : la place de
l'annulation sur la page (C-66, « détail à déplier ») → maquette.

**5. « Aucun prestataire ne correspond à ces filtres. » sans filtre — C-69.** Exigences : UX-08,
UX-10. *Fichier* : `app/prestataires/page.tsx:356`. *Cause* : le message `empty` s'affiche dès que
`results.length === 0` et que le carnet a des types ; il ne regarde pas s'il y a des fiches ni si un
filtre est posé. *Correction* : fonction pure `vendorBookEmptyState(total, results)` dans
`app/prestataires/filters.ts` : `total === 0` → état vide du carnet (texte nouveau `emptyBook`,
« Votre carnet est vide… », avec l'action « Ajouter un prestataire » : `EmptyState` déjà là) ;
`total > 0` et aucun résultat → « Aucun prestataire ne correspond à ces filtres. ». *Critère* :
carnet à zéro fiche (avec ou sans types) : jamais le mot « filtres » ; carnet de 12 fiches et un
filtre qui n'en garde aucune : le mot « filtres ». *Test* : unitaire sur `filters.test.ts`. *Hors lot* :
les sept filtres et les deux exports affichés pour zéro fiche, le bouton secondaire → maquette.

**6. « Aucun modèle de rétroplanning pour l'instant. » sur un mariage qui a ses tâches — C-39.**
Exigences : CHR-01, UX-10. *Fichier* : `app/events/[id]/page.tsx:1145-1148` : la phrase (clé
`noTaskTemplates`) est affichée dès que l'espace n'a aucun modèle, même si l'évènement porte déjà des
tâches. *Correction* : la phrase et son lien « Modèles de rétroplanning » ne s'affichent que si
`tasks.length === 0` (rien à appliquer, rien déjà là). *Test* : e2e `evt-03-chr-02-fiche-taches.spec.ts`
(cas ajouté) : espace sans modèle, mariage avec tâches → pas de phrase ; sans tâche → phrase.
*Hors lot* : le double nom « Rétroplanning »/« Tâches » (C-39, P-11) → maquette.

**7. `/import` ne cite pas le PDF des prestataires retenus — C-51.** Exigences : HUB-14, UX-10.
*Fichier* : clé `Import.pdfHint` (**lot 67 seulement**), affichée par `app/import/new-import-form.tsx`.
*Correction* : « Trois PDF sont repris ailleurs : les fiches d'évènement, par leur tuile ci-dessus ;
le programme, depuis l'onglet « Programme du jour J » de l'évènement ; et les prestataires retenus,
depuis « Reprendre les prestataires retenus » sur la fiche de l'évènement. » (emplacement exact du
dernier à reprendre dans `events/[id]/page.tsx:991` du lot 67). *Test* : `lot-69-textes.test.ts` : la
clé cite les trois PDF dans les deux langues. *Dépend du lot 67.*

**8. Tuile « Reprendre mes contacts » encadrée quand on importe autre chose — C-59.** Exigences :
HUB-14, UX-13. *Fichier* : `app/import/page.tsx` (lot 67), style `.import-tile[aria-current="true"]`
(`globals.css:2308`). *Ambiguïté* : le code ne marque `aria-current` que pour la tuile choisie
(`chosen === tile.key`) ; l'encadré vu à l'audit n'est donc pas expliqué à la lecture. À reproduire au
rendu avant de coder (`/import?type=budget_lines`, `/import` après « Importer » du menu des réglages ;
piste : un anneau de focus après l'ancre `#import-form`). *Critère* : sur `/import?type=X`, seule la
tuile de `X` est marquée, et aucune quand `X` n'est pas une tuile. *Test* : e2e (cas ajouté à
`hub-14-lot-63b-import.spec.ts`) : `aria-current` et bordure. **Si non reproductible, retiré du lot** et
dit dans le compte rendu.

### Paquet B — Valeurs brutes de l'assistant d'import

**9. « Statut : confirmed », « 2027-06-12 », « Ch&acirc;teau », sommes sans espace — C-60, C-56.**
Exigences : UX-10, HUB-14 (« aperçu »), HUB-19 (formats de date et de monnaie selon la langue).
*Causes* (deux écrans montrent les cellules telles que lues) :
- `app/import/[importId]/colonnes/page.tsx` : l'aperçu (`draft.previewRows`, l. 90) et les exemples
  (`column.samples`) sortent bruts, alors que l'écran de confirmation, lui, passe par
  `normalizeVendorImportValues` et `decodeHtmlEntities` : « Château » y est juste ;
- `app/imported-fields.tsx` : « Champs importés » écrit la valeur du fichier telle quelle :
  « Total 21650,50 € ».
*Correction* : fonction pure `displayImportCell(raw, { locale, entityType })` dans
`lib/import/display.ts` (nouveau) : (a) `decodeHtmlEntities` d'`@symbola/import-engine` ; (b) une
date ISO `AAAA-MM-JJ` devient une date lisible (`formatCalendarDate`) ; (c) pour `event_sheets` et
`events`, une valeur égale à un code de statut d'évènement devient son libellé
(`STATUS_LABEL_KEYS`, `app/events/event-status.ts`) ; (d) `formatImportedAmountText` pour
`imported-fields.tsx` : « 21650,50 € » → « 21 650,50 € » (valeurs qui ne sont qu'un montant suivi de
« € » ou « EUR », au moins quatre chiffres entiers ; rien d'autre n'est touché : numéros, SIRET,
téléphones). Le fichier source et ce qui s'écrit en base ne changent pas : affichage seulement.
*Ambiguïtés* : (c) est limité aux fiches d'évènement parce qu'un statut « confirmed » dans un autre
fichier est une donnée de la planner ; (d) est une heuristique de présentation, dite telle.
*Critère* : un fichier à « Ch&acirc;teau » montre « Château » en aperçu et en exemple ; une fiche PDF
montre « 12 juin 2027 » et « Confirmé » ; « Champs importés » montre « 21 650,50 € ». *Test* :
`lib/import/display.test.ts` (nouveau), cas limites compris (valeur vide, date invalide, montant à
trois chiffres, « 12 345 » déjà espacé, anglais). *Hors lot* : « lignes » et « colonnes » pour un PDF,
l'assistant qui dit où aller (C-60) → maquette « Reprise ».

### Paquet C — Comportement

**10. « Dernière relance : — » après « Relance notée. » — C-50.** Exigences : UX-15 (mise à jour
immédiate), UX-06. *Cause* : le tableau de la fenêtre d'un poste (`app/events/[id]/slot-comparison.tsx`)
charge ses colonnes par `slotComparisonAction` côté navigateur ; `noteVendorReminderAction`
(`app/accueil/actions.ts:139`) invalide seulement les pages (`revalidatePath`), donc le tableau déjà à
l'écran n'est pas relu. *Correction* : `NoteReminderButton` (`app/accueil/note-reminder.tsx`) reçoit
une propriété `onSaved` appelée quand l'action répond « saved » ; `slot-comparison.tsx` y branche son
`load()` (comme `after()` le fait déjà pour « Retenir »). *Critère* : après « Relance notée. », la
ligne « Dernière relance » montre la date du jour et le moyen, sans recharger. *Test* : e2e (cas
ajouté à `evt-03-chr-02-fiche-taches.spec.ts` ou au spec du lot 65d) : noter une relance, relire la
cellule. *Hors lot* : le nombre de gestes (C-50, cinq à six) → maquette « Prestataires » (la relance).

### Paquet D — Mise en page (CSS, mesurée à l'écran)

Pour ces cinq corrections, le **défaut est mesuré avant de coder** (rendu en 1 440, 1 280, 1 366 et 375
px, comme à l'audit) ; la cause ci-dessous est lue dans les feuilles de style, pas encore vue. Test :
un fichier `e2e/lot-69-corrections-audit-ux.spec.ts` (nouveau) qui **mesure** (boîtes des éléments),
sans capture d'image. Lancé en CI (job `e2e`, deux tailles) ; en local, nécessite le socle.

**11. Champ « Où ? » du carnet — C-43.** Exigences : PRE-11, UX-14. *Fichiers* : `app/prestataires/page.tsx:215`,
`app/styles/lot-63a.css:5-27`, `globals.css:237` (la règle de base `fieldset` : fond blanc, bordure,
`p-6`, `flex-col`). *Cause probable* : le fieldset garde du style de base (fond, bordure, marge, `items-start`)
que le lot 63a n'a pas défait ; le champ texte est un élément de flex sans `flex: 1` effectif.
*Correction* à fixer au rendu : `bg-transparent`, `gap`, `min-w-[12rem]` sur le champ, rangée tenue sur
une ligne (≥ 768 px). *Critère* : en 1 440 et 1 280, le champ « Où ? » fait ≥ 160 px de large, 38 px de
haut, sur la même ligne que « dans un rayon de » ; pas de fond blanc autour ; en 375 px les contrôles
s'empilent à pleine largeur. *Test* : e2e, boîtes. *Hors lot* : les filtres par métier (D9).

**12. Menu latéral — C-13.** Exigences : UX-14, NFR-17 (zoom, zones de texte). *Fichiers* :
`globals.css` (`.nav-count`, deux définitions, l. 822 et 1616 ; `.app-user-email`), `app/app-shell.tsx:549`.
*Correction* : `.nav-count` en `whitespace-nowrap shrink-0` (une seule définition) ; `.app-user-email`
en `overflow-wrap:anywhere` (jamais coupée, toujours lisible). *Critère* : la pastille « 2 en retard »
tient sur une ligne dans 232 px ; l'adresse se lit en entier. *Ambiguïté* : « Créer une autre organisation »
passe sur deux lignes dans 200 px ; on mesure : si le texte ne tient pas sur une ligne sans réduire la
taille de la police, il reste tel quel (c'est alors un texte à raccourcir : maquette « Transverse »).
*Test* : e2e, hauteur de la pastille = une ligne (≤ 28 px), `scrollWidth ≤ clientWidth` du bloc compte.

**13. « Supprimer » coupé (budget) et liens coupés (Équipe) — C-49, C-75.** Exigences : UX-05, NFR-17.
*Fichiers* : `app/events/[id]/budget-vendors-table.tsx:212-230` (cellule `.actions` : trois boutons
sur une ligne) ; `app/parametres/equipe/page.tsx:83-110` (tableau à `min-w-[560px]` dans le panneau
des réglages, boutons `row-wrap`). *Correction* : la cellule d'actions passe à la ligne (`flex flex-wrap`,
ou verticale sous 1 440 px) ; l'adresse de la colonne « Compte » casse librement (`overflow-wrap:anywhere`) ;
« Retirer l'accès de … » à la ligne (`white-space: normal`). *Critère* : en 1 280 et 1 366 px, aucun
défilement horizontal de `.list-table-wrap` pour ces deux tableaux et tous les boutons entièrement
dans le cadre. *Test* : e2e, `scrollWidth ≤ clientWidth` et boîte de chaque bouton dans la boîte du tableau.
*Hors lot* : « Comparer/Retenir », le menu « Ajouter des prestataires », les pastilles vertes, le
nom qui n'ouvre pas la fiche, « Voir tout le carnet » (C-49) → maquette « Prestataires » ; le patron
des réglages (C-75, D7) → maquette « Paramètres ».

**14. Astérisque seul sur sa ligne — C-25.** Exigences : UX-14. *Cause* : la règle de base `label`
(`globals.css:170`) est `flex flex-col` : le texte du libellé et `<RequiredMark/>` (`app/ui/required-mark.tsx`)
sont deux éléments de colonne, donc deux lignes ; vrai de **tous** les libellés qui portent une
marque (« Type d'évènement » dans `events/new/new-prospect-form.tsx:82` en est un). *Correction* :
dans `app/styles/lot-63a.css`, `label:has(> .required-mark)` en `flex-row flex-wrap items-baseline`,
`gap-x-1`, et le contrôle (`input`, `select`, `textarea`) en `basis-full`. *Critère* : le haut de
l'astérisque est à moins de 8 px de celui du texte du libellé, dans « Nouvel évènement » en 375 et
1 440 px. *Test* : e2e, deux boîtes. *Hors lot* : « Créer le prospect » à 1 610 px, absence d'« Annuler »,
champs manquants (C-25, D8) → maquette « Évènements ».

**15. « ⌘K » et « Raccourci : touche N » sur téléphone — C-81.** Exigences : UX-05. *Fichiers* :
`app/search-box.tsx:140` (`kbd.search-box-shortcut`), `app/creation-rapide/quick-create.tsx:120`
(`.quick-create-hint`), `globals.css:878`. *Correction* : masqués sous 768 px et quand le pointeur est
tactile (`@media (width < 768px), (pointer: coarse)`), sans toucher au texte (affichés sur ordinateur).
*Critère* : en 375 px, aucun des deux n'est visible ; en 1 440 px les deux le sont. *Test* : e2e.
*Hors lot* : la barre du haut à 160 px, la recherche coupée à « Recher », les listes qui commencent
par leurs filtres (C-81) → maquette.

**16. Montants hors cadre dans les cartes du budget — C-78.** Exigences : UX-05 (360 px), NFR-17,
BUD-02. *Cause* : en dessous de 640 px, `globals.css:5905-5934` transforme le tableau en cartes
(`display:block`) mais laisse `min-w-[560px]` de `.list-table` (`globals.css:1572`) : chaque carte fait
560 px, valeurs, statut et « Ouvrir » sortent du cadre à droite. *Correction* : `min-width: 0` sur
`.list-table.budget-vendors` dans ce bloc. *Critère* : en 375 px, tous les montants sont dans la
fenêtre (bord droit ≤ 375) et la page n'a pas de défilement horizontal. *Test* : e2e, 375 px.

### Paquet E — Visites (aide)

**17. Visites lues sur téléphone — C-02 (partiel).** Exigences : HUB-11, UX-05, UX-10. *Fichiers* :
`packages/starter-templates/src/tours.json` (texte, fr et en) et `packages/ui/src/guided-tour.tsx:196`.
*Correction* : (a) tours : « Survolez une fiche… » (carnet, l. 143) et « cliquez une ligne… »
(évènements, l. 43) deviennent des phrases sans geste de souris ; « Les trois points les plus
urgents » (accueil, devant sept lignes) devient « Les points les plus urgents » ; (b) à la dernière
étape, « Passer la visite » disparaît (« Terminer » reste), puisqu'il n'y a plus rien à passer.
*Critère* : aucune étape ne cite « survol » ni « cliquez », fr et en ; la dernière bulle n'a pas de
« Passer la visite ». *Test* : `packages/starter-templates/src/tours.test.ts` (nouveau ou existant) pour
les textes ; e2e (spec `aide-01-03-04.spec.ts`, cas ajouté) pour la dernière bulle. *Hors lot* :
visites proposées plutôt qu'imposées (D2), étapes sans cadre (C-02), visite sur « Tâches » (C-06).

## 4. Tests et définition de « terminé »

- **Unitaires** (Vitest, environnement Node, sans base) : n° 1, 2, 3, 4, 5, 7, 9, 17-textes.
- **Parcours Playwright** (CI, deux jobs Chromium ; en local avec le socle) : n° 6, 8, 10, 11 à 16, 17-bulle.
  Les mesures du paquet D se font en 1 440, 1 280, 1 366 et 375 px.
- axe-core sur les écrans touchés ; `pnpm lint`, `pnpm typecheck`, `pnpm check:boundaries`,
  `pnpm --filter @symbola/app test` ciblés sur les fichiers touchés.
- Rejeu local des scénarios concernés (accueil du lundi matin SC-03, reprise SC-10, budget) sur le jeu
  fictif ; `docs/recette/SC-xx.md` mis à jour si un texte vu y change. Aucune donnée réelle.
- Aide contextuelle à jour : `tours.json`, textes d'aide d'écran (n° 2, 17).
- **Aucune migration**, aucun changement de contrat d'API ni d'événement, aucune dépendance nouvelle.
  Aucune ligne de `docs/gap.csv` à changer (pas de nouvelle exigence) ; la ligne du lot 68 note que les
  corrections simples sont faites.

## 5. Ordre et commits

Un commit par numéro, au format du dépôt (`fix(hub): UX-10 message des sources de l'accueil (C-17)`),
dans l'ordre A, B, C, D, E ; test d'abord. La fusion d'orthographe (n° 3) est son propre commit,
produit par un script rejouable (`tools/referentiel/…`, non conservé s'il n'a plus d'usage).

## 6. Questions pour Julien

1. **Fusion du lot 67 d'abord** (recommandé), puis rebase de cette branche ? Sinon on code les 13
   corrections qui n'en dépendent pas et les n° 3, 7, 8, 12 attendent.
2. **« évènement »** comme graphie unique (celle du cahier des charges et de CLAUDE.md) : confirmé ?
3. **C-20 et C-06 écartés** vers les maquettes, comme au § 2 : d'accord ?
4. **Statut traduit à l'aperçu (n° 9 c)** limité aux fiches d'évènement : d'accord, ou on laisse
   les statuts bruts partout et on ne corrige que dates, accents et sommes ?

## 7. Réalisation (26/11/2026)

Seize corrections livrées, une par commit (ordre de la PR), deux lignes du tableau écartées comme au § 2.

- **Écarts à la spécification**
  - **n° 8 (tuile « Reprendre mes contacts » encadrée) : non reproduit.** Le code ne marque
    `aria-current` que la tuile choisie, et aucune quand le type demandé n'est pas une tuile
    (`/import?type=budget_lines`) ; l'encadré vu à l'audit est très probablement l'état « survol » ou le
    focus après l'ancre `#import-form`. Aucun changement de style ; le comportement attendu est tenu
    par un test (`C-59` de `lot-69-corrections-audit-ux.spec.ts`).
  - **n° 6 et n° 10** : leurs parcours sont dans `lot-69-corrections-audit-ux.spec.ts` (une seule
    atelier de données) plutôt que dans `evt-03-chr-02-fiche-taches.spec.ts`.
  - **n° 2, 4, 5, 7** : écrits d'abord en test rouge, sauf le n° 5 dont test et fonction ont été écrits
    ensemble (fonction pure de quatre lignes).
  - **n° 2** : l'éditeur de modèles d'e-mails liste déjà la variable (`email-template-rules.ts`) ;
    seule l'aide d'écran change.
  - **n° 7** : l'onglet s'appelle « Budget et prestataires » (pas « Prestataires »).
  - **n° 3** : le remplacement touche aussi des textes à portée juridique (modèle de contrat, mention
    d'information des liens personnels) : **graphie seulement**, aucun mot ni clause changé ; à garder
    en tête pour la relecture de l'avocat et de la DPO. Le type de départ « Organisation d'évènements »
    garde l'ancienne graphie parmi ses synonymes de reconnaissance.
- **Mesures du paquet D** : défauts reproduits en chiffres avant correctif (champ « Où ? » à 26 px,
  pastille « 2 en retard » à 43 px de haut, débordements de 37 px (budget) et 62 px (équipe),
  astérisque à 25 px du texte, montants jusqu'à 589 px en 375 px), puis verts.
- **Non vérifié en local** : `hub-13-reprise-export` et `imp-09-reprise` échouent ici (module
  `@napi-rs/canvas` absent de ce poste, lecture de PDF) ; ils ne touchent pas aux fichiers modifiés,
  la CI tranche.
