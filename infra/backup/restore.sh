#!/usr/bin/env bash
# Restauration complète d'un environnement depuis son dépôt restic (SOC-10) :
# base PostgreSQL et données Garage, Documenso (base dédiée, DEV-02, ADR 0026) et le
# fournisseur d'identité (base dédiée de Logto, lot 33, ADR 0067) quand l'instantané les contient. DESTRUCTIF : remplace les données actuelles.
#
# Usage (sur le VPS, root) :
#   infra/backup/restore.sh staging|production --confirm=<environnement> [--snapshot=<id>] [--motif="…"]
#
# Garde-fous :
# - --confirm doit répéter le nom de l'environnement ;
# - l'instantané doit porter le tag env:<environnement> : impossible de restaurer la
#   production dans le staging (données réelles interdites en staging, ADR 0016) ;
# - le rôle applicatif PostgreSQL doit exister (sinon : bootstrap d'abord, voir runbook),
#   vérifié avant toute suppression.
# Affiche la durée totale, à reporter dans docs/runbooks/restauration.md.
# Lot 23 (SEC-09, ADR 0060) : la restauration est un accès d'exploitation ; une ligne
# ops.backup.restored va au journal d'audit de la base restaurée, avec le motif (par
# défaut : l'instantané restauré).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
. "$here/lib.sh"

environment=${1:-}
[ $# -gt 0 ] && shift
confirm=""
snapshot="latest"
motif=""
for arg in "$@"; do
  case $arg in
    --confirm=*) confirm=${arg#*=} ;;
    --snapshot=*) snapshot=${arg#*=} ;;
    --motif=*) motif=${arg#*=} ;;
    *) die "argument inconnu : $arg" ;;
  esac
done

load_config "$environment"
if [ -n "$motif" ]; then check_motif "$motif"; fi
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
[ -n "$motif" ] || motif="restauration de l'instantané ${snapshot_id:0:8}"

app_role=$(sed -n 's/^POSTGRES_APP_USER=//p' "$ENV_FILE" | tail -n 1)
[[ $app_role =~ ^[a-z_][a-z0-9_]*$ ]] || die "POSTGRES_APP_USER absent ou invalide dans $ENV_FILE"

SECONDS=0
install -d -m 700 "$WORK_DIR"
dump="$WORK_DIR/restore-postgres.dump"
documenso_dump="$WORK_DIR/restore-documenso.dump"
logto_dump="$WORK_DIR/restore-logto.dump"
trap 'rm -f "$dump" "$documenso_dump" "$logto_dump"' EXIT

log "$ENVIRONMENT_NAME : extraction du dump de l'instantané ${snapshot_id:0:8}"
restic_run dump "$snapshot_id" /backup/postgres/postgres.dump >"$dump"
[ -s "$dump" ] || die "dump vide dans l'instantané ${snapshot_id:0:8}"

# Documenso (DEV-02) : présent dans l'instantané seulement s'il était déployé.
has_documenso=false
if restic_run dump "$snapshot_id" /backup/postgres/documenso.dump >"$documenso_dump" 2>/dev/null && [ -s "$documenso_dump" ]; then
  has_documenso=true
fi

# Fournisseur d'identité (lot 33) : présent dans l'instantané dès qu'il était déployé.
has_logto=false
if restic_run dump "$snapshot_id" /backup/postgres/logto.dump >"$logto_dump" 2>/dev/null && [ -s "$logto_dump" ]; then
  has_logto=true
fi

log "$ENVIRONMENT_NAME : arrêt de l'app"
env_compose stop symbola
if [ "$has_logto" = true ]; then env_compose stop logto; fi
if [ "$has_documenso" = true ]; then env_compose --profile signature stop documenso; fi
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

if [ "$has_documenso" = true ]; then
  log "$ENVIRONMENT_NAME : restauration de la base Documenso ($DOCUMENSO_DB)"
  documenso_role=$(sed -n 's/^DOCUMENSO_DB_USER=//p' "$ENV_FILE" | tail -n 1)
  documenso_role=${documenso_role:-documenso}
  [[ $documenso_role =~ ^[a-z_][a-z0-9_]*$ ]] || die "DOCUMENSO_DB_USER invalide dans $ENV_FILE"
  documenso_role_exists=$(env_compose exec -T postgres sh -c \
    "psql -tA --username=\"\$POSTGRES_USER\" --dbname=postgres -c \"select 1 from pg_roles where rolname = '$documenso_role'\"")
  [ "$documenso_role_exists" = 1 ] ||
    die "rôle $documenso_role absent : lancer d'abord le bootstrap avec DOCUMENSO_DB_PASSWORD (docs/runbooks/restauration.md)"
  env_compose exec -T postgres sh -c \
    "dropdb --if-exists --force --username=\"\$POSTGRES_USER\" $DOCUMENSO_DB && createdb --username=\"\$POSTGRES_USER\" --owner=$documenso_role $DOCUMENSO_DB"
  env_compose exec -T postgres sh -c \
    "pg_restore --exit-on-error --username=\"\$POSTGRES_USER\" --dbname=$DOCUMENSO_DB" <"$documenso_dump"
fi

if [ "$has_logto" = true ]; then
  log "$ENVIRONMENT_NAME : restauration de la base du fournisseur d'identité ($LOGTO_DB)"
  logto_role=$(sed -n 's/^LOGTO_DB_USER=//p' "$ENV_FILE" | tail -n 1)
  logto_role=${logto_role:-logto}
  [[ $logto_role =~ ^[a-z_][a-z0-9_]*$ ]] || die "LOGTO_DB_USER invalide dans $ENV_FILE"
  logto_role_exists=$(env_compose exec -T postgres sh -c \
    "psql -tA --username=\"\$POSTGRES_USER\" --dbname=postgres -c \"select 1 from pg_roles where rolname = '$logto_role'\"")
  [ "$logto_role_exists" = 1 ] ||
    die "rôle $logto_role absent : lancer d'abord le bootstrap avec LOGTO_DB_PASSWORD (docs/runbooks/restauration.md)"
  # Les droits de la base visent le rôle logto_tenant_<base>, qui vit hors de la base : le
  # recréer avant le pg_restore (sans connexion, comme à l'initialisation de Logto).
  tenant_role="logto_tenant_$LOGTO_DB"
  env_compose exec -T postgres sh -c \
    "psql -v ON_ERROR_STOP=1 -tA --username=\"\$POSTGRES_USER\" --dbname=postgres -c \"do \\\$\\\$ begin if not exists (select 1 from pg_roles where rolname = '$tenant_role') then create role $tenant_role nologin; end if; end \\\$\\\$\""
  env_compose exec -T postgres sh -c \
    "dropdb --if-exists --force --username=\"\$POSTGRES_USER\" $LOGTO_DB && createdb --username=\"\$POSTGRES_USER\" --owner=$logto_role $LOGTO_DB"
  # Droit de connexion des rôles de Logto (hors du dump : les droits sur la base elle-même n'y
  # sont pas ; PUBLIC ne l'a plus depuis le bootstrap).
  env_compose exec -T postgres sh -c \
    "psql -v ON_ERROR_STOP=1 -tA --username=\"\$POSTGRES_USER\" --dbname=postgres -c \"grant connect on database $LOGTO_DB to $tenant_role\""
  env_compose exec -T postgres sh -c \
    "pg_restore --exit-on-error --username=\"\$POSTGRES_USER\" --dbname=$LOGTO_DB" <"$logto_dump"
  # Rôles de connexion de Logto (un par tenant), avec le mot de passe que Logto garde dans sa
  # table tenants : il ne quitte jamais PostgreSQL.
  env_compose exec -T postgres sh -c \
    "psql -v ON_ERROR_STOP=1 -tA --username=\"\$POSTGRES_USER\" --dbname=$LOGTO_DB" <<SQL
do \$\$ declare t record; begin
  for t in select db_user, db_user_password from tenants loop
    if exists (select 1 from pg_roles where rolname = t.db_user) then
      execute format('alter role %I with login password %L', t.db_user, t.db_user_password);
    else
      execute format('create role %I login password %L', t.db_user, t.db_user_password);
    end if;
    execute format('grant %I to %I', '$tenant_role', t.db_user);
  end loop;
end \$\$;
SQL
fi

log "$ENVIRONMENT_NAME : restauration de Garage"
env_compose stop garage
docker run --rm -v "$GARAGE_VOLUME:/backup/garage" --entrypoint sh "$RESTIC_IMAGE" \
  -c 'find /backup/garage -mindepth 1 -delete'
RESTIC_MOUNTS=(-v "$GARAGE_VOLUME:/backup/garage")
restic_run restore "$snapshot_id" --target / --include /backup/garage

log "$ENVIRONMENT_NAME : redémarrage de l'environnement"
env_compose up -d --wait
if [ "$has_documenso" = true ]; then env_compose --profile signature up -d documenso; fi

journal_operations_access ops.backup.restored "$motif" ||
  log "ATTENTION : restauration non journalisée (journal d'audit inaccessible)"
log "$ENVIRONMENT_NAME : restauration terminée en $((SECONDS / 60)) min $((SECONDS % 60)) s (instantané ${snapshot_id:0:8})"
