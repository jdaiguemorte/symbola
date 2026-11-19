// Lot 35b (HUB-13, ADR 0097) — taille d'une archive déposée pour la reprise : une limite technique
// (la route lit le corps en mémoire), pas une règle métier. Un export plus lourd se reprend en
// écrivant à Symbola (comme un export de plus de 4 Gio, ADR 0068).
export const ORGANIZATION_IMPORT_MAX_BYTES = 512 * 1024 * 1024;
