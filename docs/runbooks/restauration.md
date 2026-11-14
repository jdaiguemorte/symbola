# Runbook — Sauvegardes et restauration (SOC-10, lot 22)

Ce runbook met en place la sauvegarde nocturne chiffrée (restic) de chaque environnement
(base PostgreSQL et stockage Garage, plus Uptime Kuma pour la production) **vers la Storage Box
Hetzner, hors du VPS** (lot 22, NFR-10, ADR 0051). Il décrit ensuite la restauration, le test de
restauration chronométré, le contrôle de la protection des copies instantanées et l'exercice
« dépôt effacé ».

**Rappel impératif** : Claude Code prépare les scripts et ce runbook, **Julien exécute**
chaque commande, sur le VPS, en root (`ssh symbola`, puis `sudo -i`), ou sur son poste quand c'est
indiqué.
Prérequis : durcissement fait (`docs/runbooks/durcissement-serveur.md`), environnements déployés
(`docs/runbooks/deploiement.md`), dépôt cloné dans `/opt/symbola`.

## 1. Ce qui est sauvegardé

| Donnée | Méthode | Cohérence |
| --- | --- | --- |
| PostgreSQL (base `symbola`, tous les schémas de modules) | `pg_dump --format=custom` dans le conteneur, vérifié par `pg_restore --list` avant envoi | Dump transactionnel, l'app reste en ligne |
| Garage (fichiers et métadonnées, volume `symbola-<env>_garage_data`) | Copie du volume par restic, **Garage arrêté pendant la copie** (quelques secondes à minutes la nuit) | Fichiers figés, métadonnées SQLite cohérentes |
| Uptime Kuma (volume `symbola-socle_uptime_kuma_data`) — production seulement | Copie du volume, Kuma arrêté pendant la copie | Base SQLite cohérente |
| Documenso (DEV-02, ADR 0026) — une fois déployé : base dédiée `documenso`, fichiers compris | Second `pg_dump` vérifié par `pg_restore --list` | Ignoré tant que la base n'existe pas ; restaurée seulement si l'instantané la contient (rôle `documenso` requis : bootstrap avec `DOCUMENSO_DB_PASSWORD` d'abord). Le certificat de scellement est dans `.env.<env>` et le gestionnaire de mots de passe |
| Fournisseur d'identité Logto (lot 33, ADR 0067) : base dédiée `logto` (comptes, mots de passe hachés, seconds facteurs, réglages) | Troisième `pg_dump` vérifié par `pg_restore --list` | Ignoré tant que la base n'existe pas ; restaurée seulement si l'instantané la contient (rôle `logto` requis : bootstrap avec `LOGTO_DB_PASSWORD` d'abord). Le script recrée les rôles de connexion propres à Logto (`logto_tenant_*`) d'après sa table `tenants`. **Sans cette base, plus personne ne se connecte** |

- **Un dépôt restic par environnement**, sur la Storage Box Hetzner (BX11, Helsinki), dans le
  dossier du sous-compte de l'environnement (`symbola-production`, `symbola-staging`), chacun
  avec **son propre mot de passe et sa propre clé SSH**. Chaque instantané porte le tag
  `env:<environnement>` : `restore.sh` refuse un instantané qui n'a pas le tag de l'environnement
  visé. **On ne restaure jamais la production dans le staging** : le staging ne contient que des
  données fictives (lot 0, ADR 0016).
- **Hors du VPS, chez un autre fournisseur** (NFR-10) : une panne ou une suspension chez Contabo
  n'atteint pas les sauvegardes. Le VPS ne connaît que les sous-comptes. Le mot de passe du
  compte principal de la Storage Box et l'accès à la console Hetzner (double authentification)
  ne vont **jamais** sur le VPS.
- Chiffrement : restic chiffre tout (AES-256) avant l'envoi ; sans le mot de passe, le dépôt est
  illisible, y compris pour Hetzner et **pour Julien**. Le mot de passe est donc aussi rangé dans
  le gestionnaire de mots de passe.
- Horaires : production à 02:30, staging à 03:30 (heure de Paris), avant le redémarrage
  automatique éventuel de 05:00. Une sauvegarde manquée (VPS éteint) est rattrapée au
  démarrage suivant.
- Rétention (NFR-13) : 7 quotidiennes, 4 hebdomadaires, **12 mensuelles**. Chaque nuit, contrôle
  de la structure du dépôt ; chaque dimanche, relecture de 10 % des données et relevé de la
  taille du dépôt (NFR-30). Un contrôle en échec empêche le signal de succès.
- **Copies instantanées de la Storage Box** : Hetzner en prend une chaque jour à 05:00 UTC (6 h
  ou 7 h à Paris, après les deux sauvegardes) et en garde dix. Elles sont en lecture seule et ne
  se suppriment que depuis la console : un VPS compromis qui effacerait son dépôt ne détruit pas
  l'historique des dix derniers jours (§ 7 et § 8).
- Perte maximale de données acceptée : 24 h (NFR-11).

## 2. Mise en place (une fois par environnement)

Exemple pour la production ; refaire les mêmes étapes en remplaçant `production` par `staging`
(et `INCLUDE_MONITORING=false` pour le staging). Image restic : la même version que
`RESTIC_IMAGE` dans `infra/backup/lib.sh` (ici `restic/restic:0.19.1`).

1. **Console Hetzner** (fait le 11/11/2026) : Storage Box BX11 à Helsinki, « SSH Support » et
   « External Reachability » cochés, SMB et WebDAV décochés ; onglet *Snapshots* : copies
   automatiques quotidiennes à 05:00 UTC, 10 au maximum, « Display snapshot directory » activé.
   Mot de passe du compte principal et codes de secours dans le gestionnaire de mots de passe.
2. **Sous-compte** (console Hetzner, la Storage Box, *Sub-accounts*) : un par environnement,
   dossier de base `symbola-production` (ou `symbola-staging`), SSH (port 23) et accès externe
   autorisés, ni SMB ni WebDAV, **pas** en lecture seule. Noter son identifiant (forme
   `uXXXXX-subN`) et ranger son mot de passe dans le gestionnaire : il ne sert qu'une fois, à
   l'étape 4.
3. **Clé SSH du VPS pour ce sous-compte** :
   ```bash
   install -d -m 700 /etc/symbola/backup /etc/symbola/backup/production.ssh
   ssh-keygen -t ed25519 -N '' -C symbola-backup-production -f /etc/symbola/backup/production.ssh/id_ed25519
   ```
4. **Installer la clé chez le sous-compte** (demande une fois le mot de passe du sous-compte) :
   ```bash
   cat /etc/symbola/backup/production.ssh/id_ed25519.pub \
     | ssh -p 23 uXXXXX-subN@uXXXXX-subN.your-storagebox.de install-ssh-key
   ```
   À la première connexion, `ssh` affiche l'empreinte du serveur : la comparer aux empreintes
   publiées par Hetzner (docs.hetzner.com, Storage Box, page générale) **avant** de répondre
   `yes`.
5. **Épingler l'empreinte pour le conteneur restic** :
   ```bash
   ssh-keyscan -p 23 -t ed25519 uXXXXX-subN.your-storagebox.de > /etc/symbola/backup/production.ssh/known_hosts
   ssh-keygen -lf /etc/symbola/backup/production.ssh/known_hosts   # même empreinte que celle publiée par Hetzner
   ```
6. **Configuration SSH**, à partir du modèle, en remplaçant `uXXXXX-subN` :
   ```bash
   install -m 600 /opt/symbola/infra/backup/ssh-config.example /etc/symbola/backup/production.ssh/config
   nano /etc/symbola/backup/production.ssh/config
   chmod 600 /etc/symbola/backup/production.ssh/*
   ```
   Le script refuse une configuration qui n'a pas `StrictHostKeyChecking yes` : une empreinte
   inconnue ou changée n'est jamais acceptée.
7. **Vérifier l'accès depuis l'image restic** (client SSH inclus) :
   ```bash
   docker run --rm --entrypoint ssh restic/restic:0.19.1 -V
   echo ls | docker run --rm -i -v /etc/symbola/backup/production.ssh:/root/.ssh:ro \
     --entrypoint sftp restic/restic:0.19.1 -b - symbola-production
   ```
   Si `ssh` est introuvable dans l'image, s'arrêter et le signaler à Claude Code (repli prévu :
   `-o sftp.command=…`, spécification du lot 22).
8. **Mot de passe du dépôt** (jamais le même pour les deux environnements) :
   ```bash
   ( umask 077; openssl rand -base64 48 > /etc/symbola/backup/production.restic-password )
   cat /etc/symbola/backup/production.restic-password   # copier dans le gestionnaire de mots de passe
   ```
9. **Configuration de la sauvegarde**, à partir du modèle :
   ```bash
   install -m 600 /opt/symbola/infra/backup/backup.env.example /etc/symbola/backup/production.env
   nano /etc/symbola/backup/production.env
   ```
   `RESTIC_REPOSITORY=sftp:symbola-production:restic`,
   `RESTIC_SSH_DIR=/etc/symbola/backup/production.ssh`. `BACKUP_PUSH_URL` se remplit au § 6.
10. **Initialiser le dépôt** (le script de sauvegarde ne le fait jamais lui-même, pour qu'un dépôt
    manquant soit une erreur visible et non un nouveau dépôt vide) :
    ```bash
    docker run --rm \
      -v /etc/symbola/backup/production.ssh:/root/.ssh:ro \
      -v /etc/symbola/backup/production.restic-password:/run/secrets/restic-password:ro \
      -e RESTIC_REPOSITORY=sftp:symbola-production:restic -e RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
      restic/restic:0.19.1 init
    ```

## 3. Planification et première sauvegarde

```bash
cp /opt/symbola/infra/backup/systemd/symbola-backup@.service \
   /opt/symbola/infra/backup/systemd/symbola-backup@production.timer \
   /opt/symbola/infra/backup/systemd/symbola-backup@staging.timer \
   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now symbola-backup@production.timer symbola-backup@staging.timer
systemctl list-timers 'symbola-backup@*'      # prochaines exécutions
```

Première sauvegarde à la main, pour chaque environnement :

```bash
systemctl start symbola-backup@staging.service
journalctl -u symbola-backup@staging.service -n 50 --no-pager   # « sauvegarde terminée en … s »
```

Lister les instantanés : même commande `docker run` qu'au § 2, étape 10, en remplaçant `init`
par `snapshots`.

**Anciens dépôts locaux** (décision de Julien, lot 22) : une fois la première sauvegarde
distante des deux environnements faite **et** le test de restauration du § 5 réussi, supprimer
les dépôts restés sur le disque du VPS. Leur historique ne contient que des données fictives.

```bash
rm -r /srv/backups/restic/staging /srv/backups/restic/production
```

## 4. Restaurer un environnement

**Destructif** : remplace la base et les fichiers de l'environnement par ceux de
l'instantané. L'autre environnement n'est jamais touché.

1. Choisir l'instantané (`snapshots`, § 3) ; par défaut, le plus récent de
   l'environnement. Si le dépôt lui-même a disparu ou a été abîmé (VPS compromis), le
   recopier d'abord depuis une copie instantanée de la Storage Box (§ 8, étape 4).
2. Si le volume PostgreSQL est **neuf** (VPS reconstruit, volume supprimé) : démarrer
   l'environnement (`docs/runbooks/deploiement.md`, « Premier déploiement », étape 1), puis
   créer le rôle applicatif **sans lancer les migrations** (le dump contient déjà le
   schéma et l'historique des migrations) : étape 2 du même runbook, `pnpm --filter
   @symbola/db bootstrap` uniquement, avec `LOGTO_DB_PASSWORD` (et `DOCUMENSO_DB_PASSWORD`
   s'il est déployé) rempli dans `.env.<env>` : le bootstrap crée aussi le rôle `logto`. Ne
   **pas** relancer `configure-identity` : les réglages de Logto reviennent avec sa base. Si le
   volume existe déjà, les rôles existent : rien à faire.
3. Lancer la restauration :
   ```bash
   /opt/symbola/infra/backup/restore.sh staging --confirm=staging
   # instantané précis : ajouter --snapshot=<id>
   ```
   Le script arrête l'app, vérifie le rôle applicatif, recrée la base, restaure le dump,
   remplace le contenu de Garage, redémarre l'environnement et affiche la durée totale.
   Lot 33 (ADR 0067) : si l'instantané contient la base de Logto, il arrête aussi Logto,
   recrée sa base, lui rend le droit de connexion, restaure le dump et recrée ses rôles de
   connexion ; comptes et seconds facteurs reviennent tels qu'à la date de l'instantané (un
   compte créé depuis n'existe plus chez Logto, et sa fiche Symbola non plus).
   En cas d'échec, l'app reste arrêtée : corriger, puis relancer le script.
   Lot 23 (SEC-09) : la restauration est un accès d'exploitation ; elle écrit
   `ops.backup.restored` au journal d'activité de chaque organisation, avec pour motif
   l'instantané, ou celui donné par `--motif="…"` (sans donnée personnelle). Pour toute autre
   lecture de la base : `docs/runbooks/acces-exploitation.md`.
4. Vérifier : `curl -s https://<domaine>/health` renvoie `"status":"ok"`, connexion à
   l'app par un lien de connexion (la page de Logto doit s'ouvrir), téléchargement d'un
   fichier existant.
5. **RGPD** : les effacements de données demandés **après** la date de l'instantané doivent
   être réappliqués avant de rouvrir l'accès (une sauvegarde restaurée fait réapparaître des
   données effacées depuis). À outiller avec le module RGPD (lot 6) ; en attendant, noter
   chaque effacement dans le journal d'exploitation.
6. Uptime Kuma (production, si nécessaire) : arrêter Kuma, vider le volume
   `symbola-socle_uptime_kuma_data`, puis `restore <id> --target / --include
   /backup/uptime-kuma` avec ce volume monté sur `/backup/uptime-kuma`, et relancer Kuma.

## 4 bis. Annuler une migration (sans restaurer)

Quand seul le schéma est en cause (une migration à retirer après un déploiement raté), on
annule la migration au lieu de restaurer une sauvegarde entière (ADR 0036). **Toujours après
une sauvegarde** (`sudo systemctl start symbola-backup@staging.service`) : un script qui
supprime une colonne en perd les données.

1. Revenir à l'image de l'app d'avant la migration (`APP_IMAGE_TAG`, runbook de déploiement),
   pour qu'aucune requête ne vise ce qui va disparaître.
2. Annuler les migrations **de la plus récente à la plus ancienne**, une par une, de la même
   façon que `migrate` dans le runbook de déploiement (« Mettre à jour », étape 3 : même
   tunnel SSH, mêmes variables admin) :
   ```bash
   pnpm --filter @symbola/db rollback -- 0084_lot20_tag_groups
   pnpm --filter @symbola/db rollback -- 0083_lot19_request_proof
   pnpm --filter @symbola/db rollback -- 0082_lot18_privacy_cases
   pnpm --filter @symbola/db rollback -- 0081_lot17_documents
   pnpm --filter @symbola/db rollback -- 0080_lot16_event_types
   pnpm --filter @symbola/db rollback -- 0079_lot16_drop_hello
   pnpm --filter @symbola/db rollback -- 0078_lot16_rate_limit
   pnpm --filter @symbola/db rollback -- 0077_lot16_vendor_families
   pnpm --filter @symbola/db rollback -- 0076_lot16_trusted_devices
   pnpm --filter @symbola/db rollback -- 0075_lot16_mfa_protection
   pnpm --filter @symbola/db rollback -- 0074_lot15_grant_import_jobs
   pnpm --filter @symbola/db rollback -- 0073_lot15_import_jobs
   ```
   Annuler 0084 retire les groupes, familles et paliers des étiquettes ; les étiquettes restent
   sur les fiches (ADR 0049).
   Annuler 0083 retire le réglage « preuve des demandes » (une durée modifiée est perdue) ; les
   noms déjà remplacés par « [anonymisé] » le restent (ADR 0048).
   Annuler 0082 oublie les dates d'action et de réponse des dossiers RGPD et rend son rang
   d'avant à la progression de l'assistant de démarrage (ADR 0047).
   Annuler 0081 retire la fiche entreprise complète et les réglages des documents ; les
   instantanés des documents émis gardent leurs champs (ADR 0046).
   Annuler 0080 retire les types d'événement ; le vocabulaire revient à celui du métier.
   Annuler 0079 recrée la table témoin `hello.greetings`, vide (ADR 0045).
   Annuler 0078 retire la limitation de débit et oublie les tentatives du jour (ADR 0044).
   Annuler 0077 retire les familles de types : chaque fiche garde son type, le carnet revient à
   une pastille par type (ADR 0040).
   Avant d'annuler 0075 et de revenir à une image antérieure au lot 16, il fallait remettre en
   clair les secrets de double authentification (ADR 0037) ; depuis le lot 33, ces secrets
   n'existent plus chez Symbola et la commande `mfa-secrets` a disparu.
   **Lot 33 (0130, puis 0129)** : annuler 0130 recrée les colonnes de mot de passe et de double
   authentification **vides** ; l'annulation de 0129 est ensuite refusée tant qu'un compte n'a
   pas de mot de passe. Revenir avant le lot 33 = restaurer la sauvegarde prise avant le
   déploiement (§ 4), pas annuler ces migrations (runbook de déploiement, « Retour arrière »).
   La commande refuse une migration qui n'est pas la dernière appliquée, ou dont des données
   dépendent encore (par exemple des imports de fiches PDF pour 0072) : elle l'écrit en clair
   et ne modifie rien.
3. Pour rejouer plus tard : `pnpm --filter @symbola/db migrate`, comme d'habitude.

## 5. Test de restauration chronométré (staging)

À faire à la mise en service de la sauvegarde distante (lot 22). Le test **mensuel sur un serveur
vierge** commence après le pilote (décision de Julien du 11/11/2026). Toujours sur le
**staging**, avec ses données fictives.

1. Préparer un repère : sur le staging, créer une source de prospect « Repère restauration
   <date> » (Paramètres › Sources et motifs) et joindre un fichier à une fiche du carnet de
   prestataires ; noter leur nom.
2. Lancer la sauvegarde du staging : `systemctl start symbola-backup@staging.service`.
3. Modifier le repère après la sauvegarde (supprimer la donnée et le fichier).
4. Démarrer le chronomètre et restaurer **depuis la Storage Box** :
   `/opt/symbola/infra/backup/restore.sh staging --confirm=staging` ; noter la durée
   affichée.
5. Vérifier que la donnée et le fichier supprimés sont revenus, que `/health` est `ok`, et
   que la production n'a pas bougé (`/health` de production, aucun redémarrage dans
   `docker ps`).
6. Reporter le résultat dans le relevé ci-dessous et dans la pull request du lot.

### Relevé des tests de restauration

| Date | Environnement | Dépôt | Instantané | Taille (base / fichiers) | Durée affichée | Résultat | Par |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-26 | staging | local (VPS) | 6fb7f730 | 1,351 MiB | 0 min 21 s | OK — repère hello.greetings retrouvé après restauration, `/health` ok, production non affectée (aucun redémarrage) | Julien |
| 2026-11-11 | staging | Storage Box Hetzner (`sftp:symbola-staging:restic`) | b0e26260 | 5,44 MiB | 1 min 1 s | OK — source « Repère restauration 11/11 » et fichier joint retrouvés, `/health` ok, production non affectée (aucun redémarrage) | Julien |

## 6. Surveillance et entretien

- **Sonde Uptime Kuma** de type *Push*, une par environnement (« Sauvegarde restic —
  production », « — staging »), intervalle 26 h (`docs/runbooks/surveillance.md`). Copier
  l'URL de chaque sonde, **sans sa partie `?status=…`** (`http://127.0.0.1:3001/api/push/<jeton>`),
  dans `BACKUP_PUSH_URL` de la configuration correspondante. Le script
  ne l'appelle qu'après une sauvegarde **entièrement** réussie, contrôle du dépôt compris : une
  nuit en échec déclenche l'alerte, par e-mail et sur le téléphone. L'URL est un secret (elle
  permettrait de simuler une sauvegarde réussie).
- **Console d'Administration** (lot 13, L13-HUB-18, ADR 0033) : chaque exécution est aussi
  enregistrée dans la table `hub.backup_runs` de l'environnement (début, fin, résultat, taille
  ajoutée au dépôt), par `psql` dans le conteneur `postgres` avec son rôle d'administration.
  La vue d'ensemble et la page Santé affichent « Faite le … », ou en alerte « Échec » /
  « Aucune depuis plus de 26 h ». Ce signal ne fait jamais échouer la sauvegarde : si la base
  ne répond pas (ou si la migration 0068 n'est pas encore appliquée), seul le journal le note.
- Après un échec : `journalctl -u symbola-backup@<env>.service -n 100 --no-pager`. Un dépôt
  « injoignable » vient du réseau, de la clé ou de l'empreinte : vérifier l'étape 7 du § 2.
- Place occupée : la console Hetzner affiche l'occupation de la Storage Box (copies comprises) ;
  la taille de chaque dépôt est dans le journal du dimanche. Un mois après la mise en service,
  noter dans la pull request du lot la taille des dépôts face au volume des données (NFR-30 :
  moins du double attendu). Le disque du VPS est surveillé à part (NFR-14,
  `docs/runbooks/surveillance.md`).
- Mise à jour de restic : changer la version de `RESTIC_IMAGE` dans `infra/backup/lib.sh`
  (et dans les commandes de ce runbook), puis lancer une sauvegarde manuelle du staging.

## 7. Contrôler la protection des copies instantanées (NFR-13)

À faire une fois, **avant la première donnée réelle**, pour chaque environnement : le script
prouve depuis le VPS, avec les seuls identifiants du sous-compte, qu'on ne peut ni créer, ni
modifier, ni renommer, ni supprimer une copie instantanée. Si une copie n'était pas protégée, la
tentative de suppression pourrait effacer la plus ancienne : d'où `--confirm`.

```bash
/opt/symbola/infra/backup/check-snapshot-protection.sh staging --confirm=staging
/opt/symbola/infra/backup/check-snapshot-protection.sh production --confirm=production
```

- « copies invisibles depuis le sous-compte » : le sous-compte ne peut pas les atteindre.
  Vérifier alors **depuis ton poste**, avec le compte principal, que les copies existent :
  ```bash
  echo 'ls .zfs/snapshot' | sftp -P 23 -b - uXXXXX@uXXXXX.your-storagebox.de
  ```
- « protégées » : toutes les tentatives ont été refusées.
- « NON protégées » : **ne pas mettre de données réelles** ; prévenir Claude Code (recours prévu
  par l'ADR 0051 : stockage avec verrouillage).

| Date | Environnement | Copies vues | Résultat | Par |
| --- | --- | --- | --- | --- |

## 8. Exercice « dépôt effacé » (staging)

Il prouve qu'un VPS compromis qui effacerait son dépôt ne fait pas perdre l'historique (NFR-13).
À faire une fois à la mise en service, sur le **staging** seulement.

**Ne jamais utiliser le bouton de restauration d'une copie dans la console Hetzner** : il ramène
**toute** la Storage Box à cette copie, production comprise, et efface tout ce qui est plus
récent, copies suivantes comprises. On recopie seulement le dossier voulu.

1. Le matin, après 05:00 UTC, vérifier depuis ton poste qu'une copie de la nuit contient le
   dépôt du staging :
   ```bash
   echo 'ls .zfs/snapshot' | sftp -P 23 -b - uXXXXX@uXXXXX.your-storagebox.de
   echo 'ls .zfs/snapshot/<copie>/symbola-staging/restic' | sftp -P 23 -b - uXXXXX@uXXXXX.your-storagebox.de
   ```
2. **Simuler l'attaque** depuis le VPS, avec la clé du sous-compte staging : le dépôt est mis
   de côté sous un autre nom (il ne sert plus à rien pour restic).
   ```bash
   echo 'rename restic restic-exercice-efface' | docker run --rm -i \
     -v /etc/symbola/backup/staging.ssh:/root/.ssh:ro --entrypoint sftp restic/restic:0.19.1 -b - symbola-staging
   ```
3. Constater l'échec : `systemctl start symbola-backup@staging.service` échoue (« non
   initialisé, injoignable… »), et l'alerte arrive après le délai de la sonde.
4. **Recopier le dépôt depuis la copie de la nuit**, depuis ton poste, avec le compte
   principal (les données restent chiffrées par restic pendant tout le trajet) :
   ```bash
   mkdir -p ~/restic-staging-copie
   rsync -a -e 'ssh -p 23' uXXXXX@uXXXXX.your-storagebox.de:.zfs/snapshot/<copie>/symbola-staging/restic/ ~/restic-staging-copie/
   rsync -a -e 'ssh -p 23' ~/restic-staging-copie/ uXXXXX@uXXXXX.your-storagebox.de:symbola-staging/restic/
   ```
   Puis supprimer la copie locale `~/restic-staging-copie`.
5. Sur le VPS : `systemctl start symbola-backup@staging.service` réussit, puis
   `/opt/symbola/infra/backup/restore.sh staging --confirm=staging` réussit.
6. Noter la durée totale (de l'étape 4 à la fin de l'étape 5) ci-dessous. Le dossier
   `restic-exercice-efface` peut ensuite être supprimé avec le compte principal.

| Date | Copie utilisée | Durée totale | Résultat | Par |
| --- | --- | --- | --- | --- |

## 9. Limites connues (risques acceptés pendant le pilote)

- **Fenêtre de protection de dix jours** : une attaque découverte au-delà ne peut plus compter sur
  les copies instantanées. Les alertes (sauvegarde, disque) visent à la découvrir bien avant.
- **Fichiers de Garage sur le disque du VPS** pendant le pilote (ADR 0051, décision Q14 b) :
  ils sont dans chaque sauvegarde distante, la perte maximale reste 24 h. Bascule vers un
  stockage d'objets externe au palier 2.
- **Test mensuel sur serveur vierge** : reporté après le pilote (décision de Julien du
  11/11/2026). D'ici là, seuls le test du § 5 et l'exercice du § 8 prouvent la restauration.
- Garage et Uptime Kuma sont indisponibles quelques instants chaque nuit pendant la copie :
  un envoi de fichier à ce moment échoue et doit être relancé ; `/health` peut passer
  brièvement en `degraded`.
- Le contrôle du dimanche ne relit que 10 % des données ; seul un test de restauration prouve
  qu'une sauvegarde est réellement exploitable. Le contrôle de chaque nuit ne vérifie que la
  structure du dépôt.
- L'ancienne limite « pas de copie externe » (lot 0) est levée par le lot 22.
