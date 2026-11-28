// Lot 72e (EVT-03, EVT-05, UX-09, UX-10 ; C-26, D7, M1 ; page 16 des maquettes du lot 68) — « Modifier les
// informations » : une fenêtre longue à cinq rubriques et un seul « Enregistrer », au lieu de six formulaires.
// Ici, sans base : les rubriques, la lecture de tous les champs d'un coup (une erreur n'enregistre rien et
// nomme son champ), la règle de la date (un évènement signé se reporte, il ne change pas de date ici) et
// les changements qui font demander « Fermer sans enregistrer ? ».
import { isTimeZone, parseAmountToCents } from "@symbola/i18n";
import { eventDateEditableHere, type EventDetailsBusyRule, type EventDetailsInput, type EventStatus } from "@symbola/contracts";

export const DETAILS_RUBRICS = ["dates", "clients", "guests", "style", "origin"] as const;
export type DetailsRubric = (typeof DETAILS_RUBRICS)[number];

// Les champs de la fenêtre, tels que le formulaire les envoie.
export const DETAILS_FIELDS = {
  eventDate: "dates",
  timeZone: "dates",
  venueName: "dates",
  venueCity: "dates",
  busyMode: "dates",
  startDayOffset: "dates",
  startTime: "dates",
  endDayOffset: "dates",
  endTime: "dates",
  guestsEstimated: "guests",
  guestsConfirmed: "guests",
  wantedBudget: "guests",
  style: "style",
  notes: "style",
  notesConfidential: "style",
  eventTypeId: "origin",
  prospectSourceId: "origin",
} as const satisfies Record<string, DetailsRubric>;
export type DetailsField = keyof typeof DETAILS_FIELDS;
export type DetailsRaw = Partial<Record<DetailsField, string>>;

// Le code d'une erreur de saisie ; l'écran le traduit sous le champ (lot 70b).
export type DetailsErrorCode = "date" | "eventDate" | "count" | "amount" | "tooLong" | "timeZone" | "time" | "day" | "busyRule" | "required" | "unknown" | "forbidden" | "conflict";
export type DetailsErrors = Partial<Record<DetailsField, DetailsErrorCode>>;

export type BusyRuleInput = EventDetailsBusyRule;
export type EventDetailsValues = EventDetailsInput;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const LIMITS = { venue: 200, style: 2000, notes: 10_000 } as const;

export function rubricOf(field: DetailsField): DetailsRubric {
  return DETAILS_FIELDS[field];
}

export function firstErrorRubric(errors: DetailsErrors): DetailsRubric | null {
  const fields = Object.keys(errors) as DetailsField[];
  return DETAILS_RUBRICS.find((rubric) => fields.some((field) => DETAILS_FIELDS[field] === rubric)) ?? null;
}

// E5 de la note 09 : un mariage signé change de date par « Reporter l'évènement… » ; une demande, un report
// en attente de sa nouvelle date, ou un évènement encore sans date, la reçoivent ici (règle du contrat,
// la même que celle du module).
export function dateEditable(event: { status: EventStatus; eventDate: string | null; archived: boolean }): boolean {
  return eventDateEditableHere(event);
}

function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseEventDetails(
  raw: DetailsRaw,
  context: { dateEditable: boolean; notesReadable: boolean },
): { ok: true; values: EventDetailsValues } | { ok: false; errors: DetailsErrors } {
  const errors: DetailsErrors = {};
  const text = (field: DetailsField, max: number): string | null => {
    const value = (raw[field] ?? "").replace(/\r\n/g, "\n").trim();
    if (value.length > max) errors[field] = "tooLong";
    return value || null;
  };
  const count = (field: DetailsField): number | null => {
    const value = (raw[field] ?? "").trim();
    if (!value) return null;
    if (!/^\d{1,6}$/.test(value) || Number(value) > 100_000) {
      errors[field] = "count";
      return null;
    }
    return Number(value);
  };

  let eventDate: string | null | undefined;
  if (context.dateEditable) {
    const value = (raw.eventDate ?? "").trim();
    if (value && !isRealDate(value)) errors.eventDate = "date";
    eventDate = value || null;
  }

  const timeZone = (raw.timeZone ?? "").trim() || "Europe/Paris";
  if (!isTimeZone(timeZone)) errors.timeZone = "timeZone";

  let busyRule: BusyRuleInput | null = null;
  if (raw.busyMode === "event") {
    const day = (field: "startDayOffset" | "endDayOffset") => {
      const value = (raw[field] ?? "").trim();
      if (!/^-?\d{1,2}$/.test(value)) errors[field] = "day";
      return Number(value);
    };
    const time = (field: "startTime" | "endTime") => {
      const value = (raw[field] ?? "").trim().slice(0, 5);
      if (!TIME.test(value)) errors[field] = "time";
      return value;
    };
    busyRule = { startDayOffset: day("startDayOffset"), startTime: time("startTime"), endDayOffset: day("endDayOffset"), endTime: time("endTime") };
  }

  const wantedBudgetCents = parseAmountToCents((raw.wantedBudget ?? "").trim());
  if (wantedBudgetCents === undefined || (wantedBudgetCents !== null && wantedBudgetCents < 0)) errors.wantedBudget = "amount";

  const eventTypeId = (raw.eventTypeId ?? "").trim();
  if (!eventTypeId) errors.eventTypeId = "required";
  else if (!UUID.test(eventTypeId)) errors.eventTypeId = "unknown";
  const sourceId = (raw.prospectSourceId ?? "").trim();
  if (sourceId && !UUID.test(sourceId)) errors.prospectSourceId = "unknown";

  const values: EventDetailsValues = {
    ...(eventDate === undefined ? {} : { eventDate }),
    timeZone,
    venueName: text("venueName", LIMITS.venue),
    venueCity: text("venueCity", LIMITS.venue),
    busyRule,
    guestsEstimated: count("guestsEstimated"),
    guestsConfirmed: count("guestsConfirmed"),
    wantedBudgetCents: wantedBudgetCents ?? null,
    style: text("style", LIMITS.style),
    ...(context.notesReadable ? { notes: { text: text("notes", LIMITS.notes), confidential: raw.notesConfidential === "on" } } : {}),
    eventTypeId,
    prospectSourceId: sourceId || null,
  };
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, values };
}

// Les rubriques dont un champ a changé depuis l'ouverture (espaces de bout ignorés), dans leur ordre.
export function changedDetails(initial: DetailsRaw, current: DetailsRaw): DetailsRubric[] {
  const fields = new Set([...Object.keys(initial), ...Object.keys(current)]) as Set<DetailsField>;
  const changed = new Set<DetailsRubric>();
  for (const field of fields) {
    if (!(field in DETAILS_FIELDS)) continue;
    if ((initial[field] ?? "").trim() !== (current[field] ?? "").trim()) changed.add(DETAILS_FIELDS[field]);
  }
  return DETAILS_RUBRICS.filter((rubric) => changed.has(rubric));
}
