// Lot 48b (BUD-08, PRE-07, JUR-10, DOC-02, HUB-26 ; D6 à D8 ; ADR 0093) — honoraires hors des dépenses,
// commissions affichées d'office à un particulier et facturées au prestataire (même série, Factur-X,
// chaîne des pièces), modes intermédiaire et revendeur au centime, forfait touristique qui bloque le
// modèle standard, alerte au seuil de franchise de l'Admin, mandat généré depuis le devis. PostgreSQL
// réel (RLS), stockage privé.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { getPlatformSettings, saveOnboardingStep, setPlatformSettings } from "@/modules/hub/service";
import { listBudgetLines } from "@/modules/budget/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { confirmed } from "@/lib/test-fixtures/recipients";
import { minimalPdf } from "@/lib/test-fixtures/pdf";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import { readCiiTotals } from "./facturx/cii";
import {
  actOnFakeSignature,
  addCommission,
  addContractClause,
  addPlannerFeeLine,
  addQuoteLine,
  addScheduleItem,
  addStarterContractTemplates,
  checkContract,
  CommissionAlreadyInvoicedError,
  createContractTemplate,
  createQuote,
  extractFacturXml,
  getCommissionInvoicePdf,
  getQuote,
  InvalidPlannerMoneyError,
  issueBalanceInvoice,
  issueCommissionInvoice,
  listClientCommissions,
  listEventCommissions,
  plannerFeeCents,
  quoteFranchiseAlert,
  quotePackageTravel,
  removeCommission,
  sendQuote,
  sendQuoteForSignature,
  setCommissionShown,
  setPlannerFeeTerms,
  verifyLedger,
} from "./service";

const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
const NOW = new Date("2027-04-10T10:00:00Z");
const render = async () => new Uint8Array(minimalPdf("facture de test"));

afterEach(() => setSignatureProviderForTests(undefined));

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function atelier(vatRegime: "franchise" | "assujetti" = "assujetti") {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`))).id;
  await withDb((db) => saveOnboardingStep(db, organizationId, { vatRegime, vatRateDefaultBasisPoints: vatRegime === "assujetti" ? 2000 : null, siren: "123456782", metier: "wedding_planner" }));
  await fillRequiredMentions(organizationId);
  const planner = await withDb((db) => createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" }));
  const source = await createProspectSource(organizationId, "Salon");
  const eventId = (
    await createProspect({ organizationId, createdByUserId: planner.id, prospectSourceId: source.id, eventDate: "2027-09-18", clients: [{ firstName: "Léa", lastName: "Martin" }], venueName: "Domaine des Tilleuls", venueCity: "Senlis" })
  ).id;
  return { organizationId, plannerId: planner.id, eventId };
}

type Atelier = Awaited<ReturnType<typeof atelier>>;

async function draft(context: Atelier) {
  return createQuote({ organizationId: context.organizationId, eventId: context.eventId, createdByUserId: context.plannerId, now: NOW });
}

async function sign(context: Atelier, quoteId: string) {
  await addScheduleItem(context.organizationId, quoteId, { label: "Acompte à la signature", dueDate: "2027-04-15", percentageBasisPoints: 3000 });
  await sendQuote({ organizationId: context.organizationId, quoteId, now: NOW });
  setSignatureProviderForTests(fakeSignatureProvider());
  const sent = await sendQuoteForSignature(
    confirmed({ organizationId: context.organizationId, quoteId, signers: [{ name: "Léa Martin", email: `lea-${randomUUID()}@example.test`, billingAddress: "4 rue des Lilas, 60300 Senlis" }], documentPdf: PDF, locale: "fr" }),
  );
  for (const signer of sent.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
}

describe("BUD-08 — Honoraires de la planner à part, jamais dans les dépenses (lot 48b, D6)", () => {
  it("forfait et pourcentage du budget estimé ; la ligne d'honoraires va au devis, le budget de l'évènement n'en compte rien", async () => {
    const context = await atelier();
    const before = await listBudgetLines(context.organizationId, context.eventId);
    const terms = await setPlannerFeeTerms(context.organizationId, context.eventId, { kind: "mixed", flatCents: 150_000, percentBasisPoints: 800, base: "estimated" });
    expect(terms).toMatchObject({ kind: "mixed", flatCents: 150_000, percentBasisPoints: 800, vatRateBasisPoints: 2000 });
    expect(plannerFeeCents(terms, { estimatedCents: 3_500_000, committedCents: 0 })).toBe(430_000);
    const quote = await draft(context);
    const withFee = await addPlannerFeeLine(context.organizationId, quote.id, { label: "Honoraires de coordination", amountCents: 430_000 });
    expect(withFee.current.totals.totalHtCents).toBe(430_000);
    const after = await listBudgetLines(context.organizationId, context.eventId);
    expect(after.totalEstimatedCents).toBe(before.totalEstimatedCents);
    expect(after.totalCommittedCents).toBe(before.totalCommittedCents);
    expect(after.lines.some((line) => line.label.includes("Honoraires"))).toBe(false);
    await expect(setPlannerFeeTerms(context.organizationId, context.eventId, { kind: "flat", flatCents: null, percentBasisPoints: null, base: "estimated" })).rejects.toBeInstanceOf(InvalidPlannerMoneyError);
  });
});

describe("JUR-10 — Intermédiaire ou revendeur par ligne, totaux séparés au centime", () => {
  it("la ligne intermédiaire reste hors du total, de la TVA et de la facture de la planner", async () => {
    const context = await atelier();
    const quote = await draft(context);
    await addQuoteLine(context.organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150_001, vatRateBasisPoints: 2000 });
    await addQuoteLine(context.organizationId, quote.id, { label: "Traiteur Maison Haddad", unit: "forfait", quantityMilli: 1000, unitPriceCents: 800_000, vatRateBasisPoints: 1000, supplyMode: "intermediary" });
    const detail = await getQuote(context.organizationId, quote.id);
    expect(detail.current.totals).toMatchObject({ totalHtCents: 150_001, totalVatCents: 30_000, totalTtcCents: 180_001 });
    expect(detail.current.lines.find((line) => line.supplyMode === "intermediary")).toMatchObject({ netCents: 800_000 });
    await sign(context, quote.id);
    const balance = await issueBalanceInvoice({ organizationId: context.organizationId, quoteId: quote.id, renderOriginal: render, now: NOW });
    expect(balance.lines.map((line) => line.label)).toEqual(["Coordination"]);
  });

  it("forfait touristique : alerte, et le modèle de contrat standard est bloqué ; un modèle dédié passe", async () => {
    const context = await atelier();
    const quote = await draft(context);
    await addQuoteLine(context.organizationId, quote.id, { label: "Nuitées au château", unit: "nuit", quantityMilli: 2000, unitPriceCents: 25_000, vatRateBasisPoints: 1000, tourismKind: "lodging" });
    await addQuoteLine(context.organizationId, quote.id, { label: "Excursion en bateau", unit: "forfait", quantityMilli: 1000, unitPriceCents: 60_000, vatRateBasisPoints: 2000, tourismKind: "other" });
    await sendQuote({ organizationId: context.organizationId, quoteId: quote.id, now: NOW });
    expect(await quotePackageTravel(context.organizationId, quote.id)).toBe(true);
    const [standard] = await addStarterContractTemplates(context.organizationId, "fr");
    const check = { organizationId: context.organizationId, quoteId: quote.id, optionalClauseIds: [], channel: "on_premises" as const, smallBusinessConfirmed: false, userId: context.plannerId, locale: "fr" as const };
    expect((await checkContract({ ...check, templateId: standard!.id })).problems).toContainEqual({ kind: "package_travel_template_required" });
    const dedicated = await createContractTemplate({ organizationId: context.organizationId, name: "Forfait touristique", title: "Contrat de forfait touristique", eventTypeId: null, legalReviewedOn: null, kind: "package_travel" });
    await addContractClause(context.organizationId, dedicated.id, { title: "Objet", body: "Selon le devis {devis.numero}.", optional: false, role: null });
    expect((await checkContract({ ...check, templateId: dedicated.id })).problems).not.toContainEqual({ kind: "package_travel_template_required" });
  });

  it("en franchise, alerte à l'approche du seuil fixé par l'Admin ; rien sans seuil", async () => {
    const context = await atelier("franchise");
    const previous = await withDb((db) => getPlatformSettings(db));
    const quote = await draft(context);
    await addQuoteLine(context.organizationId, quote.id, { label: "Coordination et achats revendus", unit: "forfait", quantityMilli: 1000, unitPriceCents: 3_100_000, vatRateBasisPoints: 0 });
    try {
      await withDb((db) => setPlatformSettings(db, { adminUserId: context.plannerId, franchiseThresholdServicesCents: null, franchiseThresholdGoodsCents: previous.franchiseThresholdGoodsCents }));
      expect((await quoteFranchiseAlert(context.organizationId, quote.id, NOW)).alert).toBe("none");
      await withDb((db) => setPlatformSettings(db, { adminUserId: context.plannerId, franchiseThresholdServicesCents: 3_770_000, franchiseThresholdGoodsCents: previous.franchiseThresholdGoodsCents }));
      expect(await quoteFranchiseAlert(context.organizationId, quote.id, NOW)).toMatchObject({ alert: "approaching", quoteCents: 3_100_000, thresholdCents: 3_770_000 });
    } finally {
      await withDb((db) => setPlatformSettings(db, { adminUserId: context.plannerId, franchiseThresholdServicesCents: previous.franchiseThresholdServicesCents, franchiseThresholdGoodsCents: previous.franchiseThresholdGoodsCents }));
    }
  });
});

describe("PRE-07 — Commissions tracées, affichées au client, facturées au prestataire (lot 48b, D6, D8)", () => {
  it("d'office pour un particulier, sans case pour la masquer ; au choix pour un professionnel ; une autre organisation ne voit rien", async () => {
    const context = await atelier();
    const commission = await addCommission(context.organizationId, { eventId: context.eventId, vendorId: null, vendorName: "Fleurs d'Élodie", nature: "commission", percentBasisPoints: 1000, baseCents: 285_005, shownToClient: false });
    expect(commission).toMatchObject({ amountCents: 28_501, status: "expected" });
    expect((await listClientCommissions(context.organizationId, context.eventId, "individual")).map((entry) => entry.id)).toEqual([commission.id]);
    expect(await listClientCommissions(context.organizationId, context.eventId, "professional")).toEqual([]);
    await setCommissionShown(context.organizationId, commission.id, true);
    expect(await listClientCommissions(context.organizationId, context.eventId, "professional")).toHaveLength(1);
    const other = await atelier();
    expect(await listEventCommissions(other.organizationId, context.eventId)).toEqual([]);
  });

  it("la facture de commission prend le numéro suivant de la même série, en Factur-X, dans la chaîne ; une seule par commission", async () => {
    const context = await atelier();
    const quote = await draft(context);
    await addQuoteLine(context.organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150_000, vatRateBasisPoints: 2000 });
    await sign(context, quote.id);
    const balance = await issueBalanceInvoice({ organizationId: context.organizationId, quoteId: quote.id, renderOriginal: render, now: NOW });
    const commission = await addCommission(context.organizationId, { eventId: context.eventId, vendorId: null, vendorName: "Maison Haddad", nature: "commission", amountCents: 45_000 });
    const invoice = await issueCommissionInvoice({
      organizationId: context.organizationId,
      commissionId: commission.id,
      buyer: { name: "Maison Haddad SARL", addressLine: "12 rue du Port", postalCode: "59000", city: "Lille", countryCode: "FR", siret: "55210055400013" },
      label: "Commission — mariage de Léa",
      renderOriginal: render,
      now: NOW,
    });
    expect(balance.number).toBe("F-2027-0001");
    expect(invoice).toMatchObject({ number: "F-2027-0002", amountCents: 54_000, quoteId: "" });
    expect(invoice.buyers[0]).toMatchObject({ kind: "company", name: "Maison Haddad SARL", siren: "552100554" });
    const served = await getCommissionInvoicePdf(context.organizationId, invoice.id, async () => {
      throw new Error("l'original ne doit pas être reconstruit");
    });
    expect(readCiiTotals(extractFacturXml(served.pdf)!).grandTotalCents).toBe(54_000);
    expect((await listEventCommissions(context.organizationId, context.eventId))[0]).toMatchObject({ status: "invoiced", invoice: { id: invoice.id, number: "F-2027-0002" } });
    expect(await verifyLedger(context.organizationId)).toMatchObject({ ok: true });
    await expect(
      issueCommissionInvoice({ organizationId: context.organizationId, commissionId: commission.id, buyer: { name: "X", addressLine: null, postalCode: null, city: null, countryCode: "FR", siret: null }, label: "x", renderOriginal: render, now: NOW }),
    ).rejects.toBeInstanceOf(CommissionAlreadyInvoicedError);
    expect(await removeCommission(context.organizationId, commission.id)).toBe(false);
  });
});

describe("DOC-02 / HUB-26 — Mandat généré depuis le devis, variables manquantes listées (lot 48b)", () => {
  it("le mandat de départ est « à adapter », versionné ; ses variables d'honoraires et de commissions se comblent depuis le devis", async () => {
    const context = await atelier();
    const templates = await addStarterContractTemplates(context.organizationId, "fr");
    const mandate = templates.find((template) => template.kind === "mandate")!;
    expect(templates.map((template) => template.kind)).toEqual(["contract", "mandate", "general_terms"]);
    expect(mandate).toMatchObject({ version: 1, legalReviewedOn: null });
    const quote = await draft(context);
    await addQuoteLine(context.organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150_000, vatRateBasisPoints: 2000 });
    await sendQuote({ organizationId: context.organizationId, quoteId: quote.id, now: NOW });
    const check = { organizationId: context.organizationId, quoteId: quote.id, templateId: mandate.id, optionalClauseIds: [], channel: "on_premises" as const, smallBusinessConfirmed: false, userId: context.plannerId, locale: "fr" as const };
    const missingOf = async () => (await checkContract(check)).problems.flatMap((problem) => (problem.kind === "variable_missing" ? [problem.variable] : []));
    expect(await missingOf()).toEqual(expect.arrayContaining(["devis.honoraires", "devis.commissions", "devis.prestations_intermediaires"]));
    await setPlannerFeeTerms(context.organizationId, context.eventId, { kind: "percent", flatCents: null, percentBasisPoints: 1000, base: "estimated" });
    await addCommission(context.organizationId, { eventId: context.eventId, vendorId: null, vendorName: "Fleurs d'Élodie", nature: "referral", amountCents: 20_000, shownToClient: false });
    expect(await missingOf()).not.toContain("devis.honoraires");
    const text = (await checkContract(check)).clauses.map((clause) => clause.body).join("\n");
    expect(text).toContain("Fleurs d'Élodie : 200,00");
    expect(text).toContain("du budget estimé");
  });
});
