// PRD-HUB-03 — « Quand l'Admin active ou désactive une app pour une
// organisation, le changement s'applique au prochain chargement.
// Désactiver une app ne supprime aucune donnée. » Contre un vrai
// PostgreSQL.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { organizations } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
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

describe("PRD-HUB-03 — Activation/désactivation de module", () => {
  it("un module est activé par défaut, sans qu'aucune action Admin ne soit nécessaire", async () => {
    const [organization] = await db
      .insert(organizations)
      .values({ name: `Org ${randomUUID()}` })
      .returning();

    expect(await isModuleEnabled(db, organization!.id, "budget")).toBe(true);
  });

  it("socle des lots 46 et 49 (ADR 0078) — les rendez-vous et les invités sont fermés sans réglage ; l'Admin les ouvre", async () => {
    const adminUserId = await createTestAdmin();
    const [organization] = await db
      .insert(organizations)
      .values({ name: `Org ${randomUUID()}` })
      .returning();

    for (const moduleKey of ["appointments", "guests"] as const) {
      expect(await isModuleEnabled(db, organization!.id, moduleKey)).toBe(false);
    }
    await setModuleEnabled(db, { adminUserId, organizationId: organization!.id, moduleKey: "appointments", enabled: true });
    expect(await isModuleEnabled(db, organization!.id, "appointments")).toBe(true);
    // Ouvrir l'un ne touche ni l'autre ni les modules du pilote.
    expect(await isModuleEnabled(db, organization!.id, "guests")).toBe(false);
    expect(await isModuleEnabled(db, organization!.id, "events")).toBe(true);
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
      moduleKey: "budget",
      enabled: false,
    });
    expect(await isModuleEnabled(db, organization!.id, "budget")).toBe(false);

    const [disableLog] = await withOrganization(db, organization!.id, (tx) =>
      tx.select().from(auditEntries).where(eq(auditEntries.action, "hub.module.disabled")),
    );
    expect(disableLog).toMatchObject({ action: "hub.module.disabled", details: { module: "budget" }, actorKind: "admin", actorId: adminUserId });

    await setModuleEnabled(db, {
      adminUserId,
      organizationId: organization!.id,
      moduleKey: "budget",
      enabled: true,
    });
    expect(await isModuleEnabled(db, organization!.id, "budget")).toBe(true);
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

    await setModuleEnabled(db, { adminUserId, organizationId, moduleKey: "budget", enabled: false });

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

// Lot 40b (ARC-06, décision D11) — droits d'usage pilotés sans redéploiement : l'activation d'un
// module est lue à chaque requête, par n'importe quel processus. Les interrupteurs par fonction
// rejoignent l'abonnement au lot 54 (HUB-27).
describe("ARC-06 — Droits d'usage pilotés par l'organisation, sans redéploiement", () => {
  it("activer ou retirer un module prend effet dès la requête suivante, lue par un autre processus", async () => {
    const adminUserId = await createTestAdmin();
    const [organization] = await db
      .insert(organizations)
      .values({ name: `Org ${randomUUID()}` })
      .returning();
    // Une autre connexion : la requête suivante, servie par un autre processus de l'app.
    const other = createAppConnection();
    try {
      expect(await isModuleEnabled(other.db, organization!.id, "quotes")).toBe(true);
      await setModuleEnabled(db, { adminUserId, organizationId: organization!.id, moduleKey: "quotes", enabled: false });
      expect(await isModuleEnabled(other.db, organization!.id, "quotes")).toBe(false);
      await setModuleEnabled(db, { adminUserId, organizationId: organization!.id, moduleKey: "quotes", enabled: true });
      expect(await isModuleEnabled(other.db, organization!.id, "quotes")).toBe(true);
    } finally {
      await other.sql.end();
    }
  });
});
