# shellcheck shell=bash
# Fonctions communes à backup.sh, restore.sh et check-snapshot-protection.sh (SOC-10,
# lot 22). Sourcé, jamais exécuté seul.
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
  if is_remote_repository; then
    : "${RESTIC_SSH_DIR:?RESTIC_SSH_DIR manquant dans $config (dépôt distant $RESTIC_REPOSITORY)}"
    check_ssh_dir
  else
    [ -d "$RESTIC_REPOSITORY" ] || die "dossier du dépôt restic absent : $RESTIC_REPOSITORY"
  fi
  [ -r "$RESTIC_PASSWORD_FILE" ] || die "fichier de mot de passe restic illisible : $RESTIC_PASSWORD_FILE"

  COMPOSE_DIR="$SYMBOLA_DIR/infra/compose"
  ENV_FILE="$COMPOSE_DIR/.env.$ENVIRONMENT_NAME"
  [ -r "$ENV_FILE" ] || die "fichier d'environnement absent : $ENV_FILE"
  PROJECT="symbola-$ENVIRONMENT_NAME"
  # Lues par backup.sh et restore.sh, qui sourcent ce fichier.
  # shellcheck disable=SC2034
  GARAGE_VOLUME="${PROJECT}_garage_data"
  # Documenso (DEV-02, ADR 0026) : base dédiée, sauvegardée seulement une
  # fois Documenso déployé dans cet environnement.
  DOCUMENSO_DB=$(sed -n 's/^DOCUMENSO_DB_NAME=//p' "$ENV_FILE" | tail -n 1)
  DOCUMENSO_DB=${DOCUMENSO_DB:-documenso}
  [[ $DOCUMENSO_DB =~ ^[a-z_][a-z0-9_]*$ ]] || die "DOCUMENSO_DB_NAME invalide dans $ENV_FILE"
  # Fournisseur d'identité (lot 33, ADR 0067) : base dédiée de Logto, sauvegardée dès qu'elle
  # existe ; ses rôles de connexion (logto_tenant_*) sont recréés à la restauration.
  LOGTO_DB=$(sed -n 's/^LOGTO_DB_NAME=//p' "$ENV_FILE" | tail -n 1)
  LOGTO_DB=${LOGTO_DB:-logto}
  [[ $LOGTO_DB =~ ^[a-z_][a-z0-9_]*$ ]] || die "LOGTO_DB_NAME invalide dans $ENV_FILE"
  # shellcheck disable=SC2034
  WORK_DIR="${BACKUP_WORK_DIR:-/var/tmp/symbola-backup}/$ENVIRONMENT_NAME"
}

# Lot 22 (NFR-10, ADR 0051) : le dépôt est sur la Storage Box Hetzner, sous la forme
# « sftp:<hôte>:<chemin> ». L'hôte est un alias de la configuration SSH de l'environnement
# (RESTIC_SSH_DIR) : serveur, port 23, sous-compte, clé, empreinte épinglée. Un dossier
# local reste accepté (développement, tests).
is_remote_repository() {
  [[ $RESTIC_REPOSITORY == sftp:* ]]
}

# Dossier SSH de l'environnement (root:root, 0700, fichiers 0600) : config, known_hosts,
# id_ed25519. Monté en lecture seule dans les conteneurs, en /root/.ssh.
check_ssh_dir() {
  local file strict
  for file in config known_hosts id_ed25519; do
    [ -s "$RESTIC_SSH_DIR/$file" ] ||
      die "fichier SSH absent ou vide : $RESTIC_SSH_DIR/$file (voir docs/runbooks/restauration.md, § 2)"
  done
  # Empreinte épinglée : une empreinte inconnue ou changée doit toujours être refusée.
  strict=$(grep -Ei '^[[:space:]]*StrictHostKeyChecking[[:space:]]' "$RESTIC_SSH_DIR/config" || true)
  if [ -z "$strict" ] || grep -Eiqv 'StrictHostKeyChecking[[:space:]]+yes[[:space:]]*$' <<<"$strict"; then
    die "la configuration SSH doit refuser toute empreinte inconnue : StrictHostKeyChecking yes ($RESTIC_SSH_DIR/config)"
  fi
}

# Empêche deux sauvegardes/restaurations simultanées du même environnement.
take_lock() {
  exec 9>"${BACKUP_LOCK_DIR:-/run/lock}/symbola-backup-$ENVIRONMENT_NAME.lock"
  flock -n 9 || die "une sauvegarde ou restauration de $ENVIRONMENT_NAME est déjà en cours"
}

env_compose() {
  docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE" -p "$PROJECT" "$@"
}

# Base dédiée présente sur le serveur PostgreSQL de l'environnement ? (nom déjà validé)
database_exists() {
  [ "$(env_compose exec -T postgres sh -c \
    "psql -tA --username=\"\$POSTGRES_USER\" --dbname=postgres -c \"select 1 from pg_database where datname = '$1'\"")" = 1 ]
}

documenso_database_exists() { database_exists "$DOCUMENSO_DB"; }
logto_database_exists() { database_exists "$LOGTO_DB"; }

socle_compose() {
  docker compose -f "$COMPOSE_DIR/docker-compose.socle.yml" --env-file "$COMPOSE_DIR/.env.socle" -p symbola-socle "$@"
}

# restic dans son image officielle. Le mot de passe est monté en fichier, jamais passé
# en argument ni en variable (il apparaîtrait dans `ps` ou `docker inspect`) ; de même
# pour la clé SSH du dépôt distant (lot 22), montée avec sa configuration en lecture seule.
# Volumes supplémentaires : tableau RESTIC_MOUNTS. L'écriture ${t[@]+"${t[@]}"} accepte un
# tableau vide sous `set -u`, y compris avec le bash 3.2 de macOS (tests en local).
restic_run() {
  local repository=(-e RESTIC_REPOSITORY=/repo -v "$RESTIC_REPOSITORY:/repo")
  if is_remote_repository; then
    repository=(-e "RESTIC_REPOSITORY=$RESTIC_REPOSITORY" -v "$RESTIC_SSH_DIR:/root/.ssh:ro")
  fi
  docker run --rm -i \
    --hostname "$PROJECT" \
    "${repository[@]}" \
    -e RESTIC_PASSWORD_FILE=/run/secrets/restic-password \
    -v "$RESTIC_PASSWORD_FILE:/run/secrets/restic-password:ro" \
    ${RESTIC_MOUNTS[@]+"${RESTIC_MOUNTS[@]}"} \
    "$RESTIC_IMAGE" "$@"
}

# Lot 23 (SEC-09, décision Q31, ADR 0060) : un accès d'exploitation à la base est tracé
# et motivé. Le motif dit pourquoi, sans donnée personnelle (ni e-mail, ni téléphone) :
# il s'affiche dans le journal de chaque organisation.
check_motif() {
  local motif=${1:-}
  motif=${motif#"${motif%%[![:space:]]*}"}
  [ -n "$motif" ] || die "motif obligatoire : --motif=\"pourquoi cet accès\" (sans donnée personnelle)"
  [ "${#motif}" -le 300 ] || die "motif trop long (300 caractères au plus)"
  if [[ $motif == *@* ]] || [[ $motif =~ ([0-9][\ .-]?){10,} ]]; then
    die "le motif ne doit contenir aucune donnée personnelle (e-mail, téléphone) : il s'affiche dans le journal de chaque organisation"
  fi
}

# journal_operations_access <action> <motif> : une ligne « Accès d'exploitation » au
# journal d'audit commun (core.audit_entries), sans organisation : elle se lit dans le
# journal de chacune. Le motif passe par une variable psql (:'motif'), jamais collé dans
# le SQL. Sans journal (instantané antérieur au lot 23), rien n'est écrit.
journal_operations_access() {
  local action=$1 motif=$2
  # shellcheck disable=SC2016
  env_compose exec -T postgres sh -c \
    'psql -v ON_ERROR_STOP=1 -qtA --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -v action="$1" -v motif="$2"' \
    sh "$action" "$motif" <<'SQL'
insert into core.audit_entries (organization_id, actor_kind, action, category, reason)
select null, 'operator', :'action', 'exploitation', :'motif'
where to_regclass('core.audit_entries') is not null;
SQL
}
