#!/usr/bin/env bash
# Lot 40a (DAT-10, ARC-13 ; décision D6, ADR 0075) — charge le jeu fictif de recette
# (docs/recette/symbola-synthetic-users.json) dans le staging, en une commande, par le même
# chargeur qu'en local (pnpm --filter @symbola/app seed:recette). À lancer par Julien, sur le
# VPS, après le déploiement de la version à recetter :
#
#   sudo /opt/symbola/infra/server/recette.sh staging
#
# Refusé en production (ADR 0016 : données fictives au staging seulement) ; le chargeur refuse
# aussi une base où le jeu est déjà chargé. Les comptes et les liens personnels créés vont dans
# un fichier lisible par root seul, hors du dépôt (RECETTE_ACCOUNTS_DIR).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/../backup/lib.sh
. "$here/../backup/lib.sh"
# shellcheck source=SCRIPTDIR/deploy-lib.sh
. "$here/deploy-lib.sh"

[ $# -eq 1 ] || die "usage : recette.sh staging"
[ "$1" = staging ] ||
  die "le jeu fictif ne se charge que dans le staging (ADR 0016, ARC-13) ; reçu : « $1 »"

load_config staging
take_deploy_lock

accounts_dir=${RECETTE_ACCOUNTS_DIR:-/root/symbola-recette}
mkdir -p "$accounts_dir"
chmod 700 "$accounts_dir"
NODE_MOUNTS=(-v "$accounts_dir:/comptes")
node_run "pnpm -s --filter @symbola/app seed:recette -- --comptes /comptes/comptes-recette.txt"
log "staging : jeu fictif chargé ; comptes et liens dans $accounts_dir/comptes-recette.txt (root seul)"
