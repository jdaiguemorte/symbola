// Lot 53 (HUB-28 ; D5 ; ADR 0095) — automatismes prêts à activer, contre un vrai PostgreSQL (RLS), la file
// des e-mails (Mailpit) et le faux fournisseur de signature, avec une horloge simulée :
// - « Contrat signé, puis évènement confirmé » : interrupteur et trace, et la notification « Devis signé » ;
// - « Échéance à J-7, puis rappel au payeur » : une seule fois, au payeur désigné sinon aux signataires,
//   jamais après un virement déclaré, distinct des relances d'impayés ;
// - « RSVP manquant, puis relance » : coupée, elle ne part plus ;
// - couper puis remettre en route : rien n'est rattrapé (D5).
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { addEventPayer, setInstalmentPayer } from "@/modules/budget/service";
import { createEventLink, createProspect, createProspectSource, getEvent } from "@/modules/events/service";
import { automationCovers, getAutomationGate, listAutomationRuns, listNotifications, saveOnboardingStep, setAutomationDays, setAutomationEnabled } from "@/modules/hub/service";
import { listInvitationRecipients, sendGuestInvitations, sendGuestReminders, type InvitationWords } from "@/modules/guests/service";
import { household, openResponses, readyOrganization, weddingEvent } from "@/modules/guests/test-fixtures";
import { recipientsDigest } from "@/modules/hub/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { confirmed } from "@/lib/test-fixtures/recipients";
import {
  actOnFakeSignature,
  addQuoteLine,
  addScheduleItem,
  addStarterContractTemplates,
  createQuote,
  declareTransfer,
  generateContract,
  getContractTemplate,
  getDocumentSettings,
  getQuote,
  recordSignerAct,
  sendInvoiceReminders,
  sendQuote,
  sendQuoteForSignature,
  updateContractClause,
  updateDocumentSettings,
  type ContractTemplateView,
  type QuoteDetail,
} from "@/modules/quotes/service";
import { fakeSignatureProvider, setSignatureProviderForTests } from "@/modules/quotes/signature";
import { automationHooks } from "./automation-gates";
import { sendPaymentDueReminders } from "./payment-due-reminders";

const MAILPIT_API = "http://localhost:8025/api/v1";
const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
const IBAN = "FR7630006000011234567890189";
afterEach(() => setSignatureProviderForTests(undefined));

function parisDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function plusDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Jour de Paris donné, en milieu de journée : dans les heures d'envoi (9 h à 19 h).
const atNoon = (date: string) => new Date(`${date}T10:00:00Z`);

async function messagesTo(email: string): Promise<{ ID: string; Subject: string }[]> {
  const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
  return ((await response.json()) as { messages: { ID: string; Subject: string }[] }).messages;
}

async function organization() {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, metier: "wedding_planner" });
  await fillRequiredMentions(organizationId);
  await updateDocumentSettings(organizationId, { ...(await getDocumentSettings(organizationId)), iban: IBAN, bic: "AGRIFRPP" });
  const planner = await createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" });
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: planner.id,
    prospectSourceId: source.id,
    clients: [
      { firstName: "Léa", lastName: "Martin" },
      { firstName: "Maxime", lastName: "Durand" },
    ],
    eventDate: "2027-09-18",
    venueName: "Domaine des Tilleuls",
    venueCity: "Senlis",
  });
  const tag = randomUUID().slice(0, 8);
  const people = [
    { name: "Léa Martin", email: `lea-${tag}@example.test`, billingAddress: "4 rue des Lilas, 60300 Senlis" },
    { name: "Maxime Durand", email: `maxime-${tag}@example.test`, billingAddress: "4 rue des Lilas, 60300 Senlis" },
  ];
  const links: Record<string, string> = {};
  for (const person of people) {
    const delivery = await createEventLink({ organizationId, eventId: event.id, createdByUserId: planner.id, audience: "client", locale: "fr", link: { personName: person.name, email: person.email, rights: { rubrics: ["quotes"], budgetScope: "all", sharedSlotIds: [] } } });
    links[person.email] = delivery.link.id;
  }
  return { organizationId, plannerId: planner.id, eventId: event.id, people, links };
}

type Context = Awaited<ReturnType<typeof organization>>;

// 5 000 € HT (6 000 € TTC) et une option à 300 € HT ; acompte de 30 % à la date donnée.
async function quote(context: Context, options: { dueDate?: string; send?: boolean } = {}): Promise<QuoteDetail> {
  const created = await createQuote({ organizationId: context.organizationId, eventId: context.eventId, createdByUserId: context.plannerId });
  await addQuoteLine(context.organizationId, created.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 500000, vatRateBasisPoints: 2000 });
  await addQuoteLine(context.organizationId, created.id, { label: "Brunch du lendemain", unit: "forfait", quantityMilli: 1000, unitPriceCents: 30000, vatRateBasisPoints: 2000, isOption: true });
  await addScheduleItem(context.organizationId, created.id, { label: "Acompte", percentageBasisPoints: 3000, dueDate: options.dueDate ?? plusDays(parisDay(), 10) });
  if (options.send === false) return getQuote(context.organizationId, created.id);
  return sendQuote({ organizationId: context.organizationId, quoteId: created.id });
}

async function readyTemplate(context: Context): Promise<ContractTemplateView> {
  const [template] = await addStarterContractTemplates(context.organizationId, "fr");
  for (const clause of template!.clauses) {
    if (clause.body.includes("[À rédiger")) await updateContractClause(context.organizationId, clause.id, { title: clause.title, body: `Texte de « ${clause.title} » (fictif).`, optional: clause.optional, role: clause.role });
  }
  return getContractTemplate(context.organizationId, template!.id);
}

const CLAUSES = {
  distance: ["withdrawal_period", "withdrawal_form", "early_execution", "termination", "advance_deposit"],
  off_premises: ["withdrawal_period", "withdrawal_form", "early_execution", "termination", "advance_deposit"],
  on_premises: ["no_withdrawal", "advance_deposit"],
} as const;

// Contrat au canal donné, signé par les deux mariés (commande et code compris).
async function signedWith(context: Context, channel: "distance" | "off_premises" | "on_premises", options: { dueDate?: string } = {}): Promise<QuoteDetail> {
  const sent = await quote(context, { dueDate: options.dueDate ?? plusDays(parisDay(), channel === "off_premises" ? 8 : 10) });
  const template = await readyTemplate(context);
  const contract = await generateContract({
    organizationId: context.organizationId,
    quoteId: sent.id,
    templateId: template.id,
    optionalClauseIds: template.clauses.filter((clause) => clause.optional && clause.role !== null && (CLAUSES[channel] as readonly string[]).includes(clause.role)).map((clause) => clause.id),
    channel,
    smallBusinessConfirmed: false,
    userId: context.plannerId,
    locale: "fr",
    acceptWarning: true,
  });
  setSignatureProviderForTests(fakeSignatureProvider());
  const signing = await sendQuoteForSignature(confirmed({ organizationId: context.organizationId, quoteId: sent.id, signers: context.people, documentPdf: PDF, locale: "fr", contractId: contract.id }));
  for (const signer of signing.signature!.signers) {
    if (channel === "distance") await recordSignerAct({ organizationId: context.organizationId, eventId: context.eventId, clientEmail: signer.email, contractId: contract.id, kind: "order", orderText: "Je commande avec obligation de paiement" });
    expect(await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign")).toBe(true);
  }
  return getQuote(context.organizationId, sent.id);
}

const words: InvitationWords = { wedding: { fr: "mariage", en: "wedding" }, event: { fr: "évènement", en: "event" } };

async function dueSoonSubjects(email: string): Promise<string[]> {
  return (await messagesTo(email)).map((message) => message.Subject).filter((subject) => subject.startsWith("Rappel : échéance du"));
}

describe("HUB-28 — Contrat signé, puis évènement confirmé : interrupteur et trace", () => {
  it("actif : la signature confirme l'option, laisse une trace dans le journal et prévient la Propriétaire (« Devis signé »)", async () => {
    const context = await organization();
    const signed = await signedWith(context, "on_premises");
    expect((await getEvent(context.organizationId, context.eventId))!.status).toBe("confirmed");
    expect(await listAutomationRuns(context.organizationId, "quote_signed_confirm_event")).toEqual([expect.objectContaining({ result: "done", objectLabel: signed.number, href: `/events/${context.eventId}` })]);
    expect(await listNotifications(context.organizationId, context.plannerId)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "quote_signed", href: `/devis/${signed.id}`, params: { number: signed.number } })]));
  });

  it("coupé : l'option reste une option (la planner confirme elle-même), sans trace ; la notification part quand même", async () => {
    const context = await organization();
    await setAutomationEnabled(context.organizationId, "quote_signed_confirm_event", false);
    await signedWith(context, "on_premises");
    expect((await getEvent(context.organizationId, context.eventId))!.status).toBe("option");
    expect(await listAutomationRuns(context.organizationId, "quote_signed_confirm_event")).toEqual([]);
    expect((await listNotifications(context.organizationId, context.plannerId)).map((notification) => notification.type)).toContain("quote_signed");
  });
});

describe("HUB-28 — Échéance à J-7, puis rappel au payeur (lot 53, D5 ; horloge simulée)", () => {
  it("une seule fois, à partir de J-7 et jusqu'au jour de l'échéance, aux signataires ; distinct des relances d'impayés", async () => {
    const context = await organization();
    const due = plusDays(parisDay(), 12);
    await signedWith(context, "on_premises", { dueDate: due });
    const hooks = (await automationHooks(context.organizationId, "payment_due_reminder"))!;
    expect(await sendPaymentDueReminders(context.organizationId, atNoon(plusDays(due, -8)), hooks)).toBe(0);
    expect(await sendPaymentDueReminders(context.organizationId, atNoon(plusDays(due, -7)), hooks)).toBe(2);
    expect(await sendPaymentDueReminders(context.organizationId, atNoon(plusDays(due, -3)), hooks)).toBe(0);
    expect(await sendPaymentDueReminders(context.organizationId, atNoon(plusDays(due, 1)), hooks)).toBe(0);
    // Avant l'échéance, aucune relance d'impayé.
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(due, -1)))).toBe(0);
    for (const person of context.people) expect(await dueSoonSubjects(person.email)).toHaveLength(1);
    expect(await listAutomationRuns(context.organizationId, "payment_due_reminder")).toEqual([expect.objectContaining({ result: "sent", href: expect.stringMatching(/^\/devis\//) })]);
  });

  it("jamais après un virement déclaré ; le payeur désigné le reçoit seul ; le délai se règle", async () => {
    const context = await organization();
    const due = plusDays(parisDay(), 12);
    const signed = await signedWith(context, "on_premises", { dueDate: due });
    const item = signed.current.schedule.items[0]!;
    await declareTransfer(context.organizationId, { eventId: context.eventId, linkId: context.links[context.people[0]!.email]!, personName: "Léa Martin", scheduleItemId: item.id, paidOn: parisDay(), designatedLinkId: null });
    const hooks = (await automationHooks(context.organizationId, "payment_due_reminder"))!;
    expect(await sendPaymentDueReminders(context.organizationId, atNoon(plusDays(due, -7)), hooks)).toBe(0);

    const other = await organization();
    const otherSigned = await signedWith(other, "on_premises", { dueDate: due });
    const maximeLink = other.links[other.people[1]!.email]!;
    const payer = await addEventPayer(other.organizationId, { eventId: other.eventId, name: "Maxime Durand", kind: "family_two", linkId: maximeLink });
    await setInstalmentPayer(other.organizationId, { eventId: other.eventId, scheduleItemId: otherSigned.current.schedule.items[0]!.id, payerId: payer.id });
    expect((await setAutomationDays(other.organizationId, "payment_due_reminder", 10)).days).toBe(10);
    const otherHooks = (await automationHooks(other.organizationId, "payment_due_reminder"))!;
    expect(await sendPaymentDueReminders(other.organizationId, atNoon(plusDays(due, -10)), otherHooks)).toBe(1);
    expect(await dueSoonSubjects(other.people[1]!.email)).toHaveLength(1);
    expect(await dueSoonSubjects(other.people[0]!.email)).toHaveLength(0);
  });

  it("couper arrête l'envoi ; remis en route après le jour prévu, le rappel manqué n'est pas rattrapé (D5)", async () => {
    const context = await organization();
    const due = plusDays(parisDay(), 12);
    await signedWith(context, "on_premises", { dueDate: due });
    await setAutomationEnabled(context.organizationId, "payment_due_reminder", false, atNoon(plusDays(due, -9)));
    expect(await automationHooks(context.organizationId, "payment_due_reminder")).toBeNull();
    const resumed = await setAutomationEnabled(context.organizationId, "payment_due_reminder", true, atNoon(plusDays(due, -5)));
    expect(automationCovers(resumed, plusDays(due, -7))).toBe(false);
    expect(automationCovers(resumed, plusDays(due, -5))).toBe(true);
    const hooks = (await automationHooks(context.organizationId, "payment_due_reminder"))!;
    expect(hooks.notBefore).toBe(plusDays(due, -5));
    expect(await sendPaymentDueReminders(context.organizationId, atNoon(plusDays(due, -5)), hooks)).toBe(0);
    for (const person of context.people) expect(await dueSoonSubjects(person.email)).toHaveLength(0);
  });
});

describe("HUB-28 — RSVP manquant, puis relance : coupée, elle ne part plus ; la purge ne se coupe pas", () => {
  it("coupée la veille de J-21, la relance ne part pas ; remise en route le jour de J-7, seule J-7 part", async () => {
    const { organizationId, ownerId } = await readyOrganization();
    const { eventId } = await weddingEvent(organizationId, ownerId);
    await openResponses(organizationId, eventId, "2027-05-13");
    await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Bruno", email: `bruno-${randomUUID()}@example.test` }] });
    await sendGuestInvitations({ organizationId, eventId, confirmedRecipients: recipientsDigest(await listInvitationRecipients(organizationId, eventId)), words, now: new Date("2027-04-01T09:00:00Z") });
    await setAutomationEnabled(organizationId, "rsvp_reminder", false, new Date("2027-04-21T08:00:00Z"));
    expect(await automationHooks(organizationId, "rsvp_reminder")).toBeNull();
    await setAutomationEnabled(organizationId, "rsvp_reminder", true, new Date("2027-05-06T07:00:00Z"));
    const hooks = (await automationHooks(organizationId, "rsvp_reminder"))!;
    // J-21 (22 avril) est passée pendant la coupure : rien n'est rattrapé ; J-7 (6 mai) part.
    expect(await sendGuestReminders(organizationId, words, new Date("2027-05-06T08:00:00Z"), hooks)).toBe(1);
    expect((await listAutomationRuns(organizationId, "rsvp_reminder"))[0]).toMatchObject({ result: "sent", href: `/events/${eventId}/invites` });
  });

  it("la purge RGPD et le contrôle des pièces n'ont pas d'interrupteur : ce ne sont pas des automatismes réglables", async () => {
    const { organizationId } = await readyOrganization();
    await expect(setAutomationEnabled(organizationId, "privacy_purge", false)).rejects.toMatchObject({ reason: "key" });
    expect((await getAutomationGate(organizationId, "rsvp_reminder")).enabled).toBe(true);
  });
});
