# Runbook — Sauvegardes et restauration (SOC-10)

Ce runbook met en place la sauvegarde nocturne chiffrée (restic) de chaque environnement
(base PostgreSQL et stockage Garage, plus Uptime Kuma pour la production), puis décrit la
restauration et le test de restauration chronométré sur le staging.

**Rappel impératif** : Claude Code prépare les scripts et ce runbook, **Julien exécute**
chaque commande, sur le VPS, en root (`sudo -i`). Prérequis : durcissement fait
(`docs/runbooks/durcissement-serveur.md`), environnements déployés
(`docs/runbooks/deploiement.md`), dépôt cloné dans `/opt/symbola`.

## 1. Ce qui est sauvegardé

| Donnée | Méthode | Cohérence |
| --- | --- | --- |
| PostgreSQL (base `symbola`, tous les schémas de modules) | `pg_dump --format=custom` dans le conteneur, vérifié par `pg_restore --list` avant envoi | Dump transactionnel, l'app reste en ligne |
| Garage (fichiers et métadonnées, volume `symbola-<env>_garage_data`) | Copie du volume par restic, **Garage arrêté pendant la copie** (quelques secondes à minutes la nuit) | Fichiers figés, métadonnées SQLite cohérentes |
| Uptime Kuma (volume `symbola-socle_uptime_kuma_data`) — production seulement | Copie du volume, Kuma arrêté pendant la copie | Base SQLite cohérente |

- **Un dépôt restic par environnement** (`/srv/backups/restic/production`,
  `/srv/backups/restic/staging`), chacun avec **son propre mot de passe**. Chaque
  instantané porte le tag `env:<environnement>` : `restore.sh` refuse un instantané qui
  n'a pas le tag de l'environnement visé. **On ne restaure jamais la production dans le
  staging** : le staging ne contient que des données fictives (lot 0, ADR 0016).
- Chiffrement : restic chiffre tout (AES-256) ; sans le mot de passe, le dépôt est
  illisible — **y compris pour Julien**. Le mot de passe est donc aussi rangé dans le
  gestionnaire de mots de passe.
- Horaires : production à 02:30, staging à 03:30 (heure de Paris), avant le redémarrage
  automatique éventuel de 05:00. Une sauvegarde manquée (VPS éteint) est rattrapée au
  démarrage suivant.
- Rétention : 7 quotidiennes, 4 hebdomadaires, 6 mensuelles. Contrôle d'intégrité chaque
  dimanche (relecture de 10 % des données).
- Perte maximale de données acceptée : 24 h (PRD, § 10).

## 2. Mise en place des dépôts (une fois par environnement)

Exemple pour la production ; refaire les mêmes étapes en remplaçant `production` par
`staging`.

1. Dossiers et mot de passe (jamais le même pour les deux environnements) :
   ```bash
   install -d -m 700 /srv/backups/restic/production /etc/symbola/backup
   ( umask 077; openssl rand -base64 48 > /etc/symbola/backup/production.restic-password )
   cat /etc/symbola/backup/production.restic-password   # copier dans le gestionnaire de mots de passe
   ```
2. Configuration, à partir du modèle :
   ```bash
   install -m 600 /opt/symbola/infra/backup/backup.env.example /etc/symbola/backup/production.env
   nano /etc/symbola/backup/production.env
   ```
   Pour le staging : adapter les chemins (`…/staging`), `INCLUDE_MONITORING=false`.
   `BACKUP_PUSH_URL` se remplit au § 6.
3. Initialiser le dépôt (le script de sauvegarde ne le fait jamais lui-même, pour qu'un
   dépôt manquant soit une erreur visible et non un nouveau dépôt vide) :
   ```bash
   docker run --rm \
     -v /srv/backups/restic/production:/repo \
     -v /etc/symbola/backup/production.restic-password:/run/secrets/restic-password:ro \
     -e RESTIC_REPOSITORY=/repo -e RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
     restic/restic:0.19.1 init
   ```
   Utiliser la même version d'image que `RESTIC_IMAGE` dans `infra/backup/lib.sh`.

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

Lister les instantanés (même commande `docker run` qu'au § 2, en remplaçant `init` par
`snapshots`).

## 4. Restaurer un environnement

**Destructif** : remplace la base et les fichiers de l'environnement par ceux de
l'instantané. L'autre environnement n'est jamais touché.

1. Choisir l'instantané (`snapshots`, § 3) ; par défaut, le plus récent de
   l'environnement.
2. Si le volume PostgreSQL est **neuf** (VPS reconstruit, volume supprimé) : démarrer
   l'environnement (`docs/runbooks/deploiement.md`, « Premier déploiement », étape 1), puis
   créer le rôle applicatif **sans lancer les migrations** (le dump contient déjà le
   schéma et l'historique des migrations) : étape 2 du même runbook, `pnpm --filter
   @symbola/db bootstrap` uniquement. Si le volume existe déjà, le rôle existe : rien à
   faire.
3. Lancer la restauration :
   ```bash
   /opt/symbola/infra/backup/restore.sh staging --confirm=staging
   # instantané précis : ajouter --snapshot=<id>
   ```
   Le script arrête l'app, vérifie le rôle applicatif, recrée la base, restaure le dump,
   remplace le contenu de Garage, redémarre l'environnement et affiche la durée totale.
   En cas d'échec, l'app reste arrêtée : corriger, puis relancer le script.
4. Vérifier : `curl -s https://<domaine>/health` renvoie `"status":"ok"`, connexion à
   l'app, téléchargement d'un fichier existant.
5. **RGPD** : les effacements de données demandés **après** la date de l'instantané doivent
   être réappliqués avant de rouvrir l'accès (une sauvegarde restaurée fait réapparaître des
   données effacées depuis). À outiller avec le module RGPD (lot 6) ; en attendant, noter
   chaque effacement dans le journal d'exploitation.
6. Uptime Kuma (production, si nécessaire) : arrêter Kuma, vider le volume
   `symbola-socle_uptime_kuma_data`, puis `restore <id> --target / --include
   /backup/uptime-kuma` avec ce volume monté sur `/backup/uptime-kuma`, et relancer Kuma.

## 5. Test de restauration chronométré (staging)

À faire une fois avant la fin du lot 0, puis chaque mois (PRD, § 10). Toujours sur le
**staging**, avec ses données fictives.

1. Préparer un repère : sur le staging, créer une donnée de test dans le module `hello` et
   envoyer un fichier ; noter leur identifiant.
2. Lancer la sauvegarde du staging : `systemctl start symbola-backup@staging.service`.
3. Modifier le repère après la sauvegarde (supprimer la donnée et le fichier).
4. Démarrer le chronomètre et restaurer :
   `/opt/symbola/infra/backup/restore.sh staging --confirm=staging` ; noter la durée
   affichée.
5. Vérifier que la donnée et le fichier supprimés sont revenus, que `/health` est `ok`, et
   que la production n'a pas bougé (`/health` de production, aucun redémarrage dans
   `docker ps`).
6. Reporter le résultat dans le relevé ci-dessous et dans la pull request du lot.

### Relevé des tests de restauration

| Date | Environnement | Instantané | Taille (base / fichiers) | Durée affichée | Résultat | Par |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-26 | staging | 6fb7f730 | 1,351 MiB | 0 min 21 s | OK — repère hello.greetings retrouvé après restauration, `/health` ok, production non affectée (aucun redémarrage) | Julien |

## 6. Surveillance et entretien

- **Sonde Uptime Kuma** de type *Push*, une par environnement (« Sauvegarde restic —
  production », « — staging »), intervalle 26 h (`docs/runbooks/surveillance.md`). Copier
  l'URL de chaque sonde dans `BACKUP_PUSH_URL` de la configuration correspondante. Le script
  ne l'appelle qu'après une sauvegarde **entièrement** réussie : une nuit en échec déclenche
  l'alerte. L'URL est un secret (elle permettrait de simuler une sauvegarde réussie).
- Après un échec : `journalctl -u symbola-backup@<env>.service -n 100 --no-pager`.
- Place disque : `du -sh /srv/backups/restic/*` chaque mois ; le dépôt partage le disque du
  VPS avec les données.
- Mise à jour de restic : changer la version de `RESTIC_IMAGE` dans `infra/backup/lib.sh`
  (et dans les commandes de ce runbook), puis lancer une sauvegarde manuelle du staging.

## 7. Limites connues (risque accepté au MVP)

- **Pas de copie externe** : les dépôts restic sont sur le même VPS et le même disque que les
  données. Une perte totale du VPS (panne, compte suspendu, erreur de manipulation) fait
  perdre données **et** sauvegardes. Risque accepté pour le lot 0 et le client pilote ; une
  **copie externe** chiffrée (second dépôt restic hors du VPS, `restic copy`) sera ajoutée
  **avant l'ouverture à d'autres clients** (cahier des charges, § 3).
- Garage et Uptime Kuma sont indisponibles quelques instants chaque nuit pendant la copie :
  un envoi de fichier à ce moment échoue et doit être relancé ; `/health` peut passer
  brièvement en `degraded`.
- Le contrôle hebdomadaire ne relit que 10 % des données ; seul le test mensuel de
  restauration prouve qu'une sauvegarde est réellement exploitable.
