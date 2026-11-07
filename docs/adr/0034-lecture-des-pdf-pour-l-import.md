# ADR 0034 — Import : lecture des fiches PDF avec `pdfjs-dist`

- Statut : accepté (07/11/2026, avec la spécification du lot 14)
- Date : 2026-11-07
- Complète : [0022](0022-import-lecteur-xlsx-et-orchestration.md)

## Contexte

Le lot 14 reprend les événements de l'outil de planification actuel de la planner. Cet outil ne
les exporte pas en tableau, seulement en **fiche PDF d'une page par événement**
(`docs/lots/lot-14-imports.md`). Le PDF contient du texte réel, mais disposé sur **deux
colonnes** (les deux mariés côte à côte, deux lieux par rangée) : une extraction ligne à ligne
mélange les colonnes. Il faut donc lire chaque morceau de texte **avec sa position**.

La dépendance `pdfjs-dist` a été acceptée par Julien au lot 12 (`docs/lots/lot-12-demarrage.md`)
pour ce besoin. Écrire un lecteur PDF maison, comme le lecteur `.xlsx` de l'ADR 0022, n'est pas
raisonnable : flux compressés, polices et encodages de caractères, objets indirects — c'est un
format bien plus vaste qu'un zip de XML.

## Décision

1. **`pdfjs-dist`, version figée** (build « legacy » pour Node), dans `packages/import-engine`,
   côté serveur uniquement. Seule l'API texte est utilisée (`getTextContent` : chaînes avec
   leurs coordonnées et leur taille) ; aucun rendu, aucun canvas.
2. **Durcissement** :
   - version 6 figée (6.4.299) : la faille CVE-2024-4367 des versions anciennes passait par
     l'évaluation de code lors du chargement des polices ; ce chemin n'existe plus dans la
     bibliothèque (aucun `eval` ni `new Function`), l'option `isEvalSupported` a disparu ;
   - la bibliothèque de dessin native facultative (`@napi-rs/canvas`) est exclue de
     l'installation (`pnpm.overrides`) : elle ne sert qu'au rendu ;
   - pas de police ni de ressource chargée depuis le réseau (`disableFontFace`,
     `useSystemFonts: false`, `useWorkerFetch: false`), formulaires XFA ignorés
     (`enableXfa: false`), scripts du PDF jamais exécutés (pas de rendu) ;
   - limites avant toute lecture : taille du fichier (réglage de la plateforme, comme le lot
     5), nombre de pages (3 au plus pour une fiche), temps de lecture borné ; un PDF chiffré est
     refusé ;
   - le fichier passe par l'antivirus, puis n'est **jamais gardé au-delà de sa lecture** : depuis
     le lot 15 (ADR 0035), il attend sa lecture chiffré dans le stockage privé, puis il est
     supprimé avec sa clé (seules les valeurs
     lues restent, dans l'import en cours, comme pour un tableau).
3. **Profil de format en données** : les libellés repères (« Date de l'événement », « Lieu de
   l'événement », « Le budget de l'évènement »…) et la règle des colonnes vivent dans un profil
   de `packages/starter-templates`, pas dans le code ; le moteur ne connaît que des blocs de
   texte positionnés. Un autre logiciel aura son propre profil.
4. **Neutralisation** : les valeurs lues dans un PDF passent par la même neutralisation que les
   cellules d'un tableau (`=`, `+`, `-`, `@`).
5. **Module de lecture chargé explicitement** (constaté au lot 14c) : côté serveur, pdfjs lit le
   PDF dans le même processus avec son module `pdf.worker.mjs`, qu'il importe par un chemin
   relatif à son propre fichier. Next.js intègre `pdfjs-dist` à son bundle serveur et ce chemin
   n'existe plus (« Setting up fake worker failed »). `packages/import-engine` charge donc ce
   module lui-même et le confie à pdfjs (`globalThis.pdfjsWorker`), qui l'utilise en priorité :
   la lecture fonctionne à l'identique en test, en dev et dans l'image Docker. Le parcours
   Playwright IMP-08 le vérifie sur l'app compilée.

## Conséquences

- Une dépendance de plus à surveiller (Renovate, OSV-Scanner, Trivy) ; sa taille n'alourdit que
  le serveur (aucun code envoyé au navigateur).
- Les fiches scannées (images) ne sont pas lisibles : rejetées avec un motif clair. Une
  reconnaissance de caractères n'est pas prévue.
- Les tests de lecture tournent sur des fiches fictives reconstituées
  (`packages/testing/import-corpus/files/logiciel-tiers/`) ; les vraies fiches de Julien ne
  servent qu'à une vérification manuelle en local.
