// Lot 48a (DAT-08 ; D5, ADR 0093) — notes d'évènement marquées confidentielles : chiffrées au niveau
// du champ (field-box, ADR 0079), lues, changées ou décochées par la titulaire et leur auteur seuls.
// Une note confidentielle sort des recherches, des exports et du droit d'accès des tiers (lien
// client ou prestataire) : notes est vide en base. Les rôles par évènement viendront du lot 52.
import { openField, sealField, type FieldPlace } from "@symbola/auth";
import { EventNotFoundError } from "./errors";
import { findEventNotesRow, writeEventNotesRow } from "./repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 10_000;

export type EventNotesViewer = { userId: string; role: "owner" | "member" | "admin" };

export class EventNotesForbiddenError extends Error {
  constructor() {
    super("notes confidentielles réservées à la titulaire et à leur auteur");
    this.name = "EventNotesForbiddenError";
  }
}

function notesPlace(organizationId: string, eventId: string): FieldPlace {
  return { organizationId, table: "events.events", column: "notes_sealed", rowId: eventId };
}

function allowed(viewer: EventNotesViewer, authorUserId: string | null): boolean {
  return viewer.role === "owner" || (authorUserId !== null && viewer.userId === authorUserId);
}

export async function readEventConfidentialNotes(organizationId: string, eventId: string, viewer: EventNotesViewer): Promise<string | null> {
  const row = UUID.test(eventId) ? await findEventNotesRow(organizationId, eventId) : null;
  if (!row) throw new EventNotFoundError();
  if (!row.notesSealed) return null;
  if (!allowed(viewer, row.notesConfidentialBy)) throw new EventNotesForbiddenError();
  return openField(row.notesSealed, notesPlace(organizationId, eventId));
}

export async function saveEventNotes(organizationId: string, eventId: string, input: { notes: string | null; confidential: boolean }, viewer: EventNotesViewer): Promise<void> {
  const row = UUID.test(eventId) ? await findEventNotesRow(organizationId, eventId) : null;
  if (!row) throw new EventNotFoundError();
  if (row.notesSealed && !allowed(viewer, row.notesConfidentialBy)) throw new EventNotesForbiddenError();
  const notes = input.notes?.replace(/\r\n/g, "\n").trim() ?? "";
  if (notes.length > MAX) throw new RangeError("texte trop long");
  if (input.confidential && notes) {
    await writeEventNotesRow(organizationId, eventId, {
      notes: null,
      notesSealed: sealField(notes, notesPlace(organizationId, eventId)),
      notesConfidentialBy: row.notesSealed ? (row.notesConfidentialBy ?? viewer.userId) : viewer.userId,
    });
  } else {
    await writeEventNotesRow(organizationId, eventId, { notes: notes || null, notesSealed: null, notesConfidentialBy: null });
  }
}

// Droit d'accès de la personne (export RGPD) : les notes de son évènement, confidentielles comprises.
export function revealEventNotes(organizationId: string, event: { id: string; notes: string | null; notesSealed: string | null }): string | null {
  return event.notesSealed ? openField(event.notesSealed, notesPlace(organizationId, event.id)) : event.notes;
}
