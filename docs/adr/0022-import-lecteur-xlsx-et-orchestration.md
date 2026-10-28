# ADR 0022 — Import : lecteur `.xlsx` sans dépendance et orchestration par le hub

- Statut : accepté
- Date : 2026-10-27
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md), [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md)

## Contexte

Le lot 5 (PRD §7, IMP-01 à IMP-05) fait entrer des fichiers CSV, Excel (`.xlsx`) et JSON venus
d'autres outils. Deux questions structurantes (tranchées avec Julien le 27/10/2026) :

1. **Lire un `.xlsx`** : la stack (CLAUDE.md §3) n'a aucune bibliothèque Excel. Les candidates
   ont un coût : le paquet npm `xlsx` (SheetJS) n'est plus publié sur npm et la dernière version
   qui s'y trouve porte des vulnérabilités connues (pollution de prototype, ReDoS) ; `exceljs`
   tire une chaîne de dépendances (zip, flux) à surveiller pour un besoin limité à « lire les
   valeurs de la première feuille ».
2. **Où vit l'import** : le cahier des charges (§5.9) en fait une brique du socle — le hub
   fournit l'écran, chaque module reçoit ses lignes par son API — sans que le hub lise ni n'écrive
   jamais les tables d'un autre module (ADR 0011).

## Décision

1. **Lecteur `.xlsx` minimal, dans `packages/import-engine`, sans dépendance.** Un `.xlsx` est
   une archive zip de fichiers XML (Office Open XML). Le lecteur :
   - lit le répertoire central du zip, refuse le chiffrement, le zip64 et les méthodes autres
     que « stockée » et « deflate » ; décompresse avec `zlib.inflateRawSync` et
     **`maxOutputLength`** (plafond par entrée et plafond cumulé) — une bombe zip est refusée
     avant d'occuper la mémoire ;
   - ne lit que `xl/workbook.xml` (première feuille), ses relations, `xl/sharedStrings.xml`,
     `xl/styles.xml` (pour reconnaître une cellule au format date) et la feuille elle-même ;
   - extrait les valeurs (texte, nombre, booléen, chaîne partagée, texte en ligne, numéro de
     série de date Excel → date) par une analyse XML restreinte au vocabulaire de ces quatre
     fichiers : aucune entité externe, aucune DTD (refusée), aucune exécution, aucun
     recalcul de formule (seule la dernière valeur calculée, mise en cache par Excel, est lue).
   - Les formats `.xls` (binaire) et `.ods`, et les classeurs protégés, sont refusés avec un
     message clair.

   Il est testé sur un corpus de fichiers produits par Excel, LibreOffice et Google Sheets
   (`packages/testing/import-corpus/`) et sur des fichiers malformés ou hostiles.
2. **Détection par le contenu** : zip + `[Content_Types].xml` de classeur → `.xlsx` ; JSON
   valide → JSON ; sinon texte délimité si l'encodage est reconnu (UTF-8, Windows-1252 via
   `TextDecoder`, disponible dans Node). L'extension ne sert qu'au message d'erreur.
3. **Orchestration par le hub** : écran `/import`, tables `hub.imports` (import en cours :
   lignes lues et neutralisées en attente, correspondances, choix ; puis journal) et
   `hub.import_items` (élément créé ou mis à jour : identifiant, valeurs précédentes, valeurs
   écrites). Le fichier n'est jamais stocké. À la confirmation, le hub appelle les fonctions
   d'import de chaque `service.ts` concerné ; à l'annulation, leurs fonctions de relecture et
   d'annulation. Le hub ne voit que des identifiants opaques et des valeurs renvoyées par les
   services.
4. **Champs libres** : chaque module porte une colonne `imported_fields` (jsonb, clé → texte)
   sur ses éléments importables, affichée en lecture seule sur la fiche ; déclarée dans
   `privacy.registry.yaml`.

## Conséquences

- Aucune nouvelle dépendance ; le lecteur reste petit (valeurs seulement) et entièrement testé.
  Contrepartie : formats exotiques (`.xlsb`, `.xls`, cellules riches) non lus — l'utilisatrice
  est invitée à enregistrer en `.xlsx` ou `.csv`.
- Si un besoin plus large apparaît (écriture d'Excel, plusieurs feuilles, formats anciens), une
  bibliothèque pourra remplacer le lecteur derrière la même fonction `readImportFile`, par un
  nouvel ADR.
- Chaque module importable ajoute à son `service.ts` trois fonctions (import, relecture,
  annulation) et à ses éléments la colonne `imported_fields` : coût par module, mais aucune
  écriture transversale.
- Si un module devient une app autonome (ADR 0011), ses fonctions d'import deviennent des routes
  `/v1/.../imports` sans changer l'écran du hub.
