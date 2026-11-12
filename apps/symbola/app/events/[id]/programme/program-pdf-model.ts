// PRD-EVT-05 — contenu du PDF du programme du jour J, séparé du rendu pour
// être testé : la variante « mariés » ne contient jamais de note interne.
import { formatDateTime, type Locale } from "@symbola/i18n";
import { programForVariant, type EventProgram, type ProgramVariant } from "@/modules/events/service";
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
    version: labels.version(formatDateTime(versionDate, input.locale)),
    columns: [labels.time, labels.item, labels.location, labels.participants, ...(showNotes ? [labels.note] : [])],
    rows,
    showNotes,
    empty: labels.empty,
    watermark: input.watermark ?? null,
  };
}
