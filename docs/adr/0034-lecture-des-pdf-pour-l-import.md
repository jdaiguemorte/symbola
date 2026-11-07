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
   - `isEvalSupported: false` (la faille CVE-2024-4367 des versions anciennes passait par
     l'évaluation de code lors du chargement des polices ; version figée au-delà du correctif) ;
   - pas de worker séparé, pas de police ni de ressource chargée depuis le réseau
     (`disableFontFace`, `useSystemFonts: false`), scripts et formulaires du PDF ignorés ;
   - limites avant toute lecture : taille du fichier (réglage de la plateforme, comme le lot
     5), nombre de pages (3 au plus pour une fiche), temps de lecture borné ; un PDF chiffré est
     refusé ;
   - le fichier passe par l'antivirus à l'envoi, puis n'est **jamais stocké** (seules les valeurs
     lues restent, dans l'import en cours, comme pour un tableau).
3. **Profil de format en données** : les libellés repères (« Date de l'événement », « Lieu de
   l'événement », « Le budget de l'évènement »…) et la règle des colonnes vivent dans un profil
   de `packages/starter-templates`, pas dans le code ; le moteur ne connaît que des blocs de
   texte positionnés. Un autre logiciel aura son propre profil.
4. **Neutralisation** : les valeurs lues dans un PDF passent par la même neutralisation que les
   cellules d'un tableau (`=`, `+`, `-`, `@`).

## Conséquences

- Une dépendance de plus à surveiller (Renovate, OSV-Scanner, Trivy) ; sa taille n'alourdit que
  le serveur (aucun code envoyé au navigateur).
- Les fiches scannées (images) ne sont pas lisibles : rejetées avec un motif clair. Une
  reconnaissance de caractères n'est pas prévue.
- Les tests de lecture tournent sur des fiches fictives reconstituées
  (`packages/testing/import-corpus/files/logiciel-tiers/`) ; les vraies fiches de Julien ne
  servent qu'à une vérification manuelle en local.
