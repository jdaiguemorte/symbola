# ADR 0068 — Export complet : contrat export/v1, archive écrite en flux, format tiré des tables

- Statut : accepté (lot 35, décisions D1 à D9 validées par Julien le 15/11/2026)
- Date : 2026-11-15
- Complète : [0023](0023-rgpd-contrat-par-fiches-et-orchestration.md) (export RGPD par personne),
  [0027](0027-telechargements-servis-par-l-app.md) (téléchargements servis par l'app),
  [0035](0035-traitements-de-fond-suivis-des-imports.md) (traitements de fond).
- Exigences : HUB-13, DAT-13, RGP-11 de `docs/CAHIER_DES_CHARGES.md` ; spécification
  `docs/lots/lot-35-export.md`.

## Contexte

Le cahier des charges promet un export complet, gratuit, en libre-service : données en CSV et en
JSON, documents en archive (HUB-13). Chaque entité doit avoir un format stable et documenté
(DAT-13), et l'export doit se reprendre dans un espace vide (critère de HUB-13, lot 35b).
L'export RGPD (ADR 0023) ne couvre qu'une personne, en mémoire. Les données d'une organisation
tiennent dans une centaine de tables de six schémas (83 entités exportées) et dans des fichiers
privés qui peuvent peser plusieurs centaines de mégaoctets.

## Décision

1. **Un contrat interne `export/v1`** (`packages/contracts/src/export`). Chaque module livre ses
   entités par son `service.ts` (`export<Module>Data`, `describe<Module>Export`). Une entité
   correspond à une table, ou à une vue dérivée (`hub/team_members`, `hub/activity_journal`).
   L'orchestration vit dans `apps/symbola/lib/export`, comme pour la purge des essais et le RGPD.
2. **Une lecture générique** (`@symbola/db/export`). Chaque module déclare ses tables, avec :
   - les champs retirés (secrets) ;
   - les champs qui portent un fichier ;
   - le champ d'essai ;
   - le champ d'événement ;
   - les lignes parentes.

   La lecture se fait sous RLS, en lecture seule, sur un instantané (`repeatable read`), avec un
   filtre explicite sur l'organisation. Les essais sont exclus de proche en proche : une ligne
   `is_demo`, celle d'un événement d'essai, et celle dont le parent est exclu.
3. **Le format est tiré des colonnes** (Zod, puis `z.toJSONSchema`, sans dépendance). Les schémas
   sont rangés dans chaque archive et publiés dans `docs/schemas/export/v1`. Deux tests veillent
   sur le format :
   - l'un compare la publication au code ;
   - l'autre exige que chaque table de la base soit exportée, ou exclue avec sa raison.

   Une migration qui change une table exportée oblige donc à décider de la version du format
   (champ facultatif ajouté : v1 ; sinon : v2).
4. **Une archive écrite en flux** dans un fichier temporaire (`ZipFileWriter`, écrivain ZIP du
   projet étendu).
   - Une entrée à la fois ; la compression se fait hors du fil principal ; les formats déjà
     compressés sont stockés tels quels.
   - Pas de zip64 : 4 Gio et 65 535 entrées au plus, sinon échec « trop volumineuse ».
   - L'archive part dans le stockage privé en flux (`uploadPrivateFile`) et en revient en flux
     au téléchargement (`openPrivateObjectStream`).
5. **Un traitement de fond** (`hub.organization_exports`, RLS forcée), même patron que les imports
   (ADR 0035, ADR 0043).
   - Un seul export en préparation par organisation (index unique partiel).
   - Prise sous verrou sans attente ; battement à chaque paquet de dix fichiers ; reprise depuis
     le début après dix minutes sans battement.
   - Durée de conservation réglée par l'Admin (`organization_export_retention_days`, 7 jours),
     puis purge horaire ; la ligne reste comme trace, sans donnée personnelle.
   - Demande, mise à disposition et téléchargement vont au journal.
   - Un e-mail prévient la Propriétaire, sans l'archive ni lien direct vers elle.
6. **Propriétaire seulement** (D5) : contrôlé par l'écran, l'action, la route et le service. La
   demande est limitée en débit (`organizationExport`).

## Conséquences

- **Une table nouvelle** doit être exportée ou exclue dès sa migration (le test l'exige). Le
  format reste ainsi complet sans relecture manuelle.
- **Limites du format** :
  - les noms des champs suivent ceux du code (`camelCase`) ; renommer une colonne est un
    changement de format ;
  - l'archive n'est pas un instantané global : chaque module est cohérent, mais deux modules sont
    lus l'un après l'autre. La reprise (lot 35b) le tient pour acquis (référence absente :
    signalée, pas inventée).
- **Une archive de plus de 4 Gio** demande zip64. Ce n'est pas un besoin du pilote ; à revoir si
  un espace approche cette taille (l'écran invite alors à écrire à Symbola).
- **Le traitement tourne dans le processus de l'app.** Avec plusieurs instances, le verrou sans
  attente et l'index unique évitent les doublons ; une vraie file pourra le remplacer sans
  changer la table ni l'écran.

## Avenant du lot 36a (décision D10, ADR 0069)

Le contact unique retire des champs de `events/event_clients` (ses coordonnées passent dans
`hub/contacts`), ce qui devrait créer une v2. La v1 change pourtant sur place : la règle de version
protège des archives livrées, et aucune n'a encore quitté une machine de développement (gel des
déploiements). Les entités `hub/contacts` et `hub/contact_notes` s'ajoutent ; `events/event_links`
et `quotes/quote_signers` gagnent l'identifiant du contact. La règle de version vaut de nouveau
sans exception dès le premier export livré.
