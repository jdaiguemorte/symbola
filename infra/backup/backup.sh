#!/usr/bin/env bash
# Sauvegarde nocturne d'un environnement (SOC-10) : PostgreSQL (dump) et Garage, plus
# Uptime Kuma pour la production, Documenso (base dédiée, DEV-02, ADR 0026) une
# fois déployé, et le fournisseur d'identité (base dédiée de Logto, lot 33, ADR 0067), dans un dépôt restic chiffré propre à l'environnement. Depuis le lot 22
# (NFR-10, ADR 0051), ce dépôt est sur la Storage Box Hetzner, hors du VPS.
#
# Usage (sur le VPS, root, lancé par le timer systemd symbola-backup@<env>) :
#   infra/backup/backup.sh staging|production
#
# Étapes : dump PostgreSQL vérifié → arrêt bref de Garage (fichiers cohérents) →
# instantané restic unique → redémarrage → rétention → contrôle hebdomadaire du dépôt →
# signal « push » à Uptime Kuma, envoyé seulement si tout a réussi. Chaque exécution est
# aussi signalée à l'app (table hub.backup_runs : début, fin, résultat, taille ; L13-HUB-18,
# ADR 0033), pour la console d'Administration.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
. "$here/lib.sh"

load_config "${1:-}"
take_lock

# L13-HUB-18 — requête dans la base de l'environnement, avec le rôle d'administration du
# conteneur postgres (ses variables : aucun identifiant ne transite par ce script).
# shellcheck disable=SC2016
app_sql() {
  env_compose exec -T postgres sh -c 'psql -tA -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c "$1"' sh "$1"
}

# Le signal ne fait jamais échouer la sauvegarde (base arrêtée, migration pas encore
# appliquée…) : sans identifiant d'exécution, la fin n'est simplement pas signalée.
run_id=$(app_sql "insert into hub.backup_runs default values returning id" 2>/dev/null | head -n 1) || run_id=""
[[ $run_id =~ ^[0-9a-f-]{36}$ ]] || run_id=""
size_bytes=""

install -d -m 700 "$WORK_DIR"
dump="$WORK_DIR/postgres.dump"
documenso_dump="$WORK_DIR/documenso.dump"
logto_dump="$WORK_DIR/logto.dump"
stopped=()

restart_stopped() {
  local item
  for item in ${stopped[@]+"${stopped[@]}"}; do
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
  rm -f "$dump" "$documenso_dump" "$logto_dump"
}

# Fin de l'exécution, réussie ou non : services relancés, puis résultat signalé à l'app.
finish() {
  local status=$?
  cleanup
  if [ -n "$run_id" ]; then
    local result=succeeded
    [ "$status" -eq 0 ] || result=failed
    [[ $size_bytes =~ ^[0-9]+$ ]] || size_bytes=null
    app_sql "update hub.backup_runs set finished_at = now(), status = '$result', size_bytes = $size_bytes where id = '$run_id'" >/dev/null 2>&1 ||
      log "signal de fin de sauvegarde non enregistré dans l'app"
  fi
  exit "$status"
}
trap finish EXIT

restic_run cat config >/dev/null 2>&1 ||
  die "dépôt restic non initialisé, injoignable (réseau, clé ou empreinte refusée) ou mot de passe incorrect : $RESTIC_REPOSITORY (voir docs/runbooks/restauration.md, § 2)"

log "$ENVIRONMENT_NAME : dump PostgreSQL"
# Les variables sont celles du conteneur postgres : aucun identifiant ne transite par ce script.
# shellcheck disable=SC2016
env_compose exec -T postgres sh -c 'pg_dump --format=custom --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' >"$dump"
[ -s "$dump" ] || die "dump PostgreSQL vide"
env_compose exec -T postgres pg_restore --list <"$dump" >/dev/null || die "dump PostgreSQL illisible par pg_restore"

# Documenso garde ses fichiers (PDF envoyés et signés) dans sa base : le
# dump suffit, aucun volume à copier (ADR 0026).
if documenso_database_exists; then
  log "$ENVIRONMENT_NAME : dump de la base Documenso ($DOCUMENSO_DB)"
  env_compose exec -T postgres sh -c "pg_dump --format=custom --username=\"\$POSTGRES_USER\" --dbname=$DOCUMENSO_DB" >"$documenso_dump"
  [ -s "$documenso_dump" ] || die "dump Documenso vide"
  env_compose exec -T postgres pg_restore --list <"$documenso_dump" >/dev/null || die "dump Documenso illisible par pg_restore"
fi

# Fournisseur d'identité (lot 33, ADR 0067) : comptes, clés d'accès, seconds facteurs.
if logto_database_exists; then
  log "$ENVIRONMENT_NAME : dump de la base du fournisseur d'identité ($LOGTO_DB)"
  env_compose exec -T postgres sh -c "pg_dump --format=custom --username=\"\$POSTGRES_USER\" --dbname=$LOGTO_DB" >"$logto_dump"
  [ -s "$logto_dump" ] || die "dump du fournisseur d'identité vide"
  env_compose exec -T postgres pg_restore --list <"$logto_dump" >/dev/null || die "dump du fournisseur d'identité illisible par pg_restore"
fi

RESTIC_MOUNTS=(-v "$WORK_DIR:/backup/postgres:ro" -v "$GARAGE_VOLUME:/backup/garage:ro")
if [ "${INCLUDE_MONITORING:-false}" = true ]; then
  RESTIC_MOUNTS+=(-v "symbola-socle_uptime_kuma_data:/backup/uptime-kuma:ro")
  stop_service socle uptime-kuma
fi

log "$ENVIRONMENT_NAME : arrêt de Garage le temps de la copie"
stop_service env garage
summary=$(restic_run backup --json --tag "env:$ENVIRONMENT_NAME" --tag nightly /backup)
# Taille ajoutée au dépôt par cet instantané (résumé JSON de restic), pour la console Admin.
size_bytes=$(grep -o '"data_added":[0-9]*' <<<"$summary" | tail -n 1 | cut -d: -f2) || size_bytes=""
restart_stopped
RESTIC_MOUNTS=()

log "$ENVIRONMENT_NAME : rétention"
restic_run forget --tag "env:$ENVIRONMENT_NAME" \
  --keep-daily "${KEEP_DAILY:-7}" --keep-weekly "${KEEP_WEEKLY:-4}" --keep-monthly "${KEEP_MONTHLY:-12}" \
  --prune

# NFR-10 (lot 22) : la sauvegarde de la nuit doit se relire. Chaque nuit, contrôle de la
# structure du dépôt ; le jour prévu, relecture d'une part des données et relevé de la
# taille du dépôt (NFR-30). Un contrôle en échec arrête tout : aucun signal de succès.
if [ "$(date +%u)" = "${CHECK_WEEKDAY:-7}" ]; then
  log "$ENVIRONMENT_NAME : contrôle d'intégrité du dépôt (${CHECK_SUBSET:-10%} des données relues)"
  restic_run check --read-data-subset="${CHECK_SUBSET:-10%}"
  log "$ENVIRONMENT_NAME : taille du dépôt"
  restic_run stats --mode raw-data
else
  log "$ENVIRONMENT_NAME : contrôle de la structure du dépôt"
  restic_run check
fi

if [ -n "${BACKUP_PUSH_URL:-}" ]; then
  # Uptime Kuma peut redémarrer à l'instant (sauvegarde de son volume) : on réessaie.
  # Lot 25 : seule la partie avant un « ? » de l'URL collée sert ; le script ajoute la sienne.
  curl -fsS --retry 10 --retry-delay 15 --retry-all-errors -o /dev/null "${BACKUP_PUSH_URL%%\?*}?status=up&msg=OK"
fi

log "$ENVIRONMENT_NAME : sauvegarde terminée en ${SECONDS} s"
