# Runbook — Surveillance (SOC-11, lot 22)

Uptime Kuma surveille l'app et le socle de **staging** et de **production**
et alerte par e-mail et sur le téléphone (application ntfy, lot 22, NFR-14). Il tourne
dans le socle partagé
(`infra/compose/docker-compose.socle.yml`), une seule instance pour tout
le VPS.

**Rappel** : Claude Code prépare, Julien exécute toute commande sur le VPS.

## Ce qui est surveillé

Chaque environnement expose `GET /health` (sans session) :

```json
{ "status": "ok", "version": "<sha du commit>", "checks": { "database": "ok", "storage": "ok", "antivirus": "ok" } }
```

- `status` vaut `ok` (HTTP 200) si PostgreSQL, Garage et ClamAV répondent
  en moins de 2 s, sinon `degraded` (HTTP 503). La réponse ne contient
  jamais de détail d'erreur ni de donnée métier.
- `version` est le SHA du commit gravé dans l'image par la CI : il permet
  de vérifier quelle version tourne après un déploiement ou un retour
  arrière.

Interroger `/health` par l'URL publique teste toute la chaîne : DNS
(Ionos), Traefik, certificat Let's Encrypt, app, base, stockage,
antivirus. Un seul moniteur par environnement couvre donc l'app et le
socle.

## Démarrage

Uptime Kuma démarre avec le socle :

```bash
sudo docker compose -f infra/compose/docker-compose.socle.yml \
  --env-file infra/compose/.env.socle -p symbola-socle up -d
```

La console n'est publiée que sur `127.0.0.1:3001` du VPS. Pour l'ouvrir
depuis ton poste :

```bash
ssh -N -L 3001:127.0.0.1:3001 <utilisateur>@<vps>
```

puis `http://localhost:3001` dans le navigateur.

## Première configuration (une fois)

1. **Créer le compte administrateur dès le premier accès** (le premier
   visiteur le crée) : mot de passe long généré, puis activer la double
   authentification dans *Paramètres → Sécurité*.
2. **Notification e-mail** (*Paramètres → Notifications → SMTP*) :
   serveur SMTP de la boîte qui enverra les alertes, destinataire = ton
   adresse. Tant que le service d'e-mail transactionnel n'est pas choisi
   (question ouverte du PRD), une boîte e-mail Ionos du domaine
   `symbola.fr` convient. Cocher « Activer par défaut » puis envoyer un
   e-mail de test.
3. **Moniteurs** (*Ajouter une nouvelle sonde*), un par environnement :

   | Champ | Production | Staging |
   | --- | --- | --- |
   | Type | HTTP(s) – Mot-clé | HTTP(s) – Mot-clé |
   | URL | `https://<APP_DOMAIN de .env.production>/health` | `https://<APP_DOMAIN de .env.staging>/health` |
   | Mot-clé | `"status":"ok"` | `"status":"ok"` |
   | Intervalle | 60 s | 300 s |
   | Tentatives avant alerte | 2 | 2 |
   | Notification expiration certificat | activée (14 jours) | activée (14 jours) |

4. **Sauvegarde nocturne** (lien avec SOC-10) : une sonde de type *Push*
   par environnement (« Sauvegarde restic — production », « — staging »),
   intervalle 26 h. Le script de sauvegarde appelle l'URL Push en fin de
   sauvegarde réussie : une nuit sans sauvegarde déclenche une alerte.
   Mise en place : `docs/runbooks/restauration.md`, § 6.

   **URL Push** (vaut pour chaque sonde *Push*) : Kuma l'affiche sous la forme
   `http://localhost:3001/api/push/<jeton>?status=up&msg=OK&ping=`. Ne garder que la partie
   avant le `?`, avec `127.0.0.1:3001` (Kuma vu depuis le VPS) :
   `http://127.0.0.1:3001/api/push/<jeton>`. Les scripts ajoutent eux-mêmes `status` et `msg`,
   et ignorent une partie `?…` restée par erreur (lot 25). Le jeton est un secret.
5. **Alertes sur le téléphone avec ntfy** (lot 22, NFR-14, décision de Julien du 11/11/2026) :
   1. Installer l'application **ntfy** sur le téléphone (iOS ou Android). Aucun compte n'est
      nécessaire.
   2. Choisir un **nom de sujet long et aléatoire** (par exemple la sortie de
      `openssl rand -hex 16` précédée de `symbola-`) et le ranger dans le gestionnaire de
      mots de passe : quiconque le connaît peut lire les alertes ou en envoyer de fausses.
   3. Dans l'application : *S'abonner à un sujet*, serveur `https://ntfy.sh`, ce nom de sujet.
   4. Dans Uptime Kuma, *Paramètres → Notifications → Configurer une notification* : type
      « ntfy », serveur `https://ntfy.sh`, le sujet, priorité haute. Cocher « Activer par
      défaut » et « Appliquer à toutes les sondes existantes », puis envoyer une notification
      de test : elle doit arriver sur le téléphone.

   Les alertes ne contiennent aucune donnée personnelle (« Sauvegarde restic — production :
   DOWN », « Disque / à 85 % ») ; elles transitent par le relais public ntfy.sh. L'e-mail reste
   actif en plus.
6. **Disque du VPS** (lot 22, NFR-14) : une sonde de type *Push* « Disque du VPS »,
   intervalle 1 800 s (30 min). Le contrôle `infra/monitoring/disk-check.sh` tourne toutes les
   15 minutes : il signale « up » sous le seuil et « down » à partir du seuil (80 %, décision de
   Julien) ; s'il ne tourne plus, la sonde reste muette et alerte aussi. Mise en place :
   ```bash
   install -d -m 700 /etc/symbola/monitoring
   install -m 600 /dev/null /etc/symbola/monitoring/disk.env
   nano /etc/symbola/monitoring/disk.env
   #   DISK_PUSH_URL=http://127.0.0.1:3001/api/push/<jeton>   (secret, sans « ?… »)
   #   DISK_THRESHOLD_PERCENT=80
   #   DISK_PATHS="/"
   cp /opt/symbola/infra/monitoring/systemd/symbola-disk-check.service \
      /opt/symbola/infra/monitoring/systemd/symbola-disk-check.timer /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now symbola-disk-check.timer
   systemctl start symbola-disk-check.service
   journalctl -u symbola-disk-check.service -n 5 --no-pager   # « Disque / à … % (seuil 80 %) : up »
   ```
   Si les données Docker sont sur une autre partition (`df -h /var/lib/docker`), l'ajouter à
   `DISK_PATHS`.
7. **Chaîne des factures et encaissements** (lot 23b, FAC-14, ADR 0061) : une sonde de type
   *Push* « Chaîne des pièces (production) », intervalle 90 000 s (25 h). L'app vérifie chaque
   nuit la chaîne de chaque organisation : « up » si elle est intacte, « down » à la première
   anomalie (qui va aussi au journal de l'organisation) ; si le contrôle ne tourne plus, la sonde
   reste muette et alerte aussi. Mettre l'URL Push (secret, sans « ?… ») dans
   `LEDGER_CHECK_PUSH_URL` du fichier d'environnement (`infra/compose/.env.production`), puis
   redémarrer l'app. Vide : pas d'alerte externe. Une anomalie veut dire qu'une facture, un avoir
   ou un encaissement a été modifié **hors de Symbola** : ne rien corriger, prévenir Julien, comparer
   avec la dernière sauvegarde (`docs/runbooks/restauration.md`), en passant par un accès tracé
   (`docs/runbooks/acces-exploitation.md`).

## Vérification

- [ ] `curl -s https://<domaine>/health` renvoie `"status":"ok"` et le SHA attendu, pour chaque environnement.
- [ ] Le port 3001 n'est pas joignable depuis Internet : `nc -vz <ip-du-vps> 3001` échoue depuis ton poste.
- [ ] Arrêter ClamAV de staging (`sudo docker compose ... -p symbola-staging stop clamav`) : `/health` passe en 503 et l'alerte e-mail arrive après deux tentatives. Relancer ClamAV, l'alerte de rétablissement arrive.
- [ ] Les données d'Uptime Kuma (volume `uptime_kuma_data`) sont incluses dans la sauvegarde (SOC-10).
- [ ] La notification de test ntfy arrive sur le téléphone (lot 22).
- [ ] Le temps d'un essai, `DISK_THRESHOLD_PERCENT=1` dans `/etc/symbola/monitoring/disk.env`,
      puis `systemctl start symbola-disk-check.service` : l'alerte « Disque du VPS » arrive sur le
      téléphone. Remettre 80 et relancer : l'alerte de rétablissement arrive (lot 22).
