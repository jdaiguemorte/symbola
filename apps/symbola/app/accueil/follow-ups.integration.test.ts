// Lot 13 (L13-HUB-15) — bloc « À traiter » de l'accueil, contre un vrai
// PostgreSQL (RLS) : délais de relance de départ ou réglés par
// l'organisation, horloge simulée, essais exclus, isolation.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { getFollowUpDelays, saveFollowUpDelays, saveOnboardingStep } from "@/modules/hub/service";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { addQuoteLine, createQuote, sendQuote } from "@/modules/quotes/service";
import { loadFollowUps } from "./follow-ups";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";

const DAY = 86_400_000;
const LABELS = { quote: (number: string, names: string) => `devis ${number} ${names}`, prospect: (names: string) => `prospect ${names}` };
const ALL = { events: true, quotes: true };

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

describe("L13-HUB-15 — Accueil : l'agenda et ce qui attend", () => {
  it("les délais de départ viennent des données (7 et 14 jours) et se règlent par organisation", async () => {
    const org = await organization();
    expect(await withDb((db) => getFollowUpDelays(db, org.organizationId))).toEqual({ quoteFollowUpDays: 7, prospectFollowUpDays: 14 });
    await withDb((db) => saveFollowUpDelays(db, org.organizationId, { quoteFollowUpDays: 3, prospectFollowUpDays: 10 }));
    expect(await withDb((db) => getFollowUpDelays(db, org.organizationId))).toEqual({ quoteFollowUpDays: 3, prospectFollowUpDays: 10 });
    await expect(withDb((db) => saveFollowUpDelays(db, org.organizationId, { quoteFollowUpDays: 0, prospectFollowUpDays: 10 }))).rejects.toBeInstanceOf(RangeError);
  });

  it("un prospect sans nouvelle apparaît le jour où le délai est atteint, pas la veille", async () => {
    const org = await organization();
    const event = await prospect(org, "Léa");
    const created = new Date();
    expect(await loadFollowUps(org.organizationId, ALL, LABELS, new Date(created.getTime() + 13 * DAY))).toEqual([]);
    expect(await loadFollowUps(org.organizationId, ALL, LABELS, new Date(created.getTime() + 14 * DAY))).toEqual([
      { key: `p-${event.id}`, label: "prospect Léa", href: `/events/${event.id}`, days: 14 },
    ]);
  });

  it("un devis envoyé sans réponse apparaît après le délai réglé, les plus anciens d'abord", async () => {
    const org = await organization();
    const event = await prospect(org, "Inès");
    const sentAt = new Date("2027-04-10T10:00:00Z");
    const quote = await createQuote({ organizationId: org.organizationId, eventId: event.id, createdByUserId: org.plannerId, now: sentAt });
    await addQuoteLine(org.organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000, vatRateBasisPoints: 0 });
    await sendQuote({ organizationId: org.organizationId, quoteId: quote.id, now: sentAt });
    await withDb((db) => saveFollowUpDelays(db, org.organizationId, { quoteFollowUpDays: 7, prospectFollowUpDays: 365 }));

    expect(await loadFollowUps(org.organizationId, ALL, LABELS, new Date(sentAt.getTime() + 6 * DAY))).toEqual([]);
    const items = await loadFollowUps(org.organizationId, ALL, LABELS, new Date(sentAt.getTime() + 7 * DAY));
    expect(items).toEqual([{ key: `q-${quote.id}`, label: `devis ${quote.number} Inès`, href: `/devis/${quote.id}`, days: 7 }]);

    // Sans le module Devis, la partie devis disparaît sans erreur.
    expect(await loadFollowUps(org.organizationId, { events: true, quotes: false }, LABELS, new Date(sentAt.getTime() + 7 * DAY))).toEqual([]);
  });

  it("isolation : une autre organisation ne voit rien de ce qui attend chez la première", async () => {
    const org = await organization();
    const other = await organization();
    await prospect(org, "Camille");
    const later = new Date(Date.now() + 30 * DAY);
    expect(await loadFollowUps(org.organizationId, ALL, LABELS, later)).toHaveLength(1);
    expect(await loadFollowUps(other.organizationId, ALL, LABELS, later)).toEqual([]);
  });
});
