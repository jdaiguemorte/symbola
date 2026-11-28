// Lot 71e (CHR-06, CHR-08 ; spécification du lot 71, § 5.5, critères 6 et 7 ; maquette 11, D5, R12, R13) —
// un programme repris (d'un PDF, ou dans un mariage repris) n'invente aucune fin : tant qu'un moment à
// durée n'a pas d'heure de fin, l'onglet le dit (« À compléter : 5 heures de fin non renseignées »), la
// diffusion passe par une fenêtre qui le dit, et les destinataires lisent « heure de fin à venir ». Deux
// gestes par manque : saisir l'heure de fin, ou dire que le moment est « Ponctuel » (retiré du compte).
// Un programme créé dans Symbola garde ses règles (une séquence sans fin n'est pas un manque).
import { and, eq, isNull } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { events, programItems } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { eventHasAppliedPdfImport } from "@/modules/hub/service";
import { DAY_UUID } from "./day-of";

export type ProgramGapItem = { id: string; label: string; startTime: string; keyMomentId: string | null };

// Les moments sans fin qui en attendent une : à durée (ni ponctuels, ni repères), sans heure de fin.
export function missingEndItems<T extends { timing?: "span" | "point" | "marker"; endTime: string | null }>(items: readonly T[]): T[] {
  return items.filter((item) => (item.timing ?? "span") === "span" && item.endTime === null);
}

export async function programAwaitsEnds(organizationId: string, eventId: string): Promise<boolean> {
  if (!DAY_UUID.test(eventId)) return false;
  const [event] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ origin: events.origin }).from(events).where(eq(events.id, eventId)));
  if (!event) return false;
  if (event.origin === "takeover") return true;
  return eventHasAppliedPdfImport(appDatabase(), organizationId, eventId, "program");
}

export class ProgramGapInvalidError extends Error {
  constructor() {
    super("moment du programme ou heure invalide");
    this.name = "ProgramGapInvalidError";
  }
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

// « Heure de fin » ou « Ponctuel » sur un moment de ce mariage ; un moment d'un autre mariage (ou d'une
// autre organisation, RLS) est inconnu.
export async function completeProgramItem(organizationId: string, eventId: string, itemId: string, change: { endTime: string } | { timing: "point" }): Promise<void> {
  if (!DAY_UUID.test(eventId) || !DAY_UUID.test(itemId)) throw new ProgramGapInvalidError();
  if ("endTime" in change && !CLOCK.test(change.endTime)) throw new ProgramGapInvalidError();
  await withOrganization(appDatabase(), organizationId, async (tx) => {
    const updated = await tx
      .update(programItems)
      .set({ ...("endTime" in change ? { endTime: change.endTime, timing: "span" as const } : { timing: "point" as const }), updatedAt: new Date() })
      .where(and(eq(programItems.id, itemId), eq(programItems.eventId, eventId), isNull(programItems.deletedAt)))
      .returning({ id: programItems.id });
    if (updated.length === 0) throw new ProgramGapInvalidError();
    await tx.update(events).set({ programUpdatedAt: new Date() }).where(eq(events.id, eventId));
  });
}
