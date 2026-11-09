// RGPD-09 (lot 19, ADR 0048) — à la fin de la conservation de la preuve, la
// purge mensuelle remplace en base le nom de la personne d'une demande close
// par le marqueur technique « [anonymisé] » (registre de données). L'écran
// l'affiche dans la langue de la titulaire, jamais tel quel.
import { ANONYMIZED } from "@symbola/privacy";

export function displayPerson(label: string, anonymized: string): string {
  return label === ANONYMIZED ? anonymized : label;
}
