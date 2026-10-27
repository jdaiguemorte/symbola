// AIDE-02 — essai guidé du module Devis : devis fictif (série DEMO) sur
// l'événement d'essai, depuis le modèle de départ, jamais sur un vrai
// événement ; il disparaît avec l'essai (ADR 0008).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { saveOnboardingStep } from "@/modules/hub/service";
import { createProspect, createProspectSource, startEventsTrial } from "@/modules/events/service";
import { endTrial } from "@/lib/demo-purge";
import { EventNotFoundError, QuoteNotFoundError, getQuote, listUnpaidPayments, startQuotesTrial } from "./service";

const NOW = new Date("2027-03-15T10:00:00Z");

async function organization() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null });
    return organizationId;
  } finally {
    await sql.end();
  }
}

describe("AIDE-02 — Essai guidé du module Devis", () => {
  it("crée un devis fictif complet sur l'événement d'essai, numéroté dans la série DEMO, dans la langue demandée", async () => {
    const organizationId = await organization();
    const userId = randomUUID();
    const trial = await startEventsTrial({ organizationId, userId, locale: "en", now: NOW });
    const quote = await startQuotesTrial({ organizationId, eventId: trial.eventId, createdByUserId: userId, locale: "en", now: NOW });

    expect(quote).toMatchObject({ number: "DEMO-D-2027-0001", isDemo: true, status: "draft" });
    expect(quote.current.lines.map((line) => line.label)).toEqual([
      "Wedding day coordination",
      "Vendor search and booking",
      "Table decoration",
    ]);
    expect(quote.current.schedule.items.map((item) => [item.label, item.dueDate])).toEqual([
      ["Deposit on signature", "2027-03-22"],
      ["Second deposit", "2027-05-14"],
    ]);
    expect(quote.current.schedule.exceedsTotal).toBe(false);
  });

  it("refuse un vrai événement : l'essai ne crée jamais de devis réel", async () => {
    const organizationId = await organization();
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: randomUUID(), prospectSourceId: source.id, clients: [{ firstName: "Lou" }] });
    await expect(
      startQuotesTrial({ organizationId, eventId: event.id, createdByUserId: randomUUID(), locale: "fr", now: NOW }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("le devis fictif n'entre pas dans les encaissements et disparaît à la fin de l'essai", async () => {
    const organizationId = await organization();
    const userId = randomUUID();
    const trial = await startEventsTrial({ organizationId, userId, locale: "fr", now: NOW });
    const quote = await startQuotesTrial({ organizationId, eventId: trial.eventId, createdByUserId: userId, locale: "fr", now: NOW });
    const view = await listUnpaidPayments(organizationId, { now: NOW });
    expect([...view.overdue, ...view.upcoming]).toEqual([]);

    await endTrial(organizationId, trial.eventId);
    await expect(getQuote(organizationId, quote.id)).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});
