// Lot 31a (FAC-01, FAC-05, FAC-07, JUR-01, JUR-08, JUR-09, HUB-21 ; décisions D2 à D5) —
// devis complet, contre un vrai PostgreSQL (RLS), par la porte d'entrée du module :
// sections et options, choix du client figé à la signature, mentions requises nommées,
// acompte ou arrhes, modèles de devis ; abus d'une autre organisation et d'un autre événement.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import {
  addQuoteLine,
  addQuoteSection,
  addScheduleItem,
  addStarterQuoteTemplates,
  chooseQuoteOptions,
  createQuote,
  createQuoteFromTemplate,
  duplicateQuoteTemplate,
  getQuote,
  listClientQuoteOptions,
  listQuoteTemplates,
  QuoteNotFoundError,
  QuoteOptionsLockedError,
  QuoteTemplateNotFoundError,
  quoteMissingMentions,
  removeQuoteSection,
  replaceQuoteTemplateFromQuote,
  RequiredMentionsMissingError,
  reviseQuote,
  saveQuoteAsTemplate,
  sendQuote,
  sendQuoteForSignature,
  setQuoteAdvanceKind,
} from "./service";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import { quotesPrivacy } from "./privacy";

const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
afterEach(() => setSignatureProviderForTests(undefined));

async function organization(options: { mentions?: boolean } = {}) {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, metier: "wedding_planner" });
  if (options.mentions !== false) await fillRequiredMentions(organizationId);
  const planner = await createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" });
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: planner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }], eventDate: "2027-06-12" });
  return { organizationId, plannerId: planner.id, eventId: event.id };
}

// Formule complète (section Préparation), deux options dans la section « Options ».
async function fullQuote(context: Awaited<ReturnType<typeof organization>>) {
  const quote = await createQuote({ organizationId: context.organizationId, eventId: context.eventId, createdByUserId: context.plannerId });
  const line = (label: string, cents: number, extra: { sectionId?: string; isOption?: boolean } = {}) =>
    addQuoteLine(context.organizationId, quote.id, { label, unit: "forfait", quantityMilli: 1000, unitPriceCents: cents, vatRateBasisPoints: 2000, ...extra });
  let detail = await addQuoteSection(context.organizationId, quote.id, "Préparation");
  detail = await addQuoteSection(context.organizationId, quote.id, "Options");
  const [preparation, options] = detail.current.sections;
  await line("Organisation complète", 300000, { sectionId: preparation!.id });
  await line("Coordination de la répétition", 60000, { sectionId: options!.id, isOption: true });
  detail = await line("Brunch du lendemain", 80000, { sectionId: options!.id, isOption: true });
  return { quote: detail, sections: { preparation: preparation!, options: options! } };
}

describe("FAC-01 — Sections et options (lot 31a, D2)", () => {
  it("chaque section a son sous-total ; une option reste hors du total tant qu'elle n'est pas choisie", async () => {
    const context = await organization();
    const { quote, sections } = await fullQuote(context);
    expect(quote.current.sections.map((section) => [section.title, section.subtotalCents])).toEqual([
      ["Préparation", 300000],
      ["Options", 0],
    ]);
    expect(quote.current.totals.totalHtCents).toBe(300000);
    expect(quote.current.totals.totalTtcCents).toBe(360000);
    expect(quote.current.lines.filter((line) => line.isOption).map((line) => [line.label, line.sectionId === sections.options.id, line.optionChosen])).toEqual([
      ["Coordination de la répétition", true, false],
      ["Brunch du lendemain", true, false],
    ]);
    // Retirer une section garde ses lignes, sans section.
    const after = await removeQuoteSection(context.organizationId, sections.preparation.id);
    expect(after.current.lines.find((line) => line.label === "Organisation complète")?.sectionId).toBeNull();
  });

  it("le client choisit sur son portail : total recalculé, choix daté et nominatif ; figé dès que la signature commence", async () => {
    const context = await organization();
    const { quote } = await fullQuote(context);
    await sendQuote({ organizationId: context.organizationId, quoteId: quote.id });
    const brunch = quote.current.lines.find((line) => line.label === "Brunch du lendemain")!;

    const [portal] = await listClientQuoteOptions(context.organizationId, context.eventId);
    expect(portal).toMatchObject({ quoteId: quote.id, totalTtcCents: 360000, locked: false, choice: null, advanceKind: "deposit" });
    expect(portal!.options.map((option) => [option.label, option.amountCents, option.section])).toEqual([
      ["Coordination de la répétition", 72000, "Options"],
      ["Brunch du lendemain", 96000, "Options"],
    ]);

    const chosen = await chooseQuoteOptions({ organizationId: context.organizationId, quoteId: quote.id, eventId: context.eventId, chosenLineIds: [brunch.id], chosenBy: "Léa Martin", byKind: "client" });
    expect(chosen.current.totals.totalTtcCents).toBe(456000);
    expect(chosen.current.sections.find((section) => section.title === "Options")?.subtotalCents).toBe(80000);
    expect(chosen.current.optionsChoice).toMatchObject({ chosenBy: "Léa Martin", byKind: "client" });
    expect(chosen.current.schedule.balanceCents).toBe(456000);

    // La planner lance la signature : le choix se fige.
    setSignatureProviderForTests(fakeSignatureProvider());
    await sendQuoteForSignature({
      organizationId: context.organizationId,
      quoteId: quote.id,
      signers: [{ name: "Léa Martin", email: `lea-${randomUUID().slice(0, 6)}@example.test`, billingAddress: "3 place Bellecour, 69002 Lyon" }],
      documentPdf: PDF,
      locale: "fr",
    });
    await expect(chooseQuoteOptions({ organizationId: context.organizationId, quoteId: quote.id, chosenLineIds: [], chosenBy: "Léa Martin", byKind: "client" })).rejects.toBeInstanceOf(QuoteOptionsLockedError);
    expect((await listClientQuoteOptions(context.organizationId, context.eventId))[0]?.locked).toBe(true);
  });

  it("une nouvelle version garde sections, options et choix", async () => {
    const context = await organization();
    const { quote } = await fullQuote(context);
    await sendQuote({ organizationId: context.organizationId, quoteId: quote.id });
    const brunch = quote.current.lines.find((line) => line.label === "Brunch du lendemain")!;
    await chooseQuoteOptions({ organizationId: context.organizationId, quoteId: quote.id, chosenLineIds: [brunch.id], chosenBy: "Camille", byKind: "planner" });
    const revised = await reviseQuote(context.organizationId, quote.id);
    expect(revised.current.version).toBe(2);
    expect(revised.current.sections.map((section) => section.title)).toEqual(["Préparation", "Options"]);
    expect(revised.current.lines.filter((line) => line.optionChosen).map((line) => line.label)).toEqual(["Brunch du lendemain"]);
    expect(revised.current.lines.every((line) => line.sectionId === null || revised.current.sections.some((section) => section.id === line.sectionId))).toBe(true);
    expect(revised.current.totals.totalTtcCents).toBe(456000);
  });

  it("abus : une autre organisation, un autre événement, une ligne qui n'est pas une option : refusés ; brouillon : figé", async () => {
    const mine = await organization();
    const other = await organization();
    const { quote } = await fullQuote(mine);
    const option = quote.current.lines.find((line) => line.isOption)!;
    const ordinary = quote.current.lines.find((line) => !line.isOption)!;
    await expect(chooseQuoteOptions({ organizationId: mine.organizationId, quoteId: quote.id, chosenLineIds: [option.id], chosenBy: "Léa", byKind: "client" })).rejects.toBeInstanceOf(QuoteOptionsLockedError);
    await sendQuote({ organizationId: mine.organizationId, quoteId: quote.id });
    await expect(chooseQuoteOptions({ organizationId: other.organizationId, quoteId: quote.id, chosenLineIds: [option.id], chosenBy: "Intrus", byKind: "client" })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(chooseQuoteOptions({ organizationId: mine.organizationId, quoteId: quote.id, eventId: randomUUID(), chosenLineIds: [option.id], chosenBy: "Intrus", byKind: "client" })).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(chooseQuoteOptions({ organizationId: mine.organizationId, quoteId: quote.id, chosenLineIds: [ordinary.id], chosenBy: "Léa", byKind: "client" })).rejects.toBeInstanceOf(QuoteNotFoundError);
    expect(await listClientQuoteOptions(other.organizationId, mine.eventId)).toEqual([]);
    expect((await getQuote(mine.organizationId, quote.id)).current.optionsChoice).toBeNull();
  });
});

describe("FAC-07 / JUR-01 / JUR-09 / JUR-08 — Mentions requises et acompte ou arrhes (lot 31a, D4 et D5)", () => {
  it("l'envoi est refusé tant qu'une mention manque ; le refus nomme chaque champ", async () => {
    const context = await organization({ mentions: false });
    await saveOnboardingStep(appDatabase(), context.organizationId, { siren: "123456789", address: "1 rue des Lilas, 69001 Lyon" });
    const quote = await createQuote({ organizationId: context.organizationId, eventId: context.eventId, createdByUserId: context.plannerId });
    await addQuoteLine(context.organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 100000 });
    await addScheduleItem(context.organizationId, quote.id, { label: "À la signature", percentageBasisPoints: 3000, dueDate: "2027-01-15" });
    expect(await quoteMissingMentions(context.organizationId, quote.id)).toEqual(["vatNumber", "insurance", "mediator", "generalTerms", "advanceKind"]);
    const refused = await sendQuote({ organizationId: context.organizationId, quoteId: quote.id }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(RequiredMentionsMissingError);
    expect((refused as RequiredMentionsMissingError).fields).toEqual(["vatNumber", "insurance", "mediator", "generalTerms", "advanceKind"]);

    await fillRequiredMentions(context.organizationId);
    expect(await quoteMissingMentions(context.organizationId, quote.id)).toEqual(["advanceKind"]);
    await setQuoteAdvanceKind(context.organizationId, quote.id, "earnest");
    expect(await quoteMissingMentions(context.organizationId, quote.id)).toEqual([]);
    const sent = await sendQuote({ organizationId: context.organizationId, quoteId: quote.id });
    expect(sent.current.advanceKind).toBe("earnest");
  });

  it("un nouveau devis prend acompte ou arrhes proposé par l'organisation", async () => {
    const context = await organization();
    const quote = await createQuote({ organizationId: context.organizationId, eventId: context.eventId, createdByUserId: context.plannerId });
    expect(quote.current.advanceKind).toBe("deposit");
  });
});

describe("FAC-01 / HUB-21 / HUB-26 — Modèles de devis (lot 31a, D3)", () => {
  it("un devis devient modèle ; un nouveau devis le copie (sections, options, échéancier relatif) ; modifier le modèle ne change pas le devis", async () => {
    const context = await organization();
    const { quote } = await fullQuote(context);
    await addScheduleItem(context.organizationId, quote.id, { label: "Deux mois avant", percentageBasisPoints: 4000, dueDate: "2027-04-13" });
    await setQuoteAdvanceKind(context.organizationId, quote.id, "earnest");
    const template = await saveQuoteAsTemplate({ organizationId: context.organizationId, quoteId: quote.id, name: "Mariage complet", eventTypeId: null });
    expect(template).toMatchObject({ name: "Mariage complet", version: 1, sectionCount: 2, lineCount: 3, optionCount: 2, scheduleCount: 1, advanceKind: "earnest" });

    const copy = await createQuoteFromTemplate({ organizationId: context.organizationId, eventId: context.eventId, createdByUserId: context.plannerId, templateId: template.id, now: new Date("2026-11-13T10:00:00Z") });
    expect(copy.current.sections.map((section) => section.title)).toEqual(["Préparation", "Options"]);
    expect(copy.current.lines.map((line) => [line.label, line.isOption])).toEqual([
      ["Organisation complète", false],
      ["Coordination de la répétition", true],
      ["Brunch du lendemain", true],
    ]);
    expect(copy.current.schedule.items.map((item) => [item.label, item.dueDate])).toEqual([["Deux mois avant", "2027-04-13"]]);
    expect(copy.current.advanceKind).toBe("earnest");
    expect(copy.current.template).toEqual({ id: template.id, version: 1 });

    // Le modèle est remplacé (version 2) : le devis déjà créé ne bouge pas.
    await addQuoteLine(context.organizationId, quote.id, { label: "Fleurs de table", unit: "forfait", quantityMilli: 1000, unitPriceCents: 50000 });
    const replaced = await replaceQuoteTemplateFromQuote({ organizationId: context.organizationId, templateId: template.id, quoteId: quote.id });
    expect(replaced).toMatchObject({ version: 2, lineCount: 4 });
    expect((await getQuote(context.organizationId, copy.id)).current.lines).toHaveLength(3);

    const duplicate = await duplicateQuoteTemplate({ organizationId: context.organizationId, templateId: template.id, name: "Mariage complet (copie)" });
    expect(duplicate).toMatchObject({ version: 1, lineCount: 4 });
  });

  it("le modèle de départ est marqué « à adapter » ; une autre organisation ne voit ni n'utilise un modèle", async () => {
    const mine = await organization();
    const other = await organization();
    const [starter] = await addStarterQuoteTemplates(mine.organizationId, "fr");
    expect(starter).toMatchObject({ sectionCount: 3, optionCount: 2, scheduleCount: 2 });
    expect(starter?.name).toMatch(/à adapter/);
    const fromStarter = await createQuoteFromTemplate({ organizationId: mine.organizationId, eventId: mine.eventId, createdByUserId: mine.plannerId, templateId: starter!.id, now: new Date("2026-11-13T10:00:00Z") });
    expect(fromStarter.current.schedule.items.map((item) => item.dueDate)).toEqual(["2026-11-13", "2027-04-13"]);
    expect(fromStarter.current.lines.every((line) => line.vatRateBasisPoints === 2000)).toBe(true);

    expect(await listQuoteTemplates(other.organizationId)).toEqual([]);
    await expect(createQuoteFromTemplate({ organizationId: other.organizationId, eventId: other.eventId, createdByUserId: other.plannerId, templateId: starter!.id })).rejects.toBeInstanceOf(QuoteTemplateNotFoundError);
    await expect(duplicateQuoteTemplate({ organizationId: other.organizationId, templateId: starter!.id, name: "Copie" })).rejects.toBeInstanceOf(QuoteTemplateNotFoundError);
  });
});

describe("RGPD-01, RGPD-03 — Qui a choisi les options (lot 31a)", () => {
  it("trouvé par son nom ; anonymisé à l'oubli tant que le devis n'est pas signé", async () => {
    const context = await organization();
    const { quote } = await fullQuote(context);
    await sendQuote({ organizationId: context.organizationId, quoteId: quote.id });
    const brunch = quote.current.lines.find((line) => line.label === "Brunch du lendemain")!;
    await chooseQuoteOptions({ organizationId: context.organizationId, quoteId: quote.id, eventId: context.eventId, chosenLineIds: [brunch.id], chosenBy: "Léa Martin", byKind: "client" });
    const found = (await quotesPrivacy.find({ organizationId: context.organizationId, terms: { name: "Lea Martin" } })).filter((record) => record.kind === "quote_options_choice");
    expect(found).toMatchObject([{ recordId: quote.current.id, fields: { chosenBy: "Léa Martin" } }]);
    const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 };
    const records = [{ kind: "quote_options_choice", recordId: quote.current.id }];
    expect(await quotesPrivacy.planErasure({ organizationId: context.organizationId, records, rules, today: "2026-11-13" })).toEqual([
      { kind: "quote_options_choice", recordId: quote.current.id, fate: "anonymized", legalBasis: null, keptUntil: null },
    ]);
    await quotesPrivacy.erase({ organizationId: context.organizationId, records, rules, today: "2026-11-13" });
    expect((await getQuote(context.organizationId, quote.id)).current.optionsChoice?.chosenBy).toBe("[anonymisé]");
  });
});
