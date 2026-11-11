#!/usr/bin/env bash
# Lot 22 (NFR-14, ADR 0051) — occupation du disque du VPS signalée à une sonde « Push »
# d'Uptime Kuma : « up » sous le seuil, « down » à partir du seuil (alerte par e-mail et
# sur le téléphone). Si ce contrôle ne tourne plus, la sonde reste muette et alerte aussi.
#
# Usage (sur le VPS, root, lancé par le timer systemd symbola-disk-check) :
#   infra/monitoring/disk-check.sh
# Configuration : /etc/symbola/monitoring/disk.env (root:root, 0600, jamais dans le dépôt) :
#   DISK_PUSH_URL=<URL push de la sonde « Disque du VPS », sans « ?… »>   (secret)
#   DISK_THRESHOLD_PERCENT=80                               (facultatif, 80 par défaut)
#   DISK_PATHS="/"                                          (facultatif, chemins surveillés)
# Le message ne contient que le chemin et des pourcentages : aucune donnée personnelle.
set -euo pipefail

die() {
  echo "ERREUR : $*" >&2
  exit 1
}

config="${MONITORING_CONFIG_DIR:-/etc/symbola/monitoring}/disk.env"
[ -r "$config" ] || die "configuration absente : $config (voir docs/runbooks/surveillance.md)"
# shellcheck source=/dev/null
. "$config"

[ -n "${DISK_PUSH_URL:-}" ] || die "DISK_PUSH_URL manquant dans $config"
# Lot 25 : seule la partie avant un « ? » sert. Une URL collée telle que Kuma l'affiche
# (« …?status=up&msg=OK&ping= ») ferait sinon arriver une alerte comme « up ».
push_url=${DISK_PUSH_URL%%\?*}
threshold=${DISK_THRESHOLD_PERCENT:-80}
if ! [[ $threshold =~ ^[0-9]+$ ]] || [ "$threshold" -lt 1 ] || [ "$threshold" -gt 100 ]; then
  die "DISK_THRESHOLD_PERCENT invalide dans $config : $threshold (entier de 1 à 100 attendu)"
fi

worst=-1
worst_path=""
for path in ${DISK_PATHS:-/}; do
  use=$(df -P "$path" | awk 'NR == 2 { sub(/%$/, "", $5); print $5 }') || use=""
  [[ $use =~ ^[0-9]+$ ]] || die "occupation illisible pour $path"
  if [ "$use" -gt "$worst" ]; then
    worst=$use
    worst_path=$path
  fi
done

status=up
[ "$worst" -lt "$threshold" ] || status=down
message="Disque $worst_path à $worst % (seuil $threshold %)"
curl -fsS --retry 3 --retry-delay 10 -o /dev/null -G \
  --data-urlencode "status=$status" --data-urlencode "msg=$message" "$push_url"
echo "$message : $status"
