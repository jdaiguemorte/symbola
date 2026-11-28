// Lot 72e (EVT-03, EVT-05, UX-09 ; C-26, D7, M1 ; page 16 des maquettes du lot 68) — « Modifier les
// informations » : les cinq rubriques s'enregistrent d'un coup, tout ou rien (une transaction). La date ne
// se change là que pour une demande, un report ou un évènement encore sans date (E5) ; des notes
// confidentielles ne changent que par leur auteur ou la titulaire (lot 48a), chiffrées avant l'écriture ;
// une modification faite entre-temps n'est pas écrasée (la version lue à l'ouverture, lot 39b). Un
// évènement d'une autre organisation répond comme un évènement inexistant (SEC-13).
import { sealField } from "@symbola/auth";
import { eventDateEditableHere, type EventDetailsInput, type EventDetailsRefusedField } from "@symbola/contracts";
import { isTimeZone } from "@symbola/i18n";
import { isValidBusyRule } from "./busy-ranges";
import { assertEventWritable } from "./closing";
import type { EventNotesViewer } from "./confidential-notes";
import { EventNotFoundError } from "./errors";
import { findEventById, findEventNotesRow, updateEventDetailsRow } from "./repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Un champ refusé : rien n'est enregistré, l'écran mène au champ.
export class EventDetailsRefusedError extends Error {
  constructor(readonly field: EventDetailsRefusedField) {
    super(`informations refusées : ${field}`);
    this.name = "EventDetailsRefusedError";
  }
}

// Quelqu'un a enregistré ces informations depuis l'ouverture de la fenêtre.
export class EventDetailsConflictError extends Error {
  constructor() {
    super("informations modifiées entre-temps");
    this.name = "EventDetailsConflictError";
  }
}

function text(value: string | null, max: number): string | null {
  const clean = value?.replace(/\r\n/g, "\n").trim() ?? "";
  if (clean.length > max) throw new RangeError("texte trop long");
  return clean || null;
}

function count(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 100_000) throw new RangeError("nombre d'invités invalide");
  return value;
}

export async function saveEventDetails(input: {
  organizationId: string;
  eventId: string;
  actor: EventNotesViewer;
  // `updatedAt` de l'évènement, en millisecondes, lu à l'ouverture de la fenêtre.
  version?: string;
  values: EventDetailsInput;
}): Promise<{ recalculationProposed: boolean }> {
  const { organizationId, eventId, values } = input;
  if (!UUID.test(eventId)) throw new EventNotFoundError();
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritable(organizationId, eventId);
  const found = await findEventById(organizationId, eventId);
  if (!found) throw new EventNotFoundError();
  const event = found.event;

  if (values.eventDate !== undefined) {
    if (!eventDateEditableHere({ status: event.status, eventDate: event.eventDate, archived: event.archivedAt !== null })) throw new EventDetailsRefusedError("eventDate");
    if (values.eventDate !== null && !DATE.test(values.eventDate)) throw new RangeError("date invalide");
  }
  if (!isTimeZone(values.timeZone)) throw new RangeError("fuseau inconnu");
  if (values.busyRule && !isValidBusyRule(values.busyRule)) throw new EventDetailsRefusedError("endTime");
  if (values.wantedBudgetCents !== null && (!Number.isInteger(values.wantedBudgetCents) || values.wantedBudgetCents < 0)) throw new RangeError("montant invalide");
  if (!UUID.test(values.eventTypeId)) throw new EventDetailsRefusedError("eventTypeId");
  if (values.prospectSourceId !== null && !UUID.test(values.prospectSourceId)) throw new EventDetailsRefusedError("prospectSourceId");

  // Les notes : chiffrées avant la transaction ; des notes confidentielles d'une autre personne refusées.
  let notes: { notes: string | null; notesSealed: string | null; notesConfidentialBy: string | null } | undefined;
  if (values.notes) {
    const row = await findEventNotesRow(organizationId, eventId);
    if (!row) throw new EventNotFoundError();
    const allowed = input.actor.role === "owner" || (row.notesConfidentialBy !== null && row.notesConfidentialBy === input.actor.userId);
    if (row.notesSealed && !allowed) throw new EventDetailsRefusedError("notes");
    const clean = text(values.notes.text, 10_000);
    notes =
      values.notes.confidential && clean
        ? { notes: null, notesSealed: sealField(clean, { organizationId, table: "events.events", column: "notes_sealed", rowId: eventId }), notesConfidentialBy: row.notesSealed ? (row.notesConfidentialBy ?? input.actor.userId) : input.actor.userId }
        : { notes: clean, notesSealed: null, notesConfidentialBy: null };
  }

  const outcome = await updateEventDetailsRow(
    organizationId,
    eventId,
    {
      ...(values.eventDate === undefined ? {} : { eventDate: values.eventDate }),
      timeZone: values.timeZone,
      venueName: text(values.venueName, 200),
      venueCity: text(values.venueCity, 200),
      busyRule: values.busyRule ? { ...values.busyRule, startTime: values.busyRule.startTime.slice(0, 5), endTime: values.busyRule.endTime.slice(0, 5) } : null,
      guestsEstimated: count(values.guestsEstimated),
      guestsConfirmed: count(values.guestsConfirmed),
      wantedBudgetCents: values.wantedBudgetCents,
      style: text(values.style, 2000),
      ...(notes ? { notes } : {}),
      eventTypeId: values.eventTypeId,
      prospectSourceId: values.prospectSourceId,
    },
    { userId: input.actor.userId, version: input.version },
  );
  if (outcome.kind === "not_found") throw new EventNotFoundError();
  if (outcome.kind === "conflict") throw new EventDetailsConflictError();
  if (outcome.kind === "refused") throw new EventDetailsRefusedError(outcome.field);
  return { recalculationProposed: outcome.recalculation?.pending ?? false };
}
