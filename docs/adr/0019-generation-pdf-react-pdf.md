# ADR 0019 — Génération des PDF avec @react-pdf/renderer

- Statut : accepté
- Date : 2026-10-27

## Contexte

EVT-05 demande d'exporter le programme du jour J en PDF A4 « lisible à
l'impression, avec son logo et la date de version », en deux variantes
(mariés, prestataires). Les lots suivants exporteront aussi des devis et
des factures (lot 4). Rien dans la stack du CLAUDE.md ne produit de PDF.

Options étudiées :

- **Chromium sans tête (Playwright/Puppeteer) imprimant une page HTML** :
  rendu fidèle, mais un navigateur complet dans l'image de production
  (centaines de Mo, surface d'attaque, mémoire sur le VPS partagé).
- **pdfkit ou pdf-lib directement** : légers, mais mise en page à la main
  (coordonnées, sauts de page), donc beaucoup de code pour un tableau.
- **@react-pdf/renderer** : composants React (déjà la stack), mise en page
  flexbox, sauts de page automatiques, polices standard PDF sans fichier à
  embarquer, rendu côté serveur en Node (`renderToBuffer`), sans navigateur.

## Décision

`@react-pdf/renderer`, version exacte 4.9.0 (publiée le 27/08/2026), dans
`apps/symbola` uniquement, déclarée dans `serverExternalPackages` de Next.js.
Validée par Julien avant l'ajout (CLAUDE.md §8, dépendance hors stack).

- Le contenu d'un document est construit par une fonction pure testée
  (ex. `buildProgramPdfModel`) ; le composant PDF ne fait que la mise en
  page. Les règles métier (pas de note interne dans la variante mariés)
  se testent donc sans décoder le PDF.
- Polices standard Helvetica (jeu WinAnsi : accents français, €, tirets) ;
  pas de police à embarquer. Les espaces insécables d'`Intl` sont
  remplacées par des espaces simples (`formatDateTime`).
- Le logo vient du stockage privé (`@symbola/files`, `getPrivateObject`),
  PNG ou JPEG vérifié par son contenu ; absent ou illisible, le nom de
  l'organisation le remplace, sans erreur.
- Les PDF sont produits à la demande par une route serveur qui vérifie
  session, organisation et module ; ils ne sont pas stockés.

## Conséquences

Une dépendance de plus (et ses dépendances : pdfkit, yoga-layout,
fontkit…), surveillée par OSV-Scanner, Trivy et Renovate comme le reste.
Les devis et factures du lot 4 réutiliseront le même patron (modèle pur +
composant de mise en page + en-tête `getDocumentHeader`). Si un rendu plus
riche devient nécessaire (polices de marque, mise en page complexe), on
embarquera des polices TTF via `Font.register` avant d'envisager un
navigateur sans tête.
