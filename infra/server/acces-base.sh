#!/usr/bin/env bash
# Lot 23 (SEC-09, décision Q31, ADR 0060) — accès d'exploitation à la base PostgreSQL d'un
# environnement, tracé et motivé. À lancer par Julien, sur le VPS (root) :
#
#   sudo /opt/symbola/infra/server/acces-base.sh staging --motif="vérifier la migration 0093"
#
# Avant d'ouvrir psql, une ligne « Accès d'exploitation » (ops.database.opened) va au
# journal d'audit commun, avec le motif ; une autre (ops.database.closed) à la sortie.
# Elles s'affichent dans le journal de chaque organisation. Le motif ne contient aucune
# donnée personnelle.
#
# Limite assumée (ADR 0060) : root sur le VPS peut toujours ouvrir psql sans ce script.
# Le runbook demande de passer par lui ; un accès qui l'éviterait ne serait pas tracé.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/../backup/lib.sh
. "$here/../backup/lib.sh"

environment=${1:-}
[ $# -gt 0 ] && shift
motif=""
for arg in "$@"; do
  case $arg in
    --motif=*) motif=${arg#*=} ;;
    *) die "argument inconnu : $arg" ;;
  esac
done

load_config "$environment"
check_motif "$motif"

journal_operations_access ops.database.opened "$motif"
trap 'journal_operations_access ops.database.closed "$motif" || log "ATTENTION : fermeture non journalisée"' EXIT
log "$ENVIRONMENT_NAME : accès d'exploitation journalisé ; ouverture de psql (\\q pour sortir)"
# shellcheck disable=SC2016
env_compose exec postgres sh -c 'psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
