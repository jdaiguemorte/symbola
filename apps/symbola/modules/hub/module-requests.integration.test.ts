// Lot 63g (HUB-06, HUB-15, HUB-27, ARC-06, ARC-07, SEC-09, SEC-10 ; ADR 0108) — demandes d'activation
// d'une app pendant le pilote, contre un vrai PostgreSQL :
// - la Propriétaire demande une app non activée, sans champ libre, et peut annuler tant que la demande
//   n'est pas traitée ;
// - l'Exploitation voit la demande avec l'organisation et le module, rien d'autre (SEC-09) ;
// - une fois le module activé (par l'Exploitation ou par l'abonnement), la demande est close et la
//   planner reçoit une notification ; le module s'ouvre à la requête suivante (ARC-06) ;
// - libre-service ouvert, on n'envoie plus de demande : on ajoute l'app à son abonnement ;
// - la base n'ouvre que les demandes de sa propre organisation (RLS).
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { moduleRequests } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { assertOrganizationIsolation } from "@symbola/testing";
import { starterAppCatalog } from "@symbola/starter-templates";
import {
  assignPlanByOperator,
  cancelModuleRequest,
  changeSubscription,
  declineModuleRequest,
  isModuleEnabled,
  listModuleRequests,
  listNotifications,
  listPendingModuleRequests,
  ModuleRequestError,
  requestModuleActivation,
  setFeatureFlagForOrganization,
  setFeatureFlagOpenToAll,
  setModuleEnabled,
} from "./service";

const db = appDatabase();
let adminUserId: string;

beforeAll(async () => {
  adminUserId = (await createUser(db, { organizationId: null, email: `exploitation-${randomUUID()}@example.test`, role: "admin" })).id;
});

afterAll(async () => {
  await setFeatureFlagOpenToAll(db, { adminUserId, key: "subscription_self_service", open: false });
});

async function atelier() {
  const organization = await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`);
  const owner = await createUser(db, { organizationId: organization.id, email: `titulaire-${randomUUID()}@example.test`, role: "owner" });
  return { organizationId: organization.id, organizationName: organization.name, ownerId: owner.id };
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ModuleRequestError) return error.reason;
    throw error;
  }
  return "accepted";
}

describe("HUB-06 — Demander l'activation d'une app pendant le pilote", () => {
  it("la Propriétaire demande une app non activée : la demande est enregistrée, datée, en attente", async () => {
    const { organizationId, ownerId } = await atelier();
    const now = new Date("2026-11-21T09:00:00Z");
    const request = await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "floorplans", now });
    expect(request).toMatchObject({ moduleKey: "floorplans", status: "pending", requestedAt: now, handledAt: null });
    expect(await listModuleRequests(db, organizationId)).toEqual([request]);
  });

  it("demander deux fois la même app ne crée qu'une demande", async () => {
    const { organizationId, ownerId } = await atelier();
    const first = await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "guests" });
    const second = await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "guests" });
    expect(second.id).toBe(first.id);
    expect(await listModuleRequests(db, organizationId)).toHaveLength(1);
  });

  it("une app déjà activée, une clé inconnue du registre : refusées", async () => {
    const { organizationId, ownerId } = await atelier();
    expect(await refusal(requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "events" }))).toBe("already_enabled");
    expect(await refusal(requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "inconnu" }))).toBe("unknown_module");
  });

  it("seule la Propriétaire demande ou annule ; une Planner, un Comptable, une personne d'une autre organisation sont refusés", async () => {
    const { organizationId, ownerId } = await atelier();
    const other = await atelier();
    for (const role of ["member", "accountant"] as const) {
      const userId = (await createUser(db, { organizationId, email: `${role}-${randomUUID()}@example.test`, role })).id;
      expect(await refusal(requestModuleActivation(db, { organizationId, userId, moduleKey: "floorplans" })), role).toBe("forbidden");
    }
    expect(await refusal(requestModuleActivation(db, { organizationId, userId: other.ownerId, moduleKey: "floorplans" }))).toBe("forbidden");
    const request = await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "floorplans" });
    // Annuler la demande d'une autre organisation répond comme si elle n'existait pas.
    expect(await refusal(cancelModuleRequest(db, { organizationId: other.organizationId, userId: other.ownerId, requestId: request.id }))).toBe("not_found");
    expect((await listModuleRequests(db, organizationId))[0]?.status).toBe("pending");
  });

  it("la demande s'annule tant qu'elle n'est pas traitée ; on peut ensuite la refaire", async () => {
    const { organizationId, ownerId } = await atelier();
    const request = await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "appointments" });
    const cancelledAt = new Date("2026-11-21T10:00:00Z");
    await cancelModuleRequest(db, { organizationId, userId: ownerId, requestId: request.id, now: cancelledAt });
    expect(await listModuleRequests(db, organizationId)).toEqual([expect.objectContaining({ id: request.id, status: "cancelled", handledAt: cancelledAt })]);
    expect(await listPendingModuleRequests(db)).not.toContainEqual(expect.objectContaining({ organizationId }));
    // Annuler une demande déjà close : refusé.
    expect(await refusal(cancelModuleRequest(db, { organizationId, userId: ownerId, requestId: request.id }))).toBe("not_found");
    const again = await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "appointments" });
    expect(again.id).not.toBe(request.id);
    expect((await listModuleRequests(db, organizationId)).map((entry) => entry.status)).toEqual(["pending"]);
  });

  it("libre-service ouvert : plus de demande, on ajoute l'app à son abonnement", async () => {
    const { organizationId, ownerId } = await atelier();
    await setFeatureFlagForOrganization(db, { adminUserId, key: "subscription_self_service", organizationId, open: true });
    expect(await refusal(requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "floorplans" }))).toBe("self_service");
    // Sauf sous le forfait Pilote, que la planner ne change pas elle-même.
    await assignPlanByOperator(db, { adminUserId, organizationId, planKey: "pilot" });
    await setModuleEnabled(db, { adminUserId, organizationId, moduleKey: "floorplans", enabled: false });
    expect((await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "floorplans" })).status).toBe("pending");
  });
});

describe("SEC-09 — L'Exploitation voit l'organisation et l'app demandée, rien d'autre", () => {
  it("la liste des demandes en attente ne porte que l'organisation, la clé du module et la date", async () => {
    const { organizationId, ownerId } = await atelier();
    const now = new Date("2026-11-21T11:00:00Z");
    await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "floorplans", now });
    const pending = (await listPendingModuleRequests(db)).filter((entry) => entry.organizationId === organizationId);
    expect(pending).toEqual([{ organizationId, moduleKey: "floorplans", requestedAt: now }]);
    for (const entry of pending) expect(Object.keys(entry).sort()).toEqual(["moduleKey", "organizationId", "requestedAt"]);
    expect(JSON.stringify(pending)).not.toContain(ownerId);
  });

  it("l'Exploitation classe une demande sans activer : elle sort de sa liste, la planner peut redemander", async () => {
    const { organizationId, ownerId } = await atelier();
    await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "guests" });
    await declineModuleRequest(db, { adminUserId, organizationId, moduleKey: "guests" });
    expect(await isModuleEnabled(db, organizationId, "guests")).toBe(false);
    expect(await listPendingModuleRequests(db)).not.toContainEqual(expect.objectContaining({ organizationId }));
    expect((await listModuleRequests(db, organizationId))[0]?.status).toBe("declined");
    expect(await listNotifications(organizationId, ownerId)).toEqual([]);
  });
});

describe("HUB-15, ARC-06 — Une fois l'app activée, la planner est prévenue", () => {
  it("l'Exploitation active le module : la demande est close et la Propriétaire reçoit une notification qui mène à l'app", async () => {
    const { organizationId, ownerId } = await atelier();
    const request = await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "floorplans" });
    await setModuleEnabled(db, { adminUserId, organizationId, moduleKey: "floorplans", enabled: true });
    // ARC-06 : ouvert à la requête suivante.
    expect(await isModuleEnabled(db, organizationId, "floorplans")).toBe(true);
    const [settled] = await listModuleRequests(db, organizationId);
    expect(settled).toMatchObject({ id: request.id, status: "activated" });
    expect(settled?.handledAt).toBeInstanceOf(Date);
    expect(await listPendingModuleRequests(db)).not.toContainEqual(expect.objectContaining({ organizationId }));
    const notifications = await listNotifications(organizationId, ownerId);
    expect(notifications).toEqual([
      expect.objectContaining({ type: "module_activated", params: { module: "floorplans" }, href: starterAppCatalog().find((app) => app.key === "floorplans")!.href }),
    ]);
    // Rouvrir, refermer, rouvrir : une seule notification pour une demande.
    await setModuleEnabled(db, { adminUserId, organizationId, moduleKey: "floorplans", enabled: false });
    await setModuleEnabled(db, { adminUserId, organizationId, moduleKey: "floorplans", enabled: true });
    expect(await listNotifications(organizationId, ownerId)).toHaveLength(1);
  });

  it("une app activée sans demande ne notifie personne", async () => {
    const { organizationId, ownerId } = await atelier();
    await setModuleEnabled(db, { adminUserId, organizationId, moduleKey: "appointments", enabled: true });
    expect(await listNotifications(organizationId, ownerId)).toEqual([]);
  });

  it("le forfait Pilote posé par l'Exploitation ouvre les apps demandées et clôt leurs demandes", async () => {
    const { organizationId, ownerId } = await atelier();
    await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "guests" });
    await assignPlanByOperator(db, { adminUserId, organizationId, planKey: "pilot" });
    expect((await listModuleRequests(db, organizationId))[0]?.status).toBe("activated");
    expect((await listNotifications(organizationId, ownerId)).map((notification) => notification.type)).toEqual(["module_activated"]);
  });

  it("libre-service : ajouter l'app à son abonnement l'ouvre tout de suite et clôt une demande restée en attente", async () => {
    const { organizationId, ownerId } = await atelier();
    await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "floorplans" });
    await setFeatureFlagForOrganization(db, { adminUserId, key: "subscription_self_service", organizationId, open: true });
    const now = new Date();
    await changeSubscription(db, { organizationId, userId: ownerId, selection: { planKey: "solo", chosenModule: null, options: ["floorplans"], storageUnits: 0, billingPeriod: "monthly" }, now });
    expect(await isModuleEnabled(db, organizationId, "floorplans")).toBe(true);
    expect((await listModuleRequests(db, organizationId))[0]?.status).toBe("activated");
  });
});

describe("SEC-10 — Isolation des demandes d'activation (RLS)", () => {
  it("une organisation ne lit ni ne modifie les demandes d'une autre", async () => {
    const owners = new Map<string, string>();
    await assertOrganizationIsolation({
      seed: async (organizationId) => {
        const userId = owners.get(organizationId) ?? randomUUID();
        owners.set(organizationId, userId);
        const [row] = await withOrganization(db, organizationId, (tx) =>
          tx.insert(moduleRequests).values({ organizationId, moduleKey: "floorplans", requestedByUserId: userId, requestedAt: new Date() }).returning({ id: moduleRequests.id }),
        );
        return { id: row!.id };
      },
      listVisible: (organizationId) => withOrganization(db, organizationId, (tx) => tx.select({ id: moduleRequests.id }).from(moduleRequests)),
      attemptCrossOrganizationUpdate: async (organizationId, target) => {
        const rows = await withOrganization(db, organizationId, (tx) =>
          tx.update(moduleRequests).set({ status: "cancelled", handledAt: new Date() }).where(eq(moduleRequests.id, target.id)).returning({ id: moduleRequests.id }),
        );
        return { affectedRows: rows.length };
      },
    });
  });

  it("la base refuse d'écrire une demande pour une autre organisation, et deux demandes en attente du même module", async () => {
    const a = await atelier();
    const b = await atelier();
    await expect(
      withOrganization(db, a.organizationId, (tx) => tx.insert(moduleRequests).values({ organizationId: b.organizationId, moduleKey: "guests", requestedByUserId: a.ownerId, requestedAt: new Date() })),
    ).rejects.toThrow();
    await withOrganization(db, a.organizationId, (tx) => tx.insert(moduleRequests).values({ organizationId: a.organizationId, moduleKey: "guests", requestedByUserId: a.ownerId, requestedAt: new Date() }));
    await expect(
      withOrganization(db, a.organizationId, (tx) => tx.insert(moduleRequests).values({ organizationId: a.organizationId, moduleKey: "guests", requestedByUserId: a.ownerId, requestedAt: new Date() })),
    ).rejects.toThrow();
  });

  it("le rôle applicatif ne supprime aucune demande (trace gardée)", async () => {
    const { organizationId, ownerId } = await atelier();
    const request = await requestModuleActivation(db, { organizationId, userId: ownerId, moduleKey: "floorplans" });
    await expect(withOrganization(db, organizationId, (tx) => tx.delete(moduleRequests).where(eq(moduleRequests.id, request.id)))).rejects.toThrow();
  });
});
