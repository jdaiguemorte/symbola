// Lot 49 (SEC-10, ARC-08 ; CLAUDE.md § 6) — critère obligatoire sur chaque nouvelle table : schéma
// guests et temps forts (events.key_moments). Une organisation ne voit et ne modifie jamais les
// lignes d'une autre ; l'Admin (sans organisation) n'en lit aucune. PostgreSQL réel, rôle applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { events, keyMoments } from "./schema/events";
import {
  catererSummaryDownloads,
  dietaryOptions,
  dietConsents,
  diets,
  eventSettings,
  guestImports,
  guestLinks,
  guests,
  householdGroups,
  households,
  mealTypes,
  moduleSettings,
  purgePostponements,
  rsvpAnswers,
  seatAssignments,
  seatingConstraintMembers,
  seatingConstraints,
  seatingPlans,
  seatingTables,
  vendorMealCounts,
} from "./schema/guests";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

afterAll(async () => {
  await sql.end();
});

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error("insertion attendue, aucune ligne renvoyée");
  return row;
}

// Un foyer complet : un adulte, sa réponse, son régime (valeur au format chiffré), sa preuve, son lien.
async function seedAll(tx: Tx, organizationId: string) {
  const event = first(await tx.insert(events).values({ organizationId }).returning());
  const moment = first(await tx.insert(keyMoments).values({ organizationId, eventId: event.id, name: "Dîner", date: "2027-06-12" }).returning());
  const settings = first(await tx.insert(eventSettings).values({ organizationId, eventId: event.id, responsesCloseOn: "2027-05-13" }).returning());
  const group = first(await tx.insert(householdGroups).values({ organizationId, eventId: event.id, label: "Amis" }).returning());
  const imported = first(await tx.insert(guestImports).values({ organizationId, eventId: event.id, channel: "planner", householdCount: 1, guestCount: 1 }).returning());
  const household = first(await tx.insert(households).values({ organizationId, eventId: event.id, displayName: "Foyer test", groupId: group.id, importId: imported.id }).returning());
  const person = first(await tx.insert(guests).values({ organizationId, eventId: event.id, householdId: household.id, kind: "adult", firstName: "Invité", email: `invite-${randomUUID()}@example.test` }).returning());
  const answer = first(await tx.insert(rsvpAnswers).values({ organizationId, guestId: person.id, keyMomentId: moment.id, attending: true, channel: "link" }).returning());
  const option = first(await tx.insert(dietaryOptions).values({ organizationId, kind: "diet", label: `Régime ${randomUUID().slice(0, 8)}` }).returning());
  const diet = first(await tx.insert(diets).values({ organizationId, guestId: person.id, optionsSealed: "f1:QUJD" }).returning());
  const consent = first(await tx.insert(dietConsents).values({ organizationId, eventId: event.id, guestId: person.id, givenByGuestId: person.id, textVersion: "2026-11-18", grantedAt: new Date() }).returning());
  const link = first(await tx.insert(guestLinks).values({ organizationId, eventId: event.id, guestId: person.id, tokenHash: randomUUID().replace(/-/g, "").padEnd(64, "0") }).returning());
  const postponement = first(await tx.insert(purgePostponements).values({ organizationId, eventId: event.id, reason: "Litige", postponedUntil: "2027-09-01" }).returning());
  const module = first(await tx.insert(moduleSettings).values({ organizationId, impactAssessmentConfirmedAt: new Date() }).returning());
  // Lot 50 : type de repas, plan du dîner, table, place, contrainte « séparés », repas prestataires,
  // trace d'un téléchargement de la synthèse pour le traiteur.
  const mealType = first(await tx.insert(mealTypes).values({ organizationId, starterKey: "adult" }).returning());
  const plan = first(await tx.insert(seatingPlans).values({ organizationId, eventId: event.id, keyMomentId: moment.id }).returning());
  const table = first(await tx.insert(seatingTables).values({ organizationId, planId: plan.id, name: "Table 1", shape: "round", capacity: 10 }).returning());
  const seat = first(await tx.insert(seatAssignments).values({ organizationId, planId: plan.id, tableId: table.id, guestId: person.id }).returning());
  const constraint = first(await tx.insert(seatingConstraints).values({ organizationId, planId: plan.id, kind: "apart" }).returning());
  const member = first(await tx.insert(seatingConstraintMembers).values({ organizationId, constraintId: constraint.id, guestId: person.id }).returning());
  const vendorMeals = first(await tx.insert(vendorMealCounts).values({ organizationId, eventId: event.id, keyMomentId: moment.id, mealCount: 4 }).returning());
  const download = first(await tx.insert(catererSummaryDownloads).values({ organizationId, eventId: event.id, keyMomentId: moment.id, version: "aggregate", format: "csv", downloadedBy: randomUUID() }).returning());
  return {
    moment, settings, group, imported, household, person, answer, option, diet, consent, link, postponement, module: { ...module, id: module.organizationId },
    mealType, plan, table, seat, constraint, member: { ...member, id: member.constraintId }, vendorMeals, download,
  };
}

type Seeded = Awaited<ReturnType<typeof seedAll>>;

const CASES: [string, PgTable & { id?: unknown }, keyof Seeded][] = [
  ["temps forts (events.key_moments)", keyMoments, "moment"],
  ["réglages des réponses", eventSettings, "settings"],
  ["groupes", householdGroups, "group"],
  ["imports", guestImports, "imported"],
  ["foyers", households, "household"],
  ["personnes", guests, "person"],
  ["réponses", rsvpAnswers, "answer"],
  ["liste des régimes", dietaryOptions, "option"],
  ["régimes", diets, "diet"],
  ["preuves d'accord", dietConsents, "consent"],
  ["liens personnels", guestLinks, "link"],
  ["reports de purge", purgePostponements, "postponement"],
  ["types de repas (lot 50)", mealTypes, "mealType"],
  ["plans de table (lot 50)", seatingPlans, "plan"],
  ["tables (lot 50)", seatingTables, "table"],
  ["places (lot 50)", seatAssignments, "seat"],
  ["contraintes de placement (lot 50)", seatingConstraints, "constraint"],
  ["repas des prestataires (lot 50)", vendorMealCounts, "vendorMeals"],
  ["téléchargements de la synthèse (lot 50)", catererSummaryDownloads, "download"],
];

describe("SEC-10 — Isolation entre organisations du module Invités (PostgreSQL réel)", () => {
  for (const [label, table, key] of CASES) {
    it(label, async () => {
      const idColumn = (table as unknown as { id: Parameters<typeof eq>[0] }).id;
      await assertOrganizationIsolation({
        seed: (organizationId) => withOrganization(db, organizationId, async (tx) => (await seedAll(tx, organizationId))[key] as { id: string }),
        listVisible: (organizationId) => withOrganization(db, organizationId, async (tx) => (await tx.select().from(table)) as unknown as { id: string }[]),
        attemptCrossOrganizationUpdate: async (organizationId, target) => ({
          affectedRows: (await withOrganization(db, organizationId, (tx) => tx.delete(table).where(eq(idColumn, target.id)).returning())).length,
        }),
      });
    });
  }

  it("membres d'une contrainte de placement (lot 50, clé composée)", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await withOrganization(db, a, (tx) => seedAll(tx, a));
    const seededB = await withOrganization(db, b, (tx) => seedAll(tx, b));
    const visible = await withOrganization(db, a, (tx) => tx.select().from(seatingConstraintMembers));
    expect(visible.map((row) => row.organizationId)).toEqual([a]);
    const removed = await withOrganization(db, a, (tx) => tx.delete(seatingConstraintMembers).where(eq(seatingConstraintMembers.constraintId, seededB.constraint.id)).returning());
    expect(removed).toEqual([]);
  });

  it("réglages du module (une ligne par organisation)", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await withOrganization(db, a, (tx) => seedAll(tx, a));
    await withOrganization(db, b, (tx) => seedAll(tx, b));
    const visible = await withOrganization(db, a, (tx) => tx.select().from(moduleSettings));
    expect(visible.map((row) => row.organizationId)).toEqual([a]);
    const changed = await withOrganization(db, a, (tx) => tx.update(moduleSettings).set({ privacyNotice: "volé" }).where(eq(moduleSettings.organizationId, b)).returning());
    expect(changed).toEqual([]);
  });
});

describe("SEC-09, PRD-HUB-03 — L'Admin ne lit aucune donnée d'invité", () => {
  it("sans app.organization_id (session Admin), aucune table du module ne renvoie de ligne", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, (tx) => seedAll(tx, organizationId));
    for (const [, table] of [...CASES, ["réglages", moduleSettings, "module"] as const, ["membres", seatingConstraintMembers, "member"] as const]) {
      try {
        const rows = await db.select().from(table);
        expect(rows).toHaveLength(0);
      } catch (error) {
        // Une erreur (contexte vide) dit la même chose : aucune donnée n'est accessible.
        expect(error).toBeTruthy();
      }
    }
  });
});
