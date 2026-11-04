#!/usr/bin/env bash
# Lot 11 (ADR 0031) — installe le fond de carte du carnet de prestataires :
# un extrait France de Protomaps (PMTiles) et les polices des libellés, dans
# le dossier monté en lecture seule par l'app (MAP_TILES_HOST_DIR).
# À lancer par Julien sur le VPS. Sans argument : affiche seulement la
# taille estimée (rien n'est téléchargé). Avec --install : télécharge.
#
#   sudo bash infra/map/install-map.sh            # taille estimée
#   sudo bash infra/map/install-map.sh --install  # installation
set -euo pipefail

TARGET="${MAP_TILES_HOST_DIR:-/opt/symbola-carte}"
# Construction quotidienne publique de Protomaps (date au format AAAAMMJJ).
BUILD="${PROTOMAPS_BUILD:-20261101}"
SOURCE="https://build.protomaps.com/${BUILD}.pmtiles"
# France métropolitaine et Corse ; zoom 14 suffit pour situer une adresse.
BBOX="-5.5,41.2,9.9,51.3"
MAXZOOM="${MAP_MAXZOOM:-14}"
PMTILES_IMAGE="protomaps/go-pmtiles:v1.31.2"
FONTS_ARCHIVE="https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.tar.gz"

if [[ "${1:-}" != "--install" ]]; then
  echo "Taille estimée de l'extrait (zoom ${MAXZOOM}) :"
  docker run --rm "${PMTILES_IMAGE}" extract "${SOURCE}" /tmp/france.pmtiles --bbox="${BBOX}" --maxzoom="${MAXZOOM}" --dry-run
  echo "Pour installer : sudo bash infra/map/install-map.sh --install"
  exit 0
fi

mkdir -p "${TARGET}/fonts"
docker run --rm -v "${TARGET}:/out" "${PMTILES_IMAGE}" extract "${SOURCE}" /out/france.pmtiles.tmp --bbox="${BBOX}" --maxzoom="${MAXZOOM}"
mv "${TARGET}/france.pmtiles.tmp" "${TARGET}/france.pmtiles"

# Polices des libellés (une seule famille, celle du style de l'app).
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
curl -fsSL "${FONTS_ARCHIVE}" | tar -xz -C "${tmp}"
rm -rf "${TARGET}/fonts/Noto Sans Regular"
cp -r "${tmp}/basemaps-assets-main/fonts/Noto Sans Regular" "${TARGET}/fonts/"

# Lisible par l'utilisateur de l'app dans le conteneur, en lecture seule.
chmod -R a+rX "${TARGET}"
du -sh "${TARGET}"
echo "Fond de carte installé dans ${TARGET}. Redémarrez seulement le service symbola."
