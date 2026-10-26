// HUB-03 — « Quand l'Admin active ou désactive une app pour une
// organisation, le changement s'applique au prochain chargement.
// Désactiver une app ne supprime aucune donnée. » Contre un vrai
// PostgreSQL.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { auditLog, organizations } from "@symbola/db/schema/hub";
import { createUser } from "@symbola/auth";
import { createOrganizationWithInvitation, isModuleEnabled, listOrganizations, setModuleEnabled } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createTestAdmin(): Promise<string> {
  const admin = await createUser(db, {
    organizationId: null,
    email: `admin-${randomUUID()}@symbola.test`,
    password: "mot-de-passe-admin",
    role: "admin",
  });
  return admin.id;
}

describe("HUB-03 — Activation/désactivation de module", () => {
  it("un module est activé par défaut, sans qu'aucune action Admin ne soit nécessaire", async () => {
    const [organization] = await db
      .insert(organizations)
      .values({ name: `Org ${randomUUID()}` })
      .returning();

    expect(await isModuleEnabled(db, organization!.id, "hello")).toBe(true);
  });

  it("l'Admin peut désactiver puis réactiver un module, consigné dans le journal d'audit", async () => {
    const adminUserId = await createTestAdmin();
    const [organization] = await db
      .insert(organizations)
      .values({ name: `Org ${randomUUID()}` })
      .returning();

    await setModuleEnabled(db, {
      adminUserId,
      organizationId: organization!.id,
      moduleKey: "hello",
      enabled: false,
    });
    expect(await isModuleEnabled(db, organization!.id, "hello")).toBe(false);

    const [disableLog] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetOrganizationId, organization!.id));
    expect(disableLog?.action).toBe("hub.module.disabled");

    await setModuleEnabled(db, {
      adminUserId,
      organizationId: organization!.id,
      moduleKey: "hello",
      enabled: true,
    });
    expect(await isModuleEnabled(db, organization!.id, "hello")).toBe(true);
  });

  it("désactiver un module ne supprime aucune donnée de l'organisation", async () => {
    const adminUserId = await createTestAdmin();
    const titulaireEmail = `titulaire-${randomUUID()}@symbola.test`;
    const { organizationId } = await createOrganizationWithInvitation(db, {
      adminUserId,
      name: `Org ${randomUUID()}`,
      language: "fr",
      siret: null,
      titulaireEmail,
    });

    await setModuleEnabled(db, { adminUserId, organizationId, moduleKey: "hello", enabled: false });

    const [stillThere] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    expect(stillThere).toBeTruthy();
    expect(stillThere!.name).toBeTruthy();
  });

  it("liste toutes les organisations (pour le tableau de l'Admin)", async () => {
    const { organizationId } = await createOrganizationWithInvitation(db, {
      adminUserId: await createTestAdmin(),
      name: `Org liste ${randomUUID()}`,
      language: "fr",
      siret: null,
      titulaireEmail: `titulaire-${randomUUID()}@symbola.test`,
    });

    const all = await listOrganizations(db);
    expect(all.some((org) => org.id === organizationId)).toBe(true);
  });
});
