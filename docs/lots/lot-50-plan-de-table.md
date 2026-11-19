# Lot 50 — Plan de table et synthèse pour le traiteur

**Statut** : spécification proposée le 18/11/2026, **validée par Julien le 18/11/2026** : toutes les décisions retenues dans leur option recommandée (a), préalable commun et élargissement de la contrainte des natures d'e-mails du `hub` compris (accord donné). Le lot ajoute des
tables au schéma `guests` (module du lot 49) : validation explicite requise (CLAUDE.md § 8).
Aucune dépendance nouvelle.

Branche `lot-50-plan-de-table`, partie de `main` (2649e8d, après la PR #134, qui contient le lot
49). Aucune version intermédiaire n'est déployée (gel des déploiements) : le lot se rejoue en
local. Le module Invités reste **fermé par défaut** (socle des lots 46 et 49, ADR 0079) : ce lot
n'y change rien.

Ce lot avance **en parallèle des lots 44 et 47** ; il partage avec le lot 44 un **préalable
commun** (D0) : voir la section dédiée et « Travail en parallèle » à la fin.

## Contexte

Le lot 49 a livré la liste des invités, leurs réponses par temps fort et leurs régimes, chiffrés et
donnés avec accord. Il reste les deux dernières étapes de PAR-07 : composer le plan de table et
sortir la synthèse pour le traiteur, aujourd'hui faits sur papier ou dans un tableur recopié.

Exigences du lot :

- **INV-05** (P1) — Plan de table par glisser-déposer : formes de tables, capacité, contraintes
  « ensemble » et « séparés ». *Critère* : utilisable au clavier ; les invités non placés restent
  visibles.
- **INV-06** (P1) — Synthèse pour le traiteur : repas par type, régimes, allergènes, par table.
  *Critère* : export PDF et tableur utilisable sans retouche.

Parcours **PAR-07**, étapes 5 et 6 : « Le plan de table se compose par glisser-déposer, avec des
contraintes de placement » ; « La synthèse pour le traiteur sort en un clic : repas par type,
régimes, allergènes par table ». *Réussite* : export traiteur utilisable sans retouche.
Scénario **SC-07**, étape 6 : « Camille compose le plan de table. La synthèse pour le traiteur
sort. » *Mesure* : export traiteur exact. Personas SU-01 (Camille), SU-05 (Léa), SU-08 (Karim,
traiteur).

## Ce qui existe aujourd'hui (lot 49, fusionné le 18/11/2026)

- **Module `guests`** (ADR 0083) : foyers, invités (adulte ou enfant, tranche d'âge), réponses par
  temps fort (`guests.rsvp_answers`), temps forts de l'évènement (`events.key_moments`).
- **Régimes et allergies** : liste fermée de l'organisation (`guests.dietary_options`, régimes et
  quatorze allergènes INCO), cochés par l'invité avec son **accord** ; liste de chaque personne
  **chiffrée** au niveau du champ (`guests.diets.options_sealed`, DAT-08).
- **Accès aux régimes** (lot 49, D8) : la **titulaire** voit les régimes nominatifs ; un membre de
  l'équipe et le client voient des **nombres**, jamais les noms ; un nombre inférieur à 3
  s'affiche « moins de 3 ». Le lot 49 a fixé la règle pour le traiteur : nominatif seulement pour
  la titulaire, agrégé ailleurs.
- **Purge** : régimes effacés 7 jours après l'évènement, invités 30 jours après, avec préavis
  (RGP-08).
- **Exports** : PDF côté serveur (`@react-pdf/renderer`, ADR 0019) ; tableurs en CSV UTF-8 avec
  marque d'ordre des octets et séparateur « ; » (ouvert tel quel par Excel en français).
- **Glisser-déposer sans dépendance** : `app/events/parametres/sortable-budget-lines.tsx`.

Rien n'existe pour : les tables, le placement, les contraintes, le type de repas, la synthèse.

## Préalable commun aux lots 44 et 50 (D0)

Les deux lots ont besoin de la même interaction : **déplacer un élément vers un groupe** (une carte
vers une colonne du pipeline, un invité vers une table). Proposition : un composant commun
`app/ui/move-to-group.tsx`, écrit avant les deux lots dans une petite PR : bouton « Déplacer » et
menu des groupes (clavier, doigt), glisser-déposer HTML à la souris, annonce du résultat, focus
rendu, enregistrements à la suite. Détail dans la spécification du lot 44 (même D0).

## Une seule PR

Le lot tient en une PR : deux exigences liées (la synthèse se lit **par table**), un seul module.

## Partie A — Les tables et le plan (INV-05 ; D1 à D4)

- **Un plan par temps fort à table** (D1) : la planner choisit les temps forts qui ont un plan (le
  dîner, le brunch) ; un plan par temps fort.
- **Tables** : nom ou numéro, **forme** (ronde, rectangulaire, table d'honneur), **capacité** ;
  ajout en série (« 12 tables rondes de 10 »), copie du plan d'un temps fort à un autre. La forme
  donne l'icône, l'ordre des places au PDF et la capacité proposée ; elle ne dessine pas la salle
  (D2).
- **Qui se place** : les invités qui ont répondu **présent** à ce temps fort ; ceux qui n'ont pas
  répondu sont listés à part (« en attente de réponse ») et peuvent être placés, marqués comme
  tels ; ceux qui ont décliné n'apparaissent pas. Un invité placé qui se désiste quitte sa table et
  la planner est prévenue.
- **Placer** (D3) : composant commun (D0) : choisir un invité, puis « Placer à… » (menu des tables)
  au clavier ou au doigt ; glisser-déposer à la souris. Placer tout un foyer d'un geste. Retirer
  d'une table remet l'invité dans « Non placés ».
- **Non placés toujours visibles** (critère INV-05) : une colonne fixe sur ordinateur, un onglet
  avec leur nombre à 375 px ; le nombre est aussi en tête du plan.
- **Contraintes** (D4) : « ensemble » (ces personnes à la même table) et « séparés » (jamais à la
  même table), entre deux invités ou plus ; une contrainte non tenue est **signalée** sur la table
  et dans la liste des alertes, jamais bloquante ; une table au-delà de sa capacité est signalée,
  pas bloquée (une chaise de plus se trouve toujours).
- **Confidentialité des contraintes** : elles sont internes à l'organisation, jamais montrées au
  client ni dans un export (un « séparés » dit souvent quelque chose de la famille).
- **Vue** `/events/[id]/invites/plan` : tables en cartes, avec places occupées / capacité, enfants,
  régimes en nombre (règle du lot 49), alertes. À 375 px : une table par carte, en liste.

## Partie B — Le type de repas (INV-06 ; D5)

- **Types de repas** de l'organisation, copiés des données de départ (`meal-types.json`, FR et EN) :
  « Adulte », « Enfant », « Bébé (sans repas) », « Prestataire » ; la planner renomme, ajoute,
  masque.
- **Par défaut** : adulte → « Adulte » ; enfant → « Enfant », ou « Bébé » pour la tranche 0-2 ans ;
  la planner change le type d'un invité (adolescent servi en adulte, par exemple).
- **Repas prestataires** : un **nombre** par temps fort, saisi par la planner (photographe, DJ…) ;
  ce ne sont pas des invités et ils n'ont pas de table.

## Partie C — La synthèse pour le traiteur (INV-06 ; D6 à D8)

- **Contenu**, par temps fort à table :
  - **totaux** : repas par type ; régimes et allergènes par entrée de la liste ;
  - **par table** : nom de la table, nombre de couverts par type de repas, régimes et allergènes
    **par personne** pour la version nominative (D6), en nombres pour la version agrégée ;
  - repas prestataires et invités « en attente de réponse » à part ;
  - date de la synthèse (« arrêtée au 3 juin 2027, 18 h »), car les réponses bougent.
- **Exports** (D7) : **PDF** (une page de totaux, puis une page par groupe de tables, lisible
  imprimé en noir et blanc) et **tableur** CSV (une ligne par personne placée pour la version
  nominative, une ligne par table pour l'agrégée ; colonnes nommées, nombres en nombres, sans
  cellule fusionnée). Neutralisation des cellules commençant par `=`, `+`, `-`, `@` (règle des
  imports, appliquée aussi aux exports).
- **Qui exporte quoi** (D6) : la **titulaire** obtient la version nominative ; un membre de l'équipe
  la version agrégée **exacte par table** (pas de « moins de 3 » : un traiteur ne sert pas
  « moins de 3 » assiettes), sans aucun nom à côté d'un régime. Contrôle côté serveur.
- **Rien n'est stocké** (D8) : l'export se calcule à la demande, n'est jamais rangé dans les
  documents ni dans Garage, et chaque téléchargement est journalisé (qui, quand, quelle version,
  sans contenu). Ainsi la purge des régimes à J+7 n'a aucune copie à poursuivre dans Symbola ; la
  copie envoyée au traiteur sort de Symbola, et l'écran d'export le rappelle (une phrase).
- **Un clic** (PAR-07) : bouton « Synthèse pour le traiteur » sur le plan, qui propose PDF ou
  tableur et la version permise.

## Partie D — Aide, droits, RGPD

- **Droits** : la titulaire et les membres composent le plan ; le client ne le voit pas dans ce lot
  (D9).
- **Aide contextuelle** : « Composer le plan de table », « Envoyer la synthèse au traiteur » ; textes
  des écrans et du PDF en français et en anglais (langue de l'organisation pour le PDF).
- **RGPD** : tables, placements et contraintes entrent au registre et dans `privacy/v1` du module
  `guests` ; ils suivent la **purge des invités** (30 jours après l'évènement, préavis existant) ;
  les contraintes « séparés » sont des données internes, notées au registre comme telles.
- **ARC-07** : sans le module Invités, l'onglet n'existe pas et la page répond « indisponible »
  (règle du lot 49).

## Décisions à prendre

- **D0 — Le préalable commun aux lots 44 et 50.** Voir la spécification du lot 44.
  **Recommandation : (a)**, petite PR préalable.
- **D1 — Un plan par temps fort.**
  - (a) Un plan par temps fort choisi (dîner, brunch…).
  - (b) Un seul plan par évènement.

  **Recommandation : (a).** Les présences sont déjà par temps fort (lot 49) ; un brunch du
  lendemain n'a ni les mêmes convives ni les mêmes tables. La copie d'un plan évite la ressaisie.
- **D2 — Dessiner la salle.**
  - (a) Non : tables en cartes, forme et capacité en attributs ; le PDF les liste dans l'ordre.
  - (b) Plan de salle en 2D (positions, formes dessinées).

  **Recommandation : (a).** (b) est lourd, difficile au clavier et au lecteur d'écran (critère
  INV-05), et rarement exact sans le plan du lieu (PRE-06, pas encore là). L'aide au placement et
  le plan de salle pourront venir avec INV-11 (P2).
- **D3 — L'interaction de placement.**
  - (a) Composant commun (D0) : « Placer à… » au clavier et au doigt, glisser-déposer à la souris,
    sans dépendance.
  - (b) Une bibliothèque de glisser-déposer (dnd-kit, MIT) : dépendance hors stack, ADR.

  **Recommandation : (a).** Le dépôt a déjà ce modèle (lot 13) ; le glisser-déposer HTML ne marche
  pas au doigt, le menu si.
- **D4 — Les contraintes non tenues.**
  - (a) Signalées, jamais bloquantes ; capacité dépassée signalée aussi.
  - (b) Placement refusé s'il viole une contrainte.

  **Recommandation : (a).** La planner arbitre souvent entre deux contraintes ; un refus la
  forcerait à les défaire pour avancer.
- **D5 — Le type de repas.**
  - (a) Liste de l'organisation, valeur par défaut tirée de l'âge, modifiable par invité ; repas
    prestataires en nombre.
  - (b) Adulte et enfant seulement.

  **Recommandation : (a).** « Repas par type » (INV-06) ; « bébé » et « prestataire » sont les
  premières questions d'un traiteur.
- **D6 — Nominatif ou agrégé.** Point à confirmer avec la DPO (DPO-7).
  - (a) Nominatif pour la titulaire seule (règle du lot 49) ; agrégé **exact** par table pour un
    membre, sans « moins de 3 ».
  - (b) Agrégé seulement, pour tout le monde.

  **Recommandation : (a).** Le traiteur sert la personne, pas un nombre : « Mme X, table 4, sans
  gluten ». Le texte d'accord du lot 49 nomme déjà le traiteur parmi les destinataires. Le seuil
  « moins de 3 » protège un affichage au client ou à l'équipe ; il rendrait la synthèse inutile au
  traiteur, et elle reste sans nom côté membre.
- **D7 — Le tableur.**
  - (a) CSV UTF-8 avec marque d'ordre des octets, séparateur « ; », comme les exports existants.
  - (b) Fichier Excel `.xlsx` : dépendance (exceljs), ADR.

  **Recommandation : (a).** Excel et LibreOffice l'ouvrent tel quel en français ; aucune
  dépendance. (b) si un traiteur pilote le réclame.
- **D8 — Garder une copie de la synthèse.**
  - (a) Non : calculée à chaque demande, téléchargement journalisé sans contenu.
  - (b) Rangée dans les documents de l'évènement.

  **Recommandation : (a).** (b) créerait une copie des régimes qui échappe à la purge de J+7.
- **D9 — Le client et le plan.**
  - (a) Pas dans ce lot : la planner compose ; elle peut envoyer le PDF du plan (sans régimes ni
    contraintes) au client.
  - (b) Le client compose ou modifie le plan dans son portail (rubrique « Invités »).

  **Recommandation : (a).** SC-07 fait composer Camille ; ouvrir le plan au client demande de
  cacher les contraintes et de gérer deux auteurs en même temps. À reprendre si la pilote le
  demande.

## Points pour les conseils

**DPO** (question suivante de sa fiche, numéro donné à la fusion : le lot 46 prend la 13) :

- **DPO-7** — La synthèse nominative pour le traiteur (D6 a) : nom, table et régimes ou allergies
  de chaque personne, exportée par la titulaire et envoyée au traiteur hors de Symbola. Le texte
  d'accord du lot 49 nomme le traiteur comme destinataire et la durée de 7 jours après
  l'évènement : suffit-il, ou faut-il rappeler au traiteur une durée de conservation (mention en
  pied du PDF) ? Recommandation de travail : une mention en pied de page (« Données transmises
  pour le service du repas ; à supprimer après l'évènement »).
- **DPO-8** — Les contraintes « séparés » : données internes, jamais exportées, purgées avec les
  invités. Faut-il une durée plus courte ?

## Migrations (prévision)

Numérotation : le lot part du premier numéro libre de `main` au moment de son code. La PR
fusionnée en second **renumérote** les siennes **et** leur donne une date (`when` du journal)
postérieure à la dernière de `main` (le migrateur de Drizzle n'applique pas une migration plus
ancienne que la dernière appliquée).

- **`guests`** (une migration et son annulation) :
  - `meal_types` (organisation, clé de départ, libellé, masqué, position) ;
  - `guests.meal_type_id` (facultatif : vide = valeur par défaut tirée de l'âge) ;
  - `seating_plans` (évènement, temps fort, unique par temps fort) ;
  - `seating_tables` (plan, nom, forme, capacité, position) ;
  - `seat_assignments` (table, invité, unique par invité et par plan) ;
  - `seating_constraints` (plan, nature `together` ou `apart`) et
    `seating_constraint_members` (contrainte, invité) ;
  - `vendor_meal_counts` (évènement, temps fort, nombre) ;
  - `caterer_summary_downloads` (évènement, temps fort, version nominative ou agrégée, par qui,
    quand) ;
  - RLS et index sur `organization_id` partout ; droits du rôle applicatif ; purge des invités
    étendue aux nouvelles tables.
- Aucune migration `hub` ni `events`.
- Données de départ : `meal-types.json` (FR et EN).

## Fichiers touchés (prévision)

- `packages/db/src/schema/guests.ts`, `packages/db/drizzle/`, `packages/db/drizzle-rollback/`.
- `apps/symbola/modules/guests/` : `seating.ts`, `meal-types.ts`, `caterer-summary.ts`,
  `caterer-summary-pdf.tsx`, `service.ts`, `repository.ts`, `purge.ts`, `privacy.ts` ; tests.
- `apps/symbola/app/events/[id]/invites/plan/` (plan, tables, contraintes, exports).
- `apps/symbola/app/ui/move-to-group.tsx` : composant commun (D0, PR préalable).
- `packages/starter-templates/src/meal-types.json` ; `packages/i18n/src/messages/fr.json` et
  `en.json` ; centre d'aide ; `privacy.registry.yaml`.
- `docs/gap.csv` (INV-05, INV-06), ADR 0086, `docs/recette/SC-07.md` (étape 6).

## Tests

Chaque critère devient un test ; les `describe` portent l'identifiant.

- **INV-05** (intégration) : tables en série, capacité, copie d'un plan ; seuls les présents au
  temps fort, les « en attente » à part ; un désistement libère la place ; contrainte
  « ensemble » ou « séparés » non tenue signalée ; capacité dépassée signalée ; un invité n'est
  placé qu'une fois par plan.
- **INV-05** (Playwright, ordinateur et 375 px, axe-core) : placer un invité **au clavier seul**
  (choix, « Placer à… », annonce, focus) ; placer un foyer ; glisser-déposer à la souris ; les non
  placés restent visibles, avec leur nombre ; à 375 px, sans défilement horizontal.
- **INV-06** (intégration) : totaux par type de repas, régimes et allergènes, par table, **exacts**
  sur le jeu fictif de SC-07 (cent vingt invités) ; repas prestataires et « en attente » à part ;
  version nominative pour la titulaire seulement, agrégée pour un membre, contrôle serveur ;
  cellules `=`, `+`, `-`, `@` neutralisées ; rien n'est stocké, le téléchargement est journalisé.
- **INV-06** (PDF et CSV) : le CSV s'ouvre en colonnes justes (séparateur, accents, nombres) ; le
  PDF a ses pages et ses totaux (test du contenu rendu).
- **Abus et isolation** (SEC-36) : organisation A ne lit ni ne place les invités de B ; un membre
  qui demande la version nominative reçoit l'agrégée (ou un refus) ; le client par son lien
  n'obtient ni plan ni synthèse ; l'Admin rien ; aucun nom ni régime dans les journaux.
- **Purge** (horloge simulée) : tables, placements et contraintes effacés avec les invités à J+30 ;
  à J+8, la synthèse ne contient plus aucun régime.
- **ARC-07** : module fermé, page « indisponible », jamais d'erreur.
- **Rejeu** : SC-07 étape 6 sur le jeu fictif ; `docs/recette/SC-07.md` complété.

## Hors périmètre

- Aide au placement automatique (INV-11, P2) ; plan de salle dessiné (D2).
- Plan composé par le client dans son portail (D9).
- Synthèse partagée par le lien du traiteur (après le lot 47) ; export `.xlsx` (D7 b).
- Cartons de table, marque-places, impression d'étiquettes.
- Hébergements et navettes (INV-09, P2).

## Ambiguïtés relevées

- INV-06 dit « repas par type » sans les nommer : la spécification en fait une liste de
  l'organisation (D5), avec quatre types au départ.
- « Par table » suppose un plan : sans plan, la synthèse sort les **totaux** seulement, avec la
  mention « plan de table non composé ».
- Les invités « en attente de réponse » à la date de la synthèse : comptés à part, jamais dans les
  couverts.

## Travail en parallèle (lots 44, 47 et 50)

- **Avec le lot 44** : préalable commun D0 (composant `move-to-group`) ; aucun schéma partagé.
- **Avec le lot 47** : aucun fichier de code commun prévu (le lot 47 ne touche pas au module
  Invités ; la synthèse ne passe pas par le lien du traiteur dans ces deux lots).
- **Traductions** (`fr.json`, `en.json`) et `docs/gap.csv` : conflits de texte attendus entre les
  trois lots, sans recouvrement.
- Le lot 50 ne touche ni au schéma `events` ni au `hub` : ses migrations ne gênent personne, mais
  suivent la même règle de renumérotation.
