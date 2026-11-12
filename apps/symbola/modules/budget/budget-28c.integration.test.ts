// Lot 28c — HT et TTC selon le client (BUD-09, D5, ADR 0059) et export XLSX du
// budget (BUD-10, D6), contre un vrai PostgreSQL (RLS), par les portes d'entrée
// des modules.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { AUDIT_ACTIONS } from "@symbola/contracts";
import { createAppConnection } from "@symbola/db/client";
import { readImportFile, ZipArchive } from "@symbola/import-engine";
import { addDefaultVendorSlots, createProspect, createProspectSource, listEventVendorSlots } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { createQuote, setQuoteClientKind } from "@/modules/quotes/service";
import { createXlsx } from "@/lib/xlsx-workbook";
import { budgetXlsxSheets, buildBudgetExport, type BudgetExportLabels } from "@/app/budget/[eventId]/export/budget-export";
import { BudgetLineNotFoundError, addBudgetLine, addVendorPayment, listBudgetLines, updateBudgetLine, updateBudgetLineDetails } from "./service";

const plannerId = randomUUID();
const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function organization(): Promise<string> {
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null });
  return organizationId;
}

async function wedding(organizationId: string) {
  await addDefaultVendorSlots(organizationId, ["Traiteur", "Musique"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }] });
  const slots = await listEventVendorSlots(organizationId, event.id);
  return { eventId: event.id, slot: (label: string) => slots.find((entry) => entry.label === label)! };
}

// Traiteur : dîner 1 200,00 € TTC à 20 %, vin 1 100,00 € TTC à 10 % ; Musique :
// DJ 500,00 € TTC à 0 % (franchise).
async function budgetWithRates(organizationId: string) {
  const { eventId, slot } = await wedding(organizationId);
  const lines: Record<string, string> = {};
  for (const [category, label, cents, rate] of [
    ["Traiteur", "Dîner", 120000, 2000],
    ["Traiteur", "Vin", 110000, 1000],
    ["Musique", "DJ", 50000, 0],
  ] as const) {
    const view = await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot(category).id, label });
    const lineId = view.lines.find((line) => line.label === label)!.id;
    lines[label] = lineId;
    await updateBudgetLine({ organizationId, eventId, lineId, field: "committed", amountCents: cents, changedByUserId: plannerId });
    await updateBudgetLineDetails({ organizationId, eventId, lineId, vatRateBasisPoints: rate });
  }
  return { eventId, slot, lines };
}

describe("BUD-09 — Affichage TTC ou HT selon le client (lot 28c, D5)", () => {
  it("sans devis, le client est un particulier ; une ligne prend le taux de départ des modèles (20 %)", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    const view = await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Traiteur").id, field: "committed", amountCents: 960000, changedByUserId: plannerId });
    expect(view.clientKind).toBe("individual");
    expect(view.lines[0]).toMatchObject({ vatRateBasisPoints: 2000, committedAmountCents: 960000, ht: { committedCents: 800000, estimatedCents: null } });
    expect(view.totalHt.committedCents).toBe(800000);
  });

  it("le HT se calcule au taux de chaque ligne, puis par taux pour les totaux de la catégorie et du budget", async () => {
    const organizationId = randomUUID();
    const { eventId } = await budgetWithRates(organizationId);
    const view = await listBudgetLines(organizationId, eventId);
    const line = (label: string) => view.lines.find((entry) => entry.label === label)!;
    expect([line("Dîner").vatRateBasisPoints, line("Vin").vatRateBasisPoints, line("DJ").vatRateBasisPoints]).toEqual([2000, 1000, 0]);
    expect([line("Dîner").ht.committedCents, line("Vin").ht.committedCents, line("DJ").ht.committedCents]).toEqual([100000, 100000, 50000]);
    const caterer = view.categories.find((category) => category.label === "Traiteur")!;
    expect(caterer).toMatchObject({ committedCents: 230000, ht: { committedCents: 200000, remainingCents: 200000 } });
    expect(view).toMatchObject({ totalCommittedCents: 280000, totalHt: { committedCents: 250000 } });
  });

  it("les TTC d'un même taux sont additionnés avant d'être convertis (ADR 0059) : 3 × 1,00 € à 20 % font 2,50 € HT, pas 2,49 €", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    for (const label of ["Dragées", "Faire-part", "Menus"]) {
      const view = await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Traiteur").id, label });
      await updateBudgetLine({ organizationId, eventId, lineId: view.lines.find((line) => line.label === label)!.id, field: "estimated", amountCents: 100, changedByUserId: plannerId });
    }
    const view = await listBudgetLines(organizationId, eventId);
    expect(view.lines.map((line) => line.ht.estimatedCents)).toEqual([83, 83, 83]);
    expect(view.categories[0]!.ht.estimatedCents).toBe(250);
    expect(view.totalHt.estimatedCents).toBe(250);
  });

  it("un taux hors de 0 à 100 %, ou à plus de deux décimales, est refusé ; 5,5 % est accepté", async () => {
    const organizationId = randomUUID();
    const { eventId, lines } = await budgetWithRates(organizationId);
    for (const rate of [10001, -1, 2000.5]) {
      await expect(updateBudgetLineDetails({ organizationId, eventId, lineId: lines.Dîner!, vatRateBasisPoints: rate })).rejects.toMatchObject({
        name: "BudgetLineDetailsInvalidError",
        reason: "vat",
      });
    }
    await updateBudgetLineDetails({ organizationId, eventId, lineId: lines.Dîner!, vatRateBasisPoints: 550 });
    expect((await listBudgetLines(organizationId, eventId)).lines.find((line) => line.label === "Dîner")!.vatRateBasisPoints).toBe(550);
  });

  it("le mode suit le type d'acheteur du devis de l'événement, sans réglage manuel", async () => {
    const organizationId = await organization();
    const { eventId } = await budgetWithRates(organizationId);
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId });
    expect((await listBudgetLines(organizationId, eventId)).clientKind).toBe("individual");
    await setQuoteClientKind(organizationId, quote.id, "professional");
    expect((await listBudgetLines(organizationId, eventId)).clientKind).toBe("professional");
  });

  it("isolation : une autre organisation ne change pas le taux d'une ligne, et ne lit rien du budget", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    const { eventId, lines } = await budgetWithRates(organizationA);
    await expect(updateBudgetLineDetails({ organizationId: organizationB, eventId, lineId: lines.Dîner!, vatRateBasisPoints: 0 })).rejects.toBeInstanceOf(BudgetLineNotFoundError);
    expect((await listBudgetLines(organizationA, eventId)).lines.find((line) => line.label === "Dîner")!.vatRateBasisPoints).toBe(2000);
    const seenByB = await listBudgetLines(organizationB, eventId);
    expect(seenByB.lines).toEqual([]);
    expect(seenByB.totalHt.committedCents).toBe(0);
  });
});

const LABELS: BudgetExportLabels = {
  sheetBudget: "Budget",
  sheetPayments: "Échéances",
  category: "Catégorie",
  line: "Ligne",
  vendor: "Prestataire",
  vatRate: "Taux de TVA",
  amounts: { estimated: "Estimé", quoted: "Devisé", committed: "Engagé", paid: "Payé", remaining: "Reste à payer", variance: "Écart" },
  ttc: (label) => `${label} TTC`,
  ht: (label) => `${label} HT`,
  categoryTotal: "Total de la catégorie",
  total: "Total",
  payment: "Échéance",
  paymentAmount: "Montant TTC",
  dueOn: "Date d'échéance",
  status: "Statut",
  paidOn: "Payée le",
  statuses: { due: "À payer", overdue: "En retard", paid: "Payée" },
};

function workbookOf(view: Awaited<ReturnType<typeof listBudgetLines>>) {
  const bytes = new Uint8Array(createXlsx({ title: "Budget", author: "Atelier", headerColor: "#334155", sheets: budgetXlsxSheets(buildBudgetExport(view, LABELS), LABELS) }));
  const read = readImportFile(bytes, { maxBytes: 5_000_000, maxRows: 1000 });
  if (!read.ok) throw new Error(`classeur illisible : ${read.reason}`);
  return { table: read.table, zip: new ZipArchive(bytes, 5_000_000) };
}

describe("BUD-10 — Export XLSX du budget (lot 28c, D6)", () => {
  it("particulier : feuille « Budget » avec catégories, lignes, cinq montants et écart TTC, totaux exacts au centime", async () => {
    const organizationId = randomUUID();
    const { eventId } = await budgetWithRates(organizationId);
    const { table } = workbookOf(await listBudgetLines(organizationId, eventId));
    expect(table.headers).toEqual(["Catégorie", "Ligne", "Prestataire", "Estimé TTC", "Devisé TTC", "Engagé TTC", "Payé TTC", "Reste à payer TTC", "Écart TTC"]);
    expect(table.rows.map((row) => [row[0], row[1], row[5]])).toEqual([
      ["Traiteur", "Total de la catégorie", "2300"],
      ["Traiteur", "Dîner", "1200"],
      ["Traiteur", "Vin", "1100"],
      ["Musique", "Total de la catégorie", "500"],
      ["Musique", "DJ", "500"],
      ["Total", "", "2800"],
    ]);
  });

  it("professionnel : taux de TVA, puis HT et TTC côte à côte pour chaque montant", async () => {
    const organizationId = await organization();
    const { eventId } = await budgetWithRates(organizationId);
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId });
    await setQuoteClientKind(organizationId, quote.id, "professional");
    const { table } = workbookOf(await listBudgetLines(organizationId, eventId));
    expect(table.headers.slice(3, 10)).toEqual(["Taux de TVA", "Estimé HT", "Estimé TTC", "Devisé HT", "Devisé TTC", "Engagé HT", "Engagé TTC"]);
    const dinner = table.rows.find((row) => row[1] === "Dîner")!;
    expect([dinner[3], dinner[8], dinner[9]]).toEqual(["0.2", "1000", "1200"]);
    expect(table.rows.at(-1)!.slice(8, 10)).toEqual(["2500", "2800"]);
  });

  it("feuille « Échéances » : chaque échéance avec son montant, sa date et son statut", async () => {
    const organizationId = randomUUID();
    const { eventId, lines } = await budgetWithRates(organizationId);
    await addVendorPayment({ organizationId, eventId, lineId: lines.Dîner!, label: "Acompte", percentageBasisPoints: 3000, dueOn: "2027-03-01", changedByUserId: plannerId });
    const { zip } = workbookOf(await listBudgetLines(organizationId, eventId));
    const sheet = zip.readText("xl/worksheets/sheet2.xml")!;
    expect(sheet).toContain(">Acompte<");
    expect(sheet).toContain("<v>360.00</v>");
    expect(zip.readText("xl/workbook.xml")).toContain('<sheet name="Échéances"');
  });

  it("l'export est journalisé dans la famille « exports », rattaché à l'événement", () => {
    expect(AUDIT_ACTIONS["budget.budget.exported"]).toEqual({ category: "export", objectType: "event" });
  });
});
