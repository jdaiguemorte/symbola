#!/usr/bin/env bash
# Lot 22 (NFR-13, ADR 0051) — prouve, depuis le VPS et avec les seuls identifiants du
# sous-compte de l'environnement, que les copies instantanées de la Storage Box Hetzner
# sont hors d'atteinte : impossible de les créer, d'y écrire, de les renommer ou de les
# supprimer. C'est ce qui garantit qu'un VPS compromis ne détruit pas l'historique.
#
# Usage (sur le VPS, root, avant la première donnée réelle) :
#   infra/backup/check-snapshot-protection.sh staging|production --confirm=<environnement>
#
# Si une copie n'était PAS protégée, la tentative de suppression pourrait effacer la plus
# ancienne : d'où --confirm, et un lancement avant toute donnée réelle. Le résultat est à
# reporter dans docs/runbooks/restauration.md.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
. "$here/lib.sh"

environment=${1:-}
[ $# -gt 0 ] && shift
confirm=""
for arg in "$@"; do
  case $arg in
    --confirm=*) confirm=${arg#*=} ;;
    *) die "argument inconnu : $arg" ;;
  esac
done

load_config "$environment"
is_remote_repository ||
  die "dépôt distant attendu (RESTIC_REPOSITORY=sftp:…) : ce contrôle ne vaut que pour la Storage Box"
[ "$confirm" = "$ENVIRONMENT_NAME" ] ||
  die "contrôle à lancer avant la première donnée réelle (une copie non protégée pourrait être supprimée) : relancer avec --confirm=$ENVIRONMENT_NAME"

remote=${RESTIC_REPOSITORY#sftp:}
host_alias=${remote%%:*}
[[ $host_alias =~ ^[A-Za-z0-9._-]+$ ]] || die "adresse « sftp:<hôte>:<chemin> » attendue dans RESTIC_REPOSITORY"

# Une commande sftp, dans l'image restic (client OpenSSH inclus), avec le dossier SSH de
# l'environnement en lecture seule : mêmes identifiants que la sauvegarde nocturne.
sftp_batch() {
  printf '%s\n' "$1" | docker run --rm -i -v "$RESTIC_SSH_DIR:/root/.ssh:ro" --entrypoint sftp "$RESTIC_IMAGE" -b - "$host_alias"
}

snapdir=""
listing=""
for candidate in .zfs/snapshot /.zfs/snapshot; do
  if listing=$(sftp_batch "ls -1 $candidate" 2>/dev/null); then
    snapdir=$candidate
    break
  fi
done

if [ -z "$snapdir" ]; then
  log "$ENVIRONMENT_NAME : dossier des copies instantanées introuvable depuis le sous-compte"
  echo "RÉSULTAT : copies invisibles depuis le sous-compte, donc hors de sa portée (protégées)."
  echo "Vérifie depuis ton poste, avec le compte principal, que les copies existent bien (docs/runbooks/restauration.md, § 7)."
  exit 0
fi

names=$(grep -v '^sftp>' <<<"$listing" | sed -e '/^[[:space:]]*$/d' -e 's#.*/##' | sort)
[ -n "$names" ] ||
  die "aucune copie dans $snapdir : vérifie les copies automatiques dans la console Hetzner (onglet Snapshots)"
count=$(wc -l <<<"$names" | tr -d ' ')
oldest=$(head -n 1 <<<"$names")
log "$ENVIRONMENT_NAME : $count copies visibles dans $snapdir, la plus ancienne : $oldest"

unprotected=0
# attempt <description> <commande sftp> [commande d'annulation si la tentative réussit]
attempt() {
  if sftp_batch "$2" >/dev/null 2>&1; then
    log "ÉCHEC : « $1 » a réussi depuis le sous-compte"
    unprotected=1
    if [ -n "${3:-}" ]; then
      sftp_batch "$3" >/dev/null 2>&1 || log "annulation impossible : $3"
    fi
  else
    log "refusé, comme attendu : $1"
  fi
}

attempt "créer une copie" "mkdir $snapdir/symbola-protection-test" "rmdir $snapdir/symbola-protection-test"
attempt "écrire dans une copie" "mkdir $snapdir/$oldest/symbola-protection-test" "rmdir $snapdir/$oldest/symbola-protection-test"
attempt "renommer une copie" "rename $snapdir/$oldest $snapdir/$oldest-symbola-test" "rename $snapdir/$oldest-symbola-test $snapdir/$oldest"
attempt "supprimer une copie" "rmdir $snapdir/$oldest"

if [ "$unprotected" -ne 0 ]; then
  echo "RÉSULTAT : copies NON protégées depuis le sous-compte. Ne pas mettre de données réelles : revoir l'ADR 0051 (recours : stockage avec verrouillage)." >&2
  exit 1
fi
echo "RÉSULTAT : $count copies visibles, protégées : toute modification depuis le sous-compte est refusée."
