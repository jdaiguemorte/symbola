# Runbook — Durcissement du serveur (SOC-12)

Ce runbook durcit le VPS Contabo unique qui héberge staging et production
(lot 0). Il se déroule **une fois**, avant le premier déploiement
(`docs/runbooks/deploiement.md`), puis la checklist finale se rejoue
après chaque intervention importante sur le serveur.

**Rappel impératif** : Claude Code prépare ce runbook, **Julien exécute**
chaque commande. Aucune commande n'est lancée automatiquement sur le
serveur.

Hypothèse : image **Ubuntu 24.04 LTS** proposée par Contabo. Vérifier
avec `lsb_release -a`. Pour une autre distribution, s'arrêter et adapter
les commandes avant de continuer.

## Serveur partagé : ce qu'il faut savoir (constaté le 2026-10-26)

Le VPS n'est pas dédié à Symbola. Il héberge déjà d'autres projets
Docker : `kindo` (`/root/kindo`), `petites-voitures` (`/opt/petites-voitures`,
dont le Caddy occupe les ports 80/443) et `wedding-stack`
(`/opt/wedding-stack`). Conséquences pour ce runbook :

- Aucune commande ne doit arrêter tous les conteneurs : la configuration du
  démon Docker se **recharge** (`systemctl reload docker`), elle ne se
  redémarre pas tant que `live-restore` n'est pas actif (étape 6).
- `no-new-privileges` n'est **pas** imposé à tout le démon : il
  s'appliquerait aussi aux conteneurs des autres projets, dont certaines
  images peuvent en avoir besoin. Les composes Symbola le fixent service par
  service.
- L'API locale de CrowdSec ne peut pas utiliser son port par défaut 8080,
  déjà pris (étape 4).
- Les ports publiés par les autres projets doivent être limités à
  `127.0.0.1` (Docker contourne UFW, étape 3). Pour `wedding-stack`, c'est
  fait (préfixe `127.0.0.1:` sur chaque port de `docker-compose.yml`) ; on y
  accède par tunnel SSH.
- Qui reçoit les ports 80/443 (le Caddy existant ou le Traefik de Symbola)
  est une décision à prendre avant le premier déploiement de Symbola
  (`docs/runbooks/deploiement.md`), par un ADR.

## Avant de commencer : ne pas se fermer la porte

- Garder **une session SSH root ouverte** pendant toutes les étapes 1 à 3.
  Tester chaque changement SSH ou pare-feu depuis un **second**
  terminal, jamais en fermant le premier.
- Repérer l'accès de secours : console **VNC** du panneau Contabo
  (*Your services → VPS → Manage → VNC*). Elle fonctionne même si SSH ou
  le pare-feu sont mal configurés.
- Noter ton adresse IP publique (`curl -s https://ifconfig.me` depuis ton
  poste) et vérifier si elle est fixe : la restriction SSH de l'étape 3
  en dépend.

Dans la suite, `<vps>` est l'IP du VPS et `julien` l'utilisateur
d'administration. Les commandes sont à lancer **sur le VPS**, sauf
mention « sur ton poste ».

## 1. Utilisateur d'administration et clé SSH

Sur ton poste, si tu n'as pas encore de clé dédiée :

```bash
ssh-keygen -t ed25519 -C "julien@symbola-vps" -f ~/.ssh/symbola_vps
```

Protège-la par une phrase de passe. Sur le VPS (session root) :

```bash
adduser julien                      # mot de passe long, utile seulement pour sudo
usermod -aG sudo julien
install -d -m 700 -o julien -g julien /home/julien/.ssh
```

Sur ton poste :

```bash
ssh-copy-id -i ~/.ssh/symbola_vps.pub julien@<vps>
ssh -i ~/.ssh/symbola_vps julien@<vps> 'sudo -v && echo OK'   # doit afficher OK
```

Ne passe à l'étape 2 qu'après ce `OK`.

## 2. SSH : clé uniquement, root désactivé

Les réglages vont dans un fichier dédié, qui survit aux mises à jour du
paquet. Le préfixe `00-` le fait lire avant `50-cloud-init.conf`, que
Contabo peut fournir avec `PasswordAuthentication yes` : pour sshd, la
première valeur lue l'emporte.

```bash
sudo tee /etc/ssh/sshd_config.d/00-symbola.conf >/dev/null <<'CONF'
# Durcissement SOC-12 — docs/runbooks/durcissement-serveur.md
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
AllowUsers julien
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
# Les tunnels -L (console Uptime Kuma, PostgreSQL pour les migrations)
# restent possibles ; les tunnels inverses -R sont refusés.
AllowTcpForwarding local
CONF
sudo sshd -t && sudo systemctl reload ssh
```

Depuis un **second** terminal sur ton poste :

```bash
ssh -i ~/.ssh/symbola_vps julien@<vps> 'echo clé OK'                    # doit marcher
ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password julien@<vps>  # doit être refusé
ssh root@<vps>                                                           # doit être refusé
```

Si tout est conforme, verrouille aussi le mot de passe root (l'accès
root passe désormais par `sudo`) :

```bash
sudo passwd -l root
```

## 3. Pare-feu : 80/443 publics, SSH restreint

```bash
sudo apt-get update && sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

SSH, selon ton IP :

- **IP fixe** (recommandé) : `sudo ufw allow from <ton-ip> to any port 22 proto tcp`
- **IP variable** : `sudo ufw limit 22/tcp` (refuse une IP qui fait plus
  de 6 connexions en 30 s). CrowdSec (étape 4) bannit en plus les
  attaquants connus. La clé reste la vraie protection.

Puis :

```bash
sudo ufw enable
sudo ufw status verbose
```

Ouvre une nouvelle connexion SSH depuis un second terminal **avant** de
fermer la session de secours.

### Docker contourne UFW

Docker écrit ses propres règles iptables, évaluées **avant** celles
d'UFW. Un port publié par un conteneur (`ports: "5432:5432"`) est donc
joignable depuis Internet **même si UFW le refuse**. Deux protections :

1. **Règle du dépôt, vérifiée par un test** (`tools/deployment-config`) :
   seul Traefik publie des ports sur toutes les interfaces (80 et 443).
   Tout autre port est publié sur `127.0.0.1` uniquement (PostgreSQL pour
   les migrations, console Uptime Kuma), et on y accède par tunnel SSH.
2. **Bannissement CrowdSec appliqué aussi aux conteneurs** : le bouncer
   ajoute ses règles dans la chaîne `DOCKER-USER`, que Docker évalue
   avant de router vers un conteneur (étape 4).

## 4. CrowdSec et bouncer pare-feu

```bash
curl -s https://install.crowdsec.net | sudo sh       # ajoute le dépôt officiel CrowdSec
sudo apt-get install -y crowdsec crowdsec-firewall-bouncer-iptables
sudo cscli collections install crowdsecurity/linux crowdsecurity/sshd
```

Le bouncer protège par défaut la chaîne `INPUT` (l'hôte, donc SSH). Pour
qu'une IP bannie n'atteigne plus non plus Traefik (conteneur), ajoute la
chaîne `DOCKER-USER` dans `/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml` :

```yaml
iptables_chains:
  - INPUT
  - DOCKER-USER
```

Puis :

```bash
sudo systemctl restart crowdsec crowdsec-firewall-bouncer
sudo cscli bouncers list          # le bouncer doit apparaître, « valid »
sudo cscli metrics                # les journaux SSH doivent être lus
```

La collection `crowdsecurity/linux` lit `journald` et repère les
attaques par force brute SSH. Analyser aussi les journaux d'accès de
Traefik (collection `crowdsecurity/traefik`) est une amélioration à
prévoir après le premier déploiement. Ce n'est pas un critère du lot 0.

**Port 8080 déjà utilisé** : si l'installation affiche « *Not attempting to
start crowdsec, port 8080 is already used* » (cas de ce VPS, pris par un
autre conteneur), déplacer l'API locale sur un port libre, puis démarrer :

```bash
ss -tlnH | grep -E ':(8080|8081)\b'      # 8081 doit être libre
sudo sed -i.orig 's#127\.0\.0\.1:8080#127.0.0.1:8081#' /etc/crowdsec/config.yaml \
  /etc/crowdsec/local_api_credentials.yaml /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml
sudo systemctl enable --now crowdsec
sudo systemctl restart crowdsec-firewall-bouncer
```

L'inscription à la console en ligne CrowdSec (`cscli console enroll`) est
facultative et non nécessaire.

## 5. Mises à jour de sécurité automatiques

```bash
sudo apt-get install -y unattended-upgrades
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
sudo tee /etc/apt/apt.conf.d/52symbola-unattended >/dev/null <<'CONF'
// Redémarrage automatique si un correctif noyau l'exige, hors des heures
// d'usage et après la sauvegarde nocturne (SOC-10). Les conteneurs
// repartent seuls (restart: unless-stopped).
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "05:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
CONF
sudo unattended-upgrade --dry-run --debug 2>&1 | tail -5   # aucune erreur attendue
```

Seule l'origine `-security` d'Ubuntu est mise à jour automatiquement
(réglage par défaut de `50unattended-upgrades`). Docker **n'en fait pas
partie**, car une mise à jour du démon se surveille (étape 7).

Vérifie aussi l'horloge : la double authentification (TOTP, SOC-04) et
les certificats en dépendent.

```bash
timedatectl          # « System clock synchronized: yes »
```

## 6. Docker depuis le dépôt officiel

Pas le paquet `docker.io` d'Ubuntu, souvent en retard sur les correctifs.
Si `dpkg -l | grep docker-ce` montre déjà `docker-ce` du dépôt officiel (cas
de ce VPS), passer directement à la configuration du démon :

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Configuration du démon :

```bash
sudo tee /etc/docker/daemon.json >/dev/null <<'CONF'
{
  "live-restore": true,
  "log-driver": "local",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
CONF
sudo dockerd --validate --config-file /etc/docker/daemon.json
sudo systemctl reload docker      # applique live-restore sans arrêter les conteneurs
sudo docker info --format '{{.ServerVersion}} live-restore={{.LiveRestoreEnabled}}'
```

Ne pas écraser un `daemon.json` existant sans l'avoir lu (`ls -l
/etc/docker/daemon.json`). Une fois `live-restore` actif, un
`systemctl restart docker` (demandé par exemple après une mise à jour de
bibliothèque) ne coupe plus les conteneurs.

- `live-restore` : les conteneurs continuent de tourner pendant une mise
  à jour ou un redémarrage du démon Docker.
- `no-new-privileges` : pas au niveau du démon sur ce serveur partagé
  (voir « Serveur partagé ») ; chaque service Symbola le fixe dans son compose.
- Journaux rotatifs : un conteneur bavard ne remplit pas le disque.

**Ne pas ajouter `julien` au groupe `docker`** : ce groupe équivaut à
root. Utiliser `sudo docker …`.

## 7. Mettre Docker à jour

Chaque mois, et sous 48 h quand un avis de sécurité Docker est publié
(<https://docs.docker.com/security/>) :

```bash
sudo apt-get update
apt list --upgradable 2>/dev/null | grep -E 'docker|containerd'
sudo apt-get install -y --only-upgrade docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker info --format '{{.ServerVersion}}'
sudo docker ps --format 'table {{.Names}}\t{{.Status}}'   # tous « Up », grâce à live-restore
```

Puis rejouer la checklist ci-dessous et vérifier `/health` de chaque
environnement (`docs/runbooks/surveillance.md`).

Les images (PostgreSQL, Garage, ClamAV, Traefik, Uptime Kuma) ont des
versions figées dans les composes et sont mises à jour par Renovate
(SOC-02), via une pull request puis un déploiement normal.

## Checklist de vérification

Après exécution, lancer le script de vérification en lecture seule depuis
le dépôt cloné sur le VPS. Il ne modifie rien :

```bash
sudo bash infra/server/check-hardening.sh
```

Chaque ligne affiche `OK`, `ÉCHEC` ou `ATTENTION`. Le script sort en
erreur s'il y a au moins un `ÉCHEC`. Puis cocher :

- [ ] Le script affiche `0 échec(s)`.
- [ ] Depuis ton poste : `ssh root@<vps>` est refusé.
- [ ] Depuis ton poste : une connexion par mot de passe est refusée (`ssh -o PubkeyAuthentication=no julien@<vps>`).
- [ ] Depuis ton poste : seuls 22 (si autorisé pour ton IP), 80 et 443 répondent. `nc -vz -w 3 <vps> 5432`, `nc -vz -w 3 <vps> 3001` et `nc -vz -w 3 <vps> 3900` échouent.
- [ ] `http://<domaine>` redirige vers `https://` (après le premier déploiement).
- [ ] Bannissement de test : `sudo cscli decisions add --ip 192.0.2.1 --duration 2m`, puis `sudo ipset test crowdsec-blacklists-0 192.0.2.1` le trouve (nom de l'ensemble : `sudo ipset list -n`) et `sudo iptables -L DOCKER-USER -n` contient un renvoi vers `CROWDSEC_CHAIN`. Ensuite `sudo cscli decisions delete --ip 192.0.2.1`.
- [ ] `sudo unattended-upgrade --dry-run` ne signale aucune erreur.
- [ ] `timedatectl` indique une horloge synchronisée.
- [ ] La date d'exécution et la version de Docker sont notées dans le journal d'exploitation ci-dessous.

## Journal d'exploitation

| Date | Action | Version Docker | Par |
| --- | --- | --- | --- |
| | Durcissement initial | | Julien |
