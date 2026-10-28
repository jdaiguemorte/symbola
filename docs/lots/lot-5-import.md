# Lot 5 — Import

Une PR par story (`lot-5-imp-0x-<nom>`), tests d'abord à partir des critères ci-dessous
(`describe('IMP-0x — ...')`), tests d'isolation obligatoires pour chaque nouvelle table et
chaque route. Commits en français (Conventional Commits), confirmation de Julien avant chaque
`git push`. Ordre de construction : **IMP-01, IMP-02, IMP-03, IMP-04, IMP-05**, puis la visite
guidée et l'aide de l'import.

L'import fait entrer dans Symbola les données d'un autre outil (Wedding Plan pour le pilote,
n'importe quel tableur demain). Il se déroule en **5 étapes visibles** : fichier, colonnes,
rapprochements, écarts, confirmation. **Rien n'est écrit dans les modules avant la dernière
étape**, et un import confirmé reste annulable (PRD §7).

## Décisions prises avec Julien avant de coder (27/10/2026)

1. **Lecteur Excel maison, sans dépendance** (ADR 0022) : un lecteur `.xlsx` minimal bâti sur
   `node:zlib` (première feuille, valeurs seulement, limites strictes de taille et de
   décompression contre les « bombes zip »). Aucun paquet tiers à surveiller. Les formats `.xls`
   (binaire, ancien Excel), `.ods` et les classeurs protégés par mot de passe sont refusés avec
   un message clair (« enregistrez le fichier en .xlsx ou .csv »).
2. **Un type d'éléments par import** : à l'étape 1, la planner choisit ce que contient le
   fichier — événements (avec leurs clients, une ligne = un événement), tâches, lignes de budget,
   articles du catalogue, ou une liste paramétrable (postes, sources de prospects, motifs de
   perte, modes de paiement). Les tâches et lignes de budget se rattachent à un événement
   existant par rapprochement (clients + date).
3. **Champs libres sur chaque élément importé** (IMP-04) : chaque module garde, sur son propre
   élément, les colonnes conservées sans équivalent (colonne `imported_fields`, clé → valeur),
   affichées en lecture seule dans un bloc « Champs importés » de la fiche. Déclarées dans
   `privacy.registry.yaml`.
4. **Corpus d'abord** : la reconnaissance est développée et testée sur un corpus varié
   (`packages/testing/import-corpus/`) ; Julien y ajoutera l'export Wedding Plan anonymisé
   quand il l'aura, comme test supplémentaire (PRD §7, « Robustesse »).

## Valeurs validées par Julien (28/10/2026)

- **Taille maximale** : 10 Mo, réglage de la plateforme
  (`hub.platform_settings`, Admin), jamais en dur ; nombre de lignes plafonné (5 000,
  même réglage).
- **Durée de vie d'un import en cours** (étapes 1 à 4 non confirmées) : 7 jours, puis purge
  automatique des lignes en attente (elles contiennent des données personnelles).
- **Durée pendant laquelle un import confirmé reste annulable** : 90 jours ; ensuite
  les valeurs précédentes conservées pour l'annulation sont effacées, le journal (fichier,
  auteur, date, résultat chiffré) reste.

## Frontières de module (ADR 0011, 0022)

- **`packages/import-engine`** (pur, sans base ni réseau) : lecture des fichiers (IMP-01),
  détection d'encodage, de séparateur et de ligne d'en-tête, neutralisation des formules,
  proposition de correspondances de colonnes (IMP-02), analyse des dates et montants français,
  calcul de ressemblance pour les rapprochements (IMP-03). Testé seul, sur le corpus.
- **Module `hub`** (écran et orchestration, CLAUDE.md §4) : routes `/import/...`, tables
  `hub.imports` (import en cours puis journal) et `hub.import_items` (un élément créé ou mis à
  jour, ses valeurs précédentes et les valeurs écrites, pour l'annulation). Antivirus ClamAV à
  l'envoi via `@symbola/files` ; le fichier n'est **jamais stocké** : il est lu, ses lignes
  neutralisées sont gardées en attente dans `hub.imports`, puis le fichier est oublié.
- **Chaque module reçoit ses lignes par son `service.ts`** (cahier des charges §5.9) : fonctions
  d'import (créer ou mettre à jour un lot d'éléments, renvoyer leurs identifiants et valeurs
  précédentes), de lecture de l'état courant (détection d'une modification à la main depuis
  l'import) et d'annulation. Le hub n'accède jamais aux tables d'un module.
- **Données d'essai** : un import n'écrit jamais dans un événement d'essai (`is_demo`), et les
  rapprochements ignorent les éléments d'essai (ADR 0008).

## Stories et critères d'acceptation (PRD §7, précisés)

### IMP-01 — Formats acceptés

- Quand elle dépose un fichier CSV, Excel (`.xlsx`) ou JSON, alors l'app détecte l'encodage
  (UTF-8 avec ou sans BOM, Windows-1252), le séparateur (virgule, point-virgule, tabulation) et
  la ligne d'en-tête (première ligne non vide dont les cellules sont du texte distinct).
- Le type est reconnu **par le contenu** (signature zip + `[Content_Types].xml` pour `.xlsx`,
  JSON valide tableau d'objets ou objet contenant un tableau d'objets, sinon texte délimité),
  jamais par l'extension seule.
- Étant donné un fichier d'un autre format, trop gros (10 Mo, proposé) ou infecté, alors il est
  refusé avec un message clair (FR/EN), sans rien garder du fichier.
- Le contenu des cellules qui commencent par `=`, `+`, `-` ou `@` (y compris après des espaces,
  une tabulation ou un retour chariot) est neutralisé **dès la lecture** : préfixé d'une
  apostrophe, jamais interprété, ni dans Symbola ni dans un tableur qui rouvrirait un export. Seule
  exception : une cellule qui n'est qu'un nombre signé (`-12,50`, `+33 6 12 34 56 78`), sans
  aucun autre caractère, reste telle quelle — elle ne peut pas être une formule.
- Cas limites testés : fichier vide, en-tête seul, lignes vides, guillemets et séparateurs dans
  les cellules, retours à la ligne dans une cellule, lignes de longueurs différentes, cellules
  fusionnées ou dates numériques d'Excel (numéro de série → date), chaînes partagées, bombe zip
  (taille décompressée plafonnée), JSON trop profond.
- *Réalisé (IMP-01)* : `packages/import-engine` (lecture, sans base ni réseau), tables
  `hub.imports` (RLS forcée, migrations 0043/0044) et limites dans `hub.platform_settings`
  (réglables par l'Admin : taille, lignes, durée de conservation d'un import en cours) ; écran
  `/import` (étape « fichier » et journal), purge horaire des imports en cours expirés. Le
  `TextDecoder` de Node lit « windows-1252 » comme du Latin-1 (€, Œ, guillemets perdus) : le
  décodage Windows-1252 passe par une table explicite. L'écran n'est pas encore relié au tableau
  de bord : il le sera quand l'import ira jusqu'à la confirmation (IMP-05).

### IMP-02 — Reconnaissance des colonnes

- Quand le fichier est lu, alors l'app propose une correspondance pour chaque colonne vers les
  champs du type choisi (« Prénom mariée » → client 1, prénom), avec un **indice de confiance**
  (0-100), à partir du nom de la colonne (synonymes FR/EN, données traduisibles dans
  `packages/starter-templates`, jamais en dur) et de son contenu (dates, e-mails, montants,
  téléphones).
- Elle valide, corrige ou ignore chaque correspondance. Une colonne à faible confiance (< 70,
  proposé) **n'est jamais appliquée sans validation** explicite.
- Les dates et montants au format français (31/12/2026, 31.12.2026, 2026-12-31, 1 234,56 €,
  1234.56) sont reconnus ; une date ambiguë (05/06/2026) suit le format majoritaire de la
  colonne.

### IMP-03 — Rapprochements

- Étant donné une ligne qui ressemble à un élément existant (mêmes clients et même date pour un
  événement ; même intitulé pour un article ou une liste ; même intitulé dans le même événement
  pour une tâche ou un poste), alors l'app propose de les rapprocher, avec le niveau de
  ressemblance.
- Elle valide les rapprochements un par un ou en lot, en refuse, et en ajoute à la main.
- Une ligne rapprochée met à jour l'élément existant ; elle n'en crée pas de doublon.

### IMP-04 — Rapport des écarts

- Le rapport liste les colonnes sans équivalent. Pour chacune, elle choisit : garder en « champ
  libre » visible sur la fiche, ou ignorer.
- Il liste les lignes rejetées avec leur motif (date invalide, champ obligatoire manquant…). Ce
  rapport se télécharge en CSV (cellules neutralisées) pour corriger et réimporter.

### IMP-05 — Aperçu et annulation

- Avant confirmation, elle voit le résultat : X créations, Y mises à jour, Z lignes rejetées,
  avec un échantillon.
- La confirmation écrit tout ou rien (une seule transaction ; un échec n'écrit aucune ligne).
- Quand elle annule un import déjà confirmé, alors les éléments créés sont supprimés et les
  éléments mis à jour retrouvent leurs valeurs précédentes. Étant donné un élément modifié à la
  main depuis l'import, alors l'app le signale et ne l'écrase pas sans confirmation.
- Chaque import est journalisé : fichier (nom, type, taille), auteur, date, résultat chiffré.

## Hors périmètre du lot

- Prestataires (app V2) : leurs noms importés restent du texte sur les postes (PRD §7).
- Modèles (rétroplanning, répartition, programme) : saisie ou modèles de départ, pas d'import au
  MVP.
- Devis, factures, encaissements : jamais importés (numérotation légale, ADR 0010).
