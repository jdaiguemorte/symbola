# ADR 0060 — Journal d'audit commun, auteur de chaque ligne, accès d'exploitation

- Statut : accepté (spécification du lot 23 validée par Julien le 11/11/2026, décisions D1 à D7)
- Date : 2026-11-11
- Remplace : le journal des actions de l'Admin `hub.audit_log` (PRD-HUB-03, migrations 0009 et
  0010).
- Exigences : SEC-19, ARC-16, HUB-16, SEC-09, DAT-06 de `docs/CAHIER_DES_CHARGES.md` ; décision
  Q31 de `docs/QUESTIONS.md`.

## Contexte

Le cahier des charges exige un journal d'audit **commun**, en **ajout seul**, que « aucun rôle
applicatif ne peut modifier ou supprimer » (ARC-16). Il doit tracer les connexions, les
changements de droits, les exports, les partages, les émissions, les encaissements et les
suppressions (SEC-19), et chaque accès d'exploitation, tracé et motivé, doit apparaître dans le
journal de l'organisation (SEC-09). La titulaire le lit (HUB-16). Chaque ligne de chaque table
porte sa date de création, sa date de modification et son auteur (DAT-06).

Avant le lot 23, `hub.audit_log` ne traçait que quatre actions de l'Admin, et le rôle
applicatif pouvait le modifier.

## Décision

1. **Une table commune**, `core.audit_entries`, à côté de `core.domain_events` : le journal est
   une brique de `packages/db`. Colonnes : organisation (vide pour un geste de plateforme), date,
   auteur (`member`, `admin`, `operator`, `system` et l'identifiant du compte), action
   (`<module>.<objet>.<action>`), famille, objet, détails, motif, essai guidé. **Aucune donnée
   personnelle** : ni nom, ni e-mail, ni adresse IP.
2. **Ajout seul, garanti par la base** : le rôle applicatif n'a que `SELECT`, `INSERT` et
   `DELETE` ; un déclencheur refuse `UPDATE`, `DELETE` et `TRUNCATE` à **tout** rôle,
   propriétaire compris, sauf la suppression d'une ligne d'essai guidé (purgée avec l'essai,
   comme les factures fictives). RLS forcée : une organisation lit ses lignes et les accès
   d'exploitation de la plateforme ; elle n'écrit que dans son journal ou dans celui de la
   plateforme.
3. **Dans la transaction du geste** (`appendAudit`) : si le geste échoue, la ligne disparaît avec
   lui ; si la ligne échoue, le geste est annulé. Le catalogue des actions est dans
   `@symbola/contracts`.
4. **L'auteur sans changer les dépôts** : `withOrganization` fixe `app.actor_kind` et
   `app.actor_id` dans la transaction. L'auteur vient d'un `withActor` explicite (connexion,
   script), sinon d'un résolveur enregistré par l'app, qui lit la session de la requête en cours
   (lecture seule, cache de 5 secondes), sinon `system`. Le registre est sur `globalThis`, parce
   que Next charge le paquet dans plusieurs bundles.
5. **DAT-06** : `core.stamp_row()` remplit `created_at`, `created_by`, `updated_at` et
   `updated_by` sur chaque table ; une date de modification fixée par l'appelant est gardée ;
   `created_*` ne se réécrit pas. Les tables en ajout seul n'ont que leur auteur
   (`core.stamp_created_row()`), et leur date de création peut être une date métier
   (`issued_at`, `changed_at`). Les tables techniques sont listées avec leur motif
   (`packages/db/src/row-stamps.ts`) ; un test parcourt toutes les tables de la base.
6. **Suppressions** : `core.journal_deletion()`, déclencheur `BEFORE DELETE` sur chaque table
   métier, écrit `<schéma>.<table>.deleted`, même si le code oublie de le faire. Il ne
   journalise pas une suppression en cascade (seul l'objet supprimé compte : un déclencheur
   `BEFORE` s'exécute à l'intérieur de la cascade, à la profondeur 2, là où un `AFTER`
   s'exécuterait au même niveau que l'objet), une ligne d'essai, ni une purge en masse
   (`withAuditBulk`, qui fixe `app.audit_bulk` : effacement et purge RGPD, essai guidé, imports
   expirés), dont l'appelant écrit une ligne de synthèse. Pour écrire dans le journal de
   l'organisation de la ligne, y compris depuis une table du hub supprimée hors contexte, la
   fonction fixe ce contexte le temps de l'écriture, avec les droits de l'appelant (pas de
   `SECURITY DEFINER`).
7. **Adresses IP des connexions (décision D5)** : dans `hub.connection_traces`, à part du
   journal, reliées à leur ligne. L'app y écrit sans pouvoir les relire (seul `created_at` est
   lisible, pour la purge) ; la titulaire ne les voit pas ; elles sont purgées chaque jour passé
   `platform_settings.connection_trace_retention_months` (12 mois par défaut, à confirmer par le
   DPO). Un échec de connexion a pour auteur `system` : ce n'est pas forcément le titulaire du
   compte.
8. **Accès d'exploitation (SEC-09, décision D3)** : `infra/server/acces-base.sh` exige un motif
   sans donnée personnelle, écrit `ops.database.opened` avant d'ouvrir `psql` et
   `ops.database.closed` à la sortie ; `restore.sh` écrit `ops.backup.restored`. Ces lignes sont
   sans organisation et se lisent dans le journal de chacune. La sauvegarde nocturne n'en est pas
   une : personne ne lit les données. Les actions de la console d'Administration vont au journal
   de l'organisation visée.
9. **HUB-16 (décision D4)** : Paramètres › Journal d'activité, réservé à la titulaire ; filtres
   par personne, période et famille ; les noms sont relus dans les comptes de l'organisation.

## Écarts assumés

- **Migrations entre schémas** : la migration 0086 (hub) recopie `hub.audit_log` dans
  `core.audit_entries`, et les déclencheurs des modules écrivent dans `core.audit_entries`.
  Exception à « une migration ne touche que son schéma » (DAT-09, ADR 0036) : le journal est une
  brique commune, comme `domain_events`.
- **`root` sur le VPS** peut ouvrir `psql` sans le script : cet accès ne serait pas tracé. Le
  runbook (`docs/runbooks/acces-exploitation.md`) en fait une règle ; l'outil ne peut pas
  l'imposer à l'administrateur du serveur.
- **Durée de conservation du journal** : non fixée ; question au DPO (fiche, question 11).
  Rien n'est purgé du journal d'ici le lot 34 (purges automatiques), sauf les lignes d'essai.

## Conséquences

- Toute nouvelle table reçoit les quatre colonnes de DAT-06 et ses deux déclencheurs dans sa
  migration, ou figure dans `row-stamps.ts` avec son motif ; le test le vérifie.
- Toute nouvelle action sensible s'ajoute au catalogue (`packages/contracts/src/audit.ts`) avec
  ses libellés FR/EN (`ActivityLog.actions`), et s'écrit par `appendAudit` dans sa transaction.
- Une purge en masse passe par `withAuditBulk` et écrit sa ligne de synthèse.
- Le lot 24 (tentatives refusées, SC-S1) et le lot 23b (factures et encaissements chaînés)
  écrivent dans ce journal.
