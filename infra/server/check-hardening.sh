#!/usr/bin/env bash
# Vérification du durcissement du VPS (SOC-12), après exécution de
# docs/runbooks/durcissement-serveur.md. Lecture seule : ce script ne
# modifie rien sur le serveur. À lancer par Julien, sur le VPS :
#
#   sudo bash infra/server/check-hardening.sh
#
# Sortie : une ligne OK / ÉCHEC / ATTENTION par contrôle ; code de retour
# 1 s'il y a au moins un ÉCHEC.
set -euo pipefail

failures=0
warnings=0

ok() { printf '  OK         %s\n' "$1"; }
fail() { printf '  ÉCHEC      %s\n' "$1"; failures=$((failures + 1)); }
warn() { printf '  ATTENTION  %s\n' "$1"; warnings=$((warnings + 1)); }
check() { # check <libellé> <commande…> : OK si la commande réussit
  local label=$1
  shift
  if "$@" >/dev/null 2>&1; then ok "$label"; else fail "$label"; fi
}
has() { command -v "$1" >/dev/null 2>&1; }
root_locked() { [[ $(passwd -S root | awk '{print $2}') == L ]]; }
clock_synced() { [[ $(timedatectl show -p NTPSynchronized --value) == yes ]]; }
live_restore() { [[ $(docker info --format '{{.LiveRestoreEnabled}}') == true ]]; }

if [[ ${EUID} -ne 0 ]]; then
  echo "À lancer avec sudo (lecture de la configuration SSH, du pare-feu et de CrowdSec)." >&2
  exit 2
fi

echo "SSH"
sshd_config=$(sshd -T 2>/dev/null || true)
sshd_has() { grep -qx "$1" <<<"${sshd_config}"; }
check "connexion par mot de passe refusée (passwordauthentication no)" sshd_has "passwordauthentication no"
check "clavier interactif refusé (kbdinteractiveauthentication no)" sshd_has "kbdinteractiveauthentication no"
check "root interdit en SSH (permitrootlogin no)" sshd_has "permitrootlogin no"
check "authentification par clé active (pubkeyauthentication yes)" sshd_has "pubkeyauthentication yes"
if sshd_has "allowtcpforwarding no"; then
  warn "tunnels SSH désactivés : la console Uptime Kuma et les migrations par tunnel ne fonctionneront pas"
fi
check "mot de passe root verrouillé" root_locked

echo "Pare-feu (UFW)"
if has ufw; then
  ufw_status=$(ufw status verbose)
  check "UFW actif" grep -q "^Status: active" <<<"${ufw_status}"
  check "entrées refusées par défaut" grep -q "deny (incoming)" <<<"${ufw_status}"
  check "80/tcp ouvert" grep -Eq "^80/tcp +ALLOW" <<<"${ufw_status}"
  check "443/tcp ouvert" grep -Eq "^443/tcp +ALLOW" <<<"${ufw_status}"
  if grep -Eq "^22/tcp +ALLOW IN +Anywhere" <<<"${ufw_status}"; then
    fail "SSH ouvert à tous sans limitation (règle LIMIT ou IP source attendue, voir le runbook)"
  elif grep -Eq "^22(/tcp)? +(LIMIT|ALLOW)" <<<"${ufw_status}"; then
    ok "SSH restreint (limitation ou IP source)"
  else
    warn "aucune règle SSH visible sur le port 22 : vérifier que l'accès SSH est bien prévu"
  fi
  unexpected=$(grep -E "^[0-9]+(:[0-9]+)?(/(tcp|udp))? +(ALLOW|LIMIT)" <<<"${ufw_status}" | grep -Ev "^(22|80|443)(/tcp)? " || true)
  if [[ -z ${unexpected} ]]; then ok "aucun autre port autorisé"; else fail "ports autorisés en trop : $(tr '\n' ' ' <<<"${unexpected}")"; fi
else
  fail "UFW non installé"
fi

echo "CrowdSec"
check "service crowdsec actif" systemctl is-active --quiet crowdsec
check "service crowdsec-firewall-bouncer actif" systemctl is-active --quiet crowdsec-firewall-bouncer
bouncer_config=/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml
if [[ -r ${bouncer_config} ]] && grep -q "DOCKER-USER" "${bouncer_config}"; then
  ok "bannissements appliqués aussi aux conteneurs (DOCKER-USER)"
else
  fail "chaîne DOCKER-USER absente de ${bouncer_config} : une IP bannie atteint encore Traefik"
fi

echo "Mises à jour automatiques"
check "paquet unattended-upgrades installé" dpkg -s unattended-upgrades
auto_upgrades=$(apt-config dump 2>/dev/null || true)
check "APT::Periodic::Unattended-Upgrade activé" grep -Eq '^APT::Periodic::Unattended-Upgrade "1";' <<<"${auto_upgrades}"
check "minuteur apt-daily-upgrade actif" systemctl is-active --quiet apt-daily-upgrade.timer
if [[ -f /var/run/reboot-required ]]; then
  warn "un redémarrage est en attente (correctif noyau)"
else
  ok "aucun redémarrage en attente"
fi

echo "Horloge"
check "horloge synchronisée (TOTP, certificats)" clock_synced

echo "Docker"
if has docker; then
  ok "Docker $(docker info --format '{{.ServerVersion}}' 2>/dev/null || echo '?') installé"
  check "live-restore actif" live_restore
  # Serveur partagé avec d'autres projets : no-new-privileges est fixé service par
  # service dans les composes Symbola, pas imposé à tout le démon (runbook).
  if grep -q '"no-new-privileges": *true' /etc/docker/daemon.json 2>/dev/null; then
    ok "no-new-privileges par défaut (daemon.json)"
  else
    warn "no-new-privileges non imposé par le démon : vérifier qu'il est fixé dans chaque compose Symbola"
  fi
  if dpkg -s docker.io >/dev/null 2>&1; then
    fail "paquet docker.io d'Ubuntu installé : utiliser docker-ce du dépôt officiel"
  else
    ok "Docker issu du dépôt officiel (pas docker.io)"
  fi
  # Docker contourne UFW : seuls 80 et 443 peuvent être publiés hors boucle locale.
  public_docker_ports=$(docker ps --format '{{.Names}} {{.Ports}}' | tr ',' '\n' \
    | grep -E '(0\.0\.0\.0|\[::\]|:::):[0-9]+->' | grep -Ev '(0\.0\.0\.0|\[::\]|:::):(80|443)->' || true)
  if [[ -z ${public_docker_ports} ]]; then
    ok "aucun conteneur ne publie de port public hors 80/443"
  else
    fail "ports Docker publics en trop : $(tr '\n' ' ' <<<"${public_docker_ports}")"
  fi
  # root a déjà tous les droits : seuls les autres membres élargissent l'accès.
  docker_members=$(getent group docker | cut -d: -f4 | tr ',' '\n' | grep -vx root | paste -sd, - || true)
  if [[ -n ${docker_members} ]]; then warn "membres du groupe docker (équivaut à root) : ${docker_members}"; else ok "aucun membre du groupe docker hors root"; fi
else
  fail "Docker non installé"
fi

echo "Ports en écoute sur l'hôte"
# Tout ce qui écoute hors boucle locale doit être SSH ou un port publié
# par Traefik (80/443). Le résolveur systemd (127.0.0.53%lo:53) est local :
# ss peut suffixer l'adresse par l'interface (%lo).
public_listeners=$(ss -Htln 2>/dev/null | awk '{print $4}' \
  | grep -Ev '^(127\.[0-9.]+|\[::1\]|\[::ffff:127\.[0-9.]+\])(%[[:alnum:]]+)?:[0-9]+$' \
  | grep -Ev ':(22|80|443)$' || true)
if ! has ss; then
  fail "commande ss absente (paquet iproute2) : ports en écoute non vérifiés"
elif [[ -z ${public_listeners} ]]; then
  ok "seuls 22, 80 et 443 écoutent hors boucle locale"
else
  fail "ports en écoute hors boucle locale : $(tr '\n' ' ' <<<"${public_listeners}")"
fi

echo
echo "Résultat : ${failures} échec(s), ${warnings} avertissement(s)."
[[ ${failures} -eq 0 ]]
