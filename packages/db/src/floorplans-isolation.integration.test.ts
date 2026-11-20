// Lot 60 (SEC-10, ARC-08 ; CLAUDE.md § 6) — critère obligatoire sur chaque nouvelle table : schéma
// floorplans. Une organisation ne voit et ne modifie jamais les lignes d'une autre ; une transaction
// sans organisation (l'Admin, qui n'a pas d'organisation) n'en lit aucune. PostgreSQL réel, rôle
// applicatif.
import { randomUUID } from "node:crypto";
import { assertOrganizationIsolation } from "@symbola/testing";
import { eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { elementTypes, layoutElements, layoutVersions, layouts, linkViews, powerLinks, spaceFixtures, spaces } from "./schema/floorplans";
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

// Un lieu complet : type de la bibliothèque, espace, prise, configuration, élément relié, version
// diffusée, version vue par un lien.
async function seedAll(tx: Tx, organizationId: string) {
  const type = first(await tx.insert(elementTypes).values({ organizationId, label: `Table ${randomUUID().slice(0, 8)}`, category: "table", shape: "circle", seatRule: "round", widthCm: 180, depthCm: 180 }).returning());
  const space = first(await tx.insert(spaces).values({ organizationId, vendorId: randomUUID(), name: "Salle", widthCm: 2000, depthCm: 1200 }).returning());
  const fixture = first(await tx.insert(spaceFixtures).values({ organizationId, spaceId: space.id, kind: "outlet", xCm: 100, yCm: 20, widthCm: 40, depthCm: 20, outletCount: 2, amps: 16 }).returning());
  const layout = first(await tx.insert(layouts).values({ organizationId, spaceId: space.id, eventId: randomUUID(), name: "Dîner" }).returning());
  const element = first(await tx.insert(layoutElements).values({ organizationId, layoutId: layout.id, elementTypeId: type.id, typeStarterKey: "dj", category: "setup", shape: "rect", xCm: 500, yCm: 500, widthCm: 200, depthCm: 100, powerOutlets: 2, powerAmps: 16 }).returning());
  const link = first(await tx.insert(powerLinks).values({ organizationId, elementId: element.id, fixtureId: fixture.id }).returning());
  const version = first(await tx.insert(layoutVersions).values({ organizationId, layoutId: layout.id, version: 1, snapshot: { layoutName: "Dîner" } }).returning());
  const view = first(await tx.insert(linkViews).values({ organizationId, linkId: randomUUID(), layoutId: layout.id, seenVersion: 1 }).returning());
  return { type, space, fixture, layout, element, link, version, view };
}

type Seeded = Awaited<ReturnType<typeof seedAll>>;

const CASES: [string, PgTable & { id?: unknown }, keyof Seeded][] = [
  ["bibliothèque d'éléments", elementTypes, "type"],
  ["espaces", spaces, "space"],
  ["installations fixes", spaceFixtures, "fixture"],
  ["configurations et plans d'évènement", layouts, "layout"],
  ["éléments posés", layoutElements, "element"],
  ["liaisons aux prises", powerLinks, "link"],
  ["versions diffusées", layoutVersions, "version"],
  ["versions vues par un lien", linkViews, "view"],
];

describe("SEC-10 — Isolation entre organisations du module Plans de salle (PostgreSQL réel)", () => {
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

  it("SEC-09 : sans organisation fixée (l'Admin), aucune ligne n'est lisible", async () => {
    const a = randomUUID();
    await withOrganization(db, a, (tx) => seedAll(tx, a));
    // Sans contexte d'organisation, la politique RLS ne laisse rien passer : aucune ligne, ou un refus
    // (paramètre vide sur une connexion déjà servie), jamais une donnée.
    const readable = async (query: Promise<unknown[]>) => query.then((rows) => rows, () => []);
    expect(await readable(db.select().from(spaces))).toEqual([]);
    expect(await readable(db.select().from(layouts))).toEqual([]);
  });

  it("une ligne d'une autre organisation ne peut pas être écrite sous son identifiant (WITH CHECK)", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await expect(withOrganization(db, a, (tx) => tx.insert(spaces).values({ organizationId: b, vendorId: randomUUID(), name: "Intrus", widthCm: 1000, depthCm: 1000 }))).rejects.toThrow();
  });

  it("contraintes : une prise sans nombre ni ampérage, un fond de plan PDF, une calibration sans image sont refusés", async () => {
    const a = randomUUID();
    const seeded = await withOrganization(db, a, (tx) => seedAll(tx, a));
    await expect(withOrganization(db, a, (tx) => tx.insert(spaceFixtures).values({ organizationId: a, spaceId: seeded.space.id, kind: "outlet", xCm: 0, yCm: 0, widthCm: 40, depthCm: 20 }))).rejects.toThrow();
    await expect(withOrganization(db, a, (tx) => tx.update(spaces).set({ backgroundKey: "x", backgroundMime: "application/pdf" as never, backgroundSizeBytes: 10, backgroundWidthPx: 10, backgroundHeightPx: 10 }).where(eq(spaces.id, seeded.space.id)))).rejects.toThrow();
    await expect(withOrganization(db, a, (tx) => tx.update(spaces).set({ calibrationAx: 0, calibrationAy: 0, calibrationBx: 10, calibrationBy: 0, calibrationDistanceCm: 100 }).where(eq(spaces.id, seeded.space.id)))).rejects.toThrow();
  });
});
