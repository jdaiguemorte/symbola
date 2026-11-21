// Lot 62a (UX-13) — une classe employée a une règle.
// Le relevé d'ergonomie du 20/11/2026 (§ 3 F) a trouvé des écrans qui annoncent un style absent de
// la feuille : un bouton « danger » qui a l'allure du bouton principal, un texte « text-muted » sans
// couleur. Ce test compile la feuille de style comme le fait l'app (Tailwind, `globals.css` et les
// fichiers de `app/styles/`), avec toutes les classes employées par les écrans : une classe qui ne
// produit aucune règle fait échouer la suite, sauf si elle est déclarée ci-dessous comme repère.
//
// Ce que le test lit : les attributs `className` (et `…ClassName`), les propriétés `className:` d'un
// objet, les constantes dont le nom finit par `CLASS`, `CLASSES`, `classes` ou `ClassName`, et
// `classList.add/remove/toggle`. Une classe fabriquée ailleurs (une chaîne passée par une autre
// propriété) lui échappe : la nommer par l'une de ces formes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { compile } from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";

const appDir = import.meta.dirname;
const repoRoot = resolve(appDir, "..", "..", "..");
const SCREEN_DIRS = ["apps/symbola/app", "apps/symbola/modules", "packages/ui/src"];

/**
 * Repères : classes sans règle, gardées à dessein. Un repère nomme un bloc de l'écran sans rien
 * changer à son allure (le style vient des éléments et des classes voisines). Avant d'en ajouter
 * un, se demander si la classe annonce un style : si oui, écrire la règle (ou employer la classe
 * qui existe déjà) plutôt que de l'inscrire ici. Le test refuse un repère qui n'est plus employé,
 * ou qui a reçu une règle.
 */
const MARKERS: readonly string[] = [
  // Accueil, démarrage, aide, notifications, tâches.
  "today-risks",
  "setup",
  "onboarding",
  "onboarding-ready",
  "question-form",
  "resume-zone",
  "notification-action",
  "push-device",
  "standalone-task-form",
  "task-calendar",
  "draft-keeper",
  "landmark-extra",
  "logo-upload",
  // Contacts, pipeline, prestataires.
  "identity-facts",
  "merge-form",
  "pipeline",
  "pipeline-page",
  "vendor-links",
  "vendor-map-summary",
  // Fiche d'évènement.
  "add-candidate",
  "candidate-quote",
  "candidates",
  "next-step-later",
  "questionnaire-sent",
  "task-comments",
  "timeline-auto",
  // Réglages des évènements, modèles.
  "client-term-form",
  "questionnaire-editor",
  "template-label",
  // Jour J.
  "day-copy",
  "field-bar-call",
  "field-incident",
  "field-log",
  // Devis, modèles de contrat et de proposition.
  "clause-body",
  "proposal-photos-form",
  "variables",
  // Rendez-vous et réservation publique.
  "appointment-row",
  "booking-form",
  "booking-page",
  "booking-weeks",
  "calendar-sources",
  "question-row",
  // Portail du client, proposition, liens personnels.
  "client-contract",
  "client-options",
  "link-code-form",
  "payers",
  "portal-appointments",
  "proposal-options",
  "proposal-quote",
  "proposal-schedule",
  "proposal-section",
  "proposal-validity",
  // Plans de salle.
  "plan-elements",
  "plan-findings",
  "plan-fixtures",
  "plan-list",
  "plan-power",
  "plan-shared",
  // Import, export, reprise.
  "file-read",
  "job-progress",
  "matches-table",
  "sheet-statuses",
  "takeover",
  // Journal d'activité, envois.
  "activity-action",
  "activity-log",
  "delivery-status",
];
const MARKER_SET = new Set(MARKERS);

/** Fonctions qui assemblent des classes : leurs arguments sont des classes. Les autres appels
    (`t("clé")`, `includes("x")`) n'en portent pas. */
const JOINERS = new Set(["clsx", "cx", "cn", "cva", "twMerge"]);

type Found = { exact: Set<string>; prefixes: Set<string>; suffixes: Set<string> };

function addText(found: Found, text: string, gluedBefore: boolean, gluedAfter: boolean): void {
  const tokens = text.split(/\s+/);
  tokens.forEach((token, index) => {
    if (!token) return;
    // Un morceau collé à une partie calculée (`tone-${x}`) n'est qu'un début ou une fin de classe.
    const isPrefix = gluedAfter && index === tokens.length - 1 && /[-_]$/.test(token);
    const isSuffix = gluedBefore && index === 0 && /^[-_]/.test(token);
    if (isPrefix && isSuffix) return;
    if (isPrefix) found.prefixes.add(token);
    else if (isSuffix) found.suffixes.add(token);
    else found.exact.add(token);
  });
}

/** Fin d'une chaîne ouverte en `start` (guillemet simple ou double). */
function stringEnd(src: string, start: number): number {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length && src[i] !== quote) i += src[i] === "\\" ? 2 : 1;
  return i;
}

/** Lit un gabarit ouvert en `start` : ses morceaux fixes sont des classes, ses parties calculées
    sont lues comme des expressions. Rend la position de l'accent fermant. */
function scanTemplate(src: string, start: number, found: Found, collect: boolean): number {
  let i = start + 1;
  let chunk = "";
  let afterExpr = false;
  const flush = (beforeExpr: boolean) => {
    if (collect) addText(found, chunk, afterExpr && !/^\s/.test(chunk), beforeExpr && !/\s$/.test(chunk));
    chunk = "";
  };
  while (i < src.length && src[i] !== "`") {
    if (src[i] === "\\") {
      chunk += src[i + 1] ?? "";
      i += 2;
    } else if (src[i] === "$" && src[i + 1] === "{") {
      // Après un début de classe (`plan-element--${color ?? "surface"}`), la partie calculée donne
      // la fin du nom : ses chaînes ne sont pas des classes.
      const completesName = /[-_]$/.test(chunk);
      flush(true);
      i = scanExpression(src, i + 2, found, collect && !completesName, "}") + 1;
      afterExpr = true;
    } else {
      chunk += src[i];
      i += 1;
    }
  }
  flush(false);
  return i;
}

const isComparison = (text: string) => /[=!]=$/.test(text.trimEnd());
const startsComparison = (text: string) => /^[=!]=/.test(text.trimStart());

/**
 * Lit une expression à partir de `start`, jusqu'au caractère `until` rencontré hors de toute
 * parenthèse (ou jusqu'à une virgule, si `until` vaut « , »). Rend la position de ce caractère.
 * Ne sont pas des classes : une chaîne comparée (`status === "paid"`), l'argument d'un appel qui
 * n'assemble pas des classes, l'indice d'un accès (`labels["a"]`).
 */
function scanExpression(src: string, start: number, found: Found, collect: boolean, until: string): number {
  const stack: boolean[] = [];
  const collecting = () => collect && stack.every(Boolean);
  let i = start;
  while (i < src.length) {
    const char = src[i]!;
    if (stack.length === 0 && (char === until || (until === "," && (char === "}" || char === ")" || char === ";" || char === "\n")))) return i;
    if (char === '"' || char === "'") {
      const end = stringEnd(src, i);
      if (collecting() && !isComparison(src.slice(start, i)) && !startsComparison(src.slice(end + 1, end + 6))) {
        addText(found, src.slice(i + 1, end), false, false);
      }
      i = end + 1;
    } else if (char === "`") {
      i = scanTemplate(src, i, found, collecting()) + 1;
    } else if (char === "(" || char === "[") {
      const before = src.slice(start, i).trimEnd();
      const callee = /([\w$]+)$/.exec(before)?.[1];
      const isAccessOrCall = callee !== undefined || /[)\]]$/.test(before);
      const keyword = callee !== undefined && ["return", "typeof", "in", "of"].includes(callee);
      stack.push(char === "(" ? !isAccessOrCall || keyword || JOINERS.has(callee ?? "") : !isAccessOrCall || keyword);
      i += 1;
    } else if (char === "{") {
      stack.push(true);
      i += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      if (stack.length === 0) return i;
      stack.pop();
      i += 1;
    } else {
      i += 1;
    }
  }
  return i;
}

/** Les classes qu'emploie un fichier d'écran. */
function classesOf(source: string): Found {
  const found: Found = { exact: new Set(), prefixes: new Set(), suffixes: new Set() };
  // Attributs JSX : className="…" ou className={…} (et triggerClassName, rowClassName…).
  for (const match of source.matchAll(/[cC]lassName=/g)) {
    const at = match.index + match[0].length;
    if (source[at] === '"' || source[at] === "'") addText(found, source.slice(at + 1, stringEnd(source, at)), false, false);
    else if (source[at] === "{") scanExpression(source, at + 1, found, true, "}");
  }
  // Propriétés d'objet (`className: "badge"`) et constantes (`PAID_CLASS = "…"`, `STATUS_CLASSES = {…}`).
  for (const match of source.matchAll(/\bclassName:\s*(?!string\b)/g)) {
    scanExpression(source, match.index + match[0].length, found, true, ",");
  }
  for (const match of source.matchAll(/\b\w*(?:CLASS|CLASSES|[cC]lasses|ClassName)\b(?::[^=\n]+)?\s=\s/g)) {
    scanExpression(source, match.index + match[0].length, found, true, ";");
  }
  for (const match of source.matchAll(/\bclassList\.(?:add|remove|toggle)\(/g)) {
    scanExpression(source, match.index + match[0].length, found, true, ")");
  }
  return found;
}

function screenFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) screenFiles(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

/** Les classes qui ont une règle une fois la feuille compilée avec ces classes (utilitaires compris). */
async function compiledClasses(candidates: string[]): Promise<Set<string>> {
  const require = createRequire(import.meta.url);
  const entry = join(appDir, "globals.css");
  const compiler = await compile(readFileSync(entry, "utf8"), {
    base: appDir,
    from: entry,
    loadStylesheet: async (id, base) => {
      const path = id === "tailwindcss" ? require.resolve("tailwindcss/index.css") : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, "utf8") };
    },
  });
  const css = compiler.build(candidates).replace(/\/\*[\s\S]*?\*\//g, "");
  const classes = new Set<string>();
  for (const selector of css.matchAll(/([^{};]+)\{/g)) {
    if (selector[1]!.trimStart().startsWith("@")) continue;
    for (const name of selector[1]!.matchAll(/\.((?:\\.|[\w-])+)/g)) classes.add(name[1]!.replace(/\\(.)/g, "$1"));
  }
  return classes;
}

describe("UX-13 — le test sait lire les classes d'un écran (lot 62a)", () => {
  const exact = (source: string) => [...classesOf(source).exact].sort();

  it("lit un attribut simple et les deux branches d'une condition", () => {
    expect(exact(`<p className="card today-risks" />`)).toEqual(["card", "today-risks"]);
    expect(exact(`<p className={late ? "text-overdue" : "muted"} />`)).toEqual(["muted", "text-overdue"]);
  });

  it("ne prend pas pour une classe la valeur à laquelle un état est comparé", () => {
    // Le relevé comptait « overdue », « paid », « signed », « declined » et « pending » parmi les
    // classes sans règle : ce sont des valeurs comparées, jamais posées sur un élément.
    expect(exact(`<span className={payment.status === "overdue" ? "text-overdue" : undefined} />`)).toEqual(["text-overdue"]);
    expect(exact(`<span className={"paid" !== status ? "badge-warning" : "meta"} />`)).toEqual(["badge-warning", "meta"]);
  });

  it("ne prend pas pour une classe l'argument d'un appel ni l'indice d'un accès", () => {
    expect(exact(`<span className={labels["short"] ?? t("fallback")} />`)).toEqual([]);
    expect(exact(`<span className={clsx("badge", on && "badge-sauge")} />`)).toEqual(["badge", "badge-sauge"]);
  });

  it("lit un gabarit : ses morceaux fixes, ses conditions, et le début d'une classe calculée", () => {
    const found = classesOf("<td className={`agenda-day tone-${tone}${weekend ? \" is-weekend\" : \"\"}`} />");
    expect([...found.exact].sort()).toEqual(["agenda-day", "is-weekend"]);
    expect([...found.prefixes]).toEqual(["tone-"]);
    expect(exact("<li className={`row${open ? \" row-open\" : \"\"}`} />")).toEqual(["row", "row-open"]);
  });

  it("lit les constantes de classes, les propriétés className et classList", () => {
    expect(exact(`export const PAID_CLASS = "badge badge-sauge";`)).toEqual(["badge", "badge-sauge"]);
    expect(exact(`const STATUS_CLASSES: Record<Status, string> = { draft: "badge", sent: "badge badge-bleu" };`)).toEqual(["badge", "badge-bleu"]);
    expect(exact(`return { label: t("late"), className: soon ? "badge badge-terracotta" : "badge" };`)).toEqual(["badge", "badge-terracotta"]);
    expect(exact(`element.classList.add("landmark-active");`)).toEqual(["landmark-active"]);
    expect(exact(`function Outline({ className }: { className: string }) {}`)).toEqual([]);
  });
});

describe("UX-13 — une classe employée a une règle (lot 62a)", () => {
  const used = new Map<string, Set<string>>();
  const prefixes = new Map<string, Set<string>>();
  const suffixes = new Map<string, Set<string>>();
  let ruled = new Set<string>();

  beforeAll(async () => {
    const note = (map: Map<string, Set<string>>, names: Set<string>, file: string) => {
      for (const name of names) map.set(name, (map.get(name) ?? new Set()).add(relative(repoRoot, file)));
    };
    for (const dir of SCREEN_DIRS) {
      for (const file of screenFiles(join(repoRoot, dir))) {
        const found = classesOf(readFileSync(file, "utf8"));
        note(used, found.exact, file);
        note(prefixes, found.prefixes, file);
        note(suffixes, found.suffixes, file);
      }
    }
    ruled = await compiledClasses([...used.keys()]);
  });

  const where = (map: Map<string, Set<string>>, name: string) => `${name} (${[...(map.get(name) ?? [])].join(", ")})`;

  it("lit les écrans : plusieurs centaines de classes, dont celles des motifs du lot 62", () => {
    expect(used.size).toBeGreaterThan(500);
    for (const name of ["card", "badge", "sr-only", "button-danger", "notice-error"]) expect(used.has(name), name).toBe(true);
  });

  it("chaque classe employée par un écran a une règle, ou est un repère déclaré", () => {
    const orphans = [...used.keys()].filter((name) => !ruled.has(name) && !MARKER_SET.has(name)).sort();
    expect(orphans.map((name) => where(used, name))).toEqual([]);
  });

  it("chaque début ou fin de classe calculée correspond à une règle au moins", () => {
    const names = [...ruled];
    const orphanPrefixes = [...prefixes.keys()].filter((prefix) => !names.some((name) => name.startsWith(prefix))).sort();
    const orphanSuffixes = [...suffixes.keys()].filter((suffix) => !names.some((name) => name.endsWith(suffix))).sort();
    expect([...orphanPrefixes.map((name) => where(prefixes, name)), ...orphanSuffixes.map((name) => where(suffixes, name))]).toEqual([]);
  });

  it("la liste des repères est à jour : chacun est encore employé, et n'a toujours pas de règle", () => {
    expect([...MARKER_SET].filter((name) => !used.has(name)).sort(), "repères qui ne sont plus employés").toEqual([]);
    expect([...MARKER_SET].filter((name) => ruled.has(name)).sort(), "repères qui ont reçu une règle").toEqual([]);
    expect(MARKERS.length, "repère inscrit deux fois").toBe(MARKER_SET.size);
  });

  it("les classes retirées par le lot 62a ne reviennent pas", () => {
    // « danger » est devenu « button-danger » ; les trois autres n'avaient pas d'objet.
    for (const name of ["danger", "checkbox-label", "link-form", "primary-button"]) {
      expect(used.has(name), where(used, name)).toBe(false);
      expect(MARKER_SET.has(name), name).toBe(false);
    }
  });
});

describe("UX-13 — une ligne de formulaire dit sa direction (lot 62a)", () => {
  // La règle de base met un formulaire en colonne. Une classe qui écrit « flex items-end » sans dire
  // « flex-row », posée sur un formulaire, garde la colonne et pousse chaque champ contre le bord
  // droit : c'était « form-inline » avant le lot 61, puis six autres règles relevées le 20/11/2026.
  const sheets = [join(appDir, "globals.css"), ...readdirSync(join(appDir, "styles")).map((name) => join(appDir, "styles", name))]
    .map((file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""))
    .join("\n");
  const rules = [...sheets.matchAll(/([^{};]+)\{\s*@apply ([^;]+);/g)].map((match) => ({
    selector: match[1]!.trim().replace(/\s+/g, " "),
    utilities: match[2]!.trim().split(/\s+/),
  }));
  const saysDirection = (utilities: string[]) => utilities.some((utility) => /^(?:[\w-]+:)*flex-(?:row|col)(?:-reverse)?$/.test(utility));

  it.each(["inline-add", "matches-manual", "pay-add", "postpone form", "seating-form", "field-prep", "form-inline"])("« %s » dit « flex-row »", (name) => {
    const rule = rules.find((candidate) => candidate.selector.split(",").some((selector) => selector.trim() === `.${name}`));
    expect(rule, name).toBeDefined();
    expect(rule!.utilities).toContain("flex");
    expect(rule!.utilities).toContain("flex-row");
  });

  it("aucune règle n'aligne ses éléments en bas (« items-end ») sans dire sa direction", () => {
    const silent = rules.filter((rule) => rule.utilities.includes("flex") && rule.utilities.includes("items-end") && !saysDirection(rule.utilities));
    expect(silent.map((rule) => rule.selector)).toEqual([]);
  });
});
