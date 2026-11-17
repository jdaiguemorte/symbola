// Lot 40c (NFR-17, UX-14, JUR-17 ; décision D19, ADR 0078) — contrôle automatique WCAG 2.2 AA dans
// tous les parcours : axe-core avec les étiquettes WCAG 2.0, 2.1 et 2.2 (A et AA), dont la taille
// des cibles (24 px), et les bonnes pratiques qu'il appliquait déjà par défaut. Les parcours
// importent cette classe à la place de celle d'@axe-core/playwright ; leurs appels ne changent pas.
import AxeBuilderBase from "@axe-core/playwright";

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa", "best-practice"];

export default class AxeBuilder extends AxeBuilderBase {
  constructor(options: ConstructorParameters<typeof AxeBuilderBase>[0]) {
    super(options);
    this.withTags(WCAG_TAGS);
  }
}
