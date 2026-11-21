// Lot 63g (HUB-06, HUB-15, HUB-27, ARC-06, ARC-07, SEC-09 ; ADR 0108) — demandes d'activation d'une app
// pendant le pilote. Exposé seulement par service.ts (ADR 0011).
//
// - La Propriétaire demande une app non activée depuis l'écran « Apps », sans champ libre : seuls la clé
//   du module et la date partent à l'Exploitation (SEC-09). Elle annule tant que la demande attend.
// - L'Exploitation voit les demandes en attente (organisation, module, date ; jamais la personne) et
//   active l'app, ou la classe sans l'activer.
// - Dès qu'un module s'ouvre (réglage de l'Exploitation ou abonnement), ses demandes en attente sont
//   closes et la Propriétaire reçoit une notification qui mène à l'app (HUB-15) ; le module apparaît à
//   la requête suivante (ARC-06, isModuleEnabled relu à chaque requête).
// - Libre-service ouvert (ADR 0101), on n'envoie plus de demande : l'écran propose « Ajouter à mon
//   abonnement » ; sauf sous le forfait Pilote, que la planner ne change pas elle-même.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { listTeam } from "@symbola/auth";
import { recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { moduleRequests, organizationSubscriptions } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { starterAppCatalog } from "@symbola/starter-templates";
import { isFeatureEnabled } from "./feature-flags";
import { isModuleKey, moduleEnabledByDefault } from "./module-registry";
import { notify } from "./notifications";
import { getPlanCatalog } from "./plan-catalog";
import { findOrganizationModule, listAllOrganizations } from "./repository";
import { findPlan } from "./subscription-rules";

export type ModuleRequestStatus = (typeof moduleRequests.$inferSelect)["status"];

export type ModuleRequestView = { id: string; moduleKey: string; status: ModuleRequestStatus; requestedAt: Date; handledAt: Date | null };

// Ce que lit l'Exploitation : l'organisation, l'app demandée et la date, rien d'autre (SEC-09).
export type PendingModuleRequest = { organizationId: string; moduleKey: string; requestedAt: Date };

export type ModuleRequestRefusal = "forbidden" | "unknown_module" | "already_enabled" | "self_service" | "not_found";

export class ModuleRequestError extends Error {
  constructor(readonly reason: ModuleRequestRefusal) {
    super(`demande d'activation refusée : ${reason}`);
    this.name = "ModuleRequestError";
  }
}

// Comment l'écran « Apps » ouvre une app : par une demande (pilote) ou par l'abonnement (libre-service).
export type ModuleActivationPath = "request" | "subscription";

function toView(row: typeof moduleRequests.$inferSelect): ModuleRequestView {
  return { id: row.id, moduleKey: row.moduleKey, status: row.status, requestedAt: row.requestedAt, handledAt: row.handledAt };
}

async function assertOwner(db: AppDatabase, organizationId: string, userId: string): Promise<void> {
  const member = (await listTeam(db, organizationId)).find((candidate) => candidate.id === userId);
  if (!member || member.role !== "owner" || member.disabledAt) throw new ModuleRequestError("forbidden");
}

async function moduleOpen(db: AppDatabase, organizationId: string, moduleKey: string): Promise<boolean> {
  return (await findOrganizationModule(db, organizationId, moduleKey))?.enabled ?? moduleEnabledByDefault(moduleKey);
}

// L'écran de l'app une fois activée (plans.json), où mène la notification.
export function appHref(moduleKey: string): string {
  return starterAppCatalog().find((app) => app.key === moduleKey)?.href ?? "/apps";
}

// Libre-service fermé, ou forfait Pilote : une demande. Sinon : l'abonnement.
export async function moduleActivationPath(db: AppDatabase, organizationId: string): Promise<ModuleActivationPath> {
  if (!(await isFeatureEnabled(db, organizationId, "subscription_self_service"))) return "request";
  const [subscription] = await withOrganization(db, organizationId, (tx) =>
    tx.select({ planKey: organizationSubscriptions.planKey }).from(organizationSubscriptions).where(eq(organizationSubscriptions.organizationId, organizationId)),
  );
  if (subscription && findPlan(await getPlanCatalog(db), subscription.planKey)?.kind === "pilot") return "request";
  return "subscription";
}

// La dernière demande de chaque app, la plus récente d'abord.
export async function listModuleRequests(db: AppDatabase, organizationId: string): Promise<ModuleRequestView[]> {
  const rows = await withOrganization(db, organizationId, (tx) =>
    tx.select().from(moduleRequests).where(eq(moduleRequests.organizationId, organizationId)).orderBy(desc(moduleRequests.requestedAt), desc(moduleRequests.createdAt)),
  );
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.moduleKey) ? false : (seen.add(row.moduleKey), true))).map(toView);
}

export async function requestModuleActivation(db: AppDatabase, input: { organizationId: string; userId: string; moduleKey: string; now?: Date }): Promise<ModuleRequestView> {
  const now = input.now ?? new Date();
  await assertOwner(db, input.organizationId, input.userId);
  if (!isModuleKey(input.moduleKey)) throw new ModuleRequestError("unknown_module");
  if (await moduleOpen(db, input.organizationId, input.moduleKey)) throw new ModuleRequestError("already_enabled");
  if ((await moduleActivationPath(db, input.organizationId)) !== "request") throw new ModuleRequestError("self_service");
  const { row, created } = await withOrganization(db, input.organizationId, async (tx) => {
    const [inserted] = await tx
      .insert(moduleRequests)
      .values({ organizationId: input.organizationId, moduleKey: input.moduleKey, requestedByUserId: input.userId, requestedAt: now })
      .onConflictDoNothing()
      .returning();
    if (inserted) return { row: inserted, created: true };
    // Déjà demandée : la demande en attente reste la seule.
    const [pending] = await tx
      .select()
      .from(moduleRequests)
      .where(and(eq(moduleRequests.organizationId, input.organizationId), eq(moduleRequests.moduleKey, input.moduleKey), eq(moduleRequests.status, "pending")));
    return { row: pending!, created: false };
  });
  if (created) {
    await recordAudit(db, { organizationId: input.organizationId, action: "hub.module_request.created", objectId: input.organizationId, details: { module: input.moduleKey }, actor: { kind: "member", id: input.userId } });
  }
  return toView(row);
}

// Une demande d'une autre organisation, ou déjà close, répond comme inexistante.
export async function cancelModuleRequest(db: AppDatabase, input: { organizationId: string; userId: string; requestId: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await assertOwner(db, input.organizationId, input.userId);
  const updated = await withOrganization(db, input.organizationId, (tx) =>
    tx
      .update(moduleRequests)
      .set({ status: "cancelled", handledAt: now })
      .where(and(eq(moduleRequests.id, input.requestId), eq(moduleRequests.organizationId, input.organizationId), eq(moduleRequests.status, "pending")))
      .returning({ moduleKey: moduleRequests.moduleKey }),
  );
  if (updated.length === 0) throw new ModuleRequestError("not_found");
  await recordAudit(db, { organizationId: input.organizationId, action: "hub.module_request.cancelled", objectId: input.organizationId, details: { module: updated[0]!.moduleKey }, actor: { kind: "member", id: input.userId } });
}

// L'Exploitation : les demandes en attente de toutes les organisations, lues organisation par
// organisation (RLS), les plus anciennes d'abord ; ni la personne ni l'identifiant de la demande.
export async function listPendingModuleRequests(db: AppDatabase): Promise<PendingModuleRequest[]> {
  const organizations = await listAllOrganizations(db);
  const pending: PendingModuleRequest[] = [];
  for (const organization of organizations) {
    const rows = await withOrganization(db, organization.id, (tx) =>
      tx
        .select({ organizationId: moduleRequests.organizationId, moduleKey: moduleRequests.moduleKey, requestedAt: moduleRequests.requestedAt })
        .from(moduleRequests)
        .where(and(eq(moduleRequests.organizationId, organization.id), eq(moduleRequests.status, "pending")))
        .orderBy(asc(moduleRequests.requestedAt)),
    );
    pending.push(...rows.map((row) => ({ organizationId: row.organizationId, moduleKey: row.moduleKey, requestedAt: row.requestedAt })));
  }
  return pending.sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
}

// L'Exploitation classe une demande sans activer l'app (la planner peut redemander).
export async function declineModuleRequest(db: AppDatabase, input: { adminUserId: string; organizationId: string; moduleKey: string; now?: Date }): Promise<number> {
  const now = input.now ?? new Date();
  const updated = await withOrganization(db, input.organizationId, (tx) =>
    tx
      .update(moduleRequests)
      .set({ status: "declined", handledAt: now })
      .where(and(eq(moduleRequests.organizationId, input.organizationId), eq(moduleRequests.moduleKey, input.moduleKey), eq(moduleRequests.status, "pending")))
      .returning({ id: moduleRequests.id }),
  );
  if (updated.length > 0) {
    await recordAudit(db, { organizationId: input.organizationId, action: "hub.module_request.declined", objectId: input.organizationId, details: { module: input.moduleKey }, actor: { kind: "admin", id: input.adminUserId } });
  }
  return updated.length;
}

// Des modules viennent de s'ouvrir : leurs demandes en attente sont closes, et la Propriétaire reçoit
// une notification par demande (une seule fois : l'objet est la demande).
export async function settleModuleRequests(db: AppDatabase, input: { organizationId: string; moduleKeys: readonly string[]; now?: Date }): Promise<number> {
  if (input.moduleKeys.length === 0) return 0;
  const now = input.now ?? new Date();
  const settled = await withOrganization(db, input.organizationId, (tx) =>
    tx
      .update(moduleRequests)
      .set({ status: "activated", handledAt: now })
      .where(and(eq(moduleRequests.organizationId, input.organizationId), eq(moduleRequests.status, "pending"), inArray(moduleRequests.moduleKey, [...input.moduleKeys])))
      .returning({ id: moduleRequests.id, moduleKey: moduleRequests.moduleKey }),
  );
  for (const request of settled) {
    await recordAudit(db, { organizationId: input.organizationId, action: "hub.module_request.activated", objectId: input.organizationId, details: { module: request.moduleKey }, actor: { kind: "system", id: null } });
    await notify({ organizationId: input.organizationId, type: "module_activated", eventId: null, objectKey: `module_request:${request.id}`, params: { module: request.moduleKey }, href: appHref(request.moduleKey), now });
  }
  return settled.length;
}
