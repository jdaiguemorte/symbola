// Lot 13 (L13-HUB-15), repris au lot 32a (HUB-08) — les relances de « Aujourd'hui », contre un vrai
// PostgreSQL (RLS) : délais de relance de départ ou réglés par l'organisation, horloge simulée
// (la veille, le jour même), module non souscrit, isolation. Avant le lot 32a, ces règles
// alimentaient le bloc « À traiter » de l'accueil.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { getFollowUpDelays, saveFollowUpDelays, saveOnboardingStep } from "@/modules/hub/service";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { addQuoteLine, createQuote, sendQuote } from "@/modules/quotes/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { loadTodayItems, type TodayModules, type TodayWords } from "./load";

const DAY = 86_400_000;
const ALL: TodayModules = { events: true, quotes: true, budget: true };
const words: TodayWords = {
  clientTask: "tâche du client",
  amount: (label, amount) => `${label} ${amount}`,
  decision: (title) => `choix ${title}`,
  paymentDeclaration: (label) => `déclaration ${label}`,
  quoteFollowUp: (number) => `devis ${number}`,
  prospectFollowUp: "prospect sans nouvelle",
  depositBlocked: (number) => `acompte bloqué ${number}`,
  vendorContract: (vendor) => `contrat ${vendor}`,
  dateConflict: (count) => `${count} le même jour`,
  linkRenewal: (name) => `lien ${name}`,
};

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function organization() {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`))).id;
  await withDb((db) => saveOnboardingStep(db, organizationId, { vatRegime: "franchise", siren: "123456789", address: "1 rue des Lilas, 69001 Lyon" }));
  // Lot 31a (FAC-07) : mentions requises remplies.
  await fillRequiredMentions(organizationId);
  const planner = await withDb((db) =>
    createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" }),
  );
  const source = await createProspectSource(organizationId, "Salon");
  return { organizationId, plannerId: planner.id, sourceId: source.id };
}

async function prospect(org: { organizationId: string; plannerId: string; sourceId: string }, firstName: string) {
  return createProspect({ organizationId: org.organizationId, createdByUserId: org.plannerId, prospectSourceId: org.sourceId, clients: [{ firstName, lastName: null }] });
}

async function followUps(organizationId: string, now: Date, modules: TodayModules = ALL) {
  const { items } = await loadTodayItems(organizationId, modules, words, "fr", now);
  return items.filter((item) => item.kind === "prospect_follow_up" || item.kind === "quote_follow_up").map((item) => ({ key: item.key, title: item.title, href: item.href, actor: item.actor }));
}

describe("L13-HUB-15 / HUB-08 — Relances de « Aujourd'hui »", () => {
  it("les délais de départ viennent des données (7 et 14 jours) et se règlent par organisation", async () => {
    const org = await organization();
    expect(await withDb((db) => getFollowUpDelays(db, org.organizationId))).toEqual({ quoteFollowUpDays: 7, prospectFollowUpDays: 14 });
    await withDb((db) => saveFollowUpDelays(db, org.organizationId, { quoteFollowUpDays: 3, prospectFollowUpDays: 10 }));
    expect(await withDb((db) => getFollowUpDelays(db, org.organizationId))).toEqual({ quoteFollowUpDays: 3, prospectFollowUpDays: 10 });
    await expect(withDb((db) => saveFollowUpDelays(db, org.organizationId, { quoteFollowUpDays: 0, prospectFollowUpDays: 10 }))).rejects.toBeInstanceOf(RangeError);
  });

  it("un prospect sans nouvelle apparaît le jour où le délai est atteint, pas la veille ; le client doit répondre", async () => {
    const org = await organization();
    const event = await prospect(org, "Léa");
    const created = new Date();
    expect(await followUps(org.organizationId, new Date(created.getTime() + 13 * DAY))).toEqual([]);
    expect(await followUps(org.organizationId, new Date(created.getTime() + 14 * DAY))).toEqual([
      { key: `prospect:${event.id}`, title: "prospect sans nouvelle", href: `/events/${event.id}`, actor: { kind: "client" } },
    ]);
  });

  it("un devis envoyé sans réponse apparaît après le délai réglé ; sans le module Devis, il disparaît sans erreur", async () => {
    const org = await organization();
    const event = await prospect(org, "Inès");
    const sentAt = new Date("2027-04-10T10:00:00Z");
    const quote = await createQuote({ organizationId: org.organizationId, eventId: event.id, createdByUserId: org.plannerId, now: sentAt });
    await addQuoteLine(org.organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000, vatRateBasisPoints: 0 });
    await sendQuote({ organizationId: org.organizationId, quoteId: quote.id, now: sentAt });
    await withDb((db) => saveFollowUpDelays(db, org.organizationId, { quoteFollowUpDays: 7, prospectFollowUpDays: 365 }));

    expect(await followUps(org.organizationId, new Date(sentAt.getTime() + 6 * DAY))).toEqual([]);
    expect(await followUps(org.organizationId, new Date(sentAt.getTime() + 7 * DAY))).toEqual([
      { key: `quote:${quote.id}`, title: `devis ${quote.number}`, href: `/devis/${quote.id}`, actor: { kind: "client" } },
    ]);
    expect(await followUps(org.organizationId, new Date(sentAt.getTime() + 7 * DAY), { events: true, quotes: false, budget: true })).toEqual([]);
  });

  it("isolation : une autre organisation ne voit rien de ce qui attend chez la première", async () => {
    const org = await organization();
    const other = await organization();
    await prospect(org, "Camille");
    const later = new Date(Date.now() + 30 * DAY);
    expect(await followUps(org.organizationId, later)).toHaveLength(1);
    expect(await followUps(other.organizationId, later)).toEqual([]);
  });
});
