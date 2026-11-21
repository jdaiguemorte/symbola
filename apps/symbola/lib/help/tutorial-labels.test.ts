// Lot 63a (HUB-11, UX-10 ; recette du 21/11/2026) — un tutoriel nomme les boutons par leur libellé
// à l'écran. La recette a trouvé « Envoyer en signature » dans le tutoriel et « Faire signer » sur
// le devis. Chaque texte cité entre guillemets par un tutoriel doit exister ailleurs : dans les
// textes de l'application (un libellé à variable, « Retenir {vendor} », vaut pour son début), ou
// dans les données de départ (noms d'exemple : « Séminaire express », « Traiteur »).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "@symbola/i18n/messages/fr.json";
import en from "@symbola/i18n/messages/en.json";

type Entry = [path: string, text: string];

function strings(value: unknown, path = ""): Entry[] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => strings(item, path ? `${path}.${key}` : key));
  return [];
}

const HELP_NAMESPACES = ["Tutorials", "TutorialsPage", "HelpCenter", "Help"];
const isHelp = (path: string) => HELP_NAMESPACES.some((name) => path === name || path.startsWith(`${name}.`) || path.startsWith(`${name}[`));

const startersDir = join(__dirname, "../../../../packages/starter-templates/src");
const starterTexts = readdirSync(startersDir)
  .filter((file) => file.endsWith(".json"))
  .flatMap((file) => strings(JSON.parse(readFileSync(join(startersDir, file), "utf8"))).map(([, text]) => text.trim().toLowerCase()))
  .filter((text) => text.length >= 6);

// Un nom d'exemple se cite parfois en entier, parfois en partie : « Séminaire express » pour
// « Séminaire express (exemple) », « l'anniversaire des 40 ans de Camille » pour « Anniversaire
// des 40 ans ».
const isExampleName = (label: string) => {
  const folded = label.toLowerCase();
  return starterTexts.some((text) => text === folded || text.includes(folded) || folded.includes(text));
};

function quoted(text: string, locale: "fr" | "en"): string[] {
  const pattern = locale === "fr" ? /«\s*([^»]+?)\s*»/g : /[“"]([^”"]+)[”"]/g;
  return [...text.matchAll(pattern)].map((match) => match[1]!.trim()).filter((label) => !/^\{\w+\}$/.test(label));
}

function missingLabels(messages: unknown, locale: "fr" | "en"): string[] {
  const all = strings(messages);
  const screen = all.filter(([path]) => !isHelp(path)).map(([, text]) => text.trim());
  const exact = new Set(screen);
  // « Retenir {vendor} » : le début, sans la variable.
  const prefixes = screen.filter((text) => text.includes("{")).map((text) => text.slice(0, text.indexOf("{")).trim()).filter((text) => text.length > 0);
  return all
    .filter(([path]) => path.startsWith("Tutorials."))
    .flatMap(([path, text]) => quoted(text, locale).map((label) => [path, label] as const))
    .filter(([, label]) => !exact.has(label) && !isExampleName(label) && !prefixes.includes(label))
    .map(([path, label]) => `${path} : ${label}`);
}

describe("HUB-11, UX-10 — Les tutoriels parlent comme les écrans (lot 63a)", () => {
  it("chaque libellé cité par un tutoriel français existe dans l'application ou les données d'exemple", () => {
    expect(missingLabels(fr, "fr")).toEqual([]);
  });

  it("chaque libellé cité par un tutoriel anglais existe dans l'application ou les données d'exemple", () => {
    expect(missingLabels(en, "en")).toEqual([]);
  });

  it("le tutoriel de signature et le devis disent tous deux « Faire signer »", () => {
    expect(fr.Quotes.sendForSignature).toBe("Faire signer");
    expect(fr.QuoteRubrics.nextSign).toBe("Faire signer");
    expect(fr.Tutorials["quote-signature"].steps[2]!.body).toContain("« Faire signer »");
    expect(en.Quotes.sendForSignature).toBe(en.QuoteRubrics.nextSign);
  });

  it("la fin d'un tutoriel dit ce qui est devenu de l'exemple, sans « selon votre choix »", () => {
    for (const messages of [fr, en]) {
      expect(messages.Tutorials.doneBody).not.toMatch(/selon votre choix|as you chose/);
      expect(messages.Tutorials.doneBodyKept).toBeTruthy();
      expect(messages.Tutorials.setupNote).toBeTruthy();
    }
  });
});
