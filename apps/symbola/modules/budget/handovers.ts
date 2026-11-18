// Lot 51 (JRJ-09 ; D8, ADR 0091) — paiements à remettre le jour J. Une échéance de prestataire peut
// être marquée « à remettre le jour J » (chèque, espèces, enveloppe : moyen libre, choisi parmi ceux
// de l'organisation, et la personne qui remet). Le mode Jour J en montre la liste ; chaque remise se
// pointe (qui, quand, photo du reçu facultative) et règle l'échéance : son montant se fige et le payé
// de la ligne suit, comme un paiement noté par la planner (D13 du lot 28b). La première remise reçue
// reste : une action rejouée, ou un second pointage, est ignorée. Accès aux données du module
// budget ; exposé seulement par service.ts (ADR 0011).
import { and, eq, isNull } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { vendorPayments } from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
export type HandoverRow = typeof vendorPayments.$inferSelect;

export const HANDOVER_METHOD_MAX = 80;
export const HANDOVER_BY_MAX = 120;

export class VendorPaymentHandoverInvalidError extends Error {
  constructor(readonly reason: "method" | "by" | "handed_over") {
    super(`remise du jour J invalide : ${reason}`);
    this.name = "VendorPaymentHandoverInvalidError";
  }
}

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

const oneLine = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

export function handoverValues(input: { method: string | null; by: string | null }): { method: string | null; by: string | null } {
  const method = oneLine(input.method) || null;
  const by = oneLine(input.by) || null;
  if (method !== null && method.length > HANDOVER_METHOD_MAX) throw new VendorPaymentHandoverInvalidError("method");
  if (by !== null && by.length > HANDOVER_BY_MAX) throw new VendorPaymentHandoverInvalidError("by");
  return { method, by };
}

// Marquer (ou retirer la marque). Une échéance déjà remise garde sa remise : la marque ne se retire
// plus (la preuve reste).
export async function setHandoverRow(input: { organizationId: string; eventId: string; paymentId: string; onDay: boolean; method: string | null; by: string | null }): Promise<HandoverRow | null> {
  return inOrganization(input.organizationId, async (tx) => {
    const [current] = await tx.select().from(vendorPayments).where(and(eq(vendorPayments.id, input.paymentId), eq(vendorPayments.eventId, input.eventId)));
    if (!current) return null;
    if (current.handedOverAt && !input.onDay) throw new VendorPaymentHandoverInvalidError("handed_over");
    const [row] = await tx
      .update(vendorPayments)
      .set({ handoverOnDay: input.onDay, handoverMethod: input.onDay ? input.method : null, handoverBy: input.onDay ? input.by : null, updatedAt: new Date() })
      .where(eq(vendorPayments.id, current.id))
      .returning();
    return row ?? null;
  });
}

export async function findHandoverRows(organizationId: string, eventId: string): Promise<HandoverRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(vendorPayments).where(and(eq(vendorPayments.eventId, eventId), eq(vendorPayments.handoverOnDay, true))));
}

// Pointe la remise une seule fois ; « duplicate » si l'échéance est déjà remise (même action ou
// autre pointage), « not_found » si elle n'est pas à remettre ce jour J pour cet évènement.
export async function recordHandoverRow(input: {
  organizationId: string;
  eventId: string;
  paymentId: string;
  userId: string;
  actionId: string;
  handedOverAt: Date;
}): Promise<{ status: "applied"; row: HandoverRow } | { status: "duplicate" | "not_found" }> {
  return inOrganization(input.organizationId, async (tx) => {
    const [current] = await tx
      .select()
      .from(vendorPayments)
      .where(and(eq(vendorPayments.id, input.paymentId), eq(vendorPayments.eventId, input.eventId), eq(vendorPayments.handoverOnDay, true)));
    if (!current) return { status: "not_found" as const };
    if (current.handedOverAt) return { status: "duplicate" as const };
    const [row] = await tx
      .update(vendorPayments)
      .set({ handedOverAt: input.handedOverAt, handedOverBy: input.userId, handoverActionId: input.actionId, updatedAt: new Date() })
      .where(and(eq(vendorPayments.id, current.id), isNull(vendorPayments.handedOverAt)))
      .returning();
    return row ? { status: "applied" as const, row } : { status: "duplicate" as const };
  });
}

// La photo du reçu (tenue par le module events) se rattache à la remise ; la première reste.
export async function attachHandoverReceiptRow(input: { organizationId: string; eventId: string; paymentId: string; photoId: string }): Promise<boolean> {
  const rows = await inOrganization(input.organizationId, (tx) =>
    tx
      .update(vendorPayments)
      .set({ handoverReceiptPhotoId: input.photoId, updatedAt: new Date() })
      .where(and(eq(vendorPayments.id, input.paymentId), eq(vendorPayments.eventId, input.eventId), eq(vendorPayments.handoverOnDay, true), isNull(vendorPayments.handoverReceiptPhotoId)))
      .returning({ id: vendorPayments.id }),
  );
  return rows.length > 0;
}

export async function handoverPaymentOfEvent(organizationId: string, eventId: string, paymentId: string): Promise<boolean> {
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .select({ id: vendorPayments.id })
      .from(vendorPayments)
      .where(and(eq(vendorPayments.id, paymentId), eq(vendorPayments.eventId, eventId), eq(vendorPayments.handoverOnDay, true))),
  );
  return Boolean(row);
}
