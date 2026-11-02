// RGPD-03 — trace des demandes d'oubli exécutées (lot 6, ADR 0023). Le hub
// garde le sort de chaque fiche et l'accusé de chaque module ; la demande
// n'est close que quand tous les modules concernés ont répondu. La preuve
// PDF est rendue depuis cette trace (aucune donnée personnelle hormis le
// libellé de la demande, gardé comme preuve de son traitement).
import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { privacyErasures, privacyRequests, type PrivacyErasureAck, type PrivacyErasureItem } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";

export type { PrivacyErasureAck, PrivacyErasureItem };

export class PrivacyErasureNotFoundError extends Error {}
export class PrivacyErasureInvalidError extends Error {
  constructor(readonly code: "request_invalid" | "in_progress" | "empty") {
    super(code);
  }
}

export type PrivacyErasureView = {
  id: string;
  status: "pending" | "partial" | "completed";
  items: PrivacyErasureItem[];
  acks: PrivacyErasureAck[];
  createdAt: Date;
  completedAt: Date | null;
  request: { id: string; personLabel: string; receivedOn: string; dueOn: string; status: string };
};

// Demandes d'oubli en cours, auxquelles une exécution peut être rattachée.
export async function listErasablePrivacyRequests(db: AppDatabase, organizationId: string): Promise<{ id: string; personLabel: string }[]> {
  return withOrganization(db, organizationId, (tx) =>
    tx
      .select({ id: privacyRequests.id, personLabel: privacyRequests.personLabel })
      .from(privacyRequests)
      .where(and(eq(privacyRequests.type, "erasure"), inArray(privacyRequests.status, ["open", "extended"])))
      .orderBy(privacyRequests.dueOn),
  );
}

export async function startPrivacyErasure(
  db: AppDatabase,
  input: { organizationId: string; userId: string; requestId: string; items: PrivacyErasureItem[]; now?: Date },
): Promise<string> {
  if (input.items.length === 0) throw new PrivacyErasureInvalidError("empty");
  return withOrganization(db, input.organizationId, async (tx) => {
    const [request] = await tx
      .select({ id: privacyRequests.id })
      .from(privacyRequests)
      .where(and(eq(privacyRequests.id, input.requestId), eq(privacyRequests.type, "erasure"), inArray(privacyRequests.status, ["open", "extended"])));
    if (!request) throw new PrivacyErasureInvalidError("request_invalid");
    const [unfinished] = await tx
      .select({ id: privacyErasures.id })
      .from(privacyErasures)
      .where(and(eq(privacyErasures.requestId, input.requestId), inArray(privacyErasures.status, ["pending", "partial"])));
    if (unfinished) throw new PrivacyErasureInvalidError("in_progress");
    const [row] = await tx
      .insert(privacyErasures)
      .values({
        organizationId: input.organizationId,
        requestId: input.requestId,
        items: input.items,
        createdByUserId: input.userId,
        ...(input.now ? { createdAt: input.now } : {}),
      })
      .returning({ id: privacyErasures.id });
    if (!row) throw new Error("création de l'exécution d'oubli échouée");
    return row.id;
  });
}

// Accusés des modules : chacun remplace le précédent du même module. Quand
// tous les modules concernés ont répondu, l'exécution est terminée et la
// demande close, dans la même transaction.
export async function recordPrivacyErasureAcks(
  db: AppDatabase,
  input: { organizationId: string; erasureId: string; acks: PrivacyErasureAck[]; now?: Date },
): Promise<PrivacyErasureView["status"]> {
  const now = input.now ?? new Date();
  return withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx.select().from(privacyErasures).where(eq(privacyErasures.id, input.erasureId));
    if (!row) throw new PrivacyErasureNotFoundError();
    if (row.status === "completed") return "completed";
    const byModule = new Map(row.acks.map((ack) => [ack.module, ack]));
    for (const ack of input.acks) byModule.set(ack.module, ack);
    const acks = [...byModule.values()];
    const modules = new Set(row.items.map((item) => item.module));
    const done = [...modules].every((module) => byModule.get(module)?.status === "ok");
    const status = done ? "completed" : "partial";
    await tx
      .update(privacyErasures)
      .set({ acks, status, completedAt: done ? now : null })
      .where(eq(privacyErasures.id, row.id));
    if (done) {
      await tx
        .update(privacyRequests)
        .set({ status: "closed", closedAt: now, updatedAt: now })
        .where(and(eq(privacyRequests.id, row.requestId), inArray(privacyRequests.status, ["open", "extended"])));
    }
    return status;
  });
}

export async function getPrivacyErasure(db: AppDatabase, organizationId: string, erasureId: string): Promise<PrivacyErasureView> {
  const [row] = await withOrganization(db, organizationId, (tx) =>
    tx
      .select({ erasure: privacyErasures, request: privacyRequests })
      .from(privacyErasures)
      .innerJoin(privacyRequests, eq(privacyRequests.id, privacyErasures.requestId))
      .where(eq(privacyErasures.id, erasureId)),
  );
  if (!row) throw new PrivacyErasureNotFoundError();
  return toView(row.erasure, row.request);
}

export async function listPrivacyErasures(db: AppDatabase, organizationId: string): Promise<PrivacyErasureView[]> {
  const rows = await withOrganization(db, organizationId, (tx) =>
    tx
      .select({ erasure: privacyErasures, request: privacyRequests })
      .from(privacyErasures)
      .innerJoin(privacyRequests, eq(privacyRequests.id, privacyErasures.requestId))
      .orderBy(desc(privacyErasures.createdAt)),
  );
  return rows.map((row) => toView(row.erasure, row.request));
}

function toView(erasure: typeof privacyErasures.$inferSelect, request: typeof privacyRequests.$inferSelect): PrivacyErasureView {
  return {
    id: erasure.id,
    status: erasure.status,
    items: erasure.items,
    acks: erasure.acks,
    createdAt: erasure.createdAt,
    completedAt: erasure.completedAt,
    request: { id: request.id, personLabel: request.personLabel, receivedOn: request.receivedOn, dueOn: request.dueOn, status: request.status },
  };
}
