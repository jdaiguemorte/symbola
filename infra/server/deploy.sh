#!/usr/bin/env bash
# Lot 40a (NFR-07, SEC-28, ARC-14 ; décisions D2 à D5, ADR 0075) — déploie une version de
# Symbola dans un environnement, en une commande. À lancer par Julien, sur le VPS, depuis sa
# session (sudo, pas sudo -i : Git y refuse le dépôt) :
#
#   sudo /opt/symbola/infra/server/deploy.sh production <sha du commit sur main>
#   sudo /opt/symbola/infra/server/deploy.sh production <sha> --urgence="correctif des factures"
#
# Dans l'ordre :
# 1. fenêtre : en production, refus du vendredi 12 h au lundi 8 h, heure de Paris (NFR-07),
#    sauf --urgence, dont le motif est journalisé ;
# 2. contrôle du durcissement (check-hardening.sh, SEC-28) : un ÉCHEC arrête, sauf --urgence ;
# 3. sauvegarde de l'environnement ;
# 4. dépôt avancé au commit demandé (qui doit être sur main) ;
# 5. image du commit ;
# 6. migrations : l'app est arrêtée pendant celles qui le demandent (migrate:plan) ; en cas
#    d'échec, Drizzle n'en applique aucune et l'app reste sur la version précédente ;
# 7. démarrage et sonde de santé ; si elle échoue, retour automatique à la version précédente ;
# 8. journal : journal d'audit commun (ops.deploy.completed) et /var/log/symbola/deploiements.log.
# La version précédente est notée pour rollback.sh.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/../backup/lib.sh
. "$here/../backup/lib.sh"
# shellcheck source=SCRIPTDIR/deploy-lib.sh
. "$here/deploy-lib.sh"

usage='usage : deploy.sh <staging|production> <SHA du commit, 40 caractères> [--urgence="motif"]'
[ $# -ge 2 ] || die "$usage"
environment=$1
sha=$2
shift 2
urgent=0
motif=""
for arg in "$@"; do
  case $arg in
    --urgence=*)
      urgent=1
      motif=${arg#*=}
      ;;
    *) die "argument inconnu : $arg ($usage)" ;;
  esac
done
is_commit_sha "$sha" || die "commit attendu : son SHA complet, 40 caractères en minuscules (reçu : « $sha »)"
[ "$urgent" = 0 ] || check_motif "$motif"

load_config "$environment"
take_deploy_lock

# 1. Fenêtre (NFR-07). Le staging n'est pas concerné.
if [ "$ENVIRONMENT_NAME" = production ] && ! deploy_window_open; then
  [ "$urgent" = 1 ] ||
    die "hors de la fenêtre de déploiement : pas de mise en production du vendredi 12 h au lundi 8 h, heure de Paris. Attendre lundi 8 h, ou --urgence=\"motif\" pour un correctif urgent (NFR-07)"
  log "hors de la fenêtre : correctif urgent (« $motif »)"
fi

# 2. Durcissement (SEC-28).
if bash "${SYMBOLA_HARDENING_CHECK:-$here/check-hardening.sh}"; then
  log "contrôle du durcissement : aucun échec"
elif [ "$urgent" = 1 ]; then
  log "ATTENTION : contrôle du durcissement en échec, déploiement forcé (« $motif »)"
else
  die "contrôle du durcissement en échec : déploiement arrêté, rien n'a changé (corriger, ou --urgence=\"motif\")"
fi

# 3. Sauvegarde (attendue : le service est de type oneshot).
log "sauvegarde de $ENVIRONMENT_NAME"
systemctl start "symbola-backup@$ENVIRONMENT_NAME.service" ||
  die "sauvegarde en échec : déploiement arrêté, rien n'a changé (voir journalctl -u symbola-backup@$ENVIRONMENT_NAME)"

# 4. Dépôt au commit demandé.
previous=$(current_image_tag)
git -C "$SYMBOLA_DIR" fetch --quiet origin main || die "récupération de main impossible dans $SYMBOLA_DIR"
git -C "$SYMBOLA_DIR" merge-base --is-ancestor "$sha" origin/main ||
  die "le commit $(short_sha "$sha") n'est pas sur main : seule une version fusionnée se déploie"
git -C "$SYMBOLA_DIR" merge --ff-only --quiet "$sha" ||
  die "le dépôt $SYMBOLA_DIR n'avance pas jusqu'à $(short_sha "$sha") (modifications locales ?)"
[ "$(git -C "$SYMBOLA_DIR" rev-parse HEAD)" = "$sha" ] ||
  die "le dépôt $SYMBOLA_DIR est déjà après $(short_sha "$sha") : pour revenir à une version précédente, rollback.sh"

# 5. Image du commit, tirée avant tout arrêt.
set_image_tag "$sha"
if ! env_compose pull symbola; then
  set_image_tag "$previous"
  die "image de $(short_sha "$sha") introuvable (la CI l'a-t-elle publiée ?) : l'app n'a pas changé"
fi

# 6. Migrations.
if ! plan=$(node_run "pnpm -s --filter @symbola/db migrate:plan"); then
  set_image_tag "$previous"
  die "lecture des migrations en attente impossible : l'app n'a pas changé"
fi
printf '%s\n' "$plan"
stopped=0
if grep -qx 'arret-requis=oui' <<<"$plan"; then
  log "une migration demande d'arrêter symbola : arrêt le temps des migrations"
  env_compose stop symbola
  stopped=1
fi
if ! node_run "pnpm -s --filter @symbola/db migrate"; then
  set_image_tag "$previous"
  [ "$stopped" = 0 ] || start_app_and_wait || log "ATTENTION : symbola ne redémarre pas sur la version précédente"
  deploy_log echec-migrations "$sha" "$previous" "$motif"
  die "migrations en échec (aucune appliquée) : symbola reste sur $(short_sha "$previous")"
fi

# 7. Démarrage et sonde de santé ; retour automatique si elle échoue.
if ! start_app_and_wait; then
  if is_commit_sha "$previous" && [ "$previous" != "$sha" ]; then
    log "sonde de santé en échec : retour automatique à $(short_sha "$previous")"
    set_image_tag "$previous"
    start_app_and_wait || log "ATTENTION : la version précédente ne répond pas non plus"
    journal_operations_access ops.deploy.rolled_back \
      "retour automatique à la version $(short_sha "$previous") : la version $(short_sha "$sha") ne répondait pas" ||
      log "ATTENTION : retour arrière non inscrit au journal d'audit"
    deploy_log retour-automatique "$previous" "$sha" "$motif"
  fi
  die "la version $(short_sha "$sha") ne répond pas à la sonde de santé"
fi

# 8. Journal, et version précédente notée pour rollback.sh.
if is_commit_sha "$previous" && [ "$previous" != "$sha" ]; then
  write_previous_tag "$previous"
fi
reason="version $(short_sha "$sha")"
[ "$urgent" = 0 ] || reason="$reason ; correctif urgent : $motif"
journal_operations_access ops.deploy.completed "$reason" || log "ATTENTION : déploiement non inscrit au journal d'audit"
deploy_log deploiement "$sha" "$previous" "$motif"
log "$ENVIRONMENT_NAME : version $(short_sha "$sha") en service (précédente : $(short_sha "$previous"))"
