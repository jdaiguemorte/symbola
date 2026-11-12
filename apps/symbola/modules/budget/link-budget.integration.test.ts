// PRD-BUD-04, lot 26a (POR-01, POR-10 ; ADR 0053) — budget vu par un lien
// personnel, en lecture seule, contre un vrai PostgreSQL (RLS) : l'accès du
// lien est relu par le module events avant de renvoyer la moindre donnée.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import type { EventLinkRights } from "@symbola/contracts";
import { addDefaultVendorSlots, createEventLink, createProspect, createProspectSource, listEventVendorSlots, revokeEventLink } from "@/modules/events/service";
import { attachBudgetLineQuote, getLinkBudgetView, LinkBudgetAccessDeniedError, updateBudgetLine } from "./service";

const plannerId = randomUUID();
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function newOrganization(): Promise<string> {
  return (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
}

// Un événement avec trois postes et leurs lignes de budget.
async function eventWithBudget(organizationId: string) {
  await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur", "Photographe"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }], eventDate: "2027-06-12" });
  const [venue, caterer, photographer] = await listEventVendorSlots(organizationId, event.id);
  const line = (eventVendorSlotId: string, field: "estimated" | "committed", amountCents: number) =>
    updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId, field, amountCents, changedByUserId: plannerId });
  await line(venue!.id, "estimated", 600000);
  await line(venue!.id, "committed", 650000);
  await line(caterer!.id, "estimated", 400000);
  await line(photographer!.id, "estimated", 250000);
  await attachBudgetLineQuote({ organizationId, eventId: event.id, eventVendorSlotId: venue!.id, content: TINY_PDF, uploadedByUserId: plannerId });
  return { eventId: event.id, venueId: venue!.id, catererId: caterer!.id };
}

async function linkFor(organizationId: string, eventId: string, rights: EventLinkRights) {
  const delivery = await createEventLink({
    organizationId,
    eventId,
    createdByUserId: plannerId,
    audience: "client",
    locale: "fr",
    link: { personName: "Bernard Martin", email: `lien-${randomUUID()}@example.test`, rights },
  });
  return delivery.link.id;
}

describe("PRD-BUD-04 — Budget vu par un lien personnel", () => {
  it("« tout le budget » : catégories, estimé, engagé, écart et totaux, sans le détail des lignes", async () => {
    const organizationId = await newOrganization();
    const { eventId } = await eventWithBudget(organizationId);
    const linkId = await linkFor(organizationId, eventId, { rubrics: ["budget"], budgetScope: "all", sharedSlotIds: [] });

    const view = await getLinkBudgetView(organizationId, linkId);
    expect(view.scope).toBe("all");
    expect(view.categories.map((category) => [category.label, category.estimatedCents, category.committedCents, category.varianceCents])).toEqual([
      ["Lieu", 600000, 650000, 50000],
      ["Traiteur", 400000, 0, 0],
      ["Photographe", 250000, 0, 0],
    ]);
    expect(view).toMatchObject({ totalEstimatedCents: 1250000, totalCommittedCents: 650000, totalVarianceCents: 50000 });
    expect(view.lines).toEqual([]);
    expect(view.categories.every((category) => category.lines.length === 0)).toBe(true);
  });
});

describe("POR-01 — Le parent payeur ne voit que ce qu'on lui a ouvert", () => {
  it("« catégories choisies » : le lieu et le traiteur seuls, leurs totaux, ni enveloppe ni autres postes", async () => {
    const organizationId = await newOrganization();
    const { eventId, venueId, catererId } = await eventWithBudget(organizationId);
    const linkId = await linkFor(organizationId, eventId, { rubrics: ["budget", "quotes"], budgetScope: "selected", sharedSlotIds: [venueId, catererId] });

    const view = await getLinkBudgetView(organizationId, linkId);
    expect(view.scope).toBe("selected");
    expect(view.categories.map((category) => category.label)).toEqual(["Lieu", "Traiteur"]);
    expect(view).toMatchObject({ totalEstimatedCents: 1000000, totalCommittedCents: 650000, envelope: null });
    expect(JSON.stringify(view)).not.toContain("Photographe");
  });
});

describe("POR-10 — Rien par défaut, une catégorie nouvelle reste privée", () => {
  it("un lien sans la rubrique Budget est refusé ; une catégorie engagée après coup n'apparaît pas au payeur", async () => {
    const organizationId = await newOrganization();
    const { eventId, venueId } = await eventWithBudget(organizationId);
    const closed = await linkFor(organizationId, eventId, { rubrics: ["tasks"], budgetScope: "all", sharedSlotIds: [] });
    await expect(getLinkBudgetView(organizationId, closed)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);

    const payer = await linkFor(organizationId, eventId, { rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [venueId] });
    const [, caterer] = await listEventVendorSlots(organizationId, eventId);
    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: caterer!.id, field: "committed", amountCents: 380000, changedByUserId: plannerId });
    expect((await getLinkBudgetView(organizationId, payer)).categories.map((category) => category.label)).toEqual(["Lieu"]);
  });
});

describe("PRD-BUD-04 — Isolation d'un lien", () => {
  it("refuse sous une autre organisation, même en désignant le lien", async () => {
    const organizationId = await newOrganization();
    const { eventId } = await eventWithBudget(organizationId);
    const otherOrganizationId = await newOrganization();
    const linkId = await linkFor(organizationId, eventId, { rubrics: ["budget"], budgetScope: "all", sharedSlotIds: [] });
    await expect(getLinkBudgetView(otherOrganizationId, linkId)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
    await expect(getLinkBudgetView(organizationId, randomUUID())).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
  });

  it("un lien retiré par la planner ne montre plus le budget", async () => {
    const organizationId = await newOrganization();
    const { eventId } = await eventWithBudget(organizationId);
    const linkId = await linkFor(organizationId, eventId, { rubrics: ["budget"], budgetScope: "all", sharedSlotIds: [] });
    await revokeEventLink(organizationId, linkId);
    await expect(getLinkBudgetView(organizationId, linkId)).rejects.toBeInstanceOf(LinkBudgetAccessDeniedError);
  });
});
