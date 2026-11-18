// Lot 45 (CRM-07 ; D5 ; ADR 0090) — à réception de hub.contact.merged, le module events repointe ses
// références de la fiche absorbée vers la fiche gardée : clients des évènements, liens personnels,
// messages, relances, questionnaires. Idempotent (rejouer ne change rien) ; les évènements à la
// corbeille suivent aussi (ADR 0073). Quand les deux fiches sont clientes du même évènement, la ligne de
// la fiche absorbée disparaît et ses liens passent à celle de la fiche gardée : l'historique entier
// reste (critère CRM-07). Exposé seulement par service.ts (ADR 0011).
import { and, count, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { includingDeleted } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { eventClients, eventLinks, eventMessages, eventQuestionnaires, prospectFollowUps } from "@symbola/db/schema/events";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function repointMergedContact(organizationId: string, absorbedContactId: string, keptContactId: string): Promise<number> {
  if (!UUID.test(absorbedContactId) || !UUID.test(keptContactId) || absorbedContactId === keptContactId) return 0;
  return includingDeleted(() =>
    withOrganization(appDatabase(), organizationId, async (tx) => {
      let moved = 0;
      const absorbedRows = await tx.select().from(eventClients).where(eq(eventClients.contactId, absorbedContactId));
      if (absorbedRows.length > 0) {
        const keptRows = await tx
          .select()
          .from(eventClients)
          .where(and(eq(eventClients.contactId, keptContactId), inArray(eventClients.eventId, absorbedRows.map((row) => row.eventId))));
        for (const row of absorbedRows) {
          const twin = keptRows.find((candidate) => candidate.eventId === row.eventId);
          if (twin) {
            await tx.update(eventLinks).set({ eventClientId: twin.id }).where(eq(eventLinks.eventClientId, row.id));
            await tx.delete(eventClients).where(eq(eventClients.id, row.id));
          } else {
            await tx.update(eventClients).set({ contactId: keptContactId }).where(eq(eventClients.id, row.id));
          }
          moved += 1;
        }
      }
      for (const table of [eventLinks, eventMessages, prospectFollowUps, eventQuestionnaires] as const) {
        const updated = await tx.update(table).set({ contactId: keptContactId }).where(eq(table.contactId, absorbedContactId)).returning({ id: table.id });
        moved += updated.length;
      }
      return moved;
    }),
  );
}

// L'écran de confirmation d'une fusion : ce que les deux fiches réunissent dans le module events.
export async function countEventsContactReferences(organizationId: string, contactId: string): Promise<{ events: number; links: number; messages: number; questionnaires: number }> {
  if (!UUID.test(contactId)) return { events: 0, links: 0, messages: 0, questionnaires: 0 };
  return includingDeleted(() =>
    withOrganization(appDatabase(), organizationId, async (tx) => {
      const [clients] = await tx.select({ value: count() }).from(eventClients).where(eq(eventClients.contactId, contactId));
      const [links] = await tx.select({ value: count() }).from(eventLinks).where(eq(eventLinks.contactId, contactId));
      const [messages] = await tx.select({ value: count() }).from(eventMessages).where(and(eq(eventMessages.contactId, contactId), isNotNull(eventMessages.contactId), ne(eventMessages.kind, "stop")));
      const [questionnaires] = await tx.select({ value: count() }).from(eventQuestionnaires).where(eq(eventQuestionnaires.contactId, contactId));
      return { events: clients?.value ?? 0, links: links?.value ?? 0, messages: messages?.value ?? 0, questionnaires: questionnaires?.value ?? 0 };
    }),
  );
}
