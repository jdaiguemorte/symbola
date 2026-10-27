// DEV-01 — les Server Actions et la route PDF du devis contrôlent côté
// serveur la session, le rôle et l'organisation : un compte marié, ou une
// planner d'une autre organisation, n'écrit ni ne lit rien, même par appel
// direct. Seul l'accès à la requête Next.js est simulé.
import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmTotp, createOrganization, createUser, login, setupTotp } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { acceptEventClientInvitation, createProspect, createProspectSource, inviteEventClient } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import {
  addPaymentMethods,
  addQuoteLine,
  addScheduleItem,
  createQuote,
  getQuote,
  listCatalogItems,
  listPaymentMethods,
  sendQuote,
} from "@/modules/quotes/service";

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

const { addFreeLineAction, sendQuoteAction, updateLineAction } = await import("./[quoteId]/actions");
const { saveCatalogItemAction } = await import("./catalogue/actions");
const { addScheduleItemAction, markPaidAction } = await import("./[quoteId]/schedule-actions");
const { addPaymentMethodAction } = await import("./parametres/actions");
const { sendForSignatureAction } = await import("./[quoteId]/signature-actions");
const { GET: getQuotePdf } = await import("./[quoteId]/pdf/route");

const PASSWORD = "mot-de-passe-du-test";

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function plannerSession(organizationId: string): Promise<{ userId: string; token: string }> {
  const email = `planner-${randomUUID()}@example.test`;
  const user = await withDb((db) => createUser(db, { organizationId, email, password: PASSWORD, role: "owner" }));
  const result = await withDb((db) => login(db, email, PASSWORD));
  if (result.outcome !== "success") throw new Error("connexion planner attendue");
  const { secret } = await withDb((db) => setupTotp(db, user.id));
  const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
  await withDb((db) => confirmTotp(db, { sessionToken: result.sessionToken, token: code }));
  return { userId: user.id, token: result.sessionToken };
}

// Une organisation, sa planner, un événement avec un devis d'une ligne et
// un marié invité ; une autre organisation avec sa propre planner.
async function setup() {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  await withDb((db) => saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000 }));
  const planner = await plannerSession(organizationId);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: planner.userId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès", lastName: null }],
  });
  const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: planner.userId });
  const detail = await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 100000 });

  const clientEmail = `marie-${randomUUID()}@example.test`;
  const invitation = await inviteEventClient({ organizationId, eventId: event.id, email: clientEmail, invitedByUserId: planner.userId, locale: "fr" });
  await acceptEventClientInvitation(invitation.invitationToken!, PASSWORD);
  const clientLogin = await withDb((db) => login(db, clientEmail, PASSWORD));
  if (clientLogin.outcome !== "success") throw new Error("connexion marié attendue");

  const otherOrganizationId = (await withDb((db) => createOrganization(db, `Autre ${randomUUID()}`))).id;
  const otherPlanner = await plannerSession(otherOrganizationId);

  return {
    organizationId,
    quoteId: quote.id,
    lineId: detail.current.lines[0]!.id,
    plannerToken: planner.token,
    clientToken: clientLogin.sessionToken,
    otherOrganizationId,
    otherPlannerToken: otherPlanner.token,
  };
}

function pdfRequest(quoteId: string) {
  return getQuotePdf(new Request(`http://localhost/devis/${quoteId}/pdf?version=1`), { params: Promise.resolve({ quoteId }) });
}

beforeEach(() => {
  sessionToken = undefined;
});

describe("DEV-01 — Les écritures du devis sont refusées hors de la planner de l'organisation", () => {
  it("un compte marié ne compose, n'envoie ni ne télécharge le devis, même par appel direct", async () => {
    const context = await setup();
    sessionToken = context.clientToken;
    const { quoteId, lineId, organizationId } = context;

    expect(await addFreeLineAction({}, form({ quoteId, label: "Intrus", unit: "u", quantity: "1", unitPrice: "1" }))).toEqual({
      error: "unauthenticated",
    });
    expect(await updateLineAction({}, form({ quoteId, lineId, label: "Intrus", quantity: "9", unitPrice: "1" }))).toEqual({
      error: "unauthenticated",
    });
    expect(await sendQuoteAction({}, form({ quoteId }))).toEqual({ error: "unauthenticated" });
    expect(await saveCatalogItemAction({}, form({ label: "Intrus", unit: "u", unitPrice: "1" }))).toEqual({ error: "unauthenticated" });
    expect((await pdfRequest(quoteId)).status).toBe(401);

    const quote = await getQuote(organizationId, quoteId);
    expect(quote.status).toBe("draft");
    expect(quote.current.lines.map((line) => [line.label, line.quantityMilli])).toEqual([["Coordination", 1000]]);
    expect(await listCatalogItems(organizationId)).toEqual([]);
  });

  it("une planner d'une autre organisation ne voit ni ne modifie le devis", async () => {
    const context = await setup();
    sessionToken = context.otherPlannerToken;
    const { quoteId, lineId, organizationId } = context;

    expect(await addFreeLineAction({}, form({ quoteId, label: "Intrus", unit: "u", quantity: "1", unitPrice: "1" }))).toEqual({
      error: "quoteNotFound",
    });
    expect(await updateLineAction({}, form({ quoteId, lineId, label: "Intrus", quantity: "9", unitPrice: "1" }))).toEqual({
      error: "quoteNotFound",
    });
    expect(await sendQuoteAction({}, form({ quoteId }))).toEqual({ error: "quoteNotFound" });
    expect((await pdfRequest(quoteId)).status).toBe(404);
    expect((await getQuote(organizationId, quoteId)).current.lines[0]?.quantityMilli).toBe(1000);
  });

  it("la planner de l'organisation compose, envoie et télécharge le PDF (contrôle du test)", async () => {
    const context = await setup();
    sessionToken = context.plannerToken;
    const { quoteId, lineId, organizationId } = context;

    expect(await updateLineAction({}, form({ quoteId, lineId, label: "Coordination", quantity: "2", unitPrice: "1000" }))).toEqual({
      success: true,
    });
    expect(await sendQuoteAction({}, form({ quoteId }))).toEqual({ success: true });
    const response = await pdfRequest(quoteId);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const quote = await getQuote(organizationId, quoteId);
    expect(quote.status).toBe("sent");
    expect(quote.current.totals.totalHtCents).toBe(200000);
  });
});

describe("DEV-03 — Échéancier et paiements refusés hors de la planner de l'organisation", () => {
  async function withSentSchedule() {
    const context = await setup();
    const { organizationId, quoteId } = context;
    await addScheduleItem(organizationId, quoteId, { label: "Acompte", dueDate: "2027-04-01", amountCents: 30000 });
    const sent = await sendQuote({ organizationId, quoteId });
    const [method] = await addPaymentMethods(organizationId, ["Virement bancaire"]);
    return { ...context, scheduleItemId: sent.current.schedule.items[0]!.id, paymentMethodId: method!.id };
  }

  it("un compte marié ne marque pas une échéance payée, n'ajoute ni acompte ni mode de paiement", async () => {
    const context = await withSentSchedule();
    sessionToken = context.clientToken;
    const { quoteId, scheduleItemId, paymentMethodId, organizationId } = context;
    const today = new Date().toISOString().slice(0, 10);

    expect(await markPaidAction({}, form({ quoteId, scheduleItemId, paymentMethodId, paidOn: today }))).toEqual({ error: "unauthenticated" });
    expect(await addScheduleItemAction({}, form({ quoteId, label: "Intrus", dueDate: "2027-05-01", kind: "amount", value: "1" }))).toEqual({
      error: "unauthenticated",
    });
    expect(await addPaymentMethodAction({}, form({ label: "Intrus" }))).toEqual({ error: "unauthenticated" });

    const quote = await getQuote(organizationId, quoteId);
    expect(quote.current.schedule.items.map((item) => [item.label, item.paidOn])).toEqual([["Acompte", null]]);
    expect((await listPaymentMethods(organizationId)).map((method) => method.label)).toEqual(["Virement bancaire"]);
  });

  it("une planner d'une autre organisation ne marque pas l'échéance payée", async () => {
    const context = await withSentSchedule();
    sessionToken = context.otherPlannerToken;
    const { quoteId, scheduleItemId, paymentMethodId, organizationId } = context;
    const today = new Date().toISOString().slice(0, 10);

    expect(await markPaidAction({}, form({ quoteId, scheduleItemId, paymentMethodId, paidOn: today }))).toEqual({ error: "quoteNotFound" });
    expect((await getQuote(organizationId, quoteId)).current.schedule.items[0]?.paidOn).toBeNull();
  });

  it("la planner de l'organisation marque l'échéance payée (contrôle du test)", async () => {
    const context = await withSentSchedule();
    sessionToken = context.plannerToken;
    const { quoteId, scheduleItemId, paymentMethodId, organizationId } = context;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

    expect(await markPaidAction({}, form({ quoteId, scheduleItemId, paymentMethodId, paidOn: today }))).toEqual({ success: true });
    expect((await getQuote(organizationId, quoteId)).current.schedule.items[0]?.paidOn).toBe(today);
  });
});

describe("DEV-02 — L'envoi en signature est refusé hors de la planner de l'organisation", () => {
  it("un compte marié ni une planner d'une autre organisation n'envoient le devis en signature", async () => {
    const context = await setup();
    const signer = { signer_0_name: "Intrus", signer_0_email: "intrus@example.test", signer_0_address: "Lyon" };

    sessionToken = context.clientToken;
    expect(await sendForSignatureAction({}, form({ quoteId: context.quoteId, ...signer }))).toEqual({ error: "unauthenticated" });
    sessionToken = context.otherPlannerToken;
    expect(await sendForSignatureAction({}, form({ quoteId: context.quoteId, ...signer }))).toEqual({ error: "quoteNotFound" });

    const quote = await getQuote(context.organizationId, context.quoteId);
    expect(quote.status).toBe("draft");
    expect(quote.signature).toBeNull();
  });
});
