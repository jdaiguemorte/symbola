// PRD-EVT-05 — contenu du PDF du programme du jour J, séparé du rendu pour
// être testé : la variante « mariés » ne contient jamais de note interne.
import { formatDateTime, type Locale } from "@symbola/i18n";
import { programForVariant, type EventProgram, type ProgramVariant, type PublishedProgramItem, type VendorProgramView } from "@/modules/events/service";
import { programSpans, spanLabel, type SpanWords } from "@/lib/program-spans";

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
  empty: string;
  // Lot 30b (CHR-06) : durées et responsable de chaque séquence.
  words: SpanWords;
  responsible: (name: string) => string;
};

export type ProgramPdfRow = {
  time: string;
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
  // Lot 30b (CHR-06, D7) : « 15:00 – 16:00 · 1 h » ; une fin absente vaut la suivante.
  const spans = new Map(programSpans(input.program.items).map((span) => [span.id, span]));
  const rows = programForVariant(input.program.items, input.variant).map((item) => ({
    time: spanLabel(spans.get(item.id)!, labels.words),
    label: item.label,
    responsible: item.responsible ? labels.responsible(item.responsible) : null,
    location: item.location ?? "",
    participants: item.participants.map((participant) => participant.label).join(", "),
    note: showNotes ? item.internalNote : null,
  }));
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
      };
    }),
    overlaps: [],
    updatedAt: publishedAt,
  };
}
