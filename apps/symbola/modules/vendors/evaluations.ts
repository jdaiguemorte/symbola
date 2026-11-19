// Lot 58 (PRE-08 ; ADR 0097) — évaluation d'un prestataire après un évènement et historique des
// collaborations : une évaluation par prestataire et par évènement (uuid opaque du module events,
// ADR 0011), modifiable ; l'historique donne les notes, la moyenne et la dernière collaboration.
// Toujours interne : aucune route de lien (client, prestataire), aucun écran du Comptable, aucun export
// vers un tiers ne lit cette table.
import { and, desc, eq, inArray } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { vendorEvaluations, vendors } from "@symbola/db/schema/vendors";
import { averageTenths, cleanEvaluation, type EvaluationInput } from "./evaluation-rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export class EvaluationVendorNotFoundError extends Error {
  constructor() {
    super("prestataire introuvable");
    this.name = "EvaluationVendorNotFoundError";
  }
}

export type VendorEvaluation = EvaluationInput & { id: string; vendorId: string; eventId: string; evaluatedAt: string; evaluatedBy: string | null };

function toView(row: typeof vendorEvaluations.$inferSelect): VendorEvaluation {
  return {
    id: row.id,
    vendorId: row.vendorId,
    eventId: row.eventId,
    rating: row.rating,
    punctuality: row.punctuality,
    quality: row.quality,
    value: row.value,
    comment: row.comment,
    evaluatedAt: row.evaluatedAt.toISOString(),
    evaluatedBy: row.evaluatedBy,
  };
}

export async function evaluateVendor(organizationId: string, input: EvaluationInput & { vendorId: string; eventId: string; userId: string; now?: Date }): Promise<VendorEvaluation> {
  if (!UUID.test(input.vendorId) || !UUID.test(input.eventId)) throw new EvaluationVendorNotFoundError();
  const clean = cleanEvaluation(input);
  const now = input.now ?? new Date();
  return inOrganization(organizationId, async (tx) => {
    const [vendor] = await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, input.vendorId));
    if (!vendor) throw new EvaluationVendorNotFoundError();
    const values = { ...clean, evaluatedBy: input.userId, evaluatedAt: now };
    const [row] = await tx
      .insert(vendorEvaluations)
      .values({ organizationId, vendorId: input.vendorId, eventId: input.eventId, ...values })
      .onConflictDoUpdate({ target: [vendorEvaluations.vendorId, vendorEvaluations.eventId], set: { ...values, updatedAt: now } })
      .returning();
    return toView(row!);
  });
}

export async function listEventEvaluations(organizationId: string, eventId: string, vendorIds?: readonly string[]): Promise<VendorEvaluation[]> {
  if (!UUID.test(eventId)) return [];
  const ids = vendorIds?.filter((id) => UUID.test(id));
  if (ids && ids.length === 0) return [];
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(vendorEvaluations)
      .where(and(eq(vendorEvaluations.eventId, eventId), ids ? inArray(vendorEvaluations.vendorId, ids) : undefined)),
  );
  return rows.map(toView);
}

export type CollaborationHistory = { evaluations: VendorEvaluation[]; count: number; averageTenths: number | null; lastEvaluatedAt: string | null };

export async function getVendorCollaborationHistory(organizationId: string, vendorId: string): Promise<CollaborationHistory> {
  if (!UUID.test(vendorId)) return { evaluations: [], count: 0, averageTenths: null, lastEvaluatedAt: null };
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(vendorEvaluations).where(eq(vendorEvaluations.vendorId, vendorId)).orderBy(desc(vendorEvaluations.evaluatedAt)));
  const evaluations = rows.map(toView);
  return { evaluations, count: evaluations.length, averageTenths: averageTenths(evaluations.map((evaluation) => evaluation.rating)), lastEvaluatedAt: evaluations[0]?.evaluatedAt ?? null };
}
