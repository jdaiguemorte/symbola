// Lot 50 — INV-06 (D7) : la synthèse pour le traiteur mise en fichier. Le tableur s'ouvre en colonnes
// justes (marque d'ordre des octets, séparateur « ; », accents, nombres) ; le PDF A4 a sa page de
// totaux puis ses tables, avec les nombres attendus (contenu rendu lu dans le fichier), en français
// et en anglais ; aucun nom dans la version sans nom ; le nom du fichier ne nomme personne.
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { CatererSummary } from "@symbola/contracts";
import { buildCatererSummary, type CatererSummaryInput } from "./caterer-summary";
import { renderCatererSummary } from "./caterer-summary-render";

const input: CatererSummaryInput = {
  version: "nominative",
  eventId: "e1",
  keyMoment: { id: "m1", name: "Dîner", date: "2027-06-12", startTime: "19:30" },
  generatedAt: new Date("2027-06-03T16:00:00Z"),
  dietsPurged: false,
  tables: Array.from({ length: 14 }, (_, index) => ({ id: `t${index}`, name: `Table ${index + 1}`, shape: "round" as const, capacity: 10 })),
  people: Array.from({ length: 120 }, (_, index) => ({
    id: `p${index}`,
    name: `Invitée ${index} Élodie`,
    status: index < 112 ? ("present" as const) : ("pending" as const),
    tableId: index < 110 ? `t${Math.floor(index / 8)}` : null,
    mealTypeId: index % 10 === 0 ? "child" : "adult",
    dietOptionIds: index % 7 === 0 ? ["gluten"] : [],
  })),
  mealTypes: [
    { id: "adult", label: "Adulte", hidden: false },
    { id: "child", label: "Enfant", hidden: false },
    { id: "vendor", label: "Prestataire", hidden: false },
  ],
  dietOptions: [{ id: "gluten", label: "Sans gluten", kind: "diet" }],
  vendorMeals: 4,
  vendorMealTypeId: "vendor",
};

// Texte d'un PDF écrit par @react-pdf/renderer : flux compressés (FlateDecode), chaînes en
// hexadécimal (polices standard, codage WinAnsi), opérateurs Tj et TJ.
function pdfText(pdf: Uint8Array): string {
  const raw = Buffer.from(pdf).toString("latin1");
  const chunks: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      chunks.push(inflateSync(Buffer.from(match[1]!, "latin1")).toString("latin1"));
    } catch {
      // Flux non compressé ou image : ignoré.
    }
  }
  const lines: string[] = [];
  for (const chunk of chunks) {
    for (const op of chunk.matchAll(/\[([^\]]*)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g)) {
      const hex = op[1] !== undefined ? [...op[1].matchAll(/<([0-9a-fA-F]+)>/g)].map((part) => part[1]!).join("") : op[2]!;
      lines.push(Buffer.from(hex, "hex").toString("latin1"));
    }
  }
  return lines.join("\n");
}

describe("INV-06 — Fichiers de la synthèse pour le traiteur (PDF et tableur)", () => {
  it("le tableur : marque d'ordre des octets, « ; », accents intacts, une ligne par personne, nombres en chiffres", async () => {
    const file = await renderCatererSummary(buildCatererSummary(input), "csv", "fr");
    expect(file.contentType).toBe("text/csv; charset=utf-8");
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.body);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("Table;Nom;Type de repas;Régimes et allergies;Nombre;Réponse");
    expect(lines[1]).toBe("Table 1;Invitée 0 Élodie;Enfant;Sans gluten;1;Présent");
    expect(lines.filter((line) => line.endsWith(";Présent"))).toHaveLength(112);
    expect(lines).toContain("Repas prestataires;;Prestataire;;4;");
    expect(lines.filter((line) => line.endsWith(";En attente de réponse"))).toHaveLength(8);
    expect(lines.every((line) => line.split(";").length === 6)).toBe(true);
    expect(file.filename).toBe("synthese-traiteur-nominative-diner-2027-06-12.csv");
  });

  it("le tableur sans nom, en anglais : une ligne par table, puis le total, les prestataires et l'attente", async () => {
    const file = await renderCatererSummary(buildCatererSummary({ ...input, version: "aggregate", mealTypes: input.mealTypes.map((type) => ({ ...type, label: type.id === "adult" ? "Adult" : type.id === "child" ? "Child" : "Vendor" })) }), "csv", "en");
    const lines = new TextDecoder().decode(file.body).trimEnd().split("\r\n");
    expect(lines[0]).toBe("Table;Covers;Adult;Child;Vendor;Sans gluten");
    expect(lines.find((line) => line.startsWith("Total;"))).toBe("Total;112;100;12;0;16");
    expect(lines.find((line) => line.startsWith("No table;"))).toBe("No table;2;1;1;0;0");
    expect(lines.at(-2)).toBe("Vendor meals;4;0;0;4;0");
    expect(lines.at(-1)).toBe("Awaiting an answer;8;8;0;0;2");
    expect(new TextDecoder().decode(file.body)).not.toContain("Invitée");
    expect(file.filename).toBe("caterer-summary-diner-2027-06-12.csv");
  });

  it("le PDF A4 : une page de totaux, puis les tables ; les totaux, la date d'arrêt et la mention de pied", async () => {
    const summary: CatererSummary = buildCatererSummary(input);
    const file = await renderCatererSummary(summary, "pdf", "fr");
    expect(file.contentType).toBe("application/pdf");
    const raw = Buffer.from(file.body).toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw).toMatch(/\/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
    expect((raw.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
    const text = pdfText(file.body);
    expect(text).toContain("Synthèse pour le traiteur");
    expect(text).toContain("Arrêtée au");
    expect(text).toContain("Couverts (personnes présentes)");
    expect(text).toContain("112");
    expect(text).toContain("Repas prestataires");
    expect(text).toContain("Table 14");
    expect(text).toContain("Invitée 0 Élodie");
    expect(text).toContain("à supprimer après l");
    expect(text).toMatch(/Page 1 sur \d/);
  });

  it("le PDF sans nom, en anglais : aucun nom ; sans plan, la mention le dit", async () => {
    const aggregate = await renderCatererSummary(buildCatererSummary({ ...input, version: "aggregate" }), "pdf", "en");
    const text = pdfText(aggregate.body);
    expect(text).toContain("Caterer summary");
    expect(text).not.toContain("Invitée");
    const noPlan = pdfText((await renderCatererSummary(buildCatererSummary({ ...input, version: "aggregate", tables: null }), "pdf", "fr")).body);
    expect(noPlan).toContain("Plan de table non composé");
  });
});
