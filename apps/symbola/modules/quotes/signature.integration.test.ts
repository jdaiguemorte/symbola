// DEV-02 — signature en ligne, contre un vrai PostgreSQL (RLS), par la
// porte d'entrée du module, avec le faux fournisseur (la même suite de
// contrat tourne contre l'adaptateur DocuSeal, signature/provider-contract).
import { randomUUID } from "node:crypto";
import { sql as raw } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { saveOnboardingStep } from "@/modules/hub/service";
import { createProspect, createProspectSource, getEvent, startEventsTrial } from "@/modules/events/service";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import {
  QuoteNotFoundError,
  QuoteNotSentError,
  actOnFakeSignature,
  findFakeSignature,
  SignatureAlreadyRequestedError,
  SignatureUnavailableError,
  addQuoteLine,
  createQuote,
  getQuote,
  getSignatureDocumentUrl,
  handleSignatureWebhook,
  isSignatureAvailable,
  listClientQuotesToSign,
  QuoteVersionLockedError,
  removeEventQuotesData,
  reviseQuote,
  sendQuote,
  sendQuoteForSignature,
  type QuoteDetail,
} from "./service";

const MAILPIT_API = "http://localhost:8025/api/v1";
const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");

afterEach(() => setSignatureProviderForTests(undefined));

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function messagesTo(to: string, expected = 1): Promise<{ Subject: string; Text: string }[]> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string; Subject: string }[] };
    if (messages.length >= expected) {
      return Promise.all(
        messages.map(async (message) => {
          const detail = (await (await fetch(`${MAILPIT_API}/message/${message.ID}`)).json()) as { Text: string };
          return { Subject: message.Subject, Text: detail.Text };
        }),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

async function countSignedEvents(quoteId: string): Promise<number> {
  return withDb(async (db) => {
    // core.domain_events n'a pas de RLS (ADR 0014) : lecture directe.
    const rows = await db.execute(
      raw`select count(*)::int as n from core.domain_events where name = 'quotes.quote.signed' and payload->>'quoteId' = ${quoteId}`,
    );
    return Number((rows as unknown as { n: number }[])[0]?.n ?? 0);
  });
}

// Organisation assujettie, planner réelle (destinataire de l'e-mail « devis
// signé »), événement en prospect et devis envoyé de 1 200 € TTC.
async function setup(options: { send?: boolean } = {}) {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`))).id;
  await withDb((db) =>
    saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, siren: "123456789", address: "1 rue des Lilas" }),
  );
  const plannerEmail = `planner-${randomUUID()}@example.test`;
  const planner = await withDb((db) => createUser(db, { organizationId, email: plannerEmail, password: "mot-de-passe-du-test", role: "owner" }));
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: planner.id,
    prospectSourceId: source.id,
    clients: [{ firstName: "Inès", lastName: null }, { firstName: "Sacha", lastName: null }],
  });
  const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: planner.id });
  await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 100000 });
  if (options.send !== false) await sendQuote({ organizationId, quoteId: quote.id });
  return { organizationId, eventId: event.id, quoteId: quote.id, plannerEmail };
}

function signers() {
  const tag = randomUUID().slice(0, 8);
  return [
    { name: "Inès Martin", email: `ines-${tag}@example.test`, billingAddress: "3 place Bellecour, 69002 Lyon" },
    { name: "Sacha Durand", email: `sacha-${tag}@example.test`, billingAddress: "3 place Bellecour, 69002 Lyon" },
  ];
}

async function sendForSignature(organizationId: string, quoteId: string) {
  setSignatureProviderForTests(fakeSignatureProvider());
  const people = signers();
  const detail = await sendQuoteForSignature({ organizationId, quoteId, signers: people, documentPdf: PDF, locale: "fr" });
  return { detail, people };
}

// Fait signer (ou refuser) un signataire chez le faux fournisseur, puis
// livre le webhook correspondant ; renvoie la réponse du webhook.
async function deliver(detail: QuoteDetail, signerIndex: number, action: "sign" | "decline", headers?: Headers) {
  const fake = fakeSignatureProvider();
  const signature = detail.signature!;
  const externalId = `${(await requestExternalId(detail))}`;
  const signer = signature.signers[signerIndex]!;
  const rawBody = fake.act(externalId, `${organizationOf.get(detail.id)}.${signer.id}`, action);
  return { rawBody, result: await handleSignatureWebhook({ headers: headers ?? fake.webhookHeaders(), rawBody }) };
}

// Le faux fournisseur rend l'identifiant de sa soumission dans le lien de
// signature (jeton) : on le retrouve par le jeton.
async function requestExternalId(detail: QuoteDetail): Promise<string> {
  const token = detail.signature!.signers[0]!.signingUrl.split("/").pop()!;
  return fakeSignatureProvider().findByToken(token)!.request.externalId;
}

const organizationOf = new Map<string, string>();

describe("DEV-02 — Envoi en signature", () => {
  it("la version courante figée part chez le fournisseur ; chaque signataire reçoit son lien par un e-mail de Symbola", async () => {
    const { organizationId, quoteId } = await setup();
    const { detail, people } = await sendForSignature(organizationId, quoteId);

    expect(detail.status).toBe("sent");
    expect(detail.signature).toMatchObject({ provider: "fake", status: "pending", hasSignedDocument: false });
    expect(detail.signature!.signers.map((signer) => [signer.name, signer.email, signer.status])).toEqual([
      [people[0]!.name, people[0]!.email, "pending"],
      [people[1]!.name, people[1]!.email, "pending"],
    ]);
    const [first, second] = detail.signature!.signers;
    expect(first!.signingUrl).not.toBe(second!.signingUrl);

    const [mail] = await messagesTo(people[0]!.email);
    expect(mail?.Subject).toContain(detail.number);
    expect(mail?.Text).toContain(first!.signingUrl);
    expect(mail?.Text).not.toContain(second!.signingUrl);
    expect((await messagesTo(people[1]!.email))[0]?.Text).toContain(second!.signingUrl);
  });

  it("refuse un devis non envoyé, une seconde demande sur la même version et des signataires invalides", async () => {
    const draft = await setup({ send: false });
    setSignatureProviderForTests(fakeSignatureProvider());
    await expect(
      sendQuoteForSignature({ organizationId: draft.organizationId, quoteId: draft.quoteId, signers: signers(), documentPdf: PDF, locale: "fr" }),
    ).rejects.toBeInstanceOf(QuoteNotSentError);

    const { organizationId, quoteId } = await setup();
    await expect(sendQuoteForSignature({ organizationId, quoteId, signers: [], documentPdf: PDF, locale: "fr" })).rejects.toBeInstanceOf(RangeError);
    await expect(
      sendQuoteForSignature({
        organizationId,
        quoteId,
        signers: [{ name: "Inès", email: "pas-un-email", billingAddress: "Lyon" }],
        documentPdf: PDF,
        locale: "fr",
      }),
    ).rejects.toBeInstanceOf(RangeError);
    await sendQuoteForSignature({ organizationId, quoteId, signers: signers(), documentPdf: PDF, locale: "fr" });
    await expect(
      sendQuoteForSignature({ organizationId, quoteId, signers: signers(), documentPdf: PDF, locale: "fr" }),
    ).rejects.toBeInstanceOf(SignatureAlreadyRequestedError);
  });

  it("sans fournisseur configuré, la signature est « indisponible », sans erreur pour le reste du devis", async () => {
    const { organizationId, quoteId } = await setup();
    setSignatureProviderForTests(null);
    expect(isSignatureAvailable(false)).toBe(false);
    expect(isSignatureAvailable(true)).toBe(true);
    await expect(
      sendQuoteForSignature({ organizationId, quoteId, signers: signers(), documentPdf: PDF, locale: "fr" }),
    ).rejects.toBeInstanceOf(SignatureUnavailableError);
    expect((await getQuote(organizationId, quoteId)).signature).toBeNull();
  });
});

describe("DEV-02 — Webhook du fournisseur", () => {
  it("un appel non authentifié valablement est rejeté (401), journalisé, sans effet", async () => {
    const { organizationId, quoteId } = await setup();
    const { detail } = await sendForSignature(organizationId, quoteId);
    organizationOf.set(detail.id, organizationId);

    const wrong = await deliver(detail, 0, "sign", new Headers({ "x-symbola-fake-signature": "secret-faux" }));
    expect(wrong.result).toEqual({ httpStatus: 401, outcome: "invalid_secret" });
    const missing = await handleSignatureWebhook({ headers: new Headers(), rawBody: wrong.rawBody });
    expect(missing).toEqual({ httpStatus: 401, outcome: "missing_secret" });

    const after = await getQuote(organizationId, quoteId);
    expect(after.signature!.signers.map((signer) => signer.status)).toEqual(["pending", "pending"]);
  });

  it("quand le dernier signataire a signé : devis « Signé », documents archivés, e-mail à la planner, événement Confirmé, quotes.quote.signed publié", async () => {
    const { organizationId, quoteId, eventId, plannerEmail } = await setup();
    const { detail } = await sendForSignature(organizationId, quoteId);
    organizationOf.set(detail.id, organizationId);

    const first = await deliver(detail, 0, "sign");
    expect(first.result.httpStatus).toBe(200);
    let current = await getQuote(organizationId, quoteId);
    expect(current.status).toBe("sent");
    expect(current.signature!.signers.map((signer) => signer.status)).toEqual(["signed", "pending"]);
    expect((await getEvent(organizationId, eventId))?.status).toBe("prospect");

    const last = await deliver(detail, 1, "sign");
    expect(last.result).toEqual({ httpStatus: 200, outcome: "completed" });
    current = await getQuote(organizationId, quoteId);
    expect(current.status).toBe("signed");
    expect(current.signature).toMatchObject({ status: "completed", hasSignedDocument: true });
    expect(current.signature!.completedAt).not.toBeNull();
    expect((await getEvent(organizationId, eventId))?.status).toBe("confirmed");
    expect(await countSignedEvents(quoteId)).toBe(1);

    const [mail] = await messagesTo(plannerEmail);
    expect(mail?.Subject).toContain(detail.number);

    const url = await getSignatureDocumentUrl(organizationId, quoteId, "signed");
    const document = await fetch(url);
    expect(document.status).toBe(200);
    expect(Buffer.from(await document.arrayBuffer()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect((await fetch(await getSignatureDocumentUrl(organizationId, quoteId, "certificate"))).status).toBe(200);

    // Rejouer le même appel ne change rien de plus.
    const replay = await handleSignatureWebhook({ headers: fakeSignatureProvider().webhookHeaders(), rawBody: last.rawBody });
    expect(replay).toEqual({ httpStatus: 200, outcome: "duplicate" });
    expect(await countSignedEvents(quoteId)).toBe(1);
    expect((await messagesTo(plannerEmail)).length).toBe(1);
  });

  it("un refus passe le devis à « Refusé » sans confirmer l'événement", async () => {
    const { organizationId, quoteId, eventId } = await setup();
    const { detail } = await sendForSignature(organizationId, quoteId);
    organizationOf.set(detail.id, organizationId);

    expect((await deliver(detail, 1, "decline")).result).toEqual({ httpStatus: 200, outcome: "declined" });
    const current = await getQuote(organizationId, quoteId);
    expect(current.status).toBe("declined");
    expect(current.signature?.status).toBe("declined");
    expect((await getEvent(organizationId, eventId))?.status).toBe("prospect");

    // Un devis refusé peut repartir dans une nouvelle version, sans signature.
    const revised = await reviseQuote(organizationId, quoteId);
    expect(revised).toMatchObject({ status: "draft", currentVersion: 2, signature: null });
  });

  it("une version en cours de signature ne se remplace pas par une nouvelle version", async () => {
    const { organizationId, quoteId } = await setup();
    await sendForSignature(organizationId, quoteId);
    await expect(reviseQuote(organizationId, quoteId)).rejects.toBeInstanceOf(QuoteVersionLockedError);
  });

  it("un appel authentifié mais qui désigne la demande d'une autre organisation n'a aucun effet", async () => {
    const own = await setup();
    const other = await setup();
    const { detail } = await sendForSignature(own.organizationId, own.quoteId);
    const fake = fakeSignatureProvider();
    const externalId = await requestExternalId(detail);
    const signer = detail.signature!.signers[0]!;
    fake.act(externalId, `${own.organizationId}.${signer.id}`, "sign");

    // Même soumission, mais l'identifiant du signataire prétend venir d'une autre organisation.
    const forged = JSON.stringify({
      event_type: "form.completed",
      data: { submission_id: externalId, external_id: `${other.organizationId}.${signer.id}` },
    });
    expect(await handleSignatureWebhook({ headers: fake.webhookHeaders(), rawBody: forged })).toEqual({
      httpStatus: 200,
      outcome: "unknown_request",
    });
    expect((await getQuote(own.organizationId, own.quoteId)).signature!.signers[0]?.status).toBe("pending");
    await expect(getSignatureDocumentUrl(other.organizationId, own.quoteId, "signed")).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});

describe("DEV-02 — Espace du marié", () => {
  it("le marié voit le devis à signer et son propre lien, jamais celui d'un autre signataire", async () => {
    const { organizationId, quoteId, eventId } = await setup();
    const { detail, people } = await sendForSignature(organizationId, quoteId);

    const own = await listClientQuotesToSign(organizationId, eventId, people[0]!.email.toUpperCase());
    expect(own).toEqual([
      {
        quoteId,
        number: detail.number,
        version: 1,
        totalTtcCents: 120000,
        status: "pending",
        ownSigningUrl: detail.signature!.signers[0]!.signingUrl,
        ownStatus: "pending",
      },
    ]);
    const stranger = await listClientQuotesToSign(organizationId, eventId, "inconnu@example.test");
    expect(stranger[0]).toMatchObject({ ownSigningUrl: null, ownStatus: null });
  });
});

describe("DEV-02 — Essai guidé (ADR 0008)", () => {
  it("un devis d'essai se signe avec le faux fournisseur, sans e-mail à un tiers, et disparaît avec l'essai", async () => {
    const { organizationId } = await setup();
    setSignatureProviderForTests(null);
    const trial = await startEventsTrial({ organizationId, userId: randomUUID(), locale: "fr" });
    const quote = await createQuote({ organizationId, eventId: trial.eventId, createdByUserId: randomUUID() });
    await addQuoteLine(organizationId, quote.id, { label: "Fictif", unit: "forfait", quantityMilli: 1000, unitPriceCents: 50000 });
    await sendQuote({ organizationId, quoteId: quote.id });
    const people = signers();
    const detail = await sendQuoteForSignature({ organizationId, quoteId: quote.id, signers: people, documentPdf: PDF, locale: "fr" });
    expect(detail.signature?.provider).toBe("fake");
    // Le marié fictif signe sur la page de signature fictive (pas de webhook HTTP).
    const tokens = detail.signature!.signers.map((signer) => signer.signingUrl.split("/").pop()!);
    expect(await findFakeSignature(tokens[0]!)).toMatchObject({ quoteNumber: detail.number, signerName: people[0]!.name, isDemo: true });
    expect(await actOnFakeSignature(tokens[0]!, "sign")).toBe(true);
    expect(await actOnFakeSignature(tokens[1]!, "sign")).toBe(true);
    expect((await getQuote(organizationId, quote.id)).status).toBe("signed");
    expect(await countSignedEvents(quote.id)).toBe(0);
    expect(await messagesTo(people[0]!.email, 1)).toEqual([]);
    const url = await getSignatureDocumentUrl(organizationId, quote.id, "signed");

    await removeEventQuotesData(organizationId, [trial.eventId]);
    await expect(getQuote(organizationId, quote.id)).rejects.toBeInstanceOf(QuoteNotFoundError);
    expect((await fetch(url)).status).toBe(404);
  });
});
