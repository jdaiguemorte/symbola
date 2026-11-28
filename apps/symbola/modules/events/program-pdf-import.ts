// Lot 71e (CHR-06, CHR-08, HUB-14 ; spécification du lot 71, § 5.5 ; maquette 11, D5, R11 à R15) — le
// programme du jour J repris du PDF d'un logiciel de planning, par l'assistant commun des imports. Le
// hub garde le brouillon (ce qui a été lu) ; ce module propose un poste à chaque intervenant de
// l'en-tête (lot 63b), range chaque moment dans sa journée (« Veille », « Jour J », « Lendemain », ou la
// date, règle du lot 67d) et écrit : les journées manquantes, puis les moments à la suite, chacun avec
// sa forme (une fin jamais déduite ; un repère sans durée). Chaque élément écrit est rendu au journal,
// pour que « Retirer cet import… » défasse tout.
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { events, eventVendorCandidates, eventVendorSlots, keyMoments, programItemParticipants, programItems } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { textSimilarity, type ProgramExport } from "@symbola/import-engine";
import { planningSoftwareProfile, starterVendorTypeSynonymGroups } from "@symbola/starter-templates";
import type { ImportedItem, ProgramImportRow, ProgramImportSpeaker } from "@symbola/contracts";
import { DAY_UUID } from "./day-of";
import { dayMomentName, foldText, programRowsFromExport, proposeSpeakerSlot, speakerKind, type DayMomentNames, type ProgramSlotOption } from "./program-import-rules";

export type ImportedProgramPreview = {
  eventDate: string | null;
  rows: ProgramImportRow[];
  problems: { line: number; problem: string }[];
  speakers: ProgramImportSpeaker[];
  slots: ProgramSlotOption[];
  // Les journées du fichier sans temps fort : l'import les crée, à leur nom.
  newMoments: { name: string; date: string }[];
};

// L'aperçu d'un programme lu : null quand l'évènement n'est pas de l'organisation (SEC-13).
export async function previewImportedProgram(input: {
  organizationId: string;
  eventId: string;
  program: ProgramExport;
  // Le poste choisi par la planner pour chaque intervenant de l'en-tête (null : en texte).
  speakerSlots: Record<number, string | null>;
  catalogVendors: { id: string; name: string; city: string | null }[];
  dayNames: DayMomentNames;
}): Promise<ImportedProgramPreview | null> {
  if (!DAY_UUID.test(input.eventId)) return null;
  const context = await withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id, eventDate: events.eventDate }).from(events).where(and(eq(events.id, input.eventId), eq(events.isDemo, false)));
    if (!event) return null;
    const moments = await tx.select({ date: keyMoments.date }).from(keyMoments).where(and(eq(keyMoments.eventId, input.eventId), isNull(keyMoments.deletedAt)));
    const slotRows = await tx.select({ id: eventVendorSlots.id, label: eventVendorSlots.label }).from(eventVendorSlots).where(eq(eventVendorSlots.eventId, input.eventId)).orderBy(eventVendorSlots.position);
    const vendorRows =
      slotRows.length > 0
        ? await tx
            .select({ slotId: eventVendorCandidates.vendorSlotId, name: eventVendorCandidates.vendorName })
            .from(eventVendorCandidates)
            .where(and(inArray(eventVendorCandidates.vendorSlotId, slotRows.map((slot) => slot.id)), ne(eventVendorCandidates.status, "dismissed")))
        : [];
    const slots: ProgramSlotOption[] = slotRows.map((slot) => ({ ...slot, vendorNames: vendorRows.filter((vendor) => vendor.slotId === slot.id).map((vendor) => vendor.name) }));
    return { eventDate: event.eventDate, momentDates: new Set(moments.map((moment) => moment.date)), slots };
  });
  if (!context) return null;
  const profile = planningSoftwareProfile().programExport;
  const slotIds = new Set(context.slots.map((slot) => slot.id));
  const synonyms = starterVendorTypeSynonymGroups();
  const speakers: ProgramImportSpeaker[] = input.program.speakers.map((speaker, index) => {
    const kind = speakerKind(speaker, profile);
    const proposedSlotId = kind === "vendor" ? proposeSpeakerSlot(speaker, context.slots, synonyms) : null;
    const chosen = kind === "vendor" && Object.hasOwn(input.speakerSlots, index);
    const choice = chosen ? input.speakerSlots[index]! : proposedSlotId;
    const slotId = choice && slotIds.has(choice) ? choice : null;
    const names = [speaker.company, speaker.contact].filter((name): name is string => Boolean(name));
    const catalogVendor = kind === "vendor" && !slotId ? (input.catalogVendors.find((vendor) => names.some((name) => textSimilarity(vendor.name, name) >= 0.85)) ?? null) : null;
    return { index, ...speaker, kind, proposedSlotId, slotId, chosen, catalogVendor };
  });
  const speakerSlots = new Map(speakers.map((speaker) => [speaker.index, speaker.slotId] as const));
  const slotLabels = new Map(context.slots.map((slot) => [slot.id, slot.label] as const));
  const { rows, problems } = programRowsFromExport(input.program, { eventDate: context.eventDate }, speakerSlots, slotLabels);
  const newMoments = [...new Set(rows.map((row) => row.momentDate).filter((date): date is string => date !== null))]
    .filter((date) => !context.momentDates.has(date))
    .sort()
    .map((date) => ({ name: dayMomentName(date, context.eventDate, input.dayNames), date }));
  return { eventDate: context.eventDate, rows, problems, speakers, slots: context.slots, newMoments };
}

const momentKey = (date: string, name: string) => `${date}|${foldText(name)}`;

// L'écriture : les journées qui manquent (au nom de leur jour), puis les moments à la suite, avec leurs
// interlocuteurs (un poste de l'évènement, vérifié, ou un texte). Rendus au journal dans l'ordre
// d'écriture : la journée avant ses moments.
export async function writeImportedProgram(input: {
  organizationId: string;
  eventId: string;
  rows: readonly ProgramImportRow[];
  dayNames: DayMomentNames;
}): Promise<{ items: ImportedItem[]; moments: number; count: number } | null> {
  if (!DAY_UUID.test(input.eventId)) return null;
  return withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id, eventDate: events.eventDate }).from(events).where(and(eq(events.id, input.eventId), eq(events.isDemo, false)));
    if (!event) return null;
    const existing = await tx.select({ id: keyMoments.id, name: keyMoments.name, date: keyMoments.date }).from(keyMoments).where(and(eq(keyMoments.eventId, input.eventId), isNull(keyMoments.deletedAt))).orderBy(keyMoments.position);
    const slotIds = new Set((await tx.select({ id: eventVendorSlots.id }).from(eventVendorSlots).where(eq(eventVendorSlots.eventId, input.eventId))).map((slot) => slot.id));
    const byDate = new Map<string, string>();
    for (const moment of existing) if (!byDate.has(moment.date)) byDate.set(moment.date, moment.id);
    const named = new Map(existing.map((moment) => [momentKey(moment.date, moment.name), moment.id] as const));
    const items: ImportedItem[] = [];
    let createdMoments = 0;
    let position = existing.length;
    for (const row of input.rows) {
      let keyMomentId: string | null = null;
      if (row.momentDate) {
        keyMomentId = row.moment ? (named.get(momentKey(row.momentDate, row.moment)) ?? null) : (byDate.get(row.momentDate) ?? null);
        if (!keyMomentId) {
          const name = row.moment ?? dayMomentName(row.momentDate, event.eventDate, input.dayNames);
          const [created] = await tx.insert(keyMoments).values({ organizationId: input.organizationId, eventId: input.eventId, name, date: row.momentDate, position }).returning({ id: keyMoments.id });
          keyMomentId = created!.id;
          position += 1;
          createdMoments += 1;
          byDate.set(row.momentDate, keyMomentId);
          named.set(momentKey(row.momentDate, name), keyMomentId);
          items.push({ rowIndex: row.line, module: "events", kind: "key_moment", elementId: keyMomentId, action: "created", previous: null, written: { name, date: row.momentDate } });
        }
      }
      const timing = row.timing ?? "span";
      const [item] = await tx
        .insert(programItems)
        .values({
          organizationId: input.organizationId,
          eventId: input.eventId,
          keyMomentId,
          startTime: row.startTime,
          endTime: row.endTime,
          label: row.label,
          location: row.location,
          responsible: row.responsible?.slice(0, 120) ?? null,
          internalNote: row.note,
          hiddenFromClients: row.hiddenFromClients === true,
          timing,
        })
        .returning({ id: programItems.id });
      const participants = (row.participants ?? []).filter((participant) => participant.vendorSlotId === null || slotIds.has(participant.vendorSlotId));
      if (participants.length > 0) {
        await tx.insert(programItemParticipants).values(
          participants.map((participant, index) => ({
            organizationId: input.organizationId,
            programItemId: item!.id,
            vendorSlotId: participant.vendorSlotId,
            freeLabel: participant.vendorSlotId ? null : participant.label,
            position: index,
          })),
        );
      }
      items.push({
        rowIndex: row.line,
        module: "events",
        kind: "program_item",
        elementId: item!.id,
        action: "created",
        previous: null,
        written: { keyMomentId, startTime: row.startTime, endTime: row.endTime, label: row.label, timing, hiddenFromClients: row.hiddenFromClients === true },
      });
    }
    if (input.rows.length > 0) await tx.update(events).set({ programUpdatedAt: new Date() }).where(eq(events.id, input.eventId));
    return { items, moments: createdMoments, count: input.rows.length };
  });
}
