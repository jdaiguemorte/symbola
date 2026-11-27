// Lot 40c (NFR-17, UX-14, JUR-17 ; décision D19, ADR 0078) — contrôle automatique WCAG 2.2 AA dans
// tous les parcours : axe-core avec les étiquettes WCAG 2.0, 2.1 et 2.2 (A et AA), dont la taille
// des cibles (24 px), et les bonnes pratiques qu'il appliquait déjà par défaut. Les parcours
// importent cette classe à la place de celle d'@axe-core/playwright ; leurs appels ne changent pas.
import AxeBuilderBase from "@axe-core/playwright";

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa", "best-practice"];

export default class AxeBuilder extends AxeBuilderBase {
  private readonly scrolledPage: ConstructorParameters<typeof AxeBuilderBase>[0]["page"];

  constructor(options: ConstructorParameters<typeof AxeBuilderBase>[0]) {
    super(options);
    this.scrolledPage = options.page;
    this.withTags(WCAG_TAGS);
  }

  // Lot 70e : la barre du haut est fixe ; une cible que le parcours vient de faire défiler peut passer
  // dessous, et axe la dit « partiellement masquée » (WCAG 2.5.8). On contrôle la page du haut, où la
  // barre ne recouvre rien (la barre elle-même et le défilement au clavier sont couverts par
  // `scroll-padding-top` et par le parcours du lot 70e).
  override async analyze(): ReturnType<AxeBuilderBase["analyze"]> {
    await this.scrolledPage.evaluate(() => window.scrollTo(0, 0));
    return super.analyze();
  }
}
