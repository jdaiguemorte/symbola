// Lot 45 (CRM-07 ; D5 ; ADR 0090) — à réception de hub.contact.merged, le module appointments repointe
// les rendez-vous de la fiche absorbée vers la fiche gardée. Idempotent ; les rendez-vous à la
// corbeille suivent aussi. Exposé seulement par service.ts (ADR 0011).
import { count, eq } from "drizzle-orm";
import { includingDeleted } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { appointments } from "@symbola/db/schema/appointments";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function repointAppointmentsMergedContact(organizationId: string, absorbedContactId: string, keptContactId: string): Promise<number> {
  if (!UUID.test(absorbedContactId) || !UUID.test(keptContactId) || absorbedContactId === keptContactId) return 0;
  return includingDeleted(() =>
    withOrganization(appDatabase(), organizationId, async (tx) => {
      const moved = await tx.update(appointments).set({ contactId: keptContactId }).where(eq(appointments.contactId, absorbedContactId)).returning({ id: appointments.id });
      return moved.length;
    }),
  );
}

export async function countContactAppointments(organizationId: string, contactId: string): Promise<number> {
  if (!UUID.test(contactId)) return 0;
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ value: count() }).from(appointments).where(eq(appointments.contactId, contactId)));
  return row?.value ?? 0;
}
