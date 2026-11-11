// Lot 25b (ADR 0057) — les jetons de DESIGN.md sont les seules valeurs de la feuille de style.
// Le cahier des charges (§ 5, « Langage visuel ») : les jetons vivent dans DESIGN.md, à la
// racine du dépôt, et aucun écran n'emploie une valeur hors jeton. La compilation refuse déjà
// une classe hors jeton (familles par défaut de Tailwind vidées dans @theme) ; ces tests
// gardent le reste : DESIGN.md et le thème identiques, aucune valeur écrite en dur, contrastes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const designMd = readFileSync(resolve(repoRoot, "DESIGN.md"), "utf8");
const css = readFileSync(resolve(import.meta.dirname, "globals.css"), "utf8");

type Tree = { [key: string]: string | Tree };

/** En-tête YAML de DESIGN.md (clés et valeurs simples, imbriquées par deux espaces). */
function parseFrontMatter(markdown: string): Tree {
  const block = markdown.split(/^---$/m)[1] ?? "";
  const root: Tree = {};
  const stack: { indent: number; node: Tree }[] = [{ indent: -1, node: root }];
  for (const line of block.split("\n")) {
    const match = /^( *)([\w-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const indent = match[1]!.length;
    const key = match[2]!;
    const value = match[3]!.trim().replace(/^["']|["']$/g, "");
    while (stack[stack.length - 1]!.indent >= indent) stack.pop();
    const parent = stack[stack.length - 1]!.node;
    if (value === "") {
      const child: Tree = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      parent[key] = value;
    }
  }
  return root;
}

const design = parseFrontMatter(designMd);
const section = (name: string) => design[name] as Tree;

const themeBlock = /@theme \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const theme = new Map([...themeBlock.matchAll(/--([\w*-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));

/** La feuille hors du bloc @theme et hors des zones « hors charte » (documents de l'organisation). */
const fences = [...css.matchAll(/\/\* jetons:hors-charte:debut([\s\S]*?)\/\* jetons:hors-charte:fin \*\//g)];
const styles = fences.reduce((text, fence) => text.replace(fence[0], ""), css.replace(themeBlock, ""));
/** Pas d'espacement permis : l'échelle de DESIGN.md (4 à 48 px) en pas Tailwind de 4 px. */
const allowedSteps = new Set(["0", "px", ...Object.values(section("spacing")).map((v) => String(parseInt(v as string, 10) / 4))]);

function lines(pattern: RegExp, text = styles): string[] {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("/*") && !line.trim().startsWith("*"))
    .flatMap((line) => [...line.matchAll(pattern)].map((m) => m[0]));
}

describe("Lot 25b — DESIGN.md et le thème disent la même chose (ADR 0057)", () => {
  it("chaque couleur de DESIGN.md est dans le thème, à la même valeur, et le thème n'en a pas d'autre", () => {
    const colors = section("colors");
    for (const [name, value] of Object.entries(colors)) {
      expect(theme.get(`color-${name}`)?.toUpperCase(), name).toBe((value as string).toUpperCase());
    }
    const themeColors = [...theme.keys()].filter((key) => key.startsWith("color-") && key !== "color-*");
    expect(themeColors.map((key) => key.slice("color-".length)).sort()).toEqual(Object.keys(colors).sort());
  });

  it("chaque style de texte a la taille, l'interlignage et la graisse de DESIGN.md", () => {
    for (const [name, spec] of Object.entries(section("typography"))) {
      const style = spec as Tree;
      expect(theme.get(`text-${name}`), name).toBe(style.fontSize);
      expect(theme.get(`text-${name}--line-height`), name).toBe(style.lineHeight);
      expect(theme.get(`text-${name}--font-weight`), name).toBe(style.fontWeight);
      if (style.letterSpacing) expect(theme.get(`text-${name}--letter-spacing`), name).toBe(style.letterSpacing);
    }
  });

  it("les rayons et la seule ombre sont ceux de DESIGN.md", () => {
    for (const [name, value] of Object.entries(section("rounded"))) {
      expect(theme.get(`radius-${name}`), name).toBe(value);
    }
    expect(theme.get("shadow-float")).toBe((section("elevation") as Tree).float);
    expect([...theme.keys()].filter((key) => key.startsWith("shadow-") && key !== "shadow-*")).toEqual(["shadow-float"]);
  });

  it("les familles par défaut de Tailwind sont vidées : une valeur hors jeton ne compile pas", () => {
    for (const family of ["color", "text", "radius", "shadow"]) expect(theme.get(`${family}-*`), family).toBe("initial");
  });

  it("les polices sont Inter (texte) et Space Grotesk (titres et chiffres), servies par l'app", () => {
    expect(theme.get("font-sans")).toMatch(/^var\(--font-inter\)/);
    expect(theme.get("font-display")).toMatch(/^var\(--font-space-grotesk\)/);
    const families = new Set(Object.values(section("typography")).map((style) => (style as Tree).fontFamily));
    expect([...families].sort()).toEqual(["Inter", "Space Grotesk"]);
  });
});

describe("Lot 25b — Aucune valeur hors jeton dans la feuille de style (cahier des charges, § 5)", () => {
  it("aucune couleur écrite en dur : seulement des jetons", () => {
    expect(lines(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g)).toEqual([]);
  });

  it("aucune taille de texte, aucun rayon, aucune ombre ni police entre crochets", () => {
    expect(lines(/(?<![\w-])(?:text|rounded(?:-[a-z]{1,2})?|shadow|font|leading)-\[[^\]]+\]/g)).toEqual([]);
  });

  it("chaque espacement est un pas de l'échelle de DESIGN.md", () => {
    const spacing = lines(
      /(?<![\w[-])-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|scroll-[mp][xytrbl]?)-(\d+(?:\.\d+)?|\[[^\]]*px\])(?![\w.-])/g,
    );
    const offScale = spacing.filter((utility) => {
      const step = /-(\d+(?:\.\d+)?|\[[^\]]*\])$/.exec(utility)![1]!;
      return step.startsWith("[") || !allowedSteps.has(step);
    });
    expect(offScale).toEqual([]);
  });

  it("toute couleur appelée par variable existe dans le thème", () => {
    const used = new Set(lines(/var\(--color-([\w-]+)\)/g).map((match) => match.slice(12, -1)));
    for (const name of used) expect(theme.has(`color-${name}`), name).toBe(true);
  });

  it("les zones hors charte ne servent qu'aux documents à l'image de l'organisation (ADR 0046)", () => {
    expect(fences).toHaveLength(2);
    for (const fence of fences) expect(fence[1]).toContain("ADR 0046");
  });
});

// WCAG 2.2 : 4,5:1 pour le texte (1.4.3), 3:1 pour le bord d'un composant (1.4.11).
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe("UX-14 — Contrastes des jetons (WCAG 2.2 AA)", () => {
  const color = (name: string) => section("colors")[name] as string;

  it.each([
    ["ink", "surface"],
    ["ink", "ground"],
    ["ink-muted", "surface"],
    ["ink-muted", "ground"],
    ["ink-muted", "primary-soft"],
    ["primary", "surface"],
    ["primary", "ground"],
    ["primary", "primary-soft"],
    ["on-primary", "primary"],
    ["on-primary", "primary-strong"],
    ["attention", "attention-soft"],
    ["critical", "critical-soft"],
    ["critical", "surface"],
    ["night-ink", "night"],
    ["night-ink-muted", "night-surface"],
    ["on-night-accent", "night-accent"],
  ])("texte %s sur %s : 4,5:1 au moins", (text, background) => {
    expect(contrast(color(text), color(background))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["line-strong", "surface"],
    ["line-strong", "ground"],
  ])("bord de champ %s sur %s : 3:1 au moins", (border, background) => {
    expect(contrast(color(border), color(background))).toBeGreaterThanOrEqual(3);
  });

  it("le mode Jour J vise 7:1 sur l'écran principal", () => {
    expect(contrast(color("night-ink"), color("night"))).toBeGreaterThanOrEqual(7);
  });
});
