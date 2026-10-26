#!/usr/bin/env bash
# Sauvegarde nocturne d'un environnement (SOC-10) : PostgreSQL (dump) et Garage, plus
# Uptime Kuma pour la production, dans un dépôt restic chiffré propre à l'environnement.
#
# Usage (sur le VPS, root, lancé par le timer systemd symbola-backup@<env>) :
#   infra/backup/backup.sh staging|production
#
# Étapes : dump PostgreSQL vérifié → arrêt bref de Garage (fichiers cohérents) →
# instantané restic unique → redémarrage → rétention → contrôle hebdomadaire du dépôt →
# signal « push » à Uptime Kuma, envoyé seulement si tout a réussi.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
. "$here/lib.sh"

load_config "${1:-}"
take_lock

restic_run cat config >/dev/null 2>&1 ||
  die "dépôt restic non initialisé ou mot de passe incorrect : $RESTIC_REPOSITORY (voir docs/runbooks/restauration.md, § 2)"

install -d -m 700 "$WORK_DIR"
dump="$WORK_DIR/postgres.dump"
stopped=()

restart_stopped() {
  local item
  for item in "${stopped[@]}"; do
    "${item%%:*}_compose" start "${item#*:}" || log "ÉCHEC du redémarrage de ${item#*:} : à relancer à la main"
  done
  stopped=()
}

stop_service() { # stop_service <env|socle> <service>
  "$1_compose" stop "$2"
  stopped+=("$1:$2")
}

cleanup() {
  restart_stopped
  rm -f "$dump"
}
trap cleanup EXIT

log "$ENVIRONMENT_NAME : dump PostgreSQL"
# Les variables sont celles du conteneur postgres : aucun identifiant ne transite par ce script.
# shellcheck disable=SC2016
env_compose exec -T postgres sh -c 'pg_dump --format=custom --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' >"$dump"
[ -s "$dump" ] || die "dump PostgreSQL vide"
env_compose exec -T postgres pg_restore --list <"$dump" >/dev/null || die "dump PostgreSQL illisible par pg_restore"

RESTIC_MOUNTS=(-v "$WORK_DIR:/backup/postgres:ro" -v "$GARAGE_VOLUME:/backup/garage:ro")
if [ "${INCLUDE_MONITORING:-false}" = true ]; then
  RESTIC_MOUNTS+=(-v "symbola-socle_uptime_kuma_data:/backup/uptime-kuma:ro")
  stop_service socle uptime-kuma
fi

log "$ENVIRONMENT_NAME : arrêt de Garage le temps de la copie"
stop_service env garage
restic_run backup --tag "env:$ENVIRONMENT_NAME" --tag nightly /backup
restart_stopped
RESTIC_MOUNTS=()

log "$ENVIRONMENT_NAME : rétention"
restic_run forget --tag "env:$ENVIRONMENT_NAME" \
  --keep-daily "${KEEP_DAILY:-7}" --keep-weekly "${KEEP_WEEKLY:-4}" --keep-monthly "${KEEP_MONTHLY:-6}" \
  --prune

if [ "$(date +%u)" = "${CHECK_WEEKDAY:-7}" ]; then
  log "$ENVIRONMENT_NAME : contrôle d'intégrité du dépôt (${CHECK_SUBSET:-10%} des données relues)"
  restic_run check --read-data-subset="${CHECK_SUBSET:-10%}"
fi

if [ -n "${BACKUP_PUSH_URL:-}" ]; then
  # Uptime Kuma peut redémarrer à l'instant (sauvegarde de son volume) : on réessaie.
  curl -fsS --retry 10 --retry-delay 15 --retry-all-errors -o /dev/null "$BACKUP_PUSH_URL?status=up&msg=OK"
fi

log "$ENVIRONMENT_NAME : sauvegarde terminée en ${SECONDS} s"
