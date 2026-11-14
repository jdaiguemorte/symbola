// PRD-BUD-04 — « le marié ne peut jamais modifier une ligne, y compris par
// appel direct à la Server Action » (test automatisé obligatoire). Lot 26a :
// le marié n'a plus de compte, mais une session de lien personnel ; présentée
// comme cookie de compte, elle n'ouvre aucune action de la planner. Les
// vraies actions du module budget sont appelées avec une vraie session
// (cookie, PostgreSQL) : seul l'accès à la requête Next.js (cookies,
// revalidation, traductions) est simulé, faute de serveur en test.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganization } from "@symbola/auth";
import { signedInAccount } from "@/lib/test-fixtures/session";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import {
  addDefaultVendorSlots,
  createEventLink,
  createProspect,
  createProspectSource,
  listDefaultVendorSlots,
  openEventLink,
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
  confirmEventBudgetAction,
  simulateEventBudgetAction,
  updateBudgetLineAction,
} = await import("./[eventId]/actions");
const { createAllocationModelAction } = await import("./parametres/actions");
// Lot 16 (L16-SEC-02) : le devis joint passe par sa route dédiée.
const { POST: attachQuote } = await import("./[eventId]/devis/route");

function attachQuoteRequest(eventId: string, values: Record<string, string | Blob>): Request {
  return new Request(`http://localhost:3000/budget/${eventId}/devis`, { method: "POST", body: form(values), headers: { origin: "http://localhost:3000", host: "localhost:3000" } });
}

const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
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
  // Lot 33 : session ouverte comme après le fournisseur d'identité, double authentification déclarée.
  const signedIn = await withDb((db) => signedInAccount(db, { organizationId, role: "owner" }));
  const planner = { id: signedIn.userId };
  const confirmed = { sessionToken: signedIn.token };

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
    field: "estimated",
    amountCents: 600000,
    changedByUserId: planner.id,
  });

  const delivery = await createEventLink({
    organizationId,
    eventId: event.id,
    createdByUserId: planner.id,
    audience: "client",
    locale: "fr",
    link: { personName: "Inès", email: `marie-${randomUUID()}@example.test`, rights: { rubrics: ["tasks", "program", "vendor_options", "budget", "quotes"], budgetScope: "all", sharedSlotIds: [] } },
  });
  const clientLink = await openEventLink(delivery.url.split("#")[1]!);
  if (clientLink.outcome !== "opened") throw new Error("ouverture du lien attendue");

  const [defaultSlot] = await listDefaultVendorSlots(organizationId);
  return {
    organizationId,
    eventId: event.id,
    eventVendorSlotId: slot!.id,
    defaultVendorSlotId: defaultSlot!.id,
    plannerToken: confirmed.sessionToken,
    clientToken: clientLink.sessionToken,
  };
}

beforeEach(() => {
  sessionToken = undefined;
});

describe("PRD-BUD-04 — Un marié ne modifie jamais le budget, même par appel direct", () => {
  it("L26-SEC-12 — chaque Server Action d'écriture du budget refuse la session d'un lien personnel, sans rien écrire", async () => {
    const context = await setup();
    sessionToken = context.clientToken;
    const { eventId, eventVendorSlotId, defaultVendorSlotId, organizationId } = context;

    expect(
      await updateBudgetLineAction({}, form({ eventId, eventVendorSlotId, amount_committed: "1" })),
    ).toEqual({ error: "unauthenticated" });
    expect(
      await updateBudgetLineAction({}, form({ eventId, eventVendorSlotId, amount_estimated: "1" })),
    ).toEqual({ error: "unauthenticated" });
    const quoteResponse = await attachQuote(attachQuoteRequest(eventId, { eventVendorSlotId, quote: new File([TINY_PDF], "devis.pdf", { type: "application/pdf" }) }), {
      params: Promise.resolve({ eventId }),
    });
    expect(quoteResponse.status).toBe(401);
    expect(await quoteResponse.json()).toEqual({ error: "unauthenticated" });
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
    expect(view.lines.map((line) => [line.estimatedAmountCents, line.committedAmountCents, line.attachments.length])).toEqual([
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
        form({ eventId: context.eventId, eventVendorSlotId: context.eventVendorSlotId, amount_committed: "6500" }),
      ),
    ).toEqual({ success: true });
    const view = await listBudgetLines(context.organizationId, context.eventId);
    expect(view.lines[0]?.committedAmountCents).toBe(650000);
  });
});

// Lot 16 (suite de la recette des captures) : les montants du budget se
// saisissent comme ailleurs dans l'app, en texte, et sont lus sans calcul à
// virgule flottante (CLAUDE.md §5).
describe("PRD-BUD-02 — Montants saisis en euros, au centime près", () => {
  it("« 2 929,50 » et « 2929.50 » valent 292 950 centimes ; une saisie illisible est refusée ; un champ vide ne change rien (lot 28a)", async () => {
    const context = await setup();
    sessionToken = context.plannerToken;
    const update = (amount: string) =>
      updateBudgetLineAction({}, form({ eventId: context.eventId, eventVendorSlotId: context.eventVendorSlotId, amount_committed: amount }));
    const actual = async () => (await listBudgetLines(context.organizationId, context.eventId)).lines[0]?.committedAmountCents;

    expect(await update("2 929,50")).toEqual({ success: true });
    expect(await actual()).toBe(292950);
    expect(await update("2929.50")).toEqual({ success: true });
    expect(await actual()).toBe(292950);
    expect(await update("deux mille")).toEqual({ error: "invalidAmount" });
    expect(await actual()).toBe(292950);
    expect(await update("")).toEqual({ success: true });
    expect(await actual()).toBe(292950);
  });
});
