# shellcheck shell=bash
# Lot 40a (NFR-07, SEC-28, ARC-14, DAT-10 ; ADR 0075) — fonctions communes à deploy.sh,
# rollback.sh et recette.sh. Sourcé après infra/backup/lib.sh (configuration de
# l'environnement, Compose, motif et journal d'audit), jamais exécuté seul.

DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-/var/lib/symbola/deploy}"
DEPLOY_LOG_DIR="${DEPLOY_LOG_DIR:-/var/log/symbola}"
DEPLOY_WAIT_TIMEOUT="${DEPLOY_WAIT_TIMEOUT:-240}"
NODE_IMAGE="${NODE_IMAGE:-node:22-slim}"
NODE_MOUNTS=()

# Heure de Paris d'un instant (secondes depuis 1970) : « <jour de 1 à 7> <HHMM> ».
# date GNU (VPS) ou BSD (macOS, tests en local).
paris_day_time() {
  if date -d @0 +%s >/dev/null 2>&1; then
    TZ=Europe/Paris date -d "@$1" "+%u %H%M"
  else
    TZ=Europe/Paris date -r "$1" "+%u %H%M"
  fi
}

# NFR-07 (ADR 0075) : pas de déploiement en production du vendredi 12 h au lundi 8 h, heure de
# Paris, quand les planners sont sur le terrain. SYMBOLA_DEPLOY_NOW (secondes) sert aux tests.
# L'heure HHMM (quatre chiffres) précédée d'un 1 se lit en décimal, sans souci du zéro de tête :
# 0759 donne 10759.
deploy_window_open() {
  local day time
  read -r day time <<<"$(paris_day_time "${SYMBOLA_DEPLOY_NOW:-$(date +%s)}")"
  case $day in
    5) [ "1$time" -lt 11200 ] ;;
    6 | 7) return 1 ;;
    1) [ "1$time" -ge 10800 ] ;;
    *) return 0 ;;
  esac
}

# SHA complet en minuscules. Liste explicite des caractères : une plage [a-f] suit l'ordre de
# tri de la langue et peut laisser passer des majuscules.
is_commit_sha() {
  [[ ${1:-} =~ ^[0123456789abcdef]{40}$ ]]
}

# Un seul déploiement ou retour arrière à la fois par environnement.
take_deploy_lock() {
  exec 8>"${BACKUP_LOCK_DIR:-/run/lock}/symbola-deploy-$ENVIRONMENT_NAME.lock"
  flock -n 8 || die "un déploiement ou un retour arrière de $ENVIRONMENT_NAME est déjà en cours"
}

current_image_tag() {
  sed -n 's/^APP_IMAGE_TAG=//p' "$ENV_FILE" | tail -n 1
}

# Réécrit APP_IMAGE_TAG dans .env.<environnement>, en gardant ses droits et son propriétaire
# (le fichier contient des secrets : il n'est jamais recréé).
set_image_tag() {
  local tag=$1 tmp
  tmp=$(mktemp)
  if grep -q '^APP_IMAGE_TAG=' "$ENV_FILE"; then
    sed "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=$tag/" "$ENV_FILE" >"$tmp"
  else
    cat "$ENV_FILE" >"$tmp"
    printf 'APP_IMAGE_TAG=%s\n' "$tag" >>"$tmp"
  fi
  cat "$tmp" >"$ENV_FILE"
  rm -f "$tmp"
}

previous_tag_file() {
  printf '%s/%s.previous' "$DEPLOY_STATE_DIR" "$ENVIRONMENT_NAME"
}

read_previous_tag() {
  local file
  file=$(previous_tag_file)
  [ -r "$file" ] && head -n 1 "$file"
}

write_previous_tag() {
  mkdir -p "$DEPLOY_STATE_DIR"
  printf '%s\n' "$1" >"$(previous_tag_file)"
}

# Journal des déploiements sur le serveur : date, environnement, action, version, version
# précédente, motif (séparés par des tabulations).
deploy_log() {
  mkdir -p "$DEPLOY_LOG_DIR"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ENVIRONMENT_NAME" "$1" "$2" "${3:-}" "${4:-}" \
    >>"$DEPLOY_LOG_DIR/deploiements.log"
}

short_sha() {
  printf '%s' "${1:0:7}"
}

# Démarre symbola sur l'image du tag en cours et attend la sonde de santé du Compose.
start_app_and_wait() {
  env_compose up -d --wait --wait-timeout "$DEPLOY_WAIT_TIMEOUT" symbola
}

# Commande pnpm dans le dépôt de l'environnement, dans un conteneur node:22-slim branché sur le
# réseau Docker de l'environnement (comme les migrations du runbook). Volumes supplémentaires :
# tableau NODE_MOUNTS.
node_run() {
  docker run --rm --network "${PROJECT}_default" \
    -v "$SYMBOLA_DIR:/app" -w /app \
    --env-file "$ENV_FILE" -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
    ${NODE_MOUNTS[@]+"${NODE_MOUNTS[@]}"} \
    "$NODE_IMAGE" sh -c "corepack enable && pnpm install --frozen-lockfile --reporter=silent && $1"
}
