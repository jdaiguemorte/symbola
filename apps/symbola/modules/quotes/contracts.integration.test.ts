// Lot 31b (FAC-04, FAC-05, DOC-02, DOC-03, JUR-07, JUR-08, JUR-20, HUB-21 ; décisions D6, D7, D9,
// D11 à D17, révisées après les réponses de l'avocat du 13/11/2026) — contrats, contre un vrai
// PostgreSQL (RLS) et le stockage, par la porte d'entrée du module : modèles datés et versionnés,
// génération refusée tant qu'un problème reste (nommé), canal de conclusion et régime, clause des
// sommes versées d'avance, avertissement accepté, signature du devis et du contrat, actes du
// client, dossier de preuve, facture d'acompte émise d'elle-même (horloge simulée) ; abus d'une
// autre organisation, d'un autre événement, d'un autre signataire.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { starterContractRules } from "@symbola/starter-templates";
import { createEventLink, createProspect, createProspectSource, setEventVenue } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import {
  actOnFakeSignature,
  addContractClause,
  addQuoteLine,
  addScheduleItem,
  addStarterContractTemplates,
  checkContract,
  ContractActNotAllowedError,
  ContractNotFoundError,
  ContractNotGeneratableError,
  ContractTemplateNotFoundError,
  createQuote,
  duplicateContractTemplate,
  generateContract,
  getContractEvidence,
  getContractTemplate,
  getQuote,
  getQuoteScheduledDeposit,
  getQuoteSettings,
  issueDepositInvoice,
  issueScheduledDepositInvoices,
  listClientQuotesToSign,
  listContractTemplates,
  listQuoteContracts,
  listQuoteInvoices,
  moveContractClause,
  recordSignerAct,
  removeContractClause,
  removeContractTemplate,
  SignersWithoutPortalError,
  sendContractForSignature,
  sendQuote,
  sendQuoteForSignature,
  setQuoteAdvanceKind,
  setQuoteClientKind,
  updateContractClause,
  updateContractTemplate,
  updateQuoteSettings,
  type ContractTemplateView,
  type QuoteDetail,
} from "./service";
import { withdrawalPeriod } from "./contract-text";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import { quotesPrivacy } from "./privacy";

const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
const render = async () => new Uint8Array(PDF);
const rules = starterContractRules();
afterEach(() => setSignatureProviderForTests(undefined));

function parisDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function plusDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Jour de Paris donné, en milieu de journée (aucun doute sur le jour, heure d'été comprise).
const atNoon = (date: string) => new Date(`${date}T10:00:00Z`);

async function organization(options: { venue?: boolean } = {}) {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, metier: "wedding_planner" });
  await fillRequiredMentions(organizationId);
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
    ...(options.venue === false ? {} : { venueName: "Domaine des Tilleuls", venueCity: "Senlis" }),
  });
  return { organizationId, plannerId: planner.id, eventId: event.id };
}

type Context = Awaited<ReturnType<typeof organization>>;

// Devis à 5 000 € HT, acompte de 30 % dû dans dix jours ; envoyé sauf demande contraire.
async function quote(context: Context, options: { send?: boolean; dueDate?: string } = {}): Promise<QuoteDetail> {
  const created = await createQuote({ organizationId: context.organizationId, eventId: context.eventId, createdByUserId: context.plannerId });
  await addQuoteLine(context.organizationId, created.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 500000, vatRateBasisPoints: 2000 });
  await addScheduleItem(context.organizationId, created.id, { label: "Acompte à la signature", percentageBasisPoints: 3000, dueDate: options.dueDate ?? plusDays(parisDay(), 10) });
  if (options.send === false) return getQuote(context.organizationId, created.id);
  return sendQuote({ organizationId: context.organizationId, quoteId: created.id });
}

// Le modèle de départ, dont chaque emplacement « à rédiger » a reçu le texte du conseil (fictif).
async function readyTemplate(context: Context): Promise<ContractTemplateView> {
  const [template] = await addStarterContractTemplates(context.organizationId, "fr");
  for (const clause of template!.clauses) {
    if (clause.body.includes("[À rédiger")) {
      await updateContractClause(context.organizationId, clause.id, {
        title: clause.title,
        body: `Texte de « ${clause.title} » relu par le conseil de l'atelier (fictif).`,
        optional: clause.optional,
        role: clause.role,
      });
    }
  }
  return getContractTemplate(context.organizationId, template!.id);
}

function clauseIds(template: ContractTemplateView, roles: string[]): string[] {
  return template.clauses.filter((clause) => clause.optional && clause.role !== null && roles.includes(clause.role)).map((clause) => clause.id);
}

const DISTANCE_CLAUSES = ["withdrawal_period", "withdrawal_form", "early_execution", "termination", "advance_deposit"];
const ON_PREMISES_CLAUSES = ["no_withdrawal", "advance_deposit"];

function generation(context: Context, quoteId: string, template: ContractTemplateView, overrides: Partial<Parameters<typeof generateContract>[0]> = {}) {
  return {
    organizationId: context.organizationId,
    quoteId,
    templateId: template.id,
    optionalClauseIds: clauseIds(template, DISTANCE_CLAUSES),
    channel: "distance" as const,
    smallBusinessConfirmed: false,
    userId: context.plannerId,
    locale: "fr" as const,
    acceptWarning: true,
    ...overrides,
  };
}

async function refusal(work: Promise<unknown>) {
  const error = await work.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ContractNotGeneratableError);
  return (error as ContractNotGeneratableError).problems;
}

function signers(tag: string = randomUUID().slice(0, 6)) {
  return [
    { name: "Léa Martin", email: `lea-${tag}@example.test`, billingAddress: "4 rue des Lilas, 60300 Senlis" },
    { name: "Maxime Durand", email: `maxime-${tag}@example.test`, billingAddress: "4 rue des Lilas, 60300 Senlis" },
  ];
}

// D13 : à distance, chaque signataire commande sur son espace personnel ; il lui faut un lien.
async function portalLinks(context: Context, people: { name: string; email: string }[]) {
  for (const person of people) {
    await createEventLink({
      organizationId: context.organizationId,
      eventId: context.eventId,
      createdByUserId: context.plannerId,
      audience: "client",
      locale: "fr",
      link: { personName: person.name, email: person.email, rights: { rubrics: ["quotes"], budgetScope: "all", sharedSlotIds: [] } },
    });
  }
}

async function signEveryone(detail: QuoteDetail) {
  for (const signer of detail.signature!.signers) expect(await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign")).toBe(true);
}

describe("FAC-04 / HUB-21 — Modèles de contrat datés et versionnés (lot 31b, D7, D10, partie N)", () => {
  it("le modèle de départ « à adapter » se charge ; changer son texte, son titre ou sa date de revue augmente sa version, pas son nom", async () => {
    const context = await organization();
    const [template] = await addStarterContractTemplates(context.organizationId, "fr");
    expect(template!.name).toMatch(/à adapter/);
    expect(template!.version).toBe(1);
    expect(template!.legalReviewedOn).toBeNull();
    const renamed = await updateContractTemplate({ organizationId: context.organizationId, templateId: template!.id, name: "Mariage", title: template!.title, eventTypeId: null, legalReviewedOn: null });
    expect(renamed.version).toBe(1);
    const reviewed = await updateContractTemplate({ organizationId: context.organizationId, templateId: template!.id, name: "Mariage", title: template!.title, eventTypeId: null, legalReviewedOn: "2027-01-15" });
    expect([reviewed.version, reviewed.legalReviewedOn]).toEqual([2, "2027-01-15"]);
    const clause = reviewed.clauses[0]!;
    const edited = await updateContractClause(context.organizationId, clause.id, { title: clause.title, body: "{client.noms} et l'atelier.", optional: clause.optional, role: clause.role });
    expect(edited.version).toBe(3);
  });

  it("un modèle se duplique, ses clauses s'ajoutent, se déplacent et se suppriment ; une autre organisation n'y a pas accès", async () => {
    const context = await organization();
    const other = await organization();
    const [template] = await addStarterContractTemplates(context.organizationId, "fr");
    const copy = await duplicateContractTemplate({ organizationId: context.organizationId, templateId: template!.id, name: "Mariage à l'étranger" });
    expect(copy.clauses.map((clause) => clause.title)).toEqual(template!.clauses.map((clause) => clause.title));
    const added = await addContractClause(context.organizationId, copy.id, { title: "Hébergement", body: "Hébergement des mariés.", optional: true, role: null });
    expect(added.clauses.at(-1)!.title).toBe("Hébergement");
    const moved = await moveContractClause(context.organizationId, added.clauses.at(-1)!.id, "up");
    expect(moved.clauses.at(-2)!.title).toBe("Hébergement");
    const removed = await removeContractClause(context.organizationId, moved.clauses.at(-2)!.id);
    expect(removed.clauses).toHaveLength(template!.clauses.length);
    await expect(getContractTemplate(other.organizationId, copy.id)).rejects.toBeInstanceOf(ContractTemplateNotFoundError);
    await expect(updateContractClause(other.organizationId, copy.clauses[0]!.id, { title: "Piratée", body: "x", optional: false, role: null })).rejects.toBeInstanceOf(ContractTemplateNotFoundError);
    await expect(removeContractTemplate(other.organizationId, copy.id)).rejects.toBeInstanceOf(ContractTemplateNotFoundError);
    expect((await listContractTemplates(other.organizationId)).map((entry) => entry.id)).not.toContain(copy.id);
    await removeContractTemplate(context.organizationId, copy.id);
    expect((await listContractTemplates(context.organizationId)).map((entry) => entry.id)).toEqual([template!.id]);
  });
});

describe("FAC-04 / DOC-02 — Génération : chaque problème est nommé, et bloque (lot 31b, D7, D12)", () => {
  it("devis non envoyé, lieu vide, clauses encore à rédiger : la génération est refusée et chaque problème est nommé", async () => {
    const context = await organization({ venue: false });
    const draft = await quote(context, { send: false });
    const [template] = await addStarterContractTemplates(context.organizationId, "fr");
    const problems = await refusal(generateContract(generation(context, draft.id, template!)));
    expect(problems).toContainEqual({ kind: "quote_not_sent" });
    expect(problems).toContainEqual({ kind: "variable_missing", variable: "evenement.lieu" });
    expect(problems).toContainEqual({ kind: "clause_unwritten", clause: "Annulation et report" });
    expect(await listQuoteContracts(context.organizationId, draft.id)).toEqual([]);
  });

  it("le lieu comblé et les clauses rédigées, le contrat se génère, figé : modifier le modèle ensuite ne le change pas ; une nouvelle génération crée la version 2", async () => {
    const context = await organization({ venue: false });
    const sent = await quote(context);
    const template = await readyTemplate(context);
    expect(await refusal(generateContract(generation(context, sent.id, template)))).toEqual([{ kind: "variable_missing", variable: "evenement.lieu" }]);
    await setEventVenue(context.organizationId, context.eventId, { venueName: "Domaine des Tilleuls", venueCity: "Senlis" });
    const contract = await generateContract(generation(context, sent.id, template));
    expect(contract.version).toBe(1);
    expect(contract.templateVersion).toBe(template.version);
    const object = contract.clauses.find((clause) => clause.title === "Objet")!;
    expect(object.body).toBe(`Le présent contrat porte sur l'organisation de l'événement du 18 septembre 2027, Domaine des Tilleuls, Senlis, selon le devis ${sent.number} joint.`);
    expect(contract.clauses.find((clause) => clause.title === "Parties")!.body).toContain("Léa Martin et Maxime Durand");
    expect(contract.clauses.find((clause) => clause.title === "Prix et paiement")!.body).toContain("Les sommes versées d'avance sont des acomptes.");

    const objectClause = template.clauses.find((clause) => clause.title === "Objet")!;
    await updateContractClause(context.organizationId, objectClause.id, { title: "Objet", body: "Autre texte.", optional: false, role: null });
    const [frozen] = await listQuoteContracts(context.organizationId, sent.id);
    expect(frozen!.clauses.find((clause) => clause.title === "Objet")!.body).toBe(object.body);
    const second = await generateContract(generation(context, sent.id, await getContractTemplate(context.organizationId, template.id)));
    expect([second.version, second.clauses.find((clause) => clause.title === "Objet")!.body]).toEqual([2, "Autre texte."]);
  });
});

describe("JUR-07 — Canal de conclusion et régime (lot 31b, réponse 1 de l'avocat, D11, D12)", () => {
  it("à distance : la rétractation s'applique, le bouton de commande est exigé, et les éléments de l'information légale manquants sont nommés", async () => {
    const context = await organization();
    const sent = await quote(context);
    const template = await readyTemplate(context);
    const partial = clauseIds(template, ["withdrawal_period", "advance_deposit"]);
    expect(await refusal(generateContract(generation(context, sent.id, template, { optionalClauseIds: partial })))).toEqual([
      { kind: "role_missing", role: "withdrawal_form" },
      { kind: "role_missing", role: "early_execution" },
      { kind: "role_missing", role: "termination" },
    ]);
    const contract = await generateContract(generation(context, sent.id, template));
    expect(contract.conclusionChannel).toBe("distance");
    expect(contract.clientCategory).toBe("individual");
    expect(contract.regime).toMatchObject({ withdrawalApplies: true, orderRequired: true, noPaymentDays: null });
  });

  it("dans l'établissement : sans rétractation, la clause qui le dit est exigée ; foire ou salon : refusé", async () => {
    const context = await organization();
    const sent = await quote(context);
    const template = await readyTemplate(context);
    expect(await refusal(generateContract(generation(context, sent.id, template, { channel: "on_premises", optionalClauseIds: clauseIds(template, ["advance_deposit"]) })))).toEqual([
      { kind: "role_missing", role: "no_withdrawal" },
    ]);
    const contract = await generateContract(generation(context, sent.id, template, { channel: "on_premises", optionalClauseIds: clauseIds(template, ON_PREMISES_CLAUSES) }));
    expect(contract.regime).toMatchObject({ withdrawalApplies: false, orderRequired: false });
    expect(await refusal(generateContract(generation(context, sent.id, template, { channel: "fair" })))).toContainEqual({ kind: "channel_blocked" });
  });

  it("hors établissement : une échéance avant sept jours est refusée ; un client non-professionnel n'a la rétractation que si la planner confirme la petite entreprise", async () => {
    const context = await organization();
    const today = parisDay();
    const soon = await quote(context, { dueDate: plusDays(today, 3) });
    const template = await readyTemplate(context);
    expect(await refusal(generateContract(generation(context, soon.id, template, { channel: "off_premises" })))).toEqual([
      { kind: "payment_too_soon", firstAllowed: plusDays(today, 7) },
    ]);
    const later = await quote(context, { dueDate: plusDays(today, 8) });
    await setQuoteClientKind(context.organizationId, later.id, "non_professional");
    const check = await checkContract(generation(context, later.id, template, { channel: "off_premises" }));
    expect(check.regime).toMatchObject({ withdrawalApplies: false, requiredRoles: ["precontractual_information", "no_withdrawal"] });
    const small = await checkContract(generation(context, later.id, template, { channel: "off_premises", smallBusinessConfirmed: true }));
    expect(small.regime).toMatchObject({ withdrawalApplies: true, noPaymentDays: 7 });
    expect(small.problems).toEqual([]);
  });
});

describe("JUR-08 — Sommes versées d'avance : clause concordante (lot 31b, réponse 2 de l'avocat, D17)", () => {
  it("« acompte » est proposé par défaut ; la clause des arrhes sur un devis à acomptes est refusée, l'absence de clause aussi", async () => {
    const context = await organization();
    const sent = await quote(context);
    expect(sent.current.advanceKind).toBe("deposit");
    const template = await readyTemplate(context);
    const wrong = clauseIds(template, ["withdrawal_period", "withdrawal_form", "early_execution", "termination", "advance_earnest"]);
    expect(await refusal(generateContract(generation(context, sent.id, template, { optionalClauseIds: wrong })))).toEqual([{ kind: "advance_mismatch", advanceKind: "deposit" }]);
    const none = clauseIds(template, ["withdrawal_period", "withdrawal_form", "early_execution", "termination"]);
    expect(await refusal(generateContract(generation(context, sent.id, template, { optionalClauseIds: none })))).toEqual([{ kind: "advance_missing", advanceKind: "deposit" }]);
  });
});

describe("JUR-20 — Avertissement « base à adapter » accepté à chaque version (lot 31b, réponse 6 de l'avocat)", () => {
  it("la première génération exige l'acceptation, enregistrée ; une nouvelle version du modèle la redemande", async () => {
    const context = await organization();
    const sent = await quote(context);
    const template = await readyTemplate(context);
    expect(await refusal(generateContract(generation(context, sent.id, template, { acceptWarning: false })))).toEqual([{ kind: "warning_not_accepted" }]);
    await generateContract(generation(context, sent.id, template, { acceptWarning: true }));
    expect((await checkContract(generation(context, sent.id, template))).warningAccepted).toBe(true);
    await generateContract(generation(context, sent.id, template, { acceptWarning: false }));
    const changed = await updateContractTemplate({ organizationId: context.organizationId, templateId: template.id, name: template.name, title: template.title, eventTypeId: null, legalReviewedOn: "2027-02-01" });
    expect(await refusal(generateContract(generation(context, sent.id, changed, { acceptWarning: false })))).toEqual([{ kind: "warning_not_accepted" }]);
  });
});

describe("DOC-03 / JUR-07 — Devis et contrat signés ensemble, actes du client, dossier de preuve (lot 31b, D9, D13)", () => {
  it("à distance : le client commande avant de voir son lien, demande l'exécution anticipée, signe ; le dossier de preuve est scellé et la facture d'acompte émise", async () => {
    const context = await organization();
    const other = await organization();
    const sent = await quote(context);
    const template = await readyTemplate(context);
    const contract = await generateContract(generation(context, sent.id, template));
    setSignatureProviderForTests(fakeSignatureProvider());
    const people = signers();
    // À distance, sans espace personnel pour commander, l'envoi est refusé et nomme qui en manque.
    const refused = await sendQuoteForSignature({ organizationId: context.organizationId, quoteId: sent.id, signers: people, documentPdf: PDF, locale: "fr", contractId: contract.id }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(SignersWithoutPortalError);
    expect((refused as SignersWithoutPortalError).names).toEqual(["Léa Martin", "Maxime Durand"]);
    await portalLinks(context, people);
    const signing = await sendQuoteForSignature({ organizationId: context.organizationId, quoteId: sent.id, signers: people, documentPdf: PDF, locale: "fr", contractId: contract.id });
    expect(signing.signature).toMatchObject({ kind: "quote_contract", contractId: contract.id });

    const portal = async (email: string) => (await listClientQuotesToSign(context.organizationId, context.eventId, email))[0]!;
    const before = await portal(people[0]!.email);
    expect(before).toMatchObject({ kind: "quote_contract", ownSigningUrl: null, contract: { contractId: contract.id, orderRequired: true, orderedAt: null, open: true } });
    expect(before.contract!.earlyExecutionText).toContain("Exécution avant la fin du délai de rétractation");

    const act = (email: string, kind: "order" | "early_execution", overrides: Partial<Parameters<typeof recordSignerAct>[0]> = {}) =>
      recordSignerAct({ organizationId: context.organizationId, eventId: context.eventId, clientEmail: email, contractId: contract.id, kind, orderText: "Je commande avec obligation de paiement", ...overrides });
    // Abus : un autre e-mail, un autre événement, une autre organisation.
    await expect(act("intrus@example.test", "order")).rejects.toBeInstanceOf(ContractActNotAllowedError);
    await expect(act(people[0]!.email, "order", { eventId: randomUUID() })).rejects.toBeInstanceOf(ContractNotFoundError);
    await expect(act(people[0]!.email, "order", { organizationId: other.organizationId })).rejects.toBeInstanceOf(ContractNotFoundError);
    for (const person of people) {
      await act(person.email, "order");
      await act(person.email, "early_execution");
    }
    const after = await portal(people[0]!.email);
    expect(after.ownSigningUrl).not.toBeNull();
    expect(after.contract!.orderedAt).not.toBeNull();
    expect(after.contract!.earlyExecutionRequestedAt).not.toBeNull();

    await signEveryone(signing);
    const signed = await getQuote(context.organizationId, sent.id);
    expect(signed.status).toBe("signed");
    const [view] = await listQuoteContracts(context.organizationId, sent.id);
    expect(view!.signature).toMatchObject({ kind: "quote_contract", status: "completed", hasSignedDocument: true });
    expect(view!.acts.map((entry) => [entry.signerName, entry.kind])).toEqual([
      ["Léa Martin", "order"],
      ["Léa Martin", "early_execution"],
      ["Maxime Durand", "order"],
      ["Maxime Durand", "early_execution"],
    ]);
    expect(view!.hasEvidence).toBe(true);
    const evidence = await getContractEvidence(context.organizationId, sent.id, contract.id);
    expect(evidence.contract).toMatchObject({ conclusionChannel: "distance", withdrawalApplies: true, signatureLevel: "simple", templateVersion: template.version });
    expect(evidence.acts.filter((entry) => entry.kind === "order").map((entry) => entry.presentedText)).toEqual(["Je commande avec obligation de paiement", "Je commande avec obligation de paiement"]);
    expect(evidence.documents.signedDocumentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(getContractEvidence(other.organizationId, sent.id, contract.id)).rejects.toBeInstanceOf(ContractNotFoundError);

    // Tous ont demandé l'exécution anticipée : la facture d'acompte part le jour même.
    expect(await getQuoteScheduledDeposit(context.organizationId, sent.id)).toMatchObject({ status: "waiting", issueOn: parisDay() });
    expect(await issueScheduledDepositInvoices({ organizationId: context.organizationId, renderOriginal: render })).toEqual({ issued: 1, blocked: 0 });
    const invoices = await listQuoteInvoices(context.organizationId, sent.id);
    expect(invoices.map((invoice) => [invoice.kind, invoice.amountCents])).toEqual([["deposit", 180000]]);
    expect(await getQuoteScheduledDeposit(context.organizationId, sent.id)).toMatchObject({ status: "issued", invoiceId: invoices[0]!.id });
  });

  it("un contrat généré après la signature du devis se signe seul, par les mêmes signataires, sans toucher au devis", async () => {
    const context = await organization();
    const sent = await quote(context);
    setSignatureProviderForTests(fakeSignatureProvider());
    const signing = await sendQuoteForSignature({ organizationId: context.organizationId, quoteId: sent.id, signers: signers(), documentPdf: PDF, locale: "fr" });
    expect(signing.signature!.kind).toBe("quote");
    await signEveryone(signing);
    const template = await readyTemplate(context);
    const contract = await generateContract(generation(context, sent.id, template, { channel: "on_premises", optionalClauseIds: clauseIds(template, ON_PREMISES_CLAUSES) }));
    const alone = await sendContractForSignature({ organizationId: context.organizationId, quoteId: sent.id, contractId: contract.id, documentPdf: PDF, locale: "fr" });
    expect(alone.signature).toMatchObject({ kind: "contract", status: "pending" });
    for (const signer of signing.signature!.signers) {
      const entry = (await listClientQuotesToSign(context.organizationId, context.eventId, signer.email)).find((candidate) => candidate.kind === "contract")!;
      expect(entry.contract).toMatchObject({ orderRequired: false, earlyExecutionText: null });
      expect(await actOnFakeSignature(entry.ownSigningUrl!.split("/").pop()!, "sign")).toBe(true);
    }
    const [view] = await listQuoteContracts(context.organizationId, sent.id);
    expect(view!.signature).toMatchObject({ kind: "contract", status: "completed" });
    expect(view!.hasEvidence).toBe(true);
    const after = await getQuote(context.organizationId, sent.id);
    expect([after.status, after.signature!.kind, after.signature!.status]).toEqual(["signed", "quote", "completed"]);
  });
});

describe("FAC-05 — Facture d'acompte sans autre saisie (lot 31b, D6, D21)", () => {
  it("la rétractation court sans demande de tous : émise le lendemain de la fin du délai, ni la veille ni le dernier jour (horloge simulée)", async () => {
    const context = await organization();
    const sent = await quote(context);
    const template = await readyTemplate(context);
    const contract = await generateContract(generation(context, sent.id, template));
    setSignatureProviderForTests(fakeSignatureProvider());
    const people = signers();
    await portalLinks(context, people);
    const signing = await sendQuoteForSignature({ organizationId: context.organizationId, quoteId: sent.id, signers: people, documentPdf: PDF, locale: "fr", contractId: contract.id });
    // Une seule demande d'exécution anticipée : le délai court.
    await recordSignerAct({ organizationId: context.organizationId, eventId: context.eventId, clientEmail: people[0]!.email, contractId: contract.id, kind: "early_execution" });
    await signEveryone(signing);
    const { lastDay, issueOn } = withdrawalPeriod(parisDay(), rules.withdrawal);
    expect(await getQuoteScheduledDeposit(context.organizationId, sent.id)).toMatchObject({ status: "waiting", issueOn });
    for (const day of [plusDays(lastDay, -1), lastDay]) {
      expect(await issueScheduledDepositInvoices({ organizationId: context.organizationId, now: atNoon(day), renderOriginal: render })).toEqual({ issued: 0, blocked: 0 });
    }
    expect(await issueScheduledDepositInvoices({ organizationId: context.organizationId, now: atNoon(issueOn), renderOriginal: render })).toEqual({ issued: 1, blocked: 0 });
    const [invoice] = await listQuoteInvoices(context.organizationId, sent.id);
    expect(invoice!.issuedOn).toBe(issueOn);
  });

  it("une mention manquante bloque l'émission et la nomme ; l'émission à la main clôt la facture à émettre", async () => {
    const context = await organization();
    const sent = await quote(context);
    const template = await readyTemplate(context);
    const contract = await generateContract(generation(context, sent.id, template, { channel: "on_premises", optionalClauseIds: clauseIds(template, ON_PREMISES_CLAUSES) }));
    setSignatureProviderForTests(fakeSignatureProvider());
    await signEveryone(await sendQuoteForSignature({ organizationId: context.organizationId, quoteId: sent.id, signers: signers(), documentPdf: PDF, locale: "fr", contractId: contract.id }));
    const settings = await getQuoteSettings(context.organizationId);
    await updateQuoteSettings(context.organizationId, { ...settings, invoiceMentions: "" });
    expect(await issueScheduledDepositInvoices({ organizationId: context.organizationId, renderOriginal: render })).toEqual({ issued: 0, blocked: 1 });
    expect(await getQuoteScheduledDeposit(context.organizationId, sent.id)).toMatchObject({ status: "blocked", missingFields: ["paymentTerms"] });
    await updateQuoteSettings(context.organizationId, settings);
    const item = (await getQuote(context.organizationId, sent.id)).current.schedule.items[0]!;
    const invoice = await issueDepositInvoice({ organizationId: context.organizationId, scheduleItemId: item.id, renderOriginal: render });
    expect(await getQuoteScheduledDeposit(context.organizationId, sent.id)).toMatchObject({ status: "issued", invoiceId: invoice.id });
  });

  it("des arrhes ne donnent aucune facture d'elle-même (D21) ; hors établissement, aucun paiement demandé avant sept jours", async () => {
    const context = await organization();
    const earnest = await quote(context, { send: false });
    await setQuoteAdvanceKind(context.organizationId, earnest.id, "earnest");
    await sendQuote({ organizationId: context.organizationId, quoteId: earnest.id });
    setSignatureProviderForTests(fakeSignatureProvider());
    await signEveryone(await sendQuoteForSignature({ organizationId: context.organizationId, quoteId: earnest.id, signers: signers(), documentPdf: PDF, locale: "fr" }));
    expect(await getQuoteScheduledDeposit(context.organizationId, earnest.id)).toBeNull();

    const today = parisDay();
    const outside = await quote(context, { dueDate: plusDays(today, 8) });
    const template = await readyTemplate(context);
    const contract = await generateContract(generation(context, outside.id, template, { channel: "off_premises" }));
    const people = signers();
    const signing = await sendQuoteForSignature({ organizationId: context.organizationId, quoteId: outside.id, signers: people, documentPdf: PDF, locale: "fr", contractId: contract.id });
    for (const person of people) {
      await recordSignerAct({ organizationId: context.organizationId, eventId: context.eventId, clientEmail: person.email, contractId: contract.id, kind: "early_execution" });
    }
    await signEveryone(signing);
    expect(await getQuoteScheduledDeposit(context.organizationId, outside.id)).toMatchObject({ status: "waiting", issueOn: today, paymentNotBefore: plusDays(today, 7) });
  });
});

describe("RGP-05 / RGPD-03 — Contrats et actes des signataires dans la recherche et l'oubli (lot 31b)", () => {
  it("la recherche trouve le contrat et l'acte ; à l'oubli, le contrat signé est gardé comme preuve (dix ans), le contrat non signé est anonymisé", async () => {
    const context = await organization();
    const today = parisDay();
    const template = await readyTemplate(context);
    // Un contrat signé (dans l'établissement), puis un autre devis, non signé, avec son contrat.
    const signedQuote = await quote(context);
    const signedContract = await generateContract(generation(context, signedQuote.id, template, { channel: "on_premises", optionalClauseIds: clauseIds(template, ON_PREMISES_CLAUSES) }));
    setSignatureProviderForTests(fakeSignatureProvider());
    const people = signers();
    await signEveryone(await sendQuoteForSignature({ organizationId: context.organizationId, quoteId: signedQuote.id, signers: people, documentPdf: PDF, locale: "fr", contractId: signedContract.id }));
    const openQuote = await quote(context);
    const openContract = await generateContract(generation(context, openQuote.id, template));
    await portalLinks(context, people);
    await sendQuoteForSignature({ organizationId: context.organizationId, quoteId: openQuote.id, signers: people, documentPdf: PDF, locale: "fr", contractId: openContract.id });
    await recordSignerAct({ organizationId: context.organizationId, eventId: context.eventId, clientEmail: people[0]!.email, contractId: openContract.id, kind: "order", orderText: "Je commande avec obligation de paiement" });

    const found = await quotesPrivacy.find({ organizationId: context.organizationId, terms: { name: "Lea Martin" } });
    expect(found.filter((record) => record.kind === "contract").map((record) => record.recordId).sort()).toEqual([signedContract.id, openContract.id].sort());
    const act = found.find((record) => record.kind === "contract_signer_act");
    expect(act).toMatchObject({ fields: { signerName: "Léa Martin", kind: "order" } });

    const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 120 };
    const records = [
      { kind: "contract", recordId: signedContract.id },
      { kind: "contract", recordId: openContract.id },
      { kind: "contract_signer_act", recordId: act!.recordId },
    ];
    const plan = await quotesPrivacy.planErasure({ organizationId: context.organizationId, records, rules, today });
    expect(plan).toContainEqual({ kind: "contract", recordId: signedContract.id, fate: "kept", legalBasis: "contract_proof", keptUntil: plusDays(today, 0).replace(/^(\d{4})/, (year) => String(Number(year) + 10)) });
    expect(plan).toContainEqual({ kind: "contract", recordId: openContract.id, fate: "anonymized", legalBasis: null, keptUntil: null });
    expect(plan).toContainEqual({ kind: "contract_signer_act", recordId: act!.recordId, fate: "anonymized", legalBasis: null, keptUntil: null });
    await quotesPrivacy.erase({ organizationId: context.organizationId, records, rules, today });
    const [open] = await listQuoteContracts(context.organizationId, openQuote.id);
    expect(open!.clauses.every((clause) => clause.body === "[anonymisé]")).toBe(true);
    expect(open!.acts.map((entry) => entry.signerName)).toEqual(["[anonymisé]"]);
    const [kept] = await listQuoteContracts(context.organizationId, signedQuote.id);
    expect(kept!.clauses.find((clause) => clause.title === "Parties")!.body).toContain("Léa Martin");
  });
});
