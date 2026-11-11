# Lot 23 — Journal d'audit commun, factures et encaissements inaltérables

**Statut** : spécification validée par Julien le 11/11/2026 (« Oui je valide tout ») : D1 à D4,
D6 et D7 en (a). Il confirme qu'aucune facture ni aucun encaissement réel n'existe en production.
D5 (adresse IP) est rouverte à sa question. Branche `lot-23-journal-audit`. Le lot change le
schéma de données de tous les modules et un parcours P0 (l'encaissement).

## Contexte

Phase 0 du plan (`docs/GAP_REPORT.md` § 7) : mettre les données à l'abri. Après la sauvegarde
hors serveur (lot 22), il faut pouvoir prouver **qui a fait quoi**, et qu'**une facture ou un
encaissement n'a pas été modifié après coup**.

**Exigences** : SEC-19, ARC-16, FAC-14, JUR-05, JUR-06, DOC-08, DAT-06, SEC-09 (P0) ; HUB-16
(P1).

**Constat du 11/11/2026** :

- **Journal** : `hub.audit_log` ne trace que quatre actions de l'Admin (création d'organisation,
  relance d'invitation, réglages de la plateforme, réinitialisation de la double
  authentification). Le rôle applicatif peut le modifier et l'effacer : la migration
  `0010_grant_hub03_tables.sql` lui accorde `UPDATE` et `DELETE`. Rien n'est tracé pour les
  connexions, les exports, les partages, les émissions, les encaissements ni les suppressions.
- **Factures et avoirs** : un déclencheur refuse déjà toute modification et toute suppression,
  sauf pour les documents d'essai (`0042_grant_factures.sql`). Mais rien ne les chaîne, et le PDF
  est **redessiné à chaque téléchargement** à partir des données figées
  (`app/devis/factures/[invoiceId]/pdf/route.ts`) : l'original émis n'existe pas.
- **Encaissements** : un paiement est une modification de l'échéance
  (`payment_schedule_items.paid_on`, `payment_method_id`). « Marquer non payée » efface la saisie
  sans laisser de trace (`markScheduleItemUnpaid`, `modules/quotes/service.ts`).
- **Documents signés** : le PDF signé et le dossier de preuve sont conservés en stockage privé,
  sans empreinte.
- **Auteur et date de modification** : sur 74 tables, 49 ont une date de création, 20 une date
  de modification et une quinzaine un auteur.
- **Accès d'exploitation** : la sauvegarde, la restauration et les commandes `psql` des runbooks
  lisent toute la base sans laisser de trace pour l'organisation. Décision Q31 : les tracer.

**Ce que doit garantir le lot** :

1. Chaque geste sensible laisse une ligne dans un journal commun. Aucun rôle de l'application ne
   peut modifier ni effacer cette ligne.
2. La titulaire lit ce journal : qui, quoi, quand, sur quel objet.
3. Chaque facture, chaque avoir et chaque encaissement est enchaîné au précédent par une
   empreinte. Une modification directe en base est détectée.
4. La facture émise est conservée comme fichier, telle qu'émise, avec son empreinte.
5. Chaque ligne de chaque table porte sa date de création, sa date de modification et son
   auteur.

## Découpage : deux lots, deux pull requests (décision D1)

- **23a — Journal d'audit commun** : parties A à F (SEC-19, ARC-16, HUB-16, SEC-09, DAT-06).
- **23b — Factures et encaissements inaltérables** : parties G à J (FAC-14, JUR-05, JUR-06,
  DOC-08). Le 23b écrit dans le journal du 23a.

Chacun tient en une semaine environ.

---

## Lot 23a — Journal d'audit commun

### Partie A — Une table, en ajout seul (ARC-16, SEC-19)

Nouvelle table `core.audit_entries`, à côté de `core.domain_events` : le journal est une brique
commune de `packages/db`, comme les événements internes.

| Colonne | Contenu |
| --- | --- |
| `id`, `occurred_at` | Identifiant, date (UTC) |
| `organization_id` | Organisation concernée. Vide pour un geste de plateforme (connexion de l'Admin, accès d'exploitation) |
| `actor_kind`, `actor_id` | `member` (titulaire, collaborateur, marié), `admin`, `operator` (exploitation), `system` (tâche de fond) ; identifiant du compte, jamais son nom ni son e-mail |
| `action` | `<module>.<objet>.<action>` au passé, comme les événements internes : `quotes.invoice.issued` |
| `category` | `connexion`, `droits`, `export`, `partage`, `emission`, `encaissement`, `suppression`, `exploitation` : les familles de SEC-19, pour filtrer |
| `object_type`, `object_id` | Objet visé |
| `details` | Identifiants, numéros de pièce, montants, codes. Aucune donnée personnelle (SEC-20) |
| `reason` | Motif, obligatoire pour un accès d'exploitation |
| `is_demo` | Ligne d'un essai guidé, purgée avec lui |

Garanties :

- le rôle applicatif n'a que `SELECT` et `INSERT` ;
- un déclencheur refuse `UPDATE` et `DELETE` à tout rôle, propriétaire compris. Seule exception :
  une ligne d'essai (`is_demo`), purgée avec l'essai, comme les factures fictives ;
- la sécurité au niveau des lignes (RLS) est forcée. Une organisation ne lit que ses lignes, plus
  les accès d'exploitation de la plateforme ;
- l'écriture se fait **dans la transaction du geste** : si le geste échoue, la ligne disparaît
  avec lui ; si la ligne échoue, le geste est annulé.

Les lignes de `hub.audit_log` sont recopiées dans la nouvelle table, puis l'ancienne table est
supprimée. La migration est réversible.

### Partie B — Savoir qui agit (SEC-19, DAT-06)

Aujourd'hui, `withOrganization` (`packages/db`) ne fixe que l'organisation. Il fixera aussi
l'auteur (`app.actor_id`, `app.actor_kind`). Les déclencheurs de la partie F et le journal le
liront.

- **Dans l'app** : l'auteur se déduit de la session de la requête en cours (cookie lu par Next),
  une seule fois par requête. Les dépôts (`repository.ts`) ne changent pas de signature.
- **Hors requête** (tâches de fond, scripts) : l'auteur est `system`, ou celui qu'on déclare
  explicitement (`withActor`).
- Un test vérifie qu'une modification faite depuis une action de la planner porte bien son
  identifiant.

### Partie C — Ce qui est journalisé (SEC-19)

Le catalogue des actions vit dans `packages/contracts`, avec un libellé FR/EN pour chacune.

| Famille | Actions |
| --- | --- |
| Connexions | connexion réussie (avec la méthode : code, appareil de confiance), échec sur un compte existant, compte verrouillé, déconnexion, mot de passe réinitialisé, double authentification configurée, appareils de confiance oubliés (adresse IP : décision D5) |
| Droits | organisation créée, invitation envoyée, relancée ou acceptée, module activé ou retiré, double authentification réinitialisée par l'Admin |
| Exports | export RGPD créé et téléchargé, export du carnet de prestataires, export e-reporting, archive comptable (23b) |
| Partages | espace du marié ouvert ou révoqué, devis envoyé, demande de signature envoyée |
| Émissions | facture émise, avoir émis (23b) |
| Encaissements | encaissement saisi, encaissement annulé par écriture inverse (23b) |
| Suppressions | **toute** suppression d'une ligne d'une table métier, effacement et purge RGPD |

Pour les **suppressions**, un déclencheur générique est posé sur chaque table métier. Il écrit
`<schéma>.<table>.deleted` avec l'identifiant de la ligne. Ainsi, aucune suppression n'échappe au
journal, même si le code oublie de l'écrire.

- Une suppression en cascade ne produit qu'une ligne, celle de l'objet supprimé.
- Une purge en masse (essai guidé, RGPD) écrit une seule ligne de synthèse.
- Un test vérifie que chaque table métier porte ce déclencheur, ou figure dans une liste
  d'exceptions motivées.

Les **tentatives refusées** (accès à l'objet d'une autre organisation, SC-S1) relèvent du
lot 24, qui s'appuiera sur ce journal.

### Partie D — Accès d'exploitation (SEC-09, décision Q31, décision D3)

- **Actions de l'Admin dans la console** : elles arrivent dans le journal de l'organisation
  visée, avec pour auteur « Équipe Symbola (assistance) ». L'Admin n'accède toujours à aucune
  donnée métier (ADR 0029).
- **Accès humains à la base** : un script `infra/server/acces-base.sh <env> --motif "…"` ouvre
  `psql`. Il écrit d'abord une ligne `ops.database.opened` (avec le motif), puis une ligne
  `ops.database.closed` à la fermeture. `restore.sh` et l'exercice de restauration écrivent
  `ops.backup.restored`.
- Ces lignes sont des gestes de plateforme : elles apparaissent dans le journal de **chaque**
  organisation, sous la mention « Accès d'exploitation » et avec le motif.
- Les runbooks passent par ce script. **Limite assumée** : `root` sur le VPS peut toujours
  contourner le script. Le runbook le dit, et l'ADR l'écrit.

C'est **toi qui lances ces scripts sur le VPS**. Je les prépare, je les vérifie avec ShellCheck
et j'écris le runbook.

### Partie E — Écran « Journal d'activité » (HUB-16, décision D4)

`Paramètres › Journal d'activité` (`/parametres/journal`), lisible par la titulaire. Un
collaborateur y lit un message qui lui explique qu'il n'y a pas accès, comme pour le module RGPD.

- Quatre colonnes : **Quand** (heure de Paris), **Qui**, **Quoi**, **Sur quoi**.
  - **Qui** : nom du membre, « Équipe Symbola (assistance) », « Accès d'exploitation » ou
    « Symbola (automatique) ».
  - **Sur quoi** : un lien vers l'objet s'il existe encore. Le nom est relu dans les données
    vivantes, le journal n'en stocke aucun.
- Filtres : période, famille d'action, personne. 50 lignes, puis « Voir plus ».
- En 375 px, une carte par ligne. Contrôle axe-core. Textes FR/EN, aide de l'écran et article du
  centre d'aide.

### Partie F — Date de modification et auteur sur chaque ligne (DAT-06)

- Chaque table reçoit `created_at`, `created_by`, `updated_at` et `updated_by` quand elles
  manquent. `created_by` et `updated_by` contiennent l'identifiant du compte, sans clé étrangère
  entre schémas (avenant de l'ADR 0012).
- Une fonction commune `core.stamp_row()` les remplit, déclenchée avant chaque insertion et
  chaque modification. Elle lit l'auteur de la partie B, et elle empêche de réécrire
  `created_*`.
- Les tables en ajout seul (journaux, historiques, factures, avoirs, écritures du 23b) gardent
  seulement `created_at` et `created_by`. Une ligne qui ne change jamais n'a pas besoin de date de
  modification.
- Pour les lignes existantes, l'auteur reste vide (inconnu). Une tâche de fond laisse aussi
  l'auteur vide : vide veut dire « Symbola ».
- Un test parcourt **toutes** les tables de la base. Chacune doit avoir les quatre colonnes et le
  déclencheur, ou figurer dans la liste des tables en ajout seul.
- Chaque module reçoit sa migration et ne touche que son propre schéma (DAT-09, ADR 0036).

---

## Lot 23b — Factures et encaissements inaltérables

### Partie G — La facture émise conservée comme fichier (DOC-08)

À l'émission d'une facture ou d'un avoir, tout se passe **dans une même transaction** :

1. attribution du numéro, sans trou (comme aujourd'hui) ;
2. copie figée des données (comme aujourd'hui) ;
3. rendu du PDF ;
4. calcul de son empreinte SHA-256 (bibliothèque standard de Node) ;
5. dépôt dans le stockage privé ;
6. enregistrement de la facture, de son original, de l'écriture chaînée (partie I) et de la
   ligne du journal.

Si le stockage ne répond pas, la facture n'est pas émise et le numéro n'est pas consommé. Un
message clair invite à réessayer.

- Nouvelle table `quotes.original_documents`, en ajout seul : type (facture, avoir, devis signé,
  dossier de preuve), document, clé de stockage, empreinte, taille, date.
- **Téléchargement** : l'app sert le fichier conservé. Elle recalcule d'abord son empreinte : si
  elle diffère de celle de l'émission, le fichier n'est pas servi, une ligne
  `quotes.original.altered` va au journal, et rien n'est reconstruit à la place.
- **Documents signés** : à leur réception (webhook de signature), leur empreinte et celle du
  dossier de preuve sont enregistrées.
- **Poids** : un test vérifie qu'une facture d'une page, avec logo, pèse moins de 150 Ko.

### Partie H — Encaissements en écritures, corrigés par écriture inverse (FAC-14, JUR-05, décision D2)

- Nouvelle table `quotes.payment_entries`, en ajout seul. Chaque ligne fige : l'échéance, le
  type (`received` ou `reversal`), le montant en centimes, la date de paiement, le mode et une
  copie de son libellé, l'auteur et la date de saisie.
- **Saisir un encaissement** crée une écriture `received`.
- **« Annuler l'encaissement »** remplace « Marquer non payée ». Le geste demande un **motif
  obligatoire** et crée une écriture `reversal` liée à la première. Rien n'est effacé.
- La fiche du devis montre l'historique, par exemple : « Encaissé le 12/03 par virement, annulé
  le 14/03 : erreur de saisie ».
- Les colonnes `paid_on` et `payment_method_id` de l'échéance restent comme copie de lecture
  rapide, mise à jour dans la même transaction. Les écrans existants ne changent donc pas. Un
  test vérifie que la copie concorde toujours avec les écritures.

C'est ce que la fiche de l'expert-comptable annonce déjà (question 5) : « corrigé par une écriture
inverse ».

### Partie I — La chaîne d'empreintes (FAC-14)

- Nouvelle table `quotes.ledger_entries`, une chaîne par organisation. Elle contient factures,
  avoirs, encaissements et écritures inverses, dans l'ordre de leur enregistrement, numérotés de
  façon continue.
- Le **calcul se fait en base**, par un déclencheur avant insertion. Il verrouille la chaîne de
  l'organisation, prend la dernière empreinte et calcule
  `empreinte = SHA-256(empreinte précédente | rang | type | contenu de la pièce)` avec la fonction
  `sha256` de PostgreSQL 16. L'application ne peut ni choisir le rang ni fournir une fausse
  empreinte.
- **Contenu de la pièce** : numéro, dates, montants, régime de TVA, empreinte des copies figées
  (vendeur, acheteur, lignes, totaux) et empreinte du fichier original.
- Les documents d'essai (`is_demo`) restent hors de la chaîne : ils sont purgés.
- **Vérification** : la fonction `quotes.verify_ledger(organisation)` recalcule la chaîne. Elle
  compare aussi chaque écriture à la pièce actuelle en base, et signale la première anomalie :
  maillon rompu, pièce modifiée, pièce supprimée, ou pièce sans écriture.
- **Contrôle quotidien** : une tâche de fond vérifie toutes les organisations. En cas d'anomalie,
  elle écrit dans le journal et t'alerte par la surveillance existante (Uptime Kuma, ntfy). L'app
  n'est pas pour autant déclarée en panne : `/health` répond 503 dès qu'un contrôle échoue, donc
  il faut une sonde à part.

### Partie J — Archive comptable (JUR-06)

`Devis › Paramètres › Archive comptable`, réservé à la titulaire :

- par année : un CSV des écritures (rang, date, type, numéro, montant, mode, empreinte,
  empreinte précédente), un bouton « Vérifier l'intégrité » avec son résultat, et la liste des
  originaux, chacun téléchargeable ;
- chaque export est journalisé ;
- la purge (ADR 0024) ne touche jamais aux écritures ni aux originaux avant dix ans. Un test le
  vérifie avec une horloge simulée, la veille et le jour même.

---

## Limites assumées (écrites dans l'ADR)

- Une personne qui détient **à la fois** les droits complets sur la base et sur le stockage
  pourrait réécrire toute une chaîne de façon cohérente. Quatre parades :
  - le rôle de l'application ne le peut pas (droits et déclencheurs) ;
  - le rôle propriétaire ne sert qu'aux migrations ;
  - les sauvegardes chiffrées et leurs copies instantanées chez Hetzner (lot 22) gardent les
    états passés, hors d'atteinte du VPS ;
  - le contrôle est quotidien.
- Le **contenu de l'attestation** (JUR-05) et l'éventuelle obligation de **clôtures
  périodiques** (journalière, mensuelle, annuelle) attendent la réponse de l'expert-comptable
  (fiche, question 5). Je ne les tranche pas. J'ajoute la question des clôtures à la fiche.
- Le format d'archivage (PDF/A ou non) attend aussi sa réponse (fiche, question 6). Le lot
  conserve le PDF tel qu'il est émis.

## Tests (un `describe` par exigence, un `it` par critère)

- **ARC-16, SEC-19** :
  - `UPDATE` et `DELETE` sur le journal échouent, pour le rôle applicatif comme pour le rôle
    propriétaire ;
  - chaque action du catalogue écrit une ligne, avec le bon auteur et le bon objet ;
  - aucun e-mail ni téléphone dans `details` ni dans `reason` ;
  - les lignes d'essai sont purgées avec l'essai.
- **Isolation** (`packages/testing`), pour chaque nouvelle table : A ne lit ni n'écrit chez B ;
  l'Admin ne lit aucune ligne métier.
- **HUB-16** : la titulaire voit son journal, un collaborateur est refusé, les filtres
  fonctionnent. Playwright en taille ordinateur et en 375 px, avec axe-core.
- **SEC-09** :
  - une action de l'Admin apparaît dans le journal de l'organisation visée ;
  - un accès d'exploitation sans motif est refusé ;
  - un accès d'exploitation apparaît dans le journal de chaque organisation ;
  - les scripts passent ShellCheck.
- **DAT-06** :
  - toutes les tables ont les quatre colonnes et le déclencheur, ou figurent dans la liste en
    ajout seul ;
  - une modification par la planner porte son identifiant ;
  - `created_*` ne se réécrit pas.
- **DOC-08** :
  - l'empreinte du fichier relu est celle de l'émission ;
  - un fichier altéré n'est pas servi ;
  - une facture d'une page pèse moins de 150 Ko ;
  - si le stockage est indisponible, aucune facture n'est émise et aucun numéro n'est perdu
    (FAC-06).
- **FAC-14** : chacun de ces cas est détecté par `verify_ledger` :
  - une facture modifiée en base, déclencheur désactivé par le rôle propriétaire ;
  - une écriture modifiée ;
  - une pièce supprimée ;
  - une pièce sans écriture.

  Deux émissions simultanées donnent une chaîne continue.
- **JUR-05** :
  - une écriture d'encaissement ne se modifie pas ;
  - une annulation sans motif est refusée ;
  - l'historique montre la saisie et son annulation.
- **JUR-06** : l'export d'une année contient toutes ses écritures ; la purge épargne les
  écritures et les originaux pendant dix ans.

## Migrations (toutes réversibles, une par schéma)

| Lot | Migrations |
| --- | --- |
| 23a | `core` : journal, fonctions communes (`stamp_row`, suppression journalisée, accès d'exploitation). Puis une migration par module (`hub`, `events`, `budget`, `quotes`, `vendors`) : colonnes et déclencheurs de DAT-06 et des suppressions. Celle de `hub` recopie `audit_log` dans le journal commun, puis supprime l'ancienne table |
| 23b | `quotes` : originaux, écritures d'encaissement, chaîne, vérification, reprise des données existantes (décision D6) |

**Exception** : les déclencheurs d'un module écrivent dans `core.audit_entries`. Le journal est
une brique commune, comme `domain_events`. L'ADR le dit.

## Documentation

- **ADR 0060** : journal d'audit commun, auteur de chaque ligne, accès d'exploitation.
- **ADR 0061** : originaux conservés, encaissements en écritures, chaîne d'empreintes, limites.
- **Runbooks** : accès à la base par le script ; restauration (ligne au journal).
- **Fiche de l'expert-comptable** : complément à la question 5 (clôtures périodiques, contenu de
  l'attestation).
- **Fiche du DPO** : nouvelle question sur la durée de conservation du journal (connexions,
  autres gestes).
- **`privacy.registry.yaml`** : les identifiants d'auteur (`actor_id`, `created_by`,
  `updated_by`). L'export RGPD d'une personne inclut ses lignes du journal.
- **Écrans** : aide de l'écran, article du centre d'aide, captures.
- **`docs/gap.csv`** : lignes du lot mises à jour.

## Hors périmètre

- La **durée de conservation** du journal et sa purge : à fixer avec le DPO, puis à mettre en
  œuvre au lot 34 (purges automatiques, Q10). D'ici là, rien n'est purgé, sauf les lignes
  d'essai.
- Les tentatives d'accès refusées et leur journalisation (SC-S1) : lot 24.
- Un fichier ZIP de l'archive : il demanderait une dépendance. Il viendra avec les exports
  comptables (FAC-11, P1) si tu le souhaites.
- L'écran d'équipe (changer un rôle, retirer un membre) n'existe pas encore. Le catalogue
  l'accueillera.
- Les accès par lien personnel (lot 26) : `actor_kind` recevra alors `link`.

## Rejeu

Le chargeur du jeu fictif arrive au lot 24. Je rejoue donc en local, à la main, avec les personnes
du jeu (`docs/recette/symbola-synthetic-users.json`) :

- **SC-02**, étapes 7 et 8 : facture d'acompte et encaissement, puis annulation et nouvelle
  saisie ;
- **SC-09**, étape 5 : numérotation continue, chaîne vérifiée, export de l'année.

Compte rendu dans `docs/recette/SC-02.md` et `docs/recette/SC-09.md`.

## Décisions de Julien (11/11/2026 : D1 à D4, D6, D7 en a ; D5 en attente)

- **D1 — Découpage.** (a) Deux lots, 23a puis 23b, avec deux pull requests. (b) Un seul lot.
  **Recommandation : (a).** Chaque PR reste relisible, et le journal est en place avant les
  pièces qui l'emploient.
- **D2 — Correction d'un encaissement.** (a) « Annuler l'encaissement » avec un motif obligatoire,
  par une écriture inverse ; rien ne s'efface. (b) Garder « Marquer non payée » tel quel, avec une
  simple ligne au journal. **Recommandation : (a).** C'est ce qu'exige l'inaltérabilité (FAC-14),
  et c'est ce qu'annonce la fiche de l'expert-comptable.
- **D3 — Quels accès d'exploitation tracer.** (a) Les accès humains seulement : session `psql`,
  restauration, exercice de restauration, chacun avec son motif, dans le journal de chaque
  organisation. Les sauvegardes automatiques restent dans le suivi de l'Admin. (b) Aussi chaque
  sauvegarde quotidienne, dans chaque journal. **Recommandation : (a).** Une sauvegarde
  automatique ne donne à personne accès aux données. Une ligne par jour noierait les vrais accès.
- **D4 — Qui lit le journal.** (a) La titulaire seule. (b) Toute l'équipe. **Recommandation :
  (a).** Le cahier des charges dit « les administrateurs », et le journal montre les connexions
  de chacun.
- **D5 — Adresse IP des connexions** (rouverte le 11/11 à la question de Julien). Correction :
  j'avais écrit que le proxy garde déjà les adresses. Ce n'est pas vérifié. La configuration du
  Caddy partagé n'est pas dans le dépôt, et Caddy n'écrit pas de journal d'accès par défaut.
  Aujourd'hui, l'app ne garde aucune adresse IP, sauf sous forme d'empreinte, le temps de la
  limitation de débit. Pourtant, en cas d'incident (compte piraté, notification d'une violation
  à la CNIL), l'adresse d'origine de chaque connexion est la première chose qu'on cherche.
  - (a) Pas d'adresse IP.
  - (b) L'adresse dans le journal commun, visible par la titulaire. Mais le journal est en ajout
    seul et ne se purge pas ligne à ligne, et la titulaire verrait d'où travaillent ses
    collaborateurs (surveillance des salariés).
  - (c) L'adresse dans une table à part, `hub.connection_traces`, liée à la ligne du journal.
    Elle n'est pas montrée à la titulaire et sert à l'enquête de sécurité. La lecture est tracée
    comme un accès d'exploitation (SEC-09). La table est purgée après une durée paramétrable :
    12 mois proposés, dans la fourchette de 6 mois à 1 an recommandée par la CNIL pour les
    journaux, à confirmer par le DPO (question ajoutée à sa fiche). Elle est déclarée dans le
    registre.

  **Recommandation : (c).** C'est la valeur de sécurité, sans personne exposée dans le journal.
- **D6 — Données existantes.** Je pars du principe qu'**aucune facture ni aucun encaissement réel
  n'existe en production** (le pilote n'a pas commencé) : **confirme-le.** Proposition : la
  migration place les factures, avoirs et encaissements existants dans la chaîne, marqués
  « reprise ». Le PDF d'une facture émise avant le lot est produit une fois, à sa première
  ouverture, puis conservé, et marqué « reconstitué » : c'est honnête, car l'original de
  l'époque n'existe pas.
- **D7 — Emplacement de l'archive.** (a) `Devis › Paramètres › Archive comptable`. (b) Une
  rubrique à part dans Paramètres. **Recommandation : (a).** L'archive ne concerne que le module
  Devis.
