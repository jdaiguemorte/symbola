// PRD-EVT-05 — contenu du PDF du programme du jour J, séparé du rendu pour
// être testé : la variante « mariés » ne contient jamais de note interne.
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { programForVariant, type EventProgram, type ProgramVariant, type PublishedProgramItem, type VendorProgramView } from "@/modules/events/service";
import { clock, durationText, programSpans, type ProgramSpan, type SpanWords } from "@/lib/program-spans";

export type ProgramPdfLogo = { data: Buffer; format: "png" | "jpg" };

export type ProgramPdfLabels = {
  title: string;
  variant: string;
  version: (date: string) => string;
  time: string;
  item: string;
  location: string;
  participants: string;
  note: string;
  // Lot 67d : titre des séquences sans jour, quand le programme a plusieurs jours.
  undated?: string;
  empty: string;
  // Lot 30b (CHR-06) : durées et responsable de chaque séquence.
  words: SpanWords;
  responsible: (name: string) => string;
  // Lot 71e (R13) : une fin attendue d'un programme repris, jamais déduite de la séquence suivante.
  endPending?: string;
};

export type ProgramPdfRow = {
  // « 15:00 – 16:00 · 1 h » (le texte d'origine), et, lot 67d (CHR-07 ; R10), ses deux moitiés : la
  // plage sur une ligne, la durée dessous. Une séquence sans durée n'a que son heure.
  time: string;
  hours: string;
  duration: string | null;
  label: string;
  responsible: string | null;
  location: string;
  participants: string;
  note: string | null;
};

export type ProgramPdfModel = {
  language: Locale;
  organizationName: string;
  logo: ProgramPdfLogo | null;
  title: string;
  heading: string;
  variant: string;
  version: string;
  columns: string[];
  rows: ProgramPdfRow[];
  // Lot 67d (EVT-04, CHR-07) : les mêmes lignes, jour par jour ; un titre par jour quand le
  // programme en compte plusieurs (null : un seul jour, pas de titre). Absent : `rows`, d'un bloc.
  days?: { heading: string | null; rows: ProgramPdfRow[] }[];
  showNotes: boolean;
  empty: string;
  // AIDE-02 : « Document fictif » en filigrane sur un événement d'essai.
  watermark: string | null;
};

export function buildProgramPdfModel(input: {
  program: EventProgram;
  variant: ProgramVariant;
  labels: ProgramPdfLabels;
  locale: Locale;
  heading: string;
  organizationName: string;
  logo: ProgramPdfLogo | null;
  watermark?: string | null;
  now?: Date;
  // Lot 37b (CHR-07, D8) : une version diffusée porte son numéro (« Version 3 du … »).
  versionLabel?: string;
}): ProgramPdfModel {
  const { labels } = input;
  const showNotes = input.variant === "vendors";
  const versionDate = input.program.updatedAt ? new Date(input.program.updatedAt) : (input.now ?? new Date());
  // Lot 67d (EVT-04, CHR-07 ; décision du 24/11/2026) : un programme de plusieurs jours se lit jour
  // par jour, dans l'ordre des dates ; les durées se calculent dans chaque jour (la fin d'une
  // séquence sans fin : la suivante du même jour). Les séquences sans temps fort viennent à la fin.
  const moments = input.program.moments ?? [];
  const known = new Set(moments.map((moment) => moment.id));
  const groups = [
    ...moments.map((moment) => ({ heading: `${moment.name} — ${formatCalendarDate(moment.date, input.locale)}`, items: input.program.items.filter((item) => item.keyMomentId === moment.id) })),
    { heading: null as string | null, items: input.program.items.filter((item) => !item.keyMomentId || !known.has(item.keyMomentId)) },
  ].filter((group) => group.items.length > 0);
  const timeOf = (span: ProgramSpan) => {
    // Lot 30b (CHR-06, D7) : « 15:00 – 16:00 · 1 h » ; une fin absente vaut la suivante. Lot 67d
    // (R10) : une séquence sans durée n'affiche que son heure, sans « · 0 min ».
    const minutes = span.end - span.start;
    if (span.openEnded || minutes <= 0) return { time: clock(span.start), hours: clock(span.start), duration: null };
    const duration = durationText(minutes, labels.words);
    return { time: labels.words.range(clock(span.start), clock(span.end), duration), hours: `${clock(span.start)} – ${clock(span.end)}`, duration };
  };
  const rowsOf = (items: EventProgram["items"]) => {
    const spans = new Map(programSpans(items).map((span) => [span.id, span]));
    return programForVariant(items, input.variant).map((item) => ({
      ...((item as { endPending?: true }).endPending && labels.endPending
        ? { time: `${clock(spans.get(item.id)!.start)} · ${labels.endPending}`, hours: clock(spans.get(item.id)!.start), duration: labels.endPending }
        : timeOf(spans.get(item.id)!)),
      label: item.label,
      responsible: item.responsible ? labels.responsible(item.responsible) : null,
      location: item.location ?? "",
      participants: item.participants.map((participant) => participant.label).join(", "),
      note: showNotes ? item.internalNote : null,
    }));
  };
  const days = groups.map((group) => ({ heading: groups.length > 1 ? (group.heading ?? labels.undated ?? null) : null, rows: rowsOf(group.items) })).filter((day) => day.rows.length > 0);
  const rows = days.flatMap((day) => day.rows);
  return {
    language: input.locale,
    organizationName: input.organizationName,
    logo: input.logo,
    title: labels.title,
    heading: input.heading,
    variant: labels.variant,
    version: input.versionLabel ?? labels.version(formatDateTime(versionDate, input.locale)),
    columns: [labels.time, labels.item, labels.location, labels.participants, ...(showNotes ? [labels.note] : [])],
    rows,
    days,
    showNotes,
    empty: labels.empty,
    watermark: input.watermark ?? null,
  };
}

// Lot 37b (CHR-07, DAT-14 ; D8, D10) — le programme d'une version diffusée, rendu comme la variante
// « mariés » : la copie figée n'a pas de note interne.
export function publishedPdfProgram(items: PublishedProgramItem[], publishedAt: string): EventProgram {
  return { items: items.map((item) => ({ ...item, eventId: "", internalNote: null, keyMomentId: null })), overlaps: [], updatedAt: publishedAt };
}

// Lot 37b (D9) — le PDF d'un prestataire : le déroulé du jour en titres et horaires ; ses séquences
// en entier, sa colonne « votre poste » portant son poste. Rien d'autre : ni lieu ni responsable
// d'une séquence qui n'est pas la sienne, ni autre intervenant.
export function vendorPdfProgram(program: VendorProgramView, slotLabel: string, publishedAt: string): EventProgram {
  const own = new Map(program.ownItems.map((item) => [item.id, item]));
  return {
    items: program.outline.map((line) => {
      const detail = line.own ? own.get(line.id) : undefined;
      return {
        id: line.id,
        eventId: "",
        startTime: line.startTime,
        endTime: line.endTime,
        label: line.label,
        location: detail?.location ?? null,
        internalNote: null,
        responsible: detail?.responsible ?? null,
        participants: detail ? [{ vendorSlotId: null, label: slotLabel }] : [],
        keyMomentId: null,
        hiddenFromClients: false,
        ...(line.endPending ? { endPending: true as const } : {}),
      };
    }),
    overlaps: [],
    updatedAt: publishedAt,
  };
}
