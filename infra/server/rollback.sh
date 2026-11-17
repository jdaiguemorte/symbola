#!/usr/bin/env bash
# Lot 40a (ARC-14 ; décision D4, ADR 0075) — retour arrière en une commande : remet l'image de
# la version précédente notée par deploy.sh, redémarre symbola et attend la sonde de santé. À
# lancer par Julien, sur le VPS :
#
#   sudo /opt/symbola/infra/server/rollback.sh production [--motif="la page devis ne s'ouvre plus"]
#
# Le schéma ne bouge pas : les migrations restent compatibles avec la version précédente du code
# (contrôle de la CI, ARC-14). Annuler une migration reste un geste à part, après une sauvegarde
# (docs/runbooks/restauration.md, § 4 bis). Le retour arrière n'est pas soumis à la fenêtre de
# déploiement : revenir à une version qui a tourné est le geste du week-end. Relancé, il revient
# à la version qu'il vient de quitter.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/../backup/lib.sh
. "$here/../backup/lib.sh"
# shellcheck source=SCRIPTDIR/deploy-lib.sh
. "$here/deploy-lib.sh"

[ $# -ge 1 ] || die 'usage : rollback.sh <staging|production> [--motif="pourquoi"]'
environment=$1
shift
motif=""
for arg in "$@"; do
  case $arg in
    --motif=*) motif=${arg#*=} ;;
    *) die "argument inconnu : $arg" ;;
  esac
done
[ -z "$motif" ] || check_motif "$motif"

load_config "$environment"
take_deploy_lock

target=$(read_previous_tag || true)
is_commit_sha "$target" ||
  die "aucune version précédente notée pour $ENVIRONMENT_NAME ($(previous_tag_file)) : le premier déploiement par deploy.sh la note"
current=$(current_image_tag)
[ "$target" != "$current" ] || die "la version précédente notée ($(short_sha "$target")) est déjà en service"

log "$ENVIRONMENT_NAME : retour de $(short_sha "$current") à $(short_sha "$target")"
set_image_tag "$target"
if ! env_compose pull symbola; then
  set_image_tag "$current"
  die "image de $(short_sha "$target") introuvable : rien n'a changé"
fi
if ! start_app_and_wait; then
  set_image_tag "$current"
  start_app_and_wait || log "ATTENTION : la version $(short_sha "$current") ne répond plus non plus"
  die "la version $(short_sha "$target") ne répond pas à la sonde de santé : retour à $(short_sha "$current")"
fi

if is_commit_sha "$current"; then
  write_previous_tag "$current"
fi
reason="retour à la version $(short_sha "$target") (depuis $(short_sha "$current"))"
[ -z "$motif" ] || reason="$reason : $motif"
journal_operations_access ops.deploy.rolled_back "$reason" || log "ATTENTION : retour arrière non inscrit au journal d'audit"
deploy_log retour-arriere "$target" "$current" "$motif"
log "$ENVIRONMENT_NAME : version $(short_sha "$target") en service ; rollback.sh relancé reviendrait à $(short_sha "$current")"
