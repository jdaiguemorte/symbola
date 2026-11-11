// Lot 11 (ADR 0031) — critère obligatoire (CLAUDE.md §6) sur chaque
// nouvelle table : carnet de prestataires (schéma vendors) et prestataires
// consultés (schéma events). Une organisation ne voit et ne modifie jamais
// les lignes d'une autre. PostgreSQL réel, rôle applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, it } from "vitest";
import { createAppConnection } from "./client";
import { eventPlaces, eventVendorCandidateNotes, eventVendorCandidates, events, eventVendorSlots } from "./schema/events";
import { vendorFiles, vendors, vendorSettings, vendorTags, vendorTypeFields, vendorTypes } from "./schema/vendors";
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

async function seedCandidate(tx: Tx, organizationId: string) {
  const event = first(await tx.insert(events).values({ organizationId }).returning());
  const slot = first(await tx.insert(eventVendorSlots).values({ organizationId, eventId: event.id, label: "Traiteur" }).returning());
  return first(
    await tx.insert(eventVendorCandidates).values({ organizationId, eventId: event.id, vendorSlotId: slot.id, vendorName: "Maison test" }).returning(),
  );
}

async function seedType(tx: Tx, organizationId: string) {
  return first(await tx.insert(vendorTypes).values({ organizationId, label: "Traiteur", color: "#4f6b5a" }).returning());
}

async function seedVendor(tx: Tx, organizationId: string) {
  return first(await tx.insert(vendors).values({ organizationId, name: "Maison test" }).returning());
}

describe("L11-EVT-10 / L11-PRE-01 — Isolation entre organisations (prestataires, PostgreSQL réel)", () => {
  it("prestataires consultés", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => withOrganization(db, organizationId, (tx) => seedCandidate(tx, organizationId)),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(eventVendorCandidates)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) =>
            tx.update(eventVendorCandidates).set({ vendorName: "falsifié" }).where(eq(eventVendorCandidates.id, target.id)).returning(),
          )
        ).length,
      }),
    });
  });

  it("notes des prestataires consultés", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const candidate = await seedCandidate(tx, organizationId);
          return first(
            await tx
              .insert(eventVendorCandidateNotes)
              .values({ organizationId, candidateId: candidate.id, body: "Produits frais", createdByUserId: randomUUID() })
              .returning(),
          );
        }),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(eventVendorCandidateNotes)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) =>
            tx.update(eventVendorCandidateNotes).set({ body: "falsifié" }).where(eq(eventVendorCandidateNotes.id, target.id)).returning(),
          )
        ).length,
      }),
    });
  });

  it("types de prestataires", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => withOrganization(db, organizationId, (tx) => seedType(tx, organizationId)),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(vendorTypes)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) => tx.update(vendorTypes).set({ label: "falsifié" }).where(eq(vendorTypes.id, target.id)).returning())
        ).length,
      }),
    });
  });

  it("champs des types", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const type = await seedType(tx, organizationId);
          return first(await tx.insert(vendorTypeFields).values({ organizationId, typeId: type.id, label: "Couchages", kind: "number" }).returning());
        }),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(vendorTypeFields)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) =>
            tx.update(vendorTypeFields).set({ label: "falsifié" }).where(eq(vendorTypeFields.id, target.id)).returning(),
          )
        ).length,
      }),
    });
  });

  it("étiquettes", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => withOrganization(db, organizationId, async (tx) => first(await tx.insert(vendorTags).values({ organizationId, label: "bio" }).returning())),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(vendorTags)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) => tx.update(vendorTags).set({ label: "falsifié" }).where(eq(vendorTags.id, target.id)).returning())
        ).length,
      }),
    });
  });

  it("fiches du carnet", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) => withOrganization(db, organizationId, (tx) => seedVendor(tx, organizationId)),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(vendors)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) => tx.update(vendors).set({ name: "falsifié" }).where(eq(vendors.id, target.id)).returning())
        ).length,
      }),
    });
  });

  it("fichiers des fiches (plaquettes, RIB)", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const vendor = await seedVendor(tx, organizationId);
          return first(
            await tx
              .insert(vendorFiles)
              .values({
                organizationId,
                vendorId: vendor.id,
                kind: "rib",
                fileName: "rib.pdf",
                fileKey: `${organizationId}/rib.pdf`,
                mime: "application/pdf",
                sizeBytes: 100,
                uploadedByUserId: randomUUID(),
              })
              .returning(),
          );
        }),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(vendorFiles)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) => tx.update(vendorFiles).set({ fileKey: "falsifié" }).where(eq(vendorFiles.id, target.id)).returning())
        ).length,
      }),
    });
  });

  it("paramètres du trajet estimé", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const row = first(await tx.insert(vendorSettings).values({ organizationId }).returning());
          return { ...row, id: row.organizationId };
        }),
      listVisible: async (organizationId) =>
        (await withOrganization(db, organizationId, (tx) => tx.select().from(vendorSettings))).map((row) => ({ ...row, id: row.organizationId })),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) =>
            tx.update(vendorSettings).set({ averageSpeedKmh: 1 }).where(eq(vendorSettings.organizationId, target.id)).returning(),
          )
        ).length,
      }),
    });
  });

  it("lot 12 (L12-EVT-15) — lieux d'un événement", async () => {
    await assertOrganizationIsolation({
      seed: (organizationId) =>
        withOrganization(db, organizationId, async (tx) => {
          const event = first(await tx.insert(events).values({ organizationId }).returning());
          return first(await tx.insert(eventPlaces).values({ organizationId, eventId: event.id, label: "Clos de l'Orbrie" }).returning());
        }),
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(eventPlaces)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => ({
        affectedRows: (
          await withOrganization(db, organizationId, (tx) => tx.update(eventPlaces).set({ label: "falsifié" }).where(eq(eventPlaces.id, target.id)).returning())
        ).length,
      }),
    });
  });
});
