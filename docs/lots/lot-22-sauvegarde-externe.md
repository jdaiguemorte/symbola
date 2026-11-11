# Lot 22 — Sauvegarde hors du serveur

**Statut** : spécification validée par Julien le 11/11/2026 (« Oui, les trois »). Code, tests
et runbooks écrits sur la branche `lot-22-sauvegarde-externe`. Reste : la mise en place sur le
VPS par Julien (`docs/runbooks/restauration.md`, § 2 à 8, et `docs/runbooks/surveillance.md`),
avec ses relevés. Choix d'architecture : [ADR 0051](../adr/0051-sauvegarde-externe-hetzner.md).

Identifiants : ceux de `docs/CAHIER_DES_CHARGES.md` (décision Q1 du 11/11/2026). Les anciens
identifiants (SOC-10, HUB-18…) restent tels quels dans le code jusqu'au lot 25.

## Contexte

Le rapport d'écart du 11/11/2026 (`docs/GAP_REPORT.md`, écarts 1 et 2) a relevé trois faits :

- les dépôts restic sont dans `/srv/backups/restic/<environnement>`, **sur le disque du VPS** ;
- c'est le VPS qui lance `restic forget --prune` : un serveur compromis peut donc effacer toutes
  ses sauvegardes ;
- la rétention est de 6 mensuelles, et un seul test de restauration est consigné (26/10, staging).

**Décisions de Julien du 11/11/2026** :

- (Q15) Pas encore de données réelles en production. Fournisseur européen, bon marché dans la
  durée. Test mensuel sur serveur vierge reporté après le pilote.
- (C2) Hetzner Storage Box, avec copies instantanées automatiques.
- (Q14 b) Garage reste sur le VPS pendant le pilote.
- Julien a créé la Storage Box BX11 à **Helsinki**. Les copies automatiques sont à régler
  (quotidiennes, 05:00 UTC, 10 gardées, dossier des copies visible) : réglées par Julien le 11/11.

**Ce que doit garantir le lot** : avant la première donnée réelle, une sauvegarde chiffrée part
chaque nuit chez un autre fournisseur. Un VPS compromis ne peut pas en détruire l'historique.
Une restauration depuis ce dépôt distant a été faite et chronométrée.

## Partage du travail

- **Claude Code** : cette spécification, l'ADR, les scripts, les tests, les runbooks.
- **Julien**, guidé pas à pas par le runbook : réglages dans la console Hetzner, sous-comptes,
  clés SSH sur le VPS, premières sauvegardes, tests de protection et de restauration, canal
  d'alerte sur le téléphone.

Aucune action sur le VPS, la console Hetzner ou les secrets n'est faite par Claude Code.

## Décisions de Julien (11/11/2026 : « Oui, les trois »)

1. **Les anciens dépôts locaux.**
   - **Proposé** : une fois la première sauvegarde distante et la restauration validées, tu
     supprimes `/srv/backups/restic/*` sur le VPS. On ne recopie pas leur historique : il ne
     contient que des données fictives.
   - Variante : garder aussi un dépôt local, pour des restaurations plus rapides. Cela double les
     scripts à maintenir, sans gain de sécurité.
2. **Le canal d'alerte sur le téléphone** (NFR-14). Uptime Kuma sait envoyer, entre autres :
   - **ntfy** (proposé) : application libre, sans compte, notifications instantanées ;
   - Telegram : nécessite un compte et un robot ;
   - Pushover : application payante une fois.

   Les alertes ne contiennent aucune donnée personnelle, par exemple « Sauvegarde production en
   échec ». L'e-mail actuel reste en plus.
3. **Le seuil d'alerte sur le disque du VPS.** Proposé : 80 % d'occupation.

## Critères d'acceptation

### NFR-10 — Sauvegarde externe chiffrée, chaque nuit, chez un autre fournisseur

- **Étant donné** un environnement configuré vers son sous-compte Hetzner, **quand** la
  sauvegarde nocturne tourne, **alors** l'instantané chiffré est écrit dans ce dépôt distant.
  Rien n'est écrit dans un dépôt sur le disque du VPS.
- **Étant donné** le dépôt distant injoignable (réseau coupé, clé refusée, empreinte du serveur
  différente de celle épinglée), **alors** la sauvegarde échoue sans rien perdre. Garage
  redémarre, aucun signal de succès ne part vers Uptime Kuma, et l'exécution est enregistrée
  « failed » dans `hub.backup_runs`.
- L'empreinte du serveur Hetzner est épinglée. Une empreinte inconnue ou changée fait échouer la
  connexion : jamais d'acceptation automatique.
- Chaque environnement a son sous-compte, sa clé SSH et son mot de passe restic. La clé du
  staging n'ouvre pas le dépôt de production, et inversement.
- Le mot de passe restic, la clé SSH et la configuration SSH sont montés en fichiers en lecture
  seule dans le conteneur restic. Ils ne passent jamais en argument ni en variable.
- **Chaque nuit**, après la sauvegarde, un contrôle rapide de la structure du dépôt
  (`restic check` sans relecture des données) confirme que la sauvegarde est lisible. Le
  dimanche, 10 % des données sont relues, comme aujourd'hui. Si le contrôle échoue, aucun signal
  de succès ne part.
- Un dépôt local reste possible, pour le développement et les tests : `RESTIC_REPOSITORY`
  accepte un dossier ou un dépôt distant.

### NFR-13 — Rétention, et historique hors d'atteinte du VPS

- **Quand** la rétention s'applique, **alors** restic garde 7 quotidiennes, 4 hebdomadaires et
  **12 mensuelles**.
- Hetzner prend chaque jour une copie instantanée de la Storage Box et en garde dix.
- **Étant donné** les identifiants d'un sous-compte (ceux du VPS), **quand** on tente de
  supprimer ou de modifier une copie instantanée, **alors** la tentative échoue. Un script de
  contrôle, lancé par Julien depuis le VPS, le prouve. Son résultat est consigné dans le runbook.
- Les identifiants du compte principal de la Storage Box et de la console Hetzner ne sont jamais
  copiés sur le VPS (règle du runbook).

### NFR-11 et NFR-12 — Restauration prouvée

- **Étant donné** un instantané dans le dépôt distant du staging, **quand** Julien lance
  `restore.sh staging --confirm=staging`, **alors** la base et les fichiers reviennent. La
  durée s'affiche et se consigne dans le relevé du runbook.
- **Exercice « dépôt effacé »**, sur le staging :
  1. depuis le VPS, Julien efface le dépôt du sous-compte staging ;
  2. depuis son poste, avec le compte principal, il recopie le dépôt depuis la copie
     instantanée de la veille ;
  3. `restore.sh staging` réussit.

  La durée totale est consignée. Cet exercice prouve qu'un VPS compromis ne fait pas perdre
  l'historique.
- Le test mensuel sur un serveur vierge est reporté après le pilote (décision Q15).

### NFR-14 — Alertes sur le téléphone

- Un échec ou une absence de sauvegarde, une sonde `/health` en panne et un certificat proche
  de l'expiration arrivent sur le téléphone, par le canal choisi (décision 2), en plus de
  l'e-mail.
- **Quand** l'occupation du disque du VPS dépasse le seuil (décision 3), **alors** une alerte
  part. Un contrôle planifié envoie son état à une sonde « Push » d'Uptime Kuma, et un contrôle
  qui ne répond plus alerte aussi.
- Hors périmètre, prévus au lot 40 : une sonde externe au VPS, la surveillance de la file de
  tâches, le suivi des erreurs.

### NFR-30 — Volume des sauvegardes

- Le dimanche, la taille du dépôt (`restic stats --mode raw-data`) est inscrite au journal de
  la sauvegarde. Un mois après la mise en service, le runbook consigne la comparaison avec le
  volume des données : moins de deux fois attendu.

### NFR-31 et ARC-11 — Fichiers sur le VPS pendant le pilote

- L'ADR 0051 assume que Garage reste sur le disque du VPS pendant le pilote (décision Q14 b).
  Ses données entrent dans chaque sauvegarde distante. La bascule vers un stockage d'objets
  externe est prévue au palier 2.

## Technique

- **Accès au dépôt distant** : restic, avec son interface SFTP, sur le port 23 de la Storage
  Box. Une configuration SSH propre à chaque environnement, sous
  `/etc/symbola/backup/<env>.ssh/`, contient l'hôte, le port, le sous-compte, la clé, le fichier
  des empreintes connues et `StrictHostKeyChecking yes`. Le dépôt se nomme alors
  `sftp:symbola-<env>:restic`.
- **Image restic** : elle doit contenir un client SSH. C'est à vérifier au premier essai ; sinon
  on passe la commande SSH à restic (`-o sftp.command=…`).
- **Fichiers modifiés** : `infra/backup/lib.sh`, `backup.sh`, `restore.sh` et
  `backup.env.example`.
- **Nouveaux scripts** :
  - `infra/backup/check-snapshot-protection.sh <env>`, le contrôle de NFR-13 ;
  - `infra/monitoring/disk-check.sh` avec son timer systemd, pour le disque (NFR-14).
- **Tests** : `tools/deployment-config/backup.test.mjs`, avec des doublures de `docker`, `ssh`,
  `sftp` et `curl`, sans réseau, et un nouveau test pour le contrôle du disque. La CI passe aussi
  shellcheck sur `infra/monitoring/*.sh`.
- **Runbooks** :
  - `docs/runbooks/restauration.md` : mise en place Hetzner, sous-comptes, clés et empreintes,
    contrôle des copies, exercice « dépôt effacé », relevés ;
  - `docs/runbooks/surveillance.md` : canal du téléphone, sonde du disque.
- Aucune migration de base, aucun changement de l'application.

## Tests

`tools/deployment-config/backup.test.mjs` portera des `describe` aux identifiants NFR-10, NFR-13
et NFR-14. Ils couvriront : dépôt distant et montages en lecture seule, échec de connexion ou
d'empreinte, rétention 7/4/12, contrôle quotidien, protection des copies (doublure de `sftp`),
contrôle du disque. Les essais réels sur le VPS sont consignés dans les relevés des runbooks.

## Hors périmètre

- Déplacer les fichiers de Garage hors du VPS (palier 2).
- La note TLS et le chiffrement au repos du disque du VPS (SEC-18, lot 40).
- La sonde externe et le suivi des erreurs (lot 40).

## Définition de « terminé »

Celle du nouveau document (décision Q23) :

- les critères ci-dessus sont couverts par des tests automatisés ;
- la chaîne de contrôle est verte ;
- les essais réels sont consignés : première sauvegarde distante, contrôle des copies, exercice
  « dépôt effacé », restauration chronométrée ;
- les runbooks sont à jour.

Ce lot ne touche aucun parcours d'utilisateur : il n'y a pas de scénario Synthetic User à
rejouer.
