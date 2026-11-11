// Lot 13 (L13-EVT-19) — dates de la frise du statut, contre un vrai PostgreSQL
// (RLS) : dernier passage dans chaque statut, isolation des organisations.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { changeEventStatus, createProspect, createProspectSource, getEventStatusDates } from "./service";

const plannerId = randomUUID();

async function newOrganization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

describe("L13-EVT-19 — Frise du statut datée", () => {
  it("donne la date de chaque statut franchi, et rien pour une autre organisation", async () => {
    const organizationId = await newOrganization();
    const otherId = await newOrganization();
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }] });
    await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: plannerId, toStatus: "confirmed" });

    const today = parisToday();
    expect(await getEventStatusDates(organizationId, event.id)).toEqual({ prospect: today, confirmed: today });
    expect(await getEventStatusDates(otherId, event.id)).toEqual({});
  });
});
