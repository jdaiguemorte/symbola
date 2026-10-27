// AIDE-02 — fin d'un essai guidé et purge des essais abandonnés : aucune
// donnée « démo » ne subsiste, dans aucun module (événements, budget et devis),
// ni dans le stockage de fichiers.
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  budgetLineAttachments,
  budgetLineHistory,
  budgetLines,
  eventBudgetItems,
  eventBudgets,
} from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";
import {
  addDefaultVendorSlots,
  getEvent,
  listEventVendorSlots,
  startEventsTrial,
} from "@/modules/events/service";
import {
  attachBudgetLineQuote,
  createAllocationModel,
  getBudgetLineAttachmentUrl,
  listBudgetLines,
  simulateEventBudget,
  updateBudgetLine,
} from "@/modules/budget/service";
import { addQuoteLine, createQuote, getQuote, QuoteNotFoundError } from "@/modules/quotes/service";
import { endTrial, purgeAllExpiredDemoData, purgeOrganizationsDemoData } from "./demo-purge";

const HOUR = 60 * 60 * 1000;
const plannerId = randomUUID();
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function createOrganizationId(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

// Essai avec un budget complet : simulation, ligne prévu/réel (et son
// historique), devis joint stocké.
async function trialWithBudget(organizationId: string, now: Date) {
  const [photographer] = await addDefaultVendorSlots(organizationId, ["Photographe"]);
  const trial = await startEventsTrial({ organizationId, userId: plannerId, locale: "fr", now });
  const model = await createAllocationModel({
    organizationId,
    name: "Tout photo",
    items: [{ defaultVendorSlotId: photographer!.id, percentageBasisPoints: 10000 }],
  });
  await simulateEventBudget({
    organizationId,
    eventId: trial.eventId,
    totalAmountCents: 500000,
    guestCount: 50,
    allocationModelId: model.id,
  });
  const [slot] = await listEventVendorSlots(organizationId, trial.eventId);
  await updateBudgetLine({
    organizationId,
    eventId: trial.eventId,
    eventVendorSlotId: slot!.id,
    field: "planned",
    amountCents: 500000,
    changedByUserId: plannerId,
  });
  const attachment = await attachBudgetLineQuote({
    organizationId,
    eventId: trial.eventId,
    eventVendorSlotId: slot!.id,
    content: TINY_PDF,
    uploadedByUserId: plannerId,
  });
  // DEV-01 : un devis DEMO sur l'événement fictif.
  const quote = await createQuote({ organizationId, eventId: trial.eventId, createdByUserId: plannerId, now });
  await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 100000 });
  return {
    eventId: trial.eventId,
    quoteId: quote.id,
    attachmentUrl: await getBudgetLineAttachmentUrl(organizationId, attachment.id),
  };
}

async function remainingBudgetRows(organizationId: string, eventId: string): Promise<number> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const budgets = await tx.select().from(eventBudgets).where(eq(eventBudgets.eventId, eventId));
      const items = budgets.length
        ? await tx.select().from(eventBudgetItems).where(inArray(eventBudgetItems.eventBudgetId, budgets.map((b) => b.id)))
        : [];
      const lines = await tx.select().from(budgetLines).where(eq(budgetLines.eventId, eventId));
      const lineIds = lines.map((line) => line.id);
      const history = lineIds.length
        ? await tx.select().from(budgetLineHistory).where(inArray(budgetLineHistory.lineId, lineIds))
        : [];
      const attachments = lineIds.length
        ? await tx.select().from(budgetLineAttachments).where(inArray(budgetLineAttachments.lineId, lineIds))
        : [];
      return budgets.length + items.length + lines.length + history.length + attachments.length;
    });
  } finally {
    await sql.end();
  }
}

describe("AIDE-02 — Fin de l'essai guidé, tous modules confondus", () => {
  it("terminer l'essai supprime aussi son budget (simulation, lignes, historique, devis stockés) et ses devis DEMO", async () => {
    const organizationId = await createOrganizationId();
    const { eventId, quoteId, attachmentUrl } = await trialWithBudget(organizationId, new Date());
    expect(await remainingBudgetRows(organizationId, eventId)).toBeGreaterThan(0);
    expect((await fetch(attachmentUrl)).status).toBe(200);

    await endTrial(organizationId, eventId);

    expect(await getEvent(organizationId, eventId)).toBeNull();
    expect(await remainingBudgetRows(organizationId, eventId)).toBe(0);
    expect((await fetch(attachmentUrl)).status).toBe(404);
    await expect(getQuote(organizationId, quoteId)).rejects.toBeInstanceOf(QuoteNotFoundError);
  });

  it("terminer « l'essai » d'un vrai événement ne touche ni l'événement ni son budget", async () => {
    const organizationId = await createOrganizationId();
    const { eventId } = await trialWithBudget(organizationId, new Date());
    // Un identifiant inconnu ou d'un vrai événement : rien n'est supprimé.
    await endTrial(organizationId, randomUUID());
    expect((await listBudgetLines(organizationId, eventId)).lines).toHaveLength(1);
  });

  it("un essai abandonné depuis plus de 24 h disparaît avec son budget, pas un essai récent", async () => {
    const organizationId = await createOrganizationId();
    const now = new Date();
    const old = await trialWithBudget(organizationId, new Date(now.getTime() - 25 * HOUR));

    const otherOrganizationId = await createOrganizationId();
    const recent = await trialWithBudget(otherOrganizationId, now);

    await purgeOrganizationsDemoData([organizationId, otherOrganizationId], now);

    expect(await getEvent(organizationId, old.eventId)).toBeNull();
    expect(await remainingBudgetRows(organizationId, old.eventId)).toBe(0);
    expect((await fetch(old.attachmentUrl)).status).toBe(404);
    await expect(getQuote(organizationId, old.quoteId)).rejects.toBeInstanceOf(QuoteNotFoundError);
    expect(await remainingBudgetRows(otherOrganizationId, recent.eventId)).toBeGreaterThan(0);
    expect((await getQuote(otherOrganizationId, recent.quoteId)).isDemo).toBe(true);
  });
});

describe("AIDE-02 — Purge planifiée des essais abandonnés", () => {
  // Parcourt toutes les organisations de la base de test (nombreuses en local).
  it("supprime les essais de plus de 24 h dans chaque organisation, garde les plus récents", { timeout: 60_000 }, async () => {
    const first = await createOrganizationId();
    const second = await createOrganizationId();
    const now = new Date();
    const old = await startEventsTrial({
      organizationId: first,
      userId: randomUUID(),
      locale: "fr",
      now: new Date(now.getTime() - 25 * HOUR),
    });
    const recent = await startEventsTrial({ organizationId: second, userId: randomUUID(), locale: "fr", now });

    expect(await purgeAllExpiredDemoData(now)).toBeGreaterThanOrEqual(1);
    expect(await getEvent(first, old.eventId)).toBeNull();
    expect(await getEvent(second, recent.eventId)).not.toBeNull();
  });
});
