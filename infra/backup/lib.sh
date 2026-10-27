# shellcheck shell=bash
# Fonctions communes à backup.sh et restore.sh (SOC-10). Sourcé, jamais exécuté seul.
#
# Chaque environnement a SON dépôt restic, SON mot de passe et SA configuration
# (/etc/symbola/backup/<environnement>.env) ; chaque instantané porte le tag
# env:<environnement>. Une restauration ne peut donc pas injecter des données de
# production dans le staging (ADR 0016 : staging = données fictives uniquement).

# Image officielle restic, version figée (Renovate propose les montées).
RESTIC_IMAGE="${RESTIC_IMAGE:-restic/restic:0.19.1}"
RESTIC_MOUNTS=()

die() {
  echo "ERREUR : $*" >&2
  exit 1
}

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

# load_config <staging|production> : valide l'environnement et charge sa configuration.
load_config() {
  case "${1:-}" in
    staging | production) ENVIRONMENT_NAME=$1 ;;
    *) die "environnement attendu : staging ou production (reçu : « ${1:-} »)" ;;
  esac

  local config="${BACKUP_CONFIG_DIR:-/etc/symbola/backup}/$ENVIRONMENT_NAME.env"
  [ -r "$config" ] || die "configuration absente : $config (voir docs/runbooks/restauration.md)"
  # shellcheck source=/dev/null
  . "$config"

  : "${SYMBOLA_DIR:?SYMBOLA_DIR manquant dans $config}"
  : "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY manquant dans $config}"
  : "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE manquant dans $config}"
  [ -d "$RESTIC_REPOSITORY" ] || die "dossier du dépôt restic absent : $RESTIC_REPOSITORY"
  [ -r "$RESTIC_PASSWORD_FILE" ] || die "fichier de mot de passe restic illisible : $RESTIC_PASSWORD_FILE"

  COMPOSE_DIR="$SYMBOLA_DIR/infra/compose"
  ENV_FILE="$COMPOSE_DIR/.env.$ENVIRONMENT_NAME"
  [ -r "$ENV_FILE" ] || die "fichier d'environnement absent : $ENV_FILE"
  PROJECT="symbola-$ENVIRONMENT_NAME"
  # Lues par backup.sh et restore.sh, qui sourcent ce fichier.
  # shellcheck disable=SC2034
  GARAGE_VOLUME="${PROJECT}_garage_data"
  # DocuSeal (DEV-02, ADR 0021) : base dédiée et fichiers, sauvegardés
  # seulement une fois DocuSeal déployé dans cet environnement.
  # shellcheck disable=SC2034
  DOCUSEAL_VOLUME="${PROJECT}_docuseal_data"
  DOCUSEAL_DB=$(sed -n 's/^DOCUSEAL_DB_NAME=//p' "$ENV_FILE" | tail -n 1)
  DOCUSEAL_DB=${DOCUSEAL_DB:-docuseal}
  [[ $DOCUSEAL_DB =~ ^[a-z_][a-z0-9_]*$ ]] || die "DOCUSEAL_DB_NAME invalide dans $ENV_FILE"
  # shellcheck disable=SC2034
  WORK_DIR="${BACKUP_WORK_DIR:-/var/tmp/symbola-backup}/$ENVIRONMENT_NAME"
}

# Empêche deux sauvegardes/restaurations simultanées du même environnement.
take_lock() {
  exec 9>"${BACKUP_LOCK_DIR:-/run/lock}/symbola-backup-$ENVIRONMENT_NAME.lock"
  flock -n 9 || die "une sauvegarde ou restauration de $ENVIRONMENT_NAME est déjà en cours"
}

env_compose() {
  docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE" -p "$PROJECT" "$@"
}

# Base DocuSeal présente sur le serveur PostgreSQL de l'environnement ?
docuseal_database_exists() {
  [ "$(env_compose exec -T postgres sh -c \
    "psql -tA --username=\"\$POSTGRES_USER\" --dbname=postgres -c \"select 1 from pg_database where datname = '$DOCUSEAL_DB'\"")" = 1 ]
}

socle_compose() {
  docker compose -f "$COMPOSE_DIR/docker-compose.socle.yml" --env-file "$COMPOSE_DIR/.env.socle" -p symbola-socle "$@"
}

# restic dans son image officielle. Le mot de passe est monté en fichier, jamais passé
# en argument ni en variable (il apparaîtrait dans `ps` ou `docker inspect`).
# Volumes supplémentaires : tableau RESTIC_MOUNTS.
restic_run() {
  docker run --rm -i \
    --hostname "$PROJECT" \
    -e RESTIC_REPOSITORY=/repo \
    -e RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
    -v "$RESTIC_REPOSITORY:/repo" \
    -v "$RESTIC_PASSWORD_FILE:/run/secrets/restic-password:ro" \
    "${RESTIC_MOUNTS[@]}" \
    "$RESTIC_IMAGE" "$@"
}
