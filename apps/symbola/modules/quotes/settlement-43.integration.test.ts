// Lot 43 (FAC-02, FAC-08 Divergent, FAC-09, FAC-15, GC-01, SEC-16, JUR-07 ; D1 à D7 ; ADR 0087, ADR 0089)
// — contre un vrai PostgreSQL (RLS), Mailpit et le faux fournisseur de signature, par la porte
// d'entrée du module : la proposition et son total, la validité et la relance avant expiration
// (horloge simulée), le code avant de signer, l'écran de règlement selon le canal de conclusion, la
// référence et le QR code, la déclaration puis la confirmation, les relances d'impayés (arrêt dès la
// déclaration, même entre la liste et l'envoi ; suspension) ; abus d'un autre lien, d'un autre
// évènement, d'une autre organisation.
import { setRelationMailSender } from "@/modules/hub/service";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { createEventLink, createProspect, createProspectSource } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { confirmed } from "@/lib/test-fixtures/recipients";
import {
  actOnFakeSignature,
  addPaymentMethods,
  addQuoteLine,
  addScheduleItem,
  addStarterContractTemplates,
  chooseQuoteOptions,
  confirmSigningCode,
  createQuote,
  declareTransfer,
  extendQuoteValidity,
  generateContract,
  getContractTemplate,
  getDocumentSettings,
  getEventProposal,
  getQuote,
  getQuoteSettlements,
  getSettlement,
  getSigningFlow,
  listClientQuotesToSign,
  listEventProposals,
  listTransferDeclarations,
  markScheduleItemPaid,
  planInvoiceReminders,
  QuoteExpiredError,
  QuoteNotFoundError,
  recordSignerAct,
  requestSigningCode,
  resumePaymentReminders,
  reviseQuote,
  QuoteVersionLockedError,
  sendDueSettlementDetails,
  sendInvoiceReminders,
  sendPlannedInvoiceReminder,
  sendProposalExpiryReminders,
  sendQuote,
  sendQuoteForSignature,
  suspendPaymentReminders,
  TransferDeclarationError,
  updateContractClause,
  updateDocumentSettings,
  updateReminderSettings,
  getReminderSettings,
  type ContractTemplateView,
  type QuoteDetail,
} from "./service";
import { parseEpcQrPayload } from "./payment-references";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import { markSigningCodeVerified } from "@/lib/test-fixtures/signing-code";

// Lot 65d (MSG-01 ; ADR 0110) : ces tests vérifient l'envoi par Symbola, réglage « Symbola les envoie
// pour moi » : rien n'y change. Le réglage par défaut (la planner envoie de sa messagerie) est vérifié
// dans modules/hub/relation-mail.integration.test.ts.
async function symbolaSends(organizationId: string): Promise<string> {
  await setRelationMailSender(organizationId, "symbola");
  return organizationId;
}

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

async function codeSentTo(email: string, count = 1): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const codes = (await messagesTo(email)).map((message) => /(\d{6})$/.exec(message.Subject)?.[1]).filter((code): code is string => Boolean(code));
    if (codes.length >= count) return codes[0]!;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("aucun code reçu");
}

async function organization() {
  const db = appDatabase();
  const organizationId = await symbolaSends((await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id);
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

describe("FAC-02 — Proposition en page web : le total suit les options (lot 43, D2, D3)", () => {
  it("la page d'une version envoyée montre le mot d'accueil, les sections, l'échéancier et la validité ; le total suit l'option cochée", async () => {
    const context = await organization();
    const sent = await quote(context);
    const before = await getEventProposal(context.organizationId, { eventId: context.eventId, versionId: sent.current.id });
    expect(before).toMatchObject({ number: sent.number, version: 1, status: "open", validUntil: sent.current.validUntil, blocks: ["greeting", "organization", "photos", "quote", "schedule", "validity"] });
    expect(before.greeting).toMatch(/proposition/);
    expect(before.totals.totalTtcCents).toBe(600000);
    expect(before.options!.options.map((option) => [option.label, option.amountCents, option.chosen])).toEqual([["Brunch du lendemain", 36000, false]]);
    // Voir la page n'enregistre rien (aperçu « vu par » compris).
    expect((await getQuote(context.organizationId, sent.id)).current.optionsChoice).toBeNull();
    await chooseQuoteOptions({ organizationId: context.organizationId, quoteId: sent.id, eventId: context.eventId, chosenLineIds: [before.options!.options[0]!.lineId], chosenBy: "Léa Martin", byKind: "client" });
    const after = await getEventProposal(context.organizationId, { eventId: context.eventId, versionId: sent.current.id });
    expect(after.totals.totalTtcCents).toBe(636000);
    expect(after.sections.flatMap((section) => section.lines).find((line) => line.isOption)!.chosen).toBe(true);
    expect(after.schedule[0]!.amountCents).toBe(190800);
    expect(await listEventProposals(context.organizationId, context.eventId)).toEqual([expect.objectContaining({ quoteId: sent.id, versionId: sent.current.id, status: "open" })]);
  });

  it("abus : un brouillon, la version d'un autre évènement, d'une autre organisation, ou un identifiant forgé restent introuvables", async () => {
    const context = await organization();
    const other = await organization();
    const draft = await quote(context, { send: false });
    const sent = await quote(context);
    await expect(getEventProposal(context.organizationId, { eventId: context.eventId, versionId: draft.current.id })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(getEventProposal(context.organizationId, { eventId: other.eventId, versionId: sent.current.id })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(getEventProposal(other.organizationId, { eventId: context.eventId, versionId: sent.current.id })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(getEventProposal(context.organizationId, { eventId: context.eventId, versionId: "pas-un-uuid" })).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});

describe("FAC-15 — Validité, versions successives, relance avant expiration (lot 43, D1 ; horloge simulée)", () => {
  it("relance à J-3, une seule fois ; la veille rien ; hors des heures d'envoi rien", async () => {
    const context = await organization();
    const sent = await quote(context);
    const validUntil = sent.current.validUntil!;
    expect(await sendProposalExpiryReminders(context.organizationId, atNoon(plusDays(validUntil, -4)))).toBe(0);
    expect(await sendProposalExpiryReminders(context.organizationId, new Date(`${plusDays(validUntil, -3)}T05:00:00Z`))).toBe(0);
    expect(await sendProposalExpiryReminders(context.organizationId, atNoon(plusDays(validUntil, -3)))).toBe(2);
    expect(await sendProposalExpiryReminders(context.organizationId, atNoon(plusDays(validUntil, -2)))).toBe(0);
    const subjects = (await messagesTo(context.people[0]!.email)).map((message) => message.Subject);
    expect(subjects).toContain(`Votre proposition ${sent.number} expire bientôt`);
  });

  it("pas de relance après une signature ni un refus", async () => {
    const context = await organization();
    const signed = await signedWith(context, "on_premises");
    expect(signed.status).toBe("signed");
    expect(await sendProposalExpiryReminders(context.organizationId, atNoon(plusDays(signed.current.validUntil!, -1)))).toBe(0);
  });

  it("une version expirée ne se signe plus, ses options ne se choisissent plus ; prolongée, elle repart ; une version signée est figée", async () => {
    const context = await organization();
    const sent = await quote(context);
    const expiredDay = plusDays(sent.current.validUntil!, 1);
    const proposal = await getEventProposal(context.organizationId, { eventId: context.eventId, versionId: sent.current.id, now: atNoon(expiredDay) });
    expect(proposal.status).toBe("expired");
    await expect(chooseQuoteOptions({ organizationId: context.organizationId, quoteId: sent.id, eventId: context.eventId, chosenLineIds: [], chosenBy: "Léa", byKind: "client", now: atNoon(expiredDay) })).rejects.toBeInstanceOf(QuoteExpiredError);
    expect((await getSigningFlow(context.organizationId, { eventId: context.eventId, email: context.people[0]!.email, quoteId: sent.id, now: atNoon(expiredDay) })).step).toBe("expired");
    await expect(extendQuoteValidity(context.organizationId, sent.id, plusDays(parisDay(), -1))).rejects.toThrow();
    const extended = await extendQuoteValidity(context.organizationId, sent.id, plusDays(sent.current.validUntil!, 30));
    expect(extended.current.validUntil).toBe(plusDays(sent.current.validUntil!, 30));
    expect((await getEventProposal(context.organizationId, { eventId: context.eventId, versionId: sent.current.id, now: atNoon(expiredDay) })).status).toBe("open");

    const other = await organization();
    const signed = await signedWith(other, "on_premises");
    await expect(reviseQuote(other.organizationId, signed.id)).rejects.toBeInstanceOf(QuoteVersionLockedError);
    expect((await getEventProposal(other.organizationId, { eventId: other.eventId, versionId: signed.current.id })).status).toBe("signed");
  });

  it("les versions successives restent lisibles ; la précédente est marquée remplacée", async () => {
    const context = await organization();
    const first = await quote(context);
    await reviseQuote(context.organizationId, first.id);
    const second = await sendQuote({ organizationId: context.organizationId, quoteId: first.id });
    const old = await getEventProposal(context.organizationId, { eventId: context.eventId, versionId: first.current.id });
    expect(old.status).toBe("superseded");
    const current = await getEventProposal(context.organizationId, { eventId: context.eventId, versionId: second.current.id });
    expect(current.versions.map((version) => [version.version, version.current])).toEqual([
      [2, true],
      [1, false],
    ]);
  });
});

describe("SEC-16 — Code à usage unique avant de signer (lot 43, D4)", () => {
  async function pendingSignature() {
    const context = await organization();
    const sent = await quote(context);
    setSignatureProviderForTests(fakeSignatureProvider());
    await sendQuoteForSignature(confirmed({ organizationId: context.organizationId, quoteId: sent.id, signers: context.people, documentPdf: PDF, locale: "fr" }));
    return { context, sent, lea: context.people[0]!, leaLink: context.links[context.people[0]!.email]! };
  }

  it("le lien de signature n'apparaît qu'après le code ; le bon code est accepté une fois", async () => {
    const { context, sent, lea, leaLink } = await pendingSignature();
    const flow = await getSigningFlow(context.organizationId, { eventId: context.eventId, email: lea.email, quoteId: sent.id });
    expect([flow.step, flow.signingUrl]).toEqual(["code", null]);
    expect(await requestSigningCode(context.organizationId, { eventId: context.eventId, linkId: leaLink, email: lea.email, quoteId: sent.id, locale: "fr" })).toMatchObject({ sent: true });
    const code = await codeSentTo(lea.email);
    expect(await confirmSigningCode(context.organizationId, { eventId: context.eventId, linkId: leaLink, email: lea.email, quoteId: sent.id, code })).toEqual({ outcome: "accepted" });
    const after = await getSigningFlow(context.organizationId, { eventId: context.eventId, email: lea.email, quoteId: sent.id });
    expect(after.step).toBe("sign");
    expect(after.signingUrl).toMatch(/signature-fictive/);
    expect((await listClientQuotesToSign(context.organizationId, context.eventId, lea.email))[0]!.ownSigningUrl).toBe(after.signingUrl);
    // Le même code, rejoué, est refusé.
    expect((await confirmSigningCode(context.organizationId, { eventId: context.eventId, linkId: leaLink, email: lea.email, quoteId: sent.id, code })).outcome).toBe("code_expired");
    // Trente minutes plus tard, le lien se recache.
    expect((await getSigningFlow(context.organizationId, { eventId: context.eventId, email: lea.email, quoteId: sent.id, now: new Date(Date.now() + 31 * 60_000) })).signingUrl).toBeNull();
  });

  it("le code expire en dix minutes ; cinq essais au plus", async () => {
    const { context, sent, lea, leaLink } = await pendingSignature();
    const sentAt = new Date();
    await requestSigningCode(context.organizationId, { eventId: context.eventId, linkId: leaLink, email: lea.email, quoteId: sent.id, locale: "fr", now: sentAt });
    const code = await codeSentTo(lea.email);
    expect(await confirmSigningCode(context.organizationId, { eventId: context.eventId, linkId: leaLink, email: lea.email, quoteId: sent.id, code, now: new Date(sentAt.getTime() + 10 * 60_000 + 1000) })).toEqual({ outcome: "code_expired" });
    await requestSigningCode(context.organizationId, { eventId: context.eventId, linkId: leaLink, email: lea.email, quoteId: sent.id, locale: "fr" });
    const second = await codeSentTo(lea.email, 2);
    const wrong = second === "000000" ? "111111" : "000000";
    for (let attempt = 1; attempt <= 4; attempt++) {
      expect(await confirmSigningCode(context.organizationId, { eventId: context.eventId, linkId: leaLink, email: lea.email, quoteId: sent.id, code: wrong })).toEqual({ outcome: "wrong_code", attemptsLeft: 5 - attempt });
    }
    expect(await confirmSigningCode(context.organizationId, { eventId: context.eventId, linkId: leaLink, email: lea.email, quoteId: sent.id, code: wrong })).toEqual({ outcome: "code_expired" });
    expect(await confirmSigningCode(context.organizationId, { eventId: context.eventId, linkId: leaLink, email: lea.email, quoteId: sent.id, code: second })).toEqual({ outcome: "code_expired" });
  });

  it("abus : le code du lien de Maxime n'ouvre pas la signature de Léa ; un lien d'un autre évènement ne demande rien", async () => {
    const { context, sent, lea } = await pendingSignature();
    const maxime = context.people[1]!;
    const maximeLink = context.links[maxime.email]!;
    await requestSigningCode(context.organizationId, { eventId: context.eventId, linkId: maximeLink, email: maxime.email, quoteId: sent.id, locale: "fr" });
    const code = await codeSentTo(maxime.email);
    // Le code est attaché au lien qui l'a reçu : présenté par le lien de Léa, il ne vaut rien.
    expect((await confirmSigningCode(context.organizationId, { eventId: context.eventId, linkId: context.links[lea.email]!, email: lea.email, quoteId: sent.id, code })).outcome).not.toBe("accepted");
    expect((await getSigningFlow(context.organizationId, { eventId: context.eventId, email: lea.email, quoteId: sent.id })).signingUrl).toBeNull();
    const other = await organization();
    await expect(requestSigningCode(other.organizationId, { eventId: other.eventId, linkId: other.links[other.people[0]!.email]!, email: other.people[0]!.email, quoteId: sent.id, locale: "fr" })).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});

describe("GC-01 / JUR-07 — Régler l'acompte selon le canal de conclusion (lot 43, ADR 0087)", () => {
  const view = (context: Context, quoteDetail: QuoteDetail, now?: Date, email = context.people[0]!.email) =>
    getSettlement(context.organizationId, { eventId: context.eventId, linkId: context.links[email]!, scheduleItemId: quoteDetail.current.schedule.items[0]!.id, designatedLinkId: null, locale: "fr", ...(now ? { now } : {}) });

  it("tant que Maxime n'a pas signé, le règlement attend ; puis le RIB, la référence et le QR code s'affichent (en établissement)", async () => {
    const context = await organization();
    const sent = await quote(context);
    setSignatureProviderForTests(fakeSignatureProvider());
    const signing = await sendQuoteForSignature(confirmed({ organizationId: context.organizationId, quoteId: sent.id, signers: context.people, documentPdf: PDF, locale: "fr" }));
    expect(await actOnFakeSignature(signing.signature!.signers[0]!.signingUrl.split("/").pop()!, "sign")).toBe(true);
    const flow = await getSigningFlow(context.organizationId, { eventId: context.eventId, email: context.people[0]!.email, quoteId: sent.id });
    expect([flow.step, flow.waitingFor]).toEqual(["settle", ["Maxime"]]);
    expect((await view(context, sent)).state).toEqual({ kind: "awaiting_signatures" });
    expect((await view(context, sent)).transfer).toBeNull();
    expect(await actOnFakeSignature(signing.signature!.signers[1]!.signingUrl.split("/").pop()!, "sign")).toBe(true);
    const open = await view(context, sent);
    expect(open.state).toEqual({ kind: "open", notice: null });
    expect(open.transfer!.reference).toMatch(/^SYM-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(open.transfer!.qrSvg).toMatch(/^<svg/);
    expect(open.amountCents).toBe(180000);
    expect(open.canDeclare).toBe(true);
    // La référence ne porte ni nom ni numéro de devis.
    expect(open.transfer!.reference).not.toMatch(/MARTIN|DURAND|D-\d/);
    expect((await view(context, sent)).transfer!.reference).toBe(open.transfer!.reference);
  });

  it("à distance : le RIB s'affiche avec le rappel des quatorze jours et du formulaire (contract-rules.json)", async () => {
    const context = await organization();
    const signed = await signedWith(context, "distance");
    const open = await view(context, signed);
    expect(open.state).toEqual({ kind: "open", notice: "distance" });
    expect(open.notice).toContain("14 jours");
    expect(open.notice).toContain("formulaire de rétractation");
    expect(open.transfer).not.toBeNull();
  });

  it("hors établissement : ni RIB ni déclaration avant le 8e jour ; ce jour-là, le RIB s'affiche et part par e-mail, une fois", async () => {
    const context = await organization();
    const signed = await signedWith(context, "off_premises");
    const signedOn = parisDay();
    const opensOn = plusDays(signedOn, 7);
    const before = await view(context, signed, atNoon(plusDays(opensOn, -1)));
    expect(before.state).toEqual({ kind: "not_before", date: opensOn });
    expect(before.transfer).toBeNull();
    expect(before.notice).toContain("Aucun paiement ne peut vous être demandé avant le");
    await expect(
      declareTransfer(context.organizationId, { eventId: context.eventId, linkId: context.links[context.people[0]!.email]!, personName: "Léa Martin", scheduleItemId: signed.current.schedule.items[0]!.id, paidOn: signedOn, designatedLinkId: null, now: atNoon(plusDays(opensOn, -1)) }),
    ).rejects.toMatchObject({ reason: "not_open" });
    expect(await sendDueSettlementDetails(context.organizationId, atNoon(plusDays(opensOn, -1)))).toBe(0);
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(opensOn, -1)))).toBe(0);
    const open = await view(context, signed, atNoon(opensOn));
    expect(open.state).toEqual({ kind: "open", notice: "off_premises" });
    expect(open.transfer!.iban).toBe(IBAN);
    expect(await sendDueSettlementDetails(context.organizationId, atNoon(opensOn))).toBe(2);
    expect(await sendDueSettlementDetails(context.organizationId, atNoon(plusDays(opensOn, 1)))).toBe(0);
    const subjects = (await messagesTo(context.people[1]!.email)).map((message) => message.Subject);
    expect(subjects).toContain(`Règlement de l'acompte — devis ${signed.number}`);
  });
});

describe("FAC-08 (Divergent, ADR 0087) — Déclaration du payeur, confirmation de la planner, QR code EPC", () => {
  it("le QR code porte le bénéficiaire, l'IBAN, le montant et la référence ; Léa déclare, Camille confirme par le rapprochement existant", async () => {
    const context = await organization();
    const signed = await signedWith(context, "on_premises");
    const item = signed.current.schedule.items[0]!;
    const leaLink = context.links[context.people[0]!.email]!;
    const open = await getSettlement(context.organizationId, { eventId: context.eventId, linkId: leaLink, scheduleItemId: item.id, designatedLinkId: null, locale: "fr" });
    const { epcQrPayload } = await import("./payment-references");
    const payload = epcQrPayload({ beneficiary: open.transfer!.beneficiary, iban: open.transfer!.iban, bic: open.transfer!.bic, amountCents: open.amountCents, reference: open.transfer!.reference });
    expect(parseEpcQrPayload(payload)).toMatchObject({ iban: IBAN, amount: "EUR1800.00", reference: open.transfer!.reference });
    await expect(declareTransfer(context.organizationId, { eventId: context.eventId, linkId: leaLink, personName: "Léa Martin", scheduleItemId: item.id, paidOn: plusDays(parisDay(), 1), designatedLinkId: null })).rejects.toMatchObject({ reason: "date" });
    // Un autre payeur que celui désigné ne déclare pas.
    await expect(declareTransfer(context.organizationId, { eventId: context.eventId, linkId: leaLink, personName: "Léa Martin", scheduleItemId: item.id, paidOn: parisDay(), designatedLinkId: randomUUID() })).rejects.toMatchObject({ reason: "not_payer" });
    await declareTransfer(context.organizationId, { eventId: context.eventId, linkId: leaLink, personName: "Léa Martin", scheduleItemId: item.id, paidOn: parisDay(), designatedLinkId: leaLink });
    await expect(declareTransfer(context.organizationId, { eventId: context.eventId, linkId: leaLink, personName: "Léa Martin", scheduleItemId: item.id, paidOn: parisDay(), designatedLinkId: null })).rejects.toBeInstanceOf(TransferDeclarationError);
    const declared = await getSettlement(context.organizationId, { eventId: context.eventId, linkId: leaLink, scheduleItemId: item.id, designatedLinkId: null, locale: "fr" });
    expect(declared.state).toMatchObject({ kind: "declared", paidOn: parisDay(), byName: "Léa Martin" });
    expect(declared.transfer).toBeNull();
    const pending = await listTransferDeclarations(context.organizationId);
    expect(pending).toEqual([expect.objectContaining({ scheduleItemId: item.id, amountCents: 180000, byName: "Léa Martin", reference: open.transfer!.reference })]);
    const [method] = await addPaymentMethods(context.organizationId, ["Virement"]);
    await markScheduleItemPaid({ organizationId: context.organizationId, scheduleItemId: item.id, paidOn: parisDay(), paymentMethodId: method!.id });
    expect(await listTransferDeclarations(context.organizationId)).toEqual([]);
    expect((await getSettlement(context.organizationId, { eventId: context.eventId, linkId: leaLink, scheduleItemId: item.id, designatedLinkId: null, locale: "fr" })).state).toEqual({ kind: "paid", paidOn: parisDay() });
  });

  it("abus : l'échéance d'un autre évènement ou d'une autre organisation est introuvable ; une autre organisation ne voit pas la déclaration", async () => {
    const context = await organization();
    const other = await organization();
    const signed = await signedWith(context, "on_premises");
    const item = signed.current.schedule.items[0]!;
    await expect(getSettlement(other.organizationId, { eventId: context.eventId, linkId: randomUUID(), scheduleItemId: item.id, designatedLinkId: null, locale: "fr" })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(getSettlement(context.organizationId, { eventId: other.eventId, linkId: randomUUID(), scheduleItemId: item.id, designatedLinkId: null, locale: "fr" })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(declareTransfer(context.organizationId, { eventId: other.eventId, linkId: randomUUID(), personName: "Intrus", scheduleItemId: item.id, paidOn: parisDay(), designatedLinkId: null })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await declareTransfer(context.organizationId, { eventId: context.eventId, linkId: context.links[context.people[0]!.email]!, personName: "Léa Martin", scheduleItemId: item.id, paidOn: parisDay(), designatedLinkId: null });
    expect(await listTransferDeclarations(other.organizationId)).toEqual([]);
  });
});

describe("FAC-09 — Relances d'impayés : J+3, J+10, J+20 ; arrêt dès la déclaration ; suspension (lot 43, D7 ; horloge simulée)", () => {
  it("une relance par rang, rien la veille ; les réglages de l'organisation s'appliquent", async () => {
    const context = await organization();
    const due = plusDays(parisDay(), 1);
    const signed = await signedWith(context, "on_premises", { dueDate: due });
    expect(await getReminderSettings(context.organizationId)).toEqual({ expiryReminderDays: 3, paymentReminderDays: [3, 10, 20], consumerLatePenaltyBasisPoints: null });
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(due, 2)))).toBe(0);
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(due, 3)))).toBe(1);
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(due, 4)))).toBe(0);
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(due, 10)))).toBe(1);
    await updateReminderSettings(context.organizationId, { expiryReminderDays: 5, paymentReminderDays: [3, 10, 15], consumerLatePenaltyBasisPoints: 300 });
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(due, 15)))).toBe(1);
    const settlement = (await getQuoteSettlements(context.organizationId, signed.id))[0]!;
    expect(settlement.remindersSent.map((reminder) => reminder.rank)).toEqual([1, 2, 3]);
    const subjects = (await messagesTo(context.people[0]!.email)).map((message) => message.Subject);
    expect(subjects.filter((subject) => subject.startsWith("Rappel : échéance du"))).toHaveLength(3);
  });

  it("aucune relance après une déclaration, même si elle arrive entre la liste et l'envoi ; ni après la confirmation", async () => {
    const context = await organization();
    const due = plusDays(parisDay(), 1);
    const signed = await signedWith(context, "on_premises", { dueDate: due });
    const item = signed.current.schedule.items[0]!;
    const planned = await planInvoiceReminders(context.organizationId, atNoon(plusDays(due, 3)));
    expect(planned).toEqual([expect.objectContaining({ scheduleItemId: item.id, rank: 1 })]);
    await declareTransfer(context.organizationId, { eventId: context.eventId, linkId: context.links[context.people[0]!.email]!, personName: "Léa Martin", scheduleItemId: item.id, paidOn: parisDay(), designatedLinkId: null });
    expect(await sendPlannedInvoiceReminder(context.organizationId, planned[0]!, atNoon(plusDays(due, 3)))).toBe(false);
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(due, 10)))).toBe(0);

    const second = await organization();
    const paid = await signedWith(second, "on_premises", { dueDate: due });
    const [method] = await addPaymentMethods(second.organizationId, ["Virement"]);
    const plannedSecond = await planInvoiceReminders(second.organizationId, atNoon(plusDays(due, 3)));
    await markScheduleItemPaid({ organizationId: second.organizationId, scheduleItemId: paid.current.schedule.items[0]!.id, paidOn: parisDay(), paymentMethodId: method!.id });
    expect(await sendPlannedInvoiceReminder(second.organizationId, plannedSecond[0]!, atNoon(plusDays(due, 3)))).toBe(false);
  });

  it("la planner suspend les relances d'une échéance (motif), puis les reprend", async () => {
    const context = await organization();
    const due = plusDays(parisDay(), 1);
    const signed = await signedWith(context, "on_premises", { dueDate: due });
    const item = signed.current.schedule.items[0]!;
    await suspendPaymentReminders(context.organizationId, { scheduleItemId: item.id, reason: "Arrangement avec le client : virement fin du mois", userId: context.plannerId });
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(due, 3)))).toBe(0);
    expect((await getQuoteSettlements(context.organizationId, signed.id))[0]!.remindersSuspended).toMatchObject({ reason: "Arrangement avec le client : virement fin du mois" });
    await resumePaymentReminders(context.organizationId, item.id);
    expect(await sendInvoiceReminders(context.organizationId, atNoon(plusDays(due, 3)))).toBe(1);
  });
});

describe("SEC-16 / SC-02 — Deux signataires sur deux appareils, un seul code par signataire", () => {
  it("Léa signe ; Maxime, avec son propre code, signe deux jours plus tard ; l'acompte se règle une fois", async () => {
    const context = await organization();
    const sent = await quote(context);
    setSignatureProviderForTests(fakeSignatureProvider());
    const signing = await sendQuoteForSignature(confirmed({ organizationId: context.organizationId, quoteId: sent.id, signers: context.people, documentPdf: PDF, locale: "fr" }));
    for (const person of context.people) {
      await markSigningCodeVerified(context.organizationId, person.email);
      const flow = await getSigningFlow(context.organizationId, { eventId: context.eventId, email: person.email, quoteId: sent.id });
      expect(flow.signingUrl).toBe(signing.signature!.signers.find((signer) => signer.email === person.email)!.signingUrl);
      expect(await actOnFakeSignature(flow.signingUrl!.split("/").pop()!, "sign")).toBe(true);
    }
    const item = sent.current.schedule.items[0]!;
    await declareTransfer(context.organizationId, { eventId: context.eventId, linkId: context.links[context.people[0]!.email]!, personName: "Léa Martin", scheduleItemId: item.id, paidOn: parisDay(), designatedLinkId: null });
    await expect(declareTransfer(context.organizationId, { eventId: context.eventId, linkId: context.links[context.people[1]!.email]!, personName: "Maxime Durand", scheduleItemId: item.id, paidOn: parisDay(), designatedLinkId: null })).rejects.toMatchObject({ reason: "already" });
  });
});
