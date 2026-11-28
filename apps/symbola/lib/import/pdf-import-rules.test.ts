// Lot 71e (HUB-14, PRE-01, PRE-02, CHR-06, CHR-08 ; spécification du lot 71, § 5.5, critères 1, 2, 3 et
// 5 ; maquettes 10 et 11) — les règles pures de l'aperçu des deux PDF, sur les fichiers fictifs du
// corpus (packages/testing/import-corpus/files/logiciel-tiers/).
import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { DEFAULT_PDF_LIMITS, parseEventVendorsExport, parseProgramExport, readPdfText, type EventVendorsExport, type PdfPage, type ProgramExport } from "@symbola/import-engine";
import { planningSoftwareProfile, starterVendorTypeSynonymGroups } from "@symbola/starter-templates";
import { programRowsFromExport } from "@/modules/events/program-import-rules";
import { budgetRankingData } from "./slot-ranking";
import { coupleCheck, programDayKind, programDays, programFigures, programFileCouple, vendorsFigures, vendorsFileCouple, vendorsPreviewRows, type VendorsPreviewContext } from "./pdf-import-rules";

const profile = planningSoftwareProfile();
const calendar = { weekdays: profile.eventSheet.weekdays, months: profile.eventSheet.months };

async function pages(name: string, maxPages: number): Promise<PdfPage[]> {
  const read = await readPdfText(readImportCorpusFile(`logiciel-tiers/${name}`), { ...DEFAULT_PDF_LIMITS, maxPages });
  if (!read.ok) throw new Error(read.reason);
  return read.pages;
}

async function vendorsExport(): Promise<EventVendorsExport> {
  const parsed = parseEventVendorsExport(await pages("prestataires-evenement.pdf", profile.eventVendorsExport.maxPages), profile.eventVendorsExport, {
    calendar,
    footerPrefix: profile.programExport.footerPrefix,
    plannerRoles: profile.programExport.plannerRoles,
  });
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.export;
}

async function programExport(name: string): Promise<ProgramExport> {
  const parsed = parseProgramExport(await pages(name, profile.programExport.maxPages), profile.programExport, calendar);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.program;
}

const leaHugo = [
  { firstName: "Léa", lastName: "Martin" },
  { firstName: "Hugo", lastName: "Bernard" },
];

// Un mariage aux postes de départ courants, et un carnet qui connaît déjà quelques fiches.
const slots = ["Lieu de réception", "Traiteur", "Photographe", "Vidéaste", "Musique et animation", "Fleuriste", "Coiffure et maquillage", "Tenues", "Décoration"].map((label, index) => ({ id: `slot-${index}`, label, vendorNames: [] as string[] }));
const context = (overrides: Partial<VendorsPreviewContext> = {}): VendorsPreviewContext => ({
  slots,
  carnet: [
    { id: "v-studio", name: "Studio Lumière", city: null },
    { id: "v-iris", name: "Iris Beauté", city: null },
    { id: "v-tilleuls", name: "Domaine des Tilleuls", city: null },
    { id: "v-nuit", name: "Nuit Blanche Sono", city: null },
    { id: "v-films", name: "La Boîte à Films", city: null },
  ],
  types: [{ id: "t-baby", label: "Baby-sitting" }],
  engaged: [],
  ranking: budgetRankingData(),
  synonymGroups: starterVendorTypeSynonymGroups(),
  ...overrides,
});

describe("HUB-14 — Le fichier d'un autre couple (lot 71e, critère 1)", () => {
  it("prestataires-evenement.pdf (« Clémence MARTIN, Bastien LEROY ») n'est pas le fichier de « Léa & Hugo »", async () => {
    expect(coupleCheck(vendorsFileCouple((await vendorsExport()).clients), leaHugo)).toBe("different");
  });

  it("« Léa MARTIN » seule suffit à ne rien demander ; « Martin » seul ne suffit pas", () => {
    expect(coupleCheck(vendorsFileCouple(["Léa MARTIN"]), leaHugo)).toBe("same");
    expect(coupleCheck(vendorsFileCouple(["MARTIN"]), leaHugo)).toBe("different");
  });

  it("le programme nomme le couple par ses prénoms (titre, « Mariée - Clémence ») : un autre couple aussi", async () => {
    const program = await programExport("programme-jour-j.pdf");
    expect(programFileCouple(program).map((person) => person.firstName)).toEqual(expect.arrayContaining(["Clémence", "Bastien"]));
    expect(coupleCheck(programFileCouple(program), leaHugo)).toBe("different");
    expect(coupleCheck(programFileCouple(program), [{ firstName: "Clémence", lastName: "Martin" }])).toBe("same");
  });
});

describe("PRE-02 — L'aperçu des prestataires retenus (lot 71e, critères 2 et 3)", () => {
  it("chaque ligne dit sa fiche du carnet et son poste en entier ; la ligne de l'agence est écartée", async () => {
    const rows = vendorsPreviewRows((await vendorsExport()).rows, context(), {}, null);
    const byName = new Map(rows.map((row) => [row.name, row]));
    expect(byName.get("Studio Lumière")).toMatchObject({ vendorMatch: "found", vendor: { id: "v-studio" }, slot: { kind: "existing", label: "Photographe" }, verify: null });
    expect(byName.get("Domaine des Tilleuls")).toMatchObject({ vendorMatch: "found", slot: { kind: "existing", label: "Lieu de réception" }, verify: null });
    expect(byName.get("Iris Beauté")).toMatchObject({ slot: { kind: "existing", label: "Coiffure et maquillage" } });
    expect(byName.get("Belle Journée")).toMatchObject({ planner: true, skip: true, verify: null });
  });

  it("seules les lignes incertaines sont « À vérifier », avec leur raison", async () => {
    const rows = vendorsPreviewRows((await vendorsExport()).rows, context(), {}, null);
    const verify = rows.filter((row) => row.verify !== null).map((row) => [row.name, row.verify]);
    // Trois métiers sans poste proche : un poste aux mots de l'agence sera créé.
    expect(verify).toEqual([
      ["Les P'tits Loups", "no_slot"],
      ["FlashBooth", "no_slot"],
      ["Atelier de Margot", "no_slot"],
    ]);
    expect(rows.find((row) => row.name === "Les P'tits Loups")?.slot).toEqual({ kind: "new", label: "Baby-sitting" });
    expect(rows.find((row) => row.name === "Nuit Blanche Sono")?.slot).toMatchObject({ kind: "existing", label: "Musique et animation" });
  });

  it("une fiche du carnet qui ressemble sans être la même est « À vérifier » (doublon possible)", async () => {
    const rows = vendorsPreviewRows((await vendorsExport()).rows, context({ carnet: [{ id: "v-films", name: "La Boîte à Films Mariage", city: null }] }), {}, null);
    expect(rows.find((row) => row.name === "La Boîte à Films")).toMatchObject({ vendorMatch: "possible", vendor: { id: "v-films" }, verify: "possible_vendor" });
  });

  it("un choix de la planner retire « À vérifier » et l'emporte ; une fiche ou un poste d'une autre organisation est ignoré", async () => {
    const exported = (await vendorsExport()).rows;
    const line = exported.find((row) => row.name === "La Boîte à Films")!.line;
    const decided = vendorsPreviewRows(exported, context(), { vendorRows: [{ line, vendor: "new", slot: "slot-3" }] }, null);
    expect(decided.find((row) => row.line === line)).toMatchObject({ vendorMatch: "new", vendor: null, slot: { kind: "existing", id: "slot-3" }, verify: null });
    const foreign = vendorsPreviewRows(exported, context(), { vendorRows: [{ line, vendor: "v-ailleurs", slot: "slot-ailleurs" }] }, null);
    expect(foreign.find((row) => row.line === line)).toMatchObject({ vendor: { id: "v-films" }, slot: { kind: "existing", label: "Vidéaste" } });
  });

  it("Tous, Aucun, Ligne par ligne donnent les contrats annoncés", async () => {
    const exported = (await vendorsExport()).rows;
    const count = (answer: Parameters<typeof vendorsPreviewRows>[3]) => vendorsFigures(vendorsPreviewRows(exported, context(), {}, answer));
    expect(count({ contracts: { answer: "all" } })).toMatchObject({ vendors: 12, signed: 12, unsigned: 0, unknownContracts: 0 });
    expect(count({ contracts: { answer: "none" } })).toMatchObject({ signed: 0, unsigned: 12 });
    expect(count({ contracts: { answer: "per_line", signedRows: [1, 2, 3] } })).toMatchObject({ signed: 3, unsigned: 9 });
    expect(count(null)).toMatchObject({ unknownContracts: 12 });
  });

  it("les nombres de « Vérifier » s'additionnent : trouvés + créées = retenus", async () => {
    const figures = vendorsFigures(vendorsPreviewRows((await vendorsExport()).rows, context(), {}, { contracts: { answer: "all" } }));
    expect(figures.foundInCarnet + figures.createdFiches).toBe(figures.vendors);
    expect(figures.foundInCarnet).toBe(5);
    expect(figures.createdFiches).toBe(7);
  });

  it("un prestataire déjà retenu sur son poste n'est pas compté deux fois", async () => {
    const exported = (await vendorsExport()).rows;
    const rows = vendorsPreviewRows(exported, context({ engaged: [{ slotId: "slot-2", vendorId: "v-studio", vendorName: "Studio Lumière" }] }), {}, null);
    expect(rows.find((row) => row.name === "Studio Lumière")?.alreadyRetained).toBe(true);
    expect(vendorsFigures(rows).vendors).toBe(11);
  });
});

describe("CHR-08 — Le programme repris d'un PDF n'invente aucune heure (lot 71e, critère 5)", () => {
  for (const name of ["programme-jour-j.pdf", "programme-jour-j-court.pdf"]) {
    it(`${name} : aucune heure de fin qui ne soit pas dans le fichier`, async () => {
      const program = await programExport(name);
      const { rows } = programRowsFromExport(program, { eventDate: program.eventDate }, new Map(), new Map());
      const source = (await pages(name, profile.programExport.maxPages)).flatMap((page) => page.items.map((item) => item.text)).join(" ");
      for (const row of rows) {
        if (row.endTime === null) continue;
        expect(source).toContain(`${row.startTime} - ${row.endTime}`);
      }
    });
  }

  it("la soirée de la veille finit « le lendemain » ; une fin à minuit est laissée vide et dite ; une ligne sans interlocuteur ni fin est un repère", async () => {
    const program = await programExport("programme-jour-j.pdf");
    const { rows } = programRowsFromExport(program, { eventDate: program.eventDate }, new Map(), new Map());
    expect(rows.find((row) => row.label === "Soirée de la veille")).toMatchObject({ startTime: "19:00", endTime: "02:00", endsNextDay: true, timing: "span" });
    expect(rows.find((row) => row.label === "Repas à la charge des mariés")).toMatchObject({ endTime: null, midnightEnd: true, timing: "span" });
    expect(rows.find((row) => row.label === "Coucher du soleil")).toMatchObject({ endTime: null, timing: "marker" });
  });

  it("les journées portent le nom du lot 67d (Veille, Jour J, Lendemain) ; les nombres de « Vérifier »", async () => {
    const program = await programExport("programme-jour-j.pdf");
    const { rows } = programRowsFromExport(program, { eventDate: program.eventDate }, new Map(), new Map());
    expect(programDays(rows, program.eventDate).map((day) => day.kind)).toEqual(["eve", "main", "nextDay"]);
    const figures = programFigures(rows, program.speakers.length);
    expect(figures).toMatchObject({ days: 3, moments: rows.length, markers: rows.filter((row) => row.timing === "marker").length, directory: 8 });
    expect(figures.endsMissing).toBe(rows.filter((row) => row.timing === "span" && row.endTime === null).length);
    expect(figures.endsMissing).toBeGreaterThan(0);
  });

  it("un moment de 23 h à 1 h la nuit du passage à l'heure d'été garde ses heures locales et finit le lendemain", () => {
    const program: ProgramExport = {
      title: "Mariage Léa & Hugo",
      eventDate: "2027-03-27",
      speakers: [],
      rows: [{ line: 1, date: "2027-03-27", startTime: "23:00", endTime: "01:00", endsNextDay: true, title: "Soirée", description: null, contacts: [{ text: "DJ - Félix", role: "DJ", name: "Félix", kind: "vendor" }], hiddenFromClients: false, marker: false }],
    };
    const { rows } = programRowsFromExport(program, { eventDate: "2027-03-27" }, new Map(), new Map());
    expect(rows[0]).toMatchObject({ momentDate: "2027-03-27", startTime: "23:00", endTime: "01:00", endsNextDay: true });
    expect(programDayKind("2027-03-28", "2027-03-27")).toBe("nextDay");
  });
});
