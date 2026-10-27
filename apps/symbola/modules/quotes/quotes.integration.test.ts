// DEV-01 — catalogue et composition d'un devis, contre un vrai PostgreSQL
// (RLS, ADR 0012), par la porte d'entrée du module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { changeVatRegime, saveOnboardingStep } from "@/modules/hub/service";
import { createProspect, createProspectSource, startEventsTrial } from "@/modules/events/service";
import {
  CatalogItemNotFoundError,
  EventNotFoundError,
  QuoteEmptyError,
  QuoteNotFoundError,
  QuoteVatRegimeRequiredError,
  QuoteVersionLockedError,
  addQuoteLine,
  archiveCatalogItem,
  createCatalogItem,
  createQuote,
  getQuote,
  getQuoteSettings,
  listCatalogItems,
  listEventQuotes,
  removeEventQuotesData,
  removeQuoteLine,
  reviseQuote,
  sendQuote,
  setQuoteGlobalDiscount,
  updateCatalogItem,
  updateQuoteLine,
  updateQuoteSettings,
} from "./service";

const plannerId = randomUUID();
const NOW = new Date("2027-03-15T10:00:00Z");

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

// Organisation (régime de TVA au choix, ou inconnu) avec un événement.
async function setup(vatRegime: "franchise" | "assujetti" | null = "assujetti") {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`))).id;
  if (vatRegime) {
    await withDb((db) =>
      saveOnboardingStep(db, organizationId, {
        vatRegime,
        vatRateDefaultBasisPoints: vatRegime === "assujetti" ? 2000 : null,
        siren: "123456789",
        address: "1 rue des Lilas, 69001 Lyon",
      }),
    );
  }
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès", lastName: null }],
  });
  return { organizationId, eventId: event.id };
}

const COORDINATION = { label: "Coordination jour J", unit: "forfait", unitPriceCents: 150000, vatRateBasisPoints: 2000, category: "Prestations" };
const DECORATION = { label: "Décoration florale", unit: "table", unitPriceCents: 8000, vatRateBasisPoints: 1000 };

describe("DEV-01 — Catalogue", () => {
  it("un article a intitulé, description, unité, prix HT, taux de TVA et catégorie ; il s'archive sans disparaître", async () => {
    const { organizationId } = await setup();
    const item = await createCatalogItem(organizationId, { ...COORDINATION, description: "Présence de 8 h à 2 h" });
    expect(item).toMatchObject({ ...COORDINATION, description: "Présence de 8 h à 2 h", archived: false });

    const updated = await updateCatalogItem(organizationId, item.id, { ...COORDINATION, unitPriceCents: 160000 });
    expect(updated.unitPriceCents).toBe(160000);

    await archiveCatalogItem(organizationId, item.id);
    expect(await listCatalogItems(organizationId)).toEqual([]);
    expect((await listCatalogItems(organizationId, { includeArchived: true }))[0]).toMatchObject({ archived: true });
  });

  it("refuse un prix négatif, un taux hors bornes ou un intitulé vide", async () => {
    const { organizationId } = await setup();
    await expect(createCatalogItem(organizationId, { ...COORDINATION, unitPriceCents: -1 })).rejects.toBeInstanceOf(RangeError);
    await expect(createCatalogItem(organizationId, { ...COORDINATION, vatRateBasisPoints: 10001 })).rejects.toBeInstanceOf(RangeError);
    await expect(createCatalogItem(organizationId, { ...COORDINATION, label: " " })).rejects.toBeInstanceOf(RangeError);
  });
});

describe("DEV-01 — Composition d'un devis", () => {
  it("elle choisit des articles, ajuste quantités et descriptions, ajoute des remises et des lignes libres ; les totaux se recalculent côté serveur", async () => {
    const { organizationId, eventId } = await setup();
    const coordination = await createCatalogItem(organizationId, COORDINATION);
    const decoration = await createCatalogItem(organizationId, DECORATION);
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });

    await addQuoteLine(organizationId, quote.id, { catalogItemId: coordination.id, quantityMilli: 1000 });
    let detail = await addQuoteLine(organizationId, quote.id, {
      catalogItemId: decoration.id,
      quantityMilli: 12000,
      description: "Centres de table, pivoines",
      discountBasisPoints: 1000,
    });
    detail = await addQuoteLine(organizationId, quote.id, {
      label: "Déplacement",
      unit: "forfait",
      quantityMilli: 1000,
      unitPriceCents: 20000,
    });

    expect(detail.current.lines.map((line) => [line.label, line.netCents])).toEqual([
      ["Coordination jour J", 150000],
      ["Décoration florale", 86400],
      ["Déplacement", 20000],
    ]);
    // Une ligne libre prend le taux par défaut de l'organisation (20 %).
    expect(detail.current.lines[2]?.vatRateBasisPoints).toBe(2000);

    detail = await setQuoteGlobalDiscount(organizationId, quote.id, { kind: "amount", cents: 6400 });
    expect(detail.current.totals).toMatchObject({ subtotalCents: 256400, globalDiscountCents: 6400, totalHtCents: 250000 });
    expect(detail.current.totals.totalTtcCents).toBe(detail.current.totals.totalHtCents + detail.current.totals.totalVatCents);

    const lineId = detail.current.lines[1]!.id;
    detail = await updateQuoteLine(organizationId, lineId, { quantityMilli: 10000, discountBasisPoints: 0 });
    expect(detail.current.lines[1]?.netCents).toBe(80000);
    detail = await removeQuoteLine(organizationId, detail.current.lines[2]!.id);
    expect(detail.current.lines).toHaveLength(2);
    expect(detail.totalTtcCents).toBe(detail.current.totals.totalTtcCents);
  });

  it("un article archivé ne peut plus être ajouté, mais reste sur les devis qui l'utilisent", async () => {
    const { organizationId, eventId } = await setup();
    const item = await createCatalogItem(organizationId, COORDINATION);
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
    await addQuoteLine(organizationId, quote.id, { catalogItemId: item.id, quantityMilli: 1000 });
    await archiveCatalogItem(organizationId, item.id);

    await expect(addQuoteLine(organizationId, quote.id, { catalogItemId: item.id, quantityMilli: 1000 })).rejects.toBeInstanceOf(
      CatalogItemNotFoundError,
    );
    expect((await getQuote(organizationId, quote.id)).current.lines.map((line) => line.label)).toEqual(["Coordination jour J"]);
  });

  it("chaque devis reçoit un numéro unique à sa création, par année, même créé en parallèle", async () => {
    const { organizationId, eventId } = await setup();
    const created = await Promise.all(
      Array.from({ length: 8 }, () => createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW })),
    );
    expect(created.map((quote) => quote.number).sort()).toEqual(
      Array.from({ length: 8 }, (_, index) => `D-2027-${String(index + 1).padStart(4, "0")}`),
    );
    // Nouvelle année : le compteur repart à 1.
    const nextYear = await createQuote({
      organizationId,
      eventId,
      createdByUserId: plannerId,
      now: new Date("2028-01-01T00:30:00+01:00"),
    });
    expect(nextYear.number).toBe("D-2028-0001");
    expect((await listEventQuotes(organizationId, eventId)).map((quote) => quote.number)).toHaveLength(9);
  });

  it("la validité (30 jours par défaut) et le préfixe sont paramétrables par organisation", async () => {
    const { organizationId, eventId } = await setup();
    expect(await getQuoteSettings(organizationId)).toEqual({
      validityDays: 30,
      quotePrefix: "D",
      invoicePrefix: "F",
      creditNotePrefix: "A",
      upcomingHorizonDays: 90,
      invoicePaymentTermDays: 30,
      invoiceMentions: null,
    });
    await updateQuoteSettings(organizationId, {
      validityDays: 45,
      quotePrefix: "DV",
      invoicePrefix: "F",
      creditNotePrefix: "A",
      upcomingHorizonDays: 90,
      invoicePaymentTermDays: 30,
      invoiceMentions: null,
    });
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
    expect(quote.number).toBe("DV-2027-0001");
    await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 100000 });
    expect((await sendQuote({ organizationId, quoteId: quote.id, now: NOW })).current.validUntil).toBe("2027-04-29");
  });
});

describe("DEV-01 — Mentions et TVA", () => {
  it("étant donné une planner en franchise de TVA, le devis porte « TVA non applicable, art. 293 B du CGI » et aucune TVA", async () => {
    const { organizationId, eventId } = await setup("franchise");
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
    await addQuoteLine(organizationId, quote.id, { ...COORDINATION, quantityMilli: 1000 });

    const sent = await sendQuote({ organizationId, quoteId: quote.id, now: NOW });
    expect(sent.current).toMatchObject({
      vatApplicable: false,
      vatRegime: "franchise",
      legalMention: "TVA non applicable, art. 293 B du CGI",
    });
    expect(sent.current.totals).toMatchObject({ totalHtCents: 150000, totalVatCents: 0, totalTtcCents: 150000 });
    expect(sent.current.seller).toMatchObject({ siren: "123456789", address: "1 rue des Lilas, 69001 Lyon" });
  });

  it("assujettie, la TVA est calculée par taux", async () => {
    const { organizationId, eventId } = await setup("assujetti");
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
    await addQuoteLine(organizationId, quote.id, { ...COORDINATION, quantityMilli: 1000 });
    await addQuoteLine(organizationId, quote.id, { ...DECORATION, quantityMilli: 10000 });
    const sent = await sendQuote({ organizationId, quoteId: quote.id, now: NOW });
    expect(sent.current.totals.vatByRate).toEqual([
      { rateBasisPoints: 1000, baseCents: 80000, vatCents: 8000 },
      { rateBasisPoints: 2000, baseCents: 150000, vatCents: 30000 },
    ]);
  });

  it("étant donné un régime de TVA inconnu, l'app le demande à l'envoi sans bloquer la composition", async () => {
    const { organizationId, eventId } = await setup(null);
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
    await addQuoteLine(organizationId, quote.id, { ...COORDINATION, quantityMilli: 1000 });
    await expect(sendQuote({ organizationId, quoteId: quote.id, now: NOW })).rejects.toBeInstanceOf(QuoteVatRegimeRequiredError);
    expect((await getQuote(organizationId, quote.id)).status).toBe("draft");
  });

  it("refuse d'envoyer un devis vide", async () => {
    const { organizationId, eventId } = await setup();
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
    await expect(sendQuote({ organizationId, quoteId: quote.id, now: NOW })).rejects.toBeInstanceOf(QuoteEmptyError);
  });
});

describe("DEV-01 — Versions", () => {
  it("modifier un devis envoyé crée une nouvelle version ; les précédentes restent consultables, figées", async () => {
    const { organizationId, eventId } = await setup();
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
    await addQuoteLine(organizationId, quote.id, { ...COORDINATION, quantityMilli: 1000 });
    const sent = await sendQuote({ organizationId, quoteId: quote.id, now: NOW });
    const v1Line = sent.current.lines[0]!.id;

    // Une version envoyée est immuable.
    await expect(updateQuoteLine(organizationId, v1Line, { quantityMilli: 2000 })).rejects.toBeInstanceOf(QuoteVersionLockedError);
    await expect(addQuoteLine(organizationId, quote.id, { ...DECORATION, quantityMilli: 1000 })).rejects.toBeInstanceOf(
      QuoteVersionLockedError,
    );

    const revised = await reviseQuote(organizationId, quote.id);
    expect(revised).toMatchObject({ status: "draft", currentVersion: 2, number: quote.number });
    const withDecoration = await addQuoteLine(organizationId, quote.id, { ...DECORATION, quantityMilli: 1000 });
    expect(withDecoration.current.lines).toHaveLength(2);

    const v1 = withDecoration.versions.find((version) => version.version === 1)!;
    expect(v1.lines).toHaveLength(1);
    expect(v1.totals.totalHtCents).toBe(150000);
    expect(v1.sentAt).not.toBeNull();
  });

  it("ONB-02 — après un changement de régime, un devis envoyé non signé propose une nouvelle version", async () => {
    const { organizationId, eventId } = await setup("franchise");
    const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
    await addQuoteLine(organizationId, quote.id, { ...COORDINATION, quantityMilli: 1000 });
    await sendQuote({ organizationId, quoteId: quote.id, now: NOW });
    expect((await getQuote(organizationId, quote.id)).regimeChangedSinceSent).toBe(false);

    // L'historique du régime référence un vrai compte (clé étrangère du hub).
    const owner = await withDb((db) =>
      createUser(db, { organizationId, email: `owner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" }),
    );
    await withDb((db) =>
      changeVatRegime(db, { organizationId, userId: owner.id, newRegime: "assujetti", effectiveDate: "2027-04-01" }),
    );
    const detail = await getQuote(organizationId, quote.id);
    expect(detail.regimeChangedSinceSent).toBe(true);
    // Le document déjà envoyé ne change pas.
    expect(detail.current.legalMention).toBe("TVA non applicable, art. 293 B du CGI");
  });
});

describe("DEV-01 — Essai guidé (ADR 0008)", () => {
  it("un devis sur l'événement d'essai prend la série DEMO, sans consommer la série légale, et disparaît avec l'essai", async () => {
    const { organizationId } = await setup();
    const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now: NOW });
    const demo = await createQuote({ organizationId, eventId: trial.eventId, createdByUserId: plannerId, now: NOW });
    expect(demo).toMatchObject({ number: "DEMO-D-2027-0001", isDemo: true });

    const source = await createProspectSource(organizationId, "Salon 2");
    const real = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Lou" }] });
    expect((await createQuote({ organizationId, eventId: real.id, createdByUserId: plannerId, now: NOW })).number).toBe("D-2027-0001");

    await removeEventQuotesData(organizationId, [trial.eventId]);
    await expect(getQuote(organizationId, demo.id)).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});

describe("DEV-01 — Isolation entre organisations", () => {
  it("une organisation ne crée pas de devis sur l'événement d'une autre, ne lit ni ne modifie ses devis ni son catalogue", async () => {
    const own = await setup();
    const other = await setup();
    const otherItem = await createCatalogItem(other.organizationId, COORDINATION);
    const otherQuote = await createQuote({ organizationId: other.organizationId, eventId: other.eventId, createdByUserId: plannerId, now: NOW });
    const otherDetail = await addQuoteLine(other.organizationId, otherQuote.id, { catalogItemId: otherItem.id, quantityMilli: 1000 });
    const ownQuote = await createQuote({ organizationId: own.organizationId, eventId: own.eventId, createdByUserId: plannerId, now: NOW });

    await expect(
      createQuote({ organizationId: own.organizationId, eventId: other.eventId, createdByUserId: plannerId, now: NOW }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(getQuote(own.organizationId, otherQuote.id)).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(
      addQuoteLine(own.organizationId, ownQuote.id, { catalogItemId: otherItem.id, quantityMilli: 1000 }),
    ).rejects.toBeInstanceOf(CatalogItemNotFoundError);
    await expect(
      updateQuoteLine(own.organizationId, otherDetail.current.lines[0]!.id, { quantityMilli: 5000 }),
    ).rejects.toBeInstanceOf(QuoteNotFoundError);
    expect(await listCatalogItems(own.organizationId)).toEqual([]);
    expect((await getQuote(other.organizationId, otherQuote.id)).current.lines[0]?.quantityMilli).toBe(1000);
  });
});
