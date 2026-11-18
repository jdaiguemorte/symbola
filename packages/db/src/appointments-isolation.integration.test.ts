// Lot 46 (RDV-01 à RDV-04, EVT-10 ; ADR 0082) — critère obligatoire (CLAUDE.md § 6) sur chaque
// nouvelle table du schéma appointments : une organisation ne voit ni ne modifie les lignes d'une
// autre ; l'Admin (sans organisation) n'en lit aucune. Exception écrite : l'adresse de la page de
// réservation se lit sans organisation (elle est publique), mais ne s'écrit que par la sienne.
// PostgreSQL réel, rôle applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { includingDeleted } from "./actor";
import { createAppConnection } from "./client";
import {
  appointmentReportActions,
  appointmentReports,
  appointments,
  appointmentTypes,
  availabilityClosures,
  availabilityRules,
  bookingPages,
  busyIntervals,
  calendarSources,
} from "./schema/appointments";
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

const SEALED = "f1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function seedType(tx: Tx, organizationId: string) {
  return first(await tx.insert(appointmentTypes).values({ organizationId, name: "Découverte", durationMinutes: 60, hostUserId: randomUUID() }).returning());
}

async function seedAppointment(tx: Tx, organizationId: string) {
  const type = await seedType(tx, organizationId);
  const startsAt = new Date("2027-03-02T09:00:00Z");
  return first(
    await tx
      .insert(appointments)
      .values({
        organizationId,
        typeId: type.id,
        typeName: type.name,
        hostUserId: type.hostUserId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3_600_000),
        locationKind: "video",
        origin: "public",
        personName: "Léa Martin",
        personEmail: "lea@example.test",
      })
      .returning(),
  );
}

async function seedSource(tx: Tx, organizationId: string) {
  return first(await tx.insert(calendarSources).values({ organizationId, userId: randomUUID(), label: "Agenda perso", urlSealed: SEALED, urlHint: "calendar.example.test/…abcd" }).returning());
}

async function seedReport(tx: Tx, organizationId: string) {
  const appointment = await seedAppointment(tx, organizationId);
  return first(await tx.insert(appointmentReports).values({ organizationId, appointmentId: appointment.id, notes: "Budget 30 k€" }).returning());
}

const inOrg = <T,>(organizationId: string, fn: (tx: Tx) => Promise<T>) => withOrganization(db, organizationId, fn);

describe("RDV-01 à RDV-04, EVT-10 — Isolation entre organisations (schéma appointments, PostgreSQL réel)", () => {
  it("types de rendez-vous", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => inOrg(organizationId, (tx) => seedType(tx, organizationId)),
      listVisible: (organizationId) => inOrg(organizationId, (tx) => tx.select().from(appointmentTypes)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (await inOrg(organizationId, (tx) => tx.update(appointmentTypes).set({ name: "falsifié" }).where(eq(appointmentTypes.id, target.id)).returning())).length,
      }),
    });
  });

  it("plages hebdomadaires", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => inOrg(organizationId, async (tx) => first(await tx.insert(availabilityRules).values({ organizationId, userId: randomUUID(), weekday: 1, startTime: "09:00", endTime: "18:00" }).returning())),
      listVisible: (organizationId) => inOrg(organizationId, (tx) => tx.select().from(availabilityRules)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (await inOrg(organizationId, (tx) => tx.update(availabilityRules).set({ weekday: 2 }).where(eq(availabilityRules.id, target.id)).returning())).length,
      }),
    });
  });

  it("jours fermés", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => inOrg(organizationId, async (tx) => first(await tx.insert(availabilityClosures).values({ organizationId, userId: randomUUID(), startsOn: "2027-08-01", endsOn: "2027-08-15" }).returning())),
      listVisible: (organizationId) => inOrg(organizationId, (tx) => tx.select().from(availabilityClosures)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (await inOrg(organizationId, (tx) => tx.update(availabilityClosures).set({ reason: "falsifié" }).where(eq(availabilityClosures.id, target.id)).returning())).length,
      }),
    });
  });

  it("agendas extérieurs et leurs plages occupées", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => inOrg(organizationId, (tx) => seedSource(tx, organizationId)),
      listVisible: (organizationId) => inOrg(organizationId, (tx) => tx.select().from(calendarSources)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (await inOrg(organizationId, (tx) => tx.update(calendarSources).set({ label: "falsifié" }).where(eq(calendarSources.id, target.id)).returning())).length,
      }),
    });
    await assertOrganizationIsolation({
      seed: (organizationId) =>
        inOrg(organizationId, async (tx) => {
          const source = await seedSource(tx, organizationId);
          return first(await tx.insert(busyIntervals).values({ organizationId, sourceId: source.id, startsAt: new Date("2027-03-02T09:00:00Z"), endsAt: new Date("2027-03-02T10:00:00Z") }).returning());
        }),
      listVisible: (organizationId) => inOrg(organizationId, (tx) => tx.select().from(busyIntervals)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (await inOrg(organizationId, (tx) => tx.delete(busyIntervals).where(eq(busyIntervals.id, target.id)).returning())).length,
      }),
    });
  });

  it("rendez-vous", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => inOrg(organizationId, (tx) => seedAppointment(tx, organizationId)),
      listVisible: (organizationId) => inOrg(organizationId, (tx) => tx.select().from(appointments)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (await inOrg(organizationId, (tx) => tx.update(appointments).set({ personName: "falsifié" }).where(eq(appointments.id, target.id)).returning())).length,
      }),
    });
  });

  it("comptes rendus et actions", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => inOrg(organizationId, (tx) => seedReport(tx, organizationId)),
      listVisible: (organizationId) => inOrg(organizationId, (tx) => tx.select().from(appointmentReports)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (await inOrg(organizationId, (tx) => tx.update(appointmentReports).set({ notes: "falsifié" }).where(eq(appointmentReports.id, target.id)).returning())).length,
      }),
    });
    await assertOrganizationIsolation({
      seed: (organizationId) =>
        inOrg(organizationId, async (tx) => {
          const report = await seedReport(tx, organizationId);
          return first(await tx.insert(appointmentReportActions).values({ organizationId, reportId: report.id, label: "Envoyer le devis" }).returning());
        }),
      listVisible: (organizationId) => inOrg(organizationId, (tx) => tx.select().from(appointmentReportActions)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (await inOrg(organizationId, (tx) => tx.update(appointmentReportActions).set({ label: "falsifié" }).where(eq(appointmentReportActions.id, target.id)).returning())).length,
      }),
    });
  });

  it("page de réservation : l'adresse se lit sans organisation, mais seule la sienne la modifie ou la supprime", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const slugB = `atelier-${randomUUID().slice(0, 8)}`;
    await inOrg(a, (tx) => tx.insert(bookingPages).values({ organizationId: a, slug: `maison-${randomUUID().slice(0, 8)}` }));
    const pageB = first(await inOrg(b, (tx) => tx.insert(bookingPages).values({ organizationId: b, slug: slugB }).returning()));
    // Lecture publique : retrouver l'organisation d'une adresse.
    const [found] = await db.select({ organizationId: bookingPages.organizationId }).from(bookingPages).where(eq(bookingPages.slug, slugB));
    expect(found?.organizationId).toBe(b);
    expect((await inOrg(a, (tx) => tx.update(bookingPages).set({ slug: "volee-par-a" }).where(eq(bookingPages.id, pageB.id)).returning())).length).toBe(0);
    expect((await inOrg(a, (tx) => tx.delete(bookingPages).where(eq(bookingPages.id, pageB.id)).returning())).length).toBe(0);
    await expect(inOrg(a, (tx) => tx.insert(bookingPages).values({ organizationId: b, slug: `pirate-${randomUUID().slice(0, 8)}` }))).rejects.toThrow();
  });

  it("l'Admin (aucune organisation fixée) ne lit aucun type, rendez-vous, agenda ni compte rendu", async () => {
    const organizationId = randomUUID();
    await inOrg(organizationId, async (tx) => {
      await seedReport(tx, organizationId);
      await seedSource(tx, organizationId);
    });
    for (const table of [appointmentTypes, appointments, calendarSources, appointmentReports, availabilityRules]) {
      try {
        const rows = await db.select().from(table);
        expect(rows.filter((row) => row.organizationId === organizationId)).toHaveLength(0);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    }
  });

  it("un type ou un rendez-vous à la corbeille sort de ce que la base montre (ADR 0073)", async () => {
    const organizationId = randomUUID();
    const appointment = await inOrg(organizationId, (tx) => seedAppointment(tx, organizationId));
    await includingDeleted(() => inOrg(organizationId, (tx) => tx.update(appointments).set({ deletedAt: new Date() }).where(eq(appointments.id, appointment.id))));
    expect(await inOrg(organizationId, (tx) => tx.select().from(appointments))).toHaveLength(0);
  });

  it("l'adresse d'un agenda extérieur n'est acceptée que chiffrée (préfixe f1:)", async () => {
    const organizationId = randomUUID();
    await expect(
      inOrg(organizationId, (tx) => tx.insert(calendarSources).values({ organizationId, userId: randomUUID(), label: "Perso", urlSealed: "https://calendar.example.test/secret.ics", urlHint: "calendar.example.test" })),
    ).rejects.toThrow();
  });
});
