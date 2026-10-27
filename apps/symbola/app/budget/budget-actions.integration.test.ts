// BUD-04 — « le marié ne peut jamais modifier une ligne, y compris par
// appel direct à la Server Action » (test automatisé obligatoire). Les
// vraies actions du module budget sont appelées avec une vraie session
// (cookie, PostgreSQL) : seul l'accès à la requête Next.js (cookies,
// revalidation, traductions) est simulé, faute de serveur en test.
import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmTotp, createOrganization, createUser, login, setupTotp } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  acceptEventClientInvitation,
  addDefaultVendorSlots,
  createProspect,
  createProspectSource,
  inviteEventClient,
  listDefaultVendorSlots,
  listEventVendorSlots,
} from "@/modules/events/service";
import { getEventBudget, listAllocationModels, listBudgetLines, updateBudgetLine } from "@/modules/budget/service";

let sessionToken: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "symbola_session" && sessionToken ? { value: sessionToken } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => "fr",
}));

const {
  adjustEventBudgetItemAction,
  attachQuoteAction,
  confirmEventBudgetAction,
  simulateEventBudgetAction,
  updateBudgetLineAction,
} = await import("./[eventId]/actions");
const { createAllocationModelAction } = await import("./parametres/actions");

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

function form(values: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

// Une organisation, sa planner (double authentification validée), un
// événement avec une ligne de budget, et un marié invité sur l'événement.
async function setup() {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  const plannerEmail = `planner-${randomUUID()}@example.test`;
  const planner = await withDb((db) =>
    createUser(db, { organizationId, email: plannerEmail, password: PASSWORD, role: "owner" }),
  );
  const plannerLogin = await withDb((db) => login(db, plannerEmail, PASSWORD));
  if (plannerLogin.outcome !== "success") throw new Error("connexion planner attendue");
  const { secret } = await withDb((db) => setupTotp(db, planner.id));
  const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
  await withDb((db) => confirmTotp(db, { sessionToken: plannerLogin.sessionToken, token: code }));

  await addDefaultVendorSlots(organizationId, ["Lieu"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: planner.id,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès", lastName: null }],
  });
  const [slot] = await listEventVendorSlots(organizationId, event.id);
  await updateBudgetLine({
    organizationId,
    eventId: event.id,
    eventVendorSlotId: slot!.id,
    field: "planned",
    amountCents: 600000,
    changedByUserId: planner.id,
  });

  const clientEmail = `marie-${randomUUID()}@example.test`;
  const invitation = await inviteEventClient({
    organizationId,
    eventId: event.id,
    email: clientEmail,
    invitedByUserId: planner.id,
    locale: "fr",
  });
  await acceptEventClientInvitation(invitation.invitationToken!, PASSWORD);
  const clientLogin = await withDb((db) => login(db, clientEmail, PASSWORD));
  if (clientLogin.outcome !== "success") throw new Error("connexion marié attendue");

  const [defaultSlot] = await listDefaultVendorSlots(organizationId);
  return {
    organizationId,
    eventId: event.id,
    eventVendorSlotId: slot!.id,
    defaultVendorSlotId: defaultSlot!.id,
    plannerToken: plannerLogin.sessionToken,
    clientToken: clientLogin.sessionToken,
  };
}

beforeEach(() => {
  sessionToken = undefined;
});

describe("BUD-04 — Un compte marié ne modifie jamais le budget, même par appel direct", () => {
  it("chaque Server Action d'écriture du budget refuse un compte marié, sans rien écrire", async () => {
    const context = await setup();
    sessionToken = context.clientToken;
    const { eventId, eventVendorSlotId, defaultVendorSlotId, organizationId } = context;

    expect(
      await updateBudgetLineAction({}, form({ eventId, eventVendorSlotId, field: "actual", amount: "1" })),
    ).toEqual({ error: "unauthenticated" });
    expect(
      await updateBudgetLineAction({}, form({ eventId, eventVendorSlotId, field: "planned", amount: "1" })),
    ).toEqual({ error: "unauthenticated" });
    expect(
      await attachQuoteAction(
        {},
        form({ eventId, eventVendorSlotId, quote: new File([TINY_PDF], "devis.pdf", { type: "application/pdf" }) }),
      ),
    ).toEqual({ error: "unauthenticated" });
    expect(
      await simulateEventBudgetAction(
        {},
        form({ eventId, totalAmount: "1000", guestCount: "10", allocationModelId: randomUUID() }),
      ),
    ).toEqual({ error: "unauthenticated" });
    expect(
      await adjustEventBudgetItemAction({}, form({ eventId, defaultVendorSlotId, amount: "1" })),
    ).toEqual({ error: "unauthenticated" });
    await confirmEventBudgetAction(form({ eventId }));
    expect(
      await createAllocationModelAction({}, form({ name: "Intrus", [`percentage_${defaultVendorSlotId}`]: "100" })),
    ).toMatchObject({ error: expect.any(String) });

    const view = await listBudgetLines(organizationId, eventId);
    expect(view.lines.map((line) => [line.plannedAmountCents, line.actualAmountCents, line.attachments.length])).toEqual([
      [600000, null, 0],
    ]);
    expect(await getEventBudget(organizationId, eventId)).toBeNull();
    expect(await listAllocationModels(organizationId)).toEqual([]);
  });

  it("la même action, appelée par la planner, écrit bien (contrôle du test)", async () => {
    const context = await setup();
    sessionToken = context.plannerToken;

    expect(
      await updateBudgetLineAction(
        {},
        form({ eventId: context.eventId, eventVendorSlotId: context.eventVendorSlotId, field: "actual", amount: "6500" }),
      ),
    ).toEqual({});
    const view = await listBudgetLines(context.organizationId, context.eventId);
    expect(view.lines[0]?.actualAmountCents).toBe(650000);
  });
});
