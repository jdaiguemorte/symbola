#!/usr/bin/env bash
# Restauration complète d'un environnement depuis son dépôt restic (SOC-10) :
# base PostgreSQL et données Garage. DESTRUCTIF : remplace les données actuelles.
#
# Usage (sur le VPS, root) :
#   infra/backup/restore.sh staging|production --confirm=<environnement> [--snapshot=<id>]
#
# Garde-fous :
# - --confirm doit répéter le nom de l'environnement ;
# - l'instantané doit porter le tag env:<environnement> : impossible de restaurer la
#   production dans le staging (données réelles interdites en staging, ADR 0016) ;
# - le rôle applicatif PostgreSQL doit exister (sinon : bootstrap d'abord, voir runbook),
#   vérifié avant toute suppression.
# Affiche la durée totale, à reporter dans docs/runbooks/restauration.md.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
. "$here/lib.sh"

environment=${1:-}
[ $# -gt 0 ] && shift
confirm=""
snapshot="latest"
for arg in "$@"; do
  case $arg in
    --confirm=*) confirm=${arg#*=} ;;
    --snapshot=*) snapshot=${arg#*=} ;;
    *) die "argument inconnu : $arg" ;;
  esac
done

load_config "$environment"
[ "$confirm" = "$ENVIRONMENT_NAME" ] ||
  die "restauration destructive de $ENVIRONMENT_NAME : relancer avec --confirm=$ENVIRONMENT_NAME"
take_lock

tag="env:$ENVIRONMENT_NAME"
if [ "$snapshot" = latest ]; then
  listing=$(restic_run snapshots --tag "$tag" --latest 1 --json)
else
  listing=$(restic_run snapshots --tag "$tag" --json "$snapshot")
fi
snapshot_id=$(grep -o '"id":"[0-9a-f]*"' <<<"$listing" | head -n 1 | cut -d '"' -f 4 || true)
[ -n "$snapshot_id" ] || die "aucun instantané « $snapshot » portant le tag $tag dans $RESTIC_REPOSITORY"

app_role=$(sed -n 's/^POSTGRES_APP_USER=//p' "$ENV_FILE" | tail -n 1)
[[ $app_role =~ ^[a-z_][a-z0-9_]*$ ]] || die "POSTGRES_APP_USER absent ou invalide dans $ENV_FILE"

SECONDS=0
install -d -m 700 "$WORK_DIR"
dump="$WORK_DIR/restore-postgres.dump"
trap 'rm -f "$dump"' EXIT

log "$ENVIRONMENT_NAME : extraction du dump de l'instantané ${snapshot_id:0:8}"
restic_run dump "$snapshot_id" /backup/postgres/postgres.dump >"$dump"
[ -s "$dump" ] || die "dump vide dans l'instantané ${snapshot_id:0:8}"

log "$ENVIRONMENT_NAME : arrêt de l'app"
env_compose stop symbola
env_compose up -d --wait postgres

role_exists=$(env_compose exec -T postgres sh -c \
  "psql -tA --username=\"\$POSTGRES_USER\" --dbname=postgres -c \"select 1 from pg_roles where rolname = '$app_role'\"")
[ "$role_exists" = 1 ] ||
  die "rôle $app_role absent : lancer d'abord le bootstrap des rôles (docs/runbooks/restauration.md, § 4) ; l'app reste arrêtée"

log "$ENVIRONMENT_NAME : restauration de PostgreSQL"
# shellcheck disable=SC2016
env_compose exec -T postgres sh -c \
  'dropdb --if-exists --force --username="$POSTGRES_USER" "$POSTGRES_DB" && createdb --username="$POSTGRES_USER" --owner="$POSTGRES_USER" "$POSTGRES_DB"'
# shellcheck disable=SC2016
env_compose exec -T postgres sh -c \
  'pg_restore --exit-on-error --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' <"$dump"

log "$ENVIRONMENT_NAME : restauration de Garage"
env_compose stop garage
docker run --rm -v "$GARAGE_VOLUME:/backup/garage" --entrypoint sh "$RESTIC_IMAGE" \
  -c 'find /backup/garage -mindepth 1 -delete'
RESTIC_MOUNTS=(-v "$GARAGE_VOLUME:/backup/garage")
restic_run restore "$snapshot_id" --target / --include /backup/garage

log "$ENVIRONMENT_NAME : redémarrage de l'environnement"
env_compose up -d --wait

log "$ENVIRONMENT_NAME : restauration terminée en $((SECONDS / 60)) min $((SECONDS % 60)) s (instantané ${snapshot_id:0:8})"
