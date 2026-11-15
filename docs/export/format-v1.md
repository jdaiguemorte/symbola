# Format `symbola.export/v1` — export complet d'une organisation

Référence du format de l'export complet (HUB-13, DAT-13 ; lot 35a, ADR 0068). La liste des
entités, leurs champs et les tables non exportées sont générés à côté des schémas :
[`docs/schemas/export/v1/README.md`](../schemas/export/v1/README.md).

## L'archive

Une archive ZIP, préparée en arrière-plan à la demande de la Propriétaire (Paramètres, Exporter
mes données), téléchargeable le temps réglé par l'Admin (7 jours au départ), puis effacée.

| Entrée | Contenu |
| --- | --- |
| `manifest.json` | Format, date, organisation (identifiant et nom), liste des entités (module, nom, nombre de lignes, chemins du JSON, du CSV et du schéma), fichiers (chemin, entité, ligne, champ, taille, SHA-256), fichiers introuvables, et l'empreinte SHA-256 de chaque autre entrée. Il suit `exportManifestSchema` (`packages/contracts/src/export`). |
| `json/<module>/<entité>.json` | **La référence** : la liste des lignes de l'entité, des objets JSON. |
| `csv/<module>/<entité>.csv` | Les mêmes lignes et colonnes, pour un tableur : UTF-8 avec BOM, séparateur `;`, fins de ligne CRLF ; une valeur objet ou liste y est écrite en JSON ; une cellule qui commence par `=`, `+`, `-` ou `@` est précédée d'une apostrophe (sauf un téléphone international ou un nombre négatif). |
| `schemas/<module>/<entité>.schema.json` | Le schéma d'une ligne de l'entité (JSON Schema 2020-12), le même que dans `docs/schemas/export/v1`. |
| `fichiers/<module>/<entité>/<identifiant>-<champ>.<extension>` | Les documents : la ligne qui porte un fichier donne ce chemin à la place de la clé du stockage. |
| `LISEZMOI.txt` | Le contenu, les exclusions, les conventions et la reprise, en français et en anglais. |

Modules, dans l'ordre de l'archive (et de la reprise) : `hub`, `events`, `budget`, `quotes`,
`vendors`.

## Conventions

- **Noms** : entités en `snake_case` (le nom de la table, sauf `hub/activity_journal` et
  `hub/team_members`) ; champs en `camelCase`.
- **Identifiants** : ceux de l'espace d'origine (UUID). Ils relient les entités entre elles ; la
  reprise en attribue de nouveaux et garde la correspondance.
- **Montants** : entiers en centimes, devise EUR explicite quand l'entité la porte ; taux en points
  de base (`…BasisPoints`), quantités en millièmes (`…Milli`).
- **Dates** : `AAAA-MM-JJ` ; **instants** : ISO 8601 UTC (`2026-11-15T10:00:00.000Z`) ;
  **heures** : `HH:MM:SS`.
- **Absence** : `null`, jamais une chaîne vide à la place.
- **Champ d'organisation** : retiré de chaque ligne (il est dans le manifeste), sauf l'identifiant
  de l'organisation elle-même (`hub/organizations`).

## Ce qui n'est pas exporté

- **Secrets** : sessions, jetons et codes des liens personnels, invitations en attente, lien de
  signature chez le fournisseur. Un lien se recrée ; une invitation se renvoie.
- **Identité** : les identifiants de connexion sont chez le fournisseur d'identité (ADR 0067) ;
  l'équipe est listée dans `hub/team_members` (adresse, rôle, date de retrait).
- **Essais** (CLAUDE.md § 2.9) : événements d'essai et tout ce qui s'y rattache, pièces de la série
  DEMO, fiches de prestataires d'essai, lignes de journal des essais.
- **Exploitation de Symbola** : sauvegardes, réglages de la plateforme, événements internes,
  adresses IP des connexions, historique technique des imports, tentatives limitées, compteurs.
- **Journal d'activité** : exporté (décision D3), mais sans les lignes d'exploitation de la
  plateforme, qui n'ont pas d'organisation.

La liste table par table, avec sa raison, est dans l'index généré. Un test
(`apps/symbola/lib/export/schemas.test.ts`) refuse une table qui ne serait ni exportée ni exclue.

## Limites

- Pas de zip64 : 4 Gio et 65 535 entrées au plus. Au-delà, l'export échoue avec le motif
  « archive trop volumineuse », et l'écran invite à écrire à Symbola.
- Un fichier référencé mais absent du stockage est listé dans `missingFiles` ; l'export ne
  l'invente pas.
- Chaque module est lu sur un instantané cohérent ; les modules sont lus l'un après l'autre.

## Versions

- Un **champ facultatif ajouté** garde la v1 : l'archive reste lisible par une reprise v1.
- **Tout autre changement** (champ retiré ou renommé, type changé, champ devenu obligatoire) crée
  une **v2** ; la reprise continue de lire la v1.
- Les schémas sont tirés des colonnes des tables. Une migration qui change une table exportée fait
  échouer le test de `schemas.test.ts` : on décide alors de la version, puis on régénère
  (`pnpm --filter @symbola/app export:schemas`).
- **Exception du lot 36a** (D10, ADR 0069) : la v1 a changé sur place, avant toute archive livrée.
  Les coordonnées des clients ont quitté `events/event_clients` pour `hub/contacts` (avec
  `hub/contact_notes`) ; `event_clients`, `event_links` et `quote_signers` portent l'identifiant du
  contact (`contactId`).
