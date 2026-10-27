// BUD-04 — budget visible par les mariés, en lecture seule, contre un
// vrai PostgreSQL (RLS) : l'accès du marié à l'événement est vérifié par
// le module events avant de renvoyer la moindre donnée budget.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, login, requireUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  acceptEventClientInvitation,
  addDefaultVendorSlots,
  createProspect,
  createProspectSource,
  inviteEventClient,
  listEventVendorSlots,
  revokeEventClientAccess,
} from "@/modules/events/service";
import { ClientBudgetAccessDeniedError, attachBudgetLineQuote, getClientBudgetView, updateBudgetLine } from "./service";

const plannerId = randomUUID();
const PASSWORD = "mot-de-passe-du-marie";
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

// Un événement avec deux postes et leurs lignes de budget (prévu, réel).
async function eventWithBudget(organizationId: string) {
  await addDefaultVendorSlots(organizationId, ["Lieu", "Traiteur"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès", lastName: null }],
  });
  const [venue, caterer] = await listEventVendorSlots(organizationId, event.id);
  const line = (eventVendorSlotId: string, field: "planned" | "actual", amountCents: number) =>
    updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId, field, amountCents, changedByUserId: plannerId });
  await line(venue!.id, "planned", 600000);
  await line(venue!.id, "actual", 650000);
  await line(caterer!.id, "planned", 400000);
  await attachBudgetLineQuote({
    organizationId,
    eventId: event.id,
    eventVendorSlotId: venue!.id,
    content: TINY_PDF,
    uploadedByUserId: plannerId,
  });
  return event.id;
}

async function invitedClient(organizationId: string, eventId: string) {
  const email = `marie-${randomUUID()}@example.test`;
  const invitation = await inviteEventClient({ organizationId, eventId, email, invitedByUserId: plannerId, locale: "fr" });
  await acceptEventClientInvitation(invitation.invitationToken!, PASSWORD);
  const session = await withDb((db) => login(db, email, PASSWORD));
  if (session.outcome !== "success") throw new Error("connexion attendue");
  const auth = await withDb((db) => requireUser(db, session.sessionToken));
  if (auth.status !== "authenticated") throw new Error("session attendue");
  return { userId: auth.user.id, accessId: invitation.access.id };
}

async function newOrganization(): Promise<string> {
  return (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
}

describe("BUD-04 — Budget visible par les mariés", () => {
  it("le marié voit le budget de son événement : poste, prévu, réel, écart et totaux", async () => {
    const organizationId = await newOrganization();
    const eventId = await eventWithBudget(organizationId);
    const client = await invitedClient(organizationId, eventId);

    const view = await getClientBudgetView(organizationId, client.userId, eventId);
    expect(view.lines.map((line) => [line.label, line.plannedAmountCents, line.actualAmountCents, line.varianceCents])).toEqual([
      ["Lieu", 600000, 650000, 50000],
      ["Traiteur", 400000, null, null],
    ]);
    expect(view).toMatchObject({ totalPlannedCents: 1000000, totalActualCents: 650000, totalVarianceCents: 50000 });
    // Lecture seule des colonnes publiques : les devis de la planner n'y sont pas.
    expect(view.lines.every((line) => line.attachments.length === 0)).toBe(true);
  });
});

describe("BUD-04 — Isolation d'un compte marié", () => {
  it("refuse le budget d'un autre événement de la même organisation", async () => {
    const organizationId = await newOrganization();
    const eventId = await eventWithBudget(organizationId);
    const otherEventId = await eventWithBudget(organizationId);
    const client = await invitedClient(organizationId, eventId);

    await expect(getClientBudgetView(organizationId, client.userId, otherEventId)).rejects.toBeInstanceOf(
      ClientBudgetAccessDeniedError,
    );
  });

  it("refuse le budget d'une autre organisation, même en la désignant", async () => {
    const organizationId = await newOrganization();
    const eventId = await eventWithBudget(organizationId);
    const otherOrganizationId = await newOrganization();
    const otherEventId = await eventWithBudget(otherOrganizationId);
    const client = await invitedClient(organizationId, eventId);

    await expect(getClientBudgetView(otherOrganizationId, client.userId, otherEventId)).rejects.toBeInstanceOf(
      ClientBudgetAccessDeniedError,
    );
    await expect(getClientBudgetView(organizationId, client.userId, otherEventId)).rejects.toBeInstanceOf(
      ClientBudgetAccessDeniedError,
    );
  });

  it("un accès retiré par la planner ne montre plus le budget", async () => {
    const organizationId = await newOrganization();
    const eventId = await eventWithBudget(organizationId);
    const client = await invitedClient(organizationId, eventId);

    await revokeEventClientAccess(organizationId, client.accessId);
    await expect(getClientBudgetView(organizationId, client.userId, eventId)).rejects.toBeInstanceOf(
      ClientBudgetAccessDeniedError,
    );
  });
});
