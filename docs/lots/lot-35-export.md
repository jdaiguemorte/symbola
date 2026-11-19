# Lot 35 — Export complet réversible et fermeture d'un espace

**Statut** : spécification **validée par Julien le 15/11/2026** (« Oui, je valide » : D1 à D9
en (a)). D7 reste à faire confirmer par l'expert-comptable avant le code du 35b (question 11 de
sa fiche), et D8 par l'avocat et le DPO avant le code du 35c (question 12 de leurs fiches). D9
rejoint la décision Q35 sur les sauvegardes (erratum ci-dessous, Q37). **Le 18/11/2026, Julien a
tranché D7 et D8 en (a)** (Q37) : les lots 35b et 35c peuvent se coder.
Branche `lot-35-export` (35a), partie de `main` après le lot 34 (PR #116).

## Contexte

Le cahier des charges promet qu'une planner peut partir avec toutes ses données. C'est possible
à tout moment, gratuitement, sans rien demander à personne (règles tarifaires, HUB-13). Il
demande aussi trois choses :

- l'export se réimporte dans un espace vide, et un test automatisé le prouve ;
- chaque entité a un format stable et documenté ;
- les données d'un espace résilié sont supprimées dans les 30 jours.

| ID | Exigence | Critère | État (`docs/gap.csv`) |
| --- | --- | --- | --- |
| HUB-13 | Export complet en libre-service : données en CSV et JSON, documents en archive. | L'export se réimporte dans un espace vide. Ce test de réversibilité est automatisé. | Absent : seuls existent le carnet et l'export RGPD par personne |
| DAT-13 | Chaque entité a un format d'export stable et documenté (HUB-13). | — | Partiel : l'export RGPD sort en JSON et CSV, sans format documenté |
| RGP-11 | Réversibilité : export complet de l'organisation. Suppression du compte et de ses données dans les 30 jours suivant la résiliation, hors obligations légales. | La suppression couvre les sauvegardes à l'issue de leur cycle. | Partiel : ni export complet, ni suppression après résiliation |

## Ce qui existe aujourd'hui

- **Export RGPD par personne** (lot 6, ADR 0023).
  - Chaque module répond au contrat `privacy/v1` (`find`, `related`).
  - L'app assemble une archive ZIP : JSON et CSV par module, plus un PDF.
  - L'archive est rangée dans le stockage privé et téléchargée par un lien signé de courte
    durée. Elle est purgée à l'expiration (`hub.privacy_exports`, purge horaire).
  - Le projet écrit l'archive lui-même, en mémoire et sans dépendance
    (`packages/privacy/src/archive.ts`).
- **Export du carnet de prestataires** (lot 11) : la sélection courante, en CSV ou en PDF.
- **Imports** (lots 5 et 14).
  - Ils passent par le moteur `packages/import-engine`.
  - Leurs traitements de fond sont suivis (lot 15, ADR 0035) et peuvent être annulés.
  - Ils lisent des fichiers tiers (tableurs, fiches PDF), jamais un export de Symbola.
- **Données d'un espace** :
  - cinq schémas métier : `hub` (profil et réglages), `events` (29 tables), `budget` (7),
    `quotes` (une trentaine), `vendors` (7) ;
  - des fichiers privés : documents, pièces jointes, devis des prestataires consultés, originaux
    des factures, PDF signés, dossiers de preuve, fichiers du carnet.
- **Rien ne ferme un espace** : il n'y a ni résiliation, ni suppression d'une organisation.
- **Sauvegardes** (`docs/runbooks/restauration.md` § 1) : 7 copies quotidiennes, 4 hebdomadaires
  et 12 mensuelles, plus dix jours de copies instantanées sur la Storage Box.

## Découpage (D1)

- **35a — L'export complet** (HUB-13 pour l'export, DAT-13) : format v1 documenté, archive
  produite en arrière-plan, téléchargement, journal.
- **35b — La reprise dans un espace vide** (critère de HUB-13).
  - L'action « Reprendre un export Symbola » dans une organisation vide.
  - Le test de réversibilité automatisé : export, reprise, puis nouvel export identique au
    premier, aux identifiants près.
- **35c — La fermeture d'un espace** (RGP-11).
  - La Propriétaire ferme son organisation ; l'export reste possible 30 jours.
  - Ensuite, la suppression, et la trace qui en reste.

## Lot 35a — L'export complet

### Partie A — Ce que contient l'export (D2, D3)

- **Contenu** : tout ce que l'organisation a saisi ou reçu, module par module.
  - Chaque module livre ses données par sa porte d'entrée (ARC-01).
  - Pour cela, un nouveau contrat interne `export/v1`, à côté de `privacy/v1`, que chaque module
    implémente : `hub`, `events`, `budget`, `quotes`, `vendors`.
  - Le contrat a son ADR : ADR 0068, à écrire.
- **Exclusions**, chacune avec sa raison dans le fichier `LISEZMOI` de l'archive :
  - **secrets et jetons** (sessions, jetons et codes des liens personnels, clés) : un lien se
    recrée, et l'identité de chaque compte est tenue par le fournisseur d'identité (ADR 0052,
    ADR 0067) ;
  - **données d'essai et d'exemple** (`is_demo`, CLAUDE.md § 2.9) ;
  - **données d'exploitation de Symbola** : sauvegardes, réglages de la plateforme, événements
    internes techniques, adresses IP des connexions ;
  - **comptes de l'équipe** : ils sont listés pour information (adresse, rôle), sans identifiant
    de connexion.
- **Journal d'activité** : inclus, en lecture seule (D3).

### Partie B — Le format (DAT-13)

- **Une archive ZIP**, qui contient :
  - `manifest.json` : le format (`symbola.export/v1`), la date et l'organisation ; la liste des
    entités, avec pour chacune son nombre de lignes et son schéma ; l'empreinte SHA-256 de chaque
    fichier ;
  - `json/<module>/<entité>.json` : le format de référence, une liste d'objets ;
  - `csv/<module>/<entité>.csv` : les mêmes colonnes, en UTF-8 ; les cellules qui commencent par
    `=`, `+`, `-` ou `@` sont neutralisées (CLAUDE.md § 5) ;
  - `fichiers/…` : chaque fichier sous un nom stable (`<identifiant>-<nom>`), référencé par les
    lignes qui le portent ;
  - `LISEZMOI.txt`, en français et en anglais : contenu, exclusions, version, et comment
    reprendre l'archive.
- **Des champs stables** :
  - noms en anglais (`camelCase`) ;
  - montants en centimes entiers, avec la devise ;
  - dates en `AAAA-MM-JJ`, instants en ISO 8601 UTC ;
  - identifiants d'origine conservés, car ils relient les entités entre elles.
- **Une documentation** :
  - un schéma Zod par entité, dans `packages/contracts/src/export/` ;
  - les schémas JSON publiés dans `docs/schemas/export/v1/`, tirés des schémas Zod par
    `z.toJSONSchema` (fourni par Zod 4, sans dépendance) ;
  - une page de référence, `docs/export/format-v1.md` ;
  - un test qui refuse tout export qui ne suit pas son schéma.
- **Les versions** :
  - un champ facultatif ajouté garde la v1 ;
  - tout autre changement crée une v2 ;
  - la reprise continue de lire la v1.

### Partie C — Produire et télécharger (D4)

- **Lancer l'export** : « Exporter toutes mes données », dans Paramètres, réservé à la
  Propriétaire (D5).
  - L'export se prépare en arrière-plan, suivi comme les imports longs (ADR 0035), car les
    fichiers peuvent peser lourd.
  - L'écran montre l'avancement, et un e-mail prévient quand l'archive est prête.
- **Télécharger** : l'app sert l'archive après contrôle des droits (ADR 0027), pendant 7 jours.
- **Après 7 jours** : l'archive est effacée du stockage, comme un export RGPD. Seule reste une
  trace sans donnée personnelle : date, auteur, taille, nombre de lignes.
- **Écrire en flux** : les fichiers peuvent être volumineux. L'écrivain ZIP du projet est étendu
  pour écrire en flux, sans dépendance.
- **Journal** : la demande, la mise à disposition et le téléchargement de l'export sont journalisés.

## Lot 35b — La reprise dans un espace vide

### Partie D — Reprendre un export Symbola (D6, D7)

- **Où, par qui** : dans une organisation **vide** (aucun évènement, prestataire, devis ni
  budget réels), par sa Propriétaire.
  - L'action se trouve dans Paramètres, Import : « Reprendre un export Symbola ».
  - Elle sert à changer d'espace, ou à revenir après une fermeture.
- **Contrôles avant d'écrire** :
  - format et version connus ;
  - empreintes justes ;
  - chaque entité conforme à son schéma ;
  - fichiers contrôlés comme tout envoi : type vérifié par le contenu, antivirus.
- **Écriture** :
  - module par module, dans l'ordre de leurs dépendances, chacun par sa porte (le contrat
    `export/v1` porte aussi la reprise) ;
  - chaque entité reçoit un nouvel identifiant ; une table de correspondance avec les anciens
    sert à relier les entités ;
  - en cas d'échec, l'espace est vidé : aucune donnée partielle ne reste.
- **Bilan** :
  - ce qui a été repris, entité par entité ;
  - ce qui ne l'a pas été, et pourquoi : les liens personnels sont à recréer, les membres de
    l'équipe à inviter.
- **Pièces comptables** (D7) : à faire valider par l'expert-comptable.

### Partie E — Le test de réversibilité (HUB-13)

- **Le test** :
  1. le jeu fictif complet (`docs/recette/symbola-synthetic-users.json`) est exporté ;
  2. il est repris dans un espace vide ;
  3. il est exporté de nouveau.
- **Ce qu'il vérifie** :
  - les deux exports sont égaux, identifiants et dates de création mis à part ;
  - chaque fichier garde la même empreinte.
- **Où il tourne** :
  - en intégration (Vitest, base et stockage réels) ;
  - en parcours Playwright : exporter, télécharger, reprendre, en taille ordinateur et en 375 px.

## Lot 35c — La fermeture d'un espace

### Partie F — Fermer l'organisation (RGP-11 ; D8, D9)

- **« Fermer l'organisation »**, par la Propriétaire. L'écran :
  - rappelle l'export ;
  - nomme l'organisation dans sa confirmation (UX-07) ;
  - donne la date de suppression.
- **Pendant les 30 jours** :
  - l'espace ne sert plus qu'à exporter et à rouvrir ;
  - les liens des tiers se ferment ;
  - aucun envoi ne part, ni rappel ni facture programmée.
- **Préavis**, comme la purge RGPD (ADR 0056) : un e-mail à la fermeture, un autre sept jours
  avant la suppression.
- **Au 30e jour, la suppression** :
  - chaque module efface les données de l'organisation par sa porte, fichiers compris ;
  - seul reste ce que garde la décision D8 ;
  - une trace sans donnée personnelle (organisation, dates de fermeture et de suppression),
    visible de l'Exploitation.
- **Sauvegardes** (D9) :
  - les données supprimées disparaissent des sauvegardes à la fin de leur cycle (NFR-13) ;
  - le délai maximal est écrit dans la fiche de conformité et dans les conditions ;
  - après une restauration, la trace des suppressions sert à effacer de nouveau les
    organisations déjà supprimées ; le runbook de restauration ajoute cette étape.

## Décisions à prendre

- **D1 — Découpage.**
  - (a) Trois parties, trois PR : 35a export, 35b reprise et test, 35c fermeture.
  - (b) Deux parties : export et reprise ensemble, fermeture à part.

  **Recommandation : (a).** Chaque partie se livre et se recette seule ; 35b suit 35a.
- **D2 — Périmètre de l'export.**
  - (a) Toutes les données métier de l'organisation, sauf secrets, essais et données
    d'exploitation (partie A).
  - (b) Les données de travail seulement (évènements, contacts, prestataires, budget, devis),
    sans journal ni réglages.

  **Recommandation : (a).** Le critère demande un export « complet », et la reprise a besoin
  des réglages.
- **D3 — Journal d'activité dans l'export.**
  - (a) Inclus, en lecture seule : il fait partie des données de l'organisation.
  - (b) Exclu.

  **Recommandation : (a).** Il n'est pas repris : la reprise ouvre un nouveau journal.
- **D4 — Mode de production.**
  - (a) En arrière-plan ; archive gardée 7 jours ; e-mail quand elle est prête.
  - (b) Téléchargement immédiat, l'archive étant produite pendant la requête.

  **Recommandation : (a).** Les fichiers peuvent peser plusieurs centaines de mégaoctets, et une
  requête aussi longue échouerait.
- **D5 — Qui exporte.**
  - (a) La Propriétaire seulement.
  - (b) La Propriétaire et les Planners.

  **Recommandation : (a).** L'archive contient tout, finances comprises.
- **D6 — Où se fait la reprise.**
  - (a) Dans une organisation vide seulement.
  - (b) Aussi en fusion, dans un espace qui a déjà des données.

  **Recommandation : (a).** La fusion crée des doublons, et le critère ne la demande pas.
- **D7 — Factures, avoirs et chaîne des pièces à la reprise.** Point comptable : **à faire
  valider par l'expert-comptable** avant le code du 35b.
  - (a) Repris comme pièces d'archive, en lecture seule, avec leur numéro et leur original.
    Pour la même entreprise (même SIREN), la nouvelle série repart après le dernier numéro
    repris ; la chaîne reprise est vérifiée, et la nouvelle s'y raccroche.
  - (b) Repris comme fichiers seulement (les originaux PDF), sans ligne comptable ; la
    numérotation repart à 1 dans le nouvel espace.

  **Recommandation : (a)**, sous réserve de l'avis de l'expert-comptable : une entreprise qui
  change d'espace garde une numérotation continue.
- **D8 — Ce qui survit à la suppression.** Point juridique : **à faire valider par l'avocat et
  le DPO**.
  - (a) Rien. La planner est responsable de ses obligations comptables et garde son export ;
    Symbola, sous-traitant, efface tout au 30e jour.
  - (b) Les pièces comptables (factures, avoirs, chaîne) et les preuves de signature. Symbola les
    garde sous scellé jusqu'à la fin de leur durée légale, puis les efface.

  **Recommandation : (a)**, sous réserve de leur avis. C'est la règle d'un sous-traitant : rendre
  ou effacer. L'export reste proposé jusqu'au dernier jour.
- **D9 — Sauvegardes après une suppression.** NFR-13 fixe la rétention : 7 copies quotidiennes,
  4 hebdomadaires et 12 mensuelles. Il ajoute que le serveur ne peut pas effacer ses propres
  sauvegardes. Les données supprimées ne peuvent donc pas en être retirées avant la fin de leur
  cycle.
  - (a) Garder NFR-13. Le délai maximal est écrit dans la fiche de conformité et dans le contrat
    de sous-traitance : jusqu'à 12 mois après la suppression. Une restauration de sauvegarde
    supprime de nouveau, juste après, les organisations déjà supprimées.
  - (b) Ramener la rétention mensuelle à 3 mois ; le délai maximal devient alors environ trois
    mois. C'est un écart avec NFR-13 : il faudrait la décision de Julien et un ADR.

  **Recommandation : (a)**, conforme au cahier des charges. La durée de 12 mois est à faire
  confirmer par le DPO.

  **Erratum (15/11/2026)** : la DPO avait déjà répondu le 13/11 (fiche, réponse 2 ; Q35). Elle
  demande une rotation de 35 jours au plus, et le rejeu des effacements après toute restauration.
  D9 (a) contredit cette réponse. La rétention se décide donc dans Q35 (Q37 : réduire à 35 jours
  avec un ADR, ou garder 12 mois en le justifiant). Le rejeu après une restauration reste prévu
  au 35c.

## Migrations (prévision, schéma `hub` seulement)

- **35a** : la table `hub.organization_exports`, sous RLS, avec son journal. Elle porte l'état,
  la clé de l'archive, la taille, le nombre de lignes par entité, l'auteur, et les dates de
  demande, de mise à disposition et d'expiration.
- **35b** : le suivi de la reprise, sous RLS : l'état, le bilan, et la table de correspondance
  des identifiants, effacée à la fin.
- **35c** :
  - `hub.organizations` reçoit la date de fermeture et la date de suppression prévue ;
  - `hub.organization_closures` garde la trace, sans donnée personnelle, après la suppression.

Chaque migration a son script d'annulation et son test. Gel des déploiements : elles partent avec
le déploiement d'ensemble.

## Fichiers touchés (prévision)

- `packages/contracts/src/export/` : le contrat `export/v1` et les schémas Zod des entités.
- `packages/privacy/src/archive.ts` : écriture et lecture d'une archive en flux.
- `apps/symbola/modules/<module>/export.ts` : chaque module exporte et reprend ses entités, par
  son `service.ts`.
- `apps/symbola/lib/export/` : l'orchestration de l'export, de la reprise et de la fermeture,
  les traitements de fond, la purge.
- `apps/symbola/app/parametres/` : les écrans d'export, de reprise et de fermeture, et les
  e-mails.
- `packages/db` : les migrations du schéma `hub`, leurs annulations et leurs tests.
- Documentation :
  - `docs/adr/0068-…` : le contrat `export/v1` et le format ;
  - `docs/schemas/export/v1/` et `docs/export/format-v1.md` : le format ;
  - `docs/conformite/` : le délai de suppression et les sauvegardes ;
  - `docs/runbooks/restauration.md` : effacer de nouveau, après une restauration, les
    organisations supprimées.
- `packages/i18n` : les textes en français et en anglais, et l'aide des écrans.

## Tests

- **Critères** : chaque critère devient un `it`, sous l'identifiant de son exigence.
- **Format** :
  - chaque entité exportée suit son schéma ;
  - un test vérifie que les schémas publiés sont à jour.
- **Réversibilité** : le jeu fictif est exporté, repris, puis réexporté à l'identique (partie E).
- **Isolation et abus** :
  - un export ne contient rien d'une autre organisation ;
  - une Planner ne peut ni lancer ni télécharger un export ;
  - une archive modifiée (empreinte fausse), d'une version inconnue, ou contenant un fichier
    refusé n'écrit rien ;
  - la reprise est refusée dans un espace qui n'est pas vide ;
  - une archive expirée ne se télécharge plus.
- **Horloge simulée** : expiration de l'archive (veille et jour même), préavis, suppression au
  30e jour.
- **Restauration** : une organisation supprimée puis ramenée par une restauration est effacée de
  nouveau.
- **Playwright** : exporter, télécharger, reprendre, fermer ; en taille ordinateur et en 375 px,
  avec axe-core.
- **Rejeu** : aucun scénario du § 17 ne joue l'export. Le rejeu exporte donc l'atelier de Camille
  (ORG-01), puis le reprend dans un espace vide. Les résultats vont dans `docs/recette/`.

## Hors périmètre

- La résiliation commerciale (abonnement, facture de clôture) : elle relève du lot du paiement.
- La reprise en fusion dans un espace existant (D6 b).
- L'export programmé, ou automatique vers un stockage externe.
- La portabilité vers un logiciel tiers : le format est documenté, mais aucun convertisseur n'est
  fourni.

## Ambiguïtés relevées

- **« Hors obligations légales »** (RGP-11) ne dit pas qui garde les pièces comptables quand
  l'espace ferme : la planner (responsable du traitement) ou Symbola (sous-traitant). D8 pose la
  question.
- **« La suppression couvre les sauvegardes à l'issue de leur cycle »** (RGP-11) : NFR-13 fixe
  ce cycle à 12 mois pour les copies mensuelles. D9 propose de garder ce délai et de l'écrire.
- **« Données en CSV et JSON »** : le JSON est la référence, car il porte les liens entre
  entités ; le CSV contient la même chose à plat, pour un tableur.

## Bilan du lot 35a (15/11/2026)

### Fait

- **Contrat interne `export/v1`** (`packages/contracts/src/export`). Chaque module livre ses
  entités par son `service.ts` : `hub`, `events`, `budget`, `quotes`, `vendors`. Les tables non
  exportées sont listées avec leur raison.
- **Lecture générique** (`@symbola/db/export`) :
  - sous RLS, en lecture seule, sur un instantané, avec un filtre explicite sur l'organisation ;
  - essais exclus de proche en proche (ligne d'essai, ligne d'un événement d'essai, ligne dont
    le parent est exclu) ;
  - fichiers remplacés par leur chemin dans l'archive.
- **Format `symbola.export/v1`** (DAT-13) : 83 entités, chacune avec son schéma JSON tiré des
  colonnes de sa table, publié dans `docs/schemas/export/v1` avec l'index des exclusions.
  Référence : `docs/export/format-v1.md`. ADR 0068.
- **Archive** : écrite en flux (écrivain ZIP du projet étendu, sans dépendance), envoyée et
  téléchargée en flux. Elle contient le manifeste aux empreintes SHA-256, JSON, CSV, schémas,
  fichiers et `LISEZMOI.txt` (FR, EN).
- **Écran « Exporter mes données »** (Paramètres, groupe Prestataires et données), Propriétaire
  seulement (D5) :
  - préparation en arrière-plan avec son avancement, un seul export à la fois, reprise d'une
    préparation interrompue (D4) ;
  - e-mail quand l'archive est prête ;
  - téléchargement servi par l'app (ADR 0027) pendant la durée réglée par l'Admin (7 jours),
    puis purge horaire ; la trace reste.
  - Demande, mise à disposition et téléchargement vont au journal ; la demande est limitée en
    débit.
- **Migration 0134** (schéma `hub`), avec son annulation et son test. Elle passe sans arrêter
  l'app.

### Écarts et points ouverts

- **Pièces jointes et fichiers absents du stockage** : listés dans `missingFiles` et signalés à
  l'écran, jamais inventés.
- **Taille** : pas de zip64, donc 4 Gio et 65 535 entrées au plus ; au-delà, l'export échoue et
  invite à écrire à Symbola (ADR 0068).
- **Instantané** : chaque module est lu sur son propre instantané ; deux modules sont lus l'un
  après l'autre. La reprise (35b) signalera une référence absente.
- **Avant le code du 35b** : D7 (factures, avoirs et numérotation à la reprise) attend l'avis de
  l'expert-comptable.
- **`LISEZMOI.txt`** décrit déjà la reprise (« Reprendre un export Symbola »), livrée au 35b. Le
  gel des déploiements fait partir les deux ensemble ; si le 35a devait partir seul, retirer
  cette phrase.

### Vérifications (en local)

- Lint, typecheck, frontières de modules : verts. Registre RGPD à jour.
- Unitaires : app 499, dont le format et la couverture des tables (`schemas.test.ts`) et l'e-mail ;
  `@symbola/privacy` 42, dont l'écrivain en flux.
- Intégration :
  - app 625, dont 6 pour l'export complet : contenu, exclusions, rôle, isolation, unicité,
    expiration à l'horloge simulée, reprise ;
  - `@symbola/db` 167, annulation de 0134 comprise ;
  - `@symbola/auth` 21.
- Parcours e2e, base rechargée : 281 réussis, 3 ignorés (les mêmes qu'avant). Nouveau parcours
  `hub-13-export-complet`, en taille ordinateur et en 375 px, avec axe-core.
- Semgrep (`p/default`) : rien sur le code du lot (six signalements anciens de
  `quotes/service.ts`, hors du lot). Gitleaks : aucune fuite dans le diff du lot.
- Rejeu : export de l'atelier de Camille (ORG-01) sur le jeu fictif, sans blocage
  (`docs/recette/HUB-13.md`).

## Bilan du lot 35b (19/11/2026)

### Fait

- **Reprise d'un export Symbola dans un espace vide** (HUB-13 ; D6, D7 ; ADR 0097) : Paramètres,
  « Reprendre un export » (`/parametres/reprise`), Propriétaire seulement. L'archive est déposée
  par une route dédiée aux fichiers, rangée dans le stockage privé, reprise en arrière-plan, puis
  effacée ; l'écran montre l'avancement et le bilan, entité par entité.
- **Contrôles avant d'écrire** : lecteur ZIP en flux sans dépendance (`@symbola/privacy`, CRC et
  tailles), format et version, empreintes SHA-256, schéma de chaque entité, espace vide, même SIREN,
  fichiers contrôlés comme tout envoi (type, antivirus).
- **Écriture** générique (`@symbola/db/import`), par la porte de chaque module, en une seule
  transaction ; nouveaux identifiants et table de correspondance commune (en mémoire : rien à
  effacer, écart assumé dans l'ADR) ; dates et auteurs gardés.
- **Pièces comptables (D7)** : reprises inaltérables, numérotation continuée, chaîne vérifiée puis
  prolongée par une ancre (`quotes.ledger_anchors`) ; l'ancre s'exporte (entité ajoutée à la v1).
- **Test de réversibilité** automatisé : jeu fictif (ORG-01, complété de pièces) exporté, repris,
  réexporté : identique aux identifiants près, chaque fichier garde son empreinte.
- **Migrations** 0184 (hub) et 0185 (quotes), annulables, sans arrêt de l'app ; test d'annulation.

### Écarts et points ouverts

- **Autre SIREN** : refusé en attendant une décision (Q40).
- **Table de correspondance** en mémoire plutôt qu'en base (ADR 0097).
- **Taille** : l'archive déposée est lue en mémoire par la route (512 Mio au plus).
- **Référence de signature** : marquée `#<nouvel identifiant>` à la reprise (unicité).
