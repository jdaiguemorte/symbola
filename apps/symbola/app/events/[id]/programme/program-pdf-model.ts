// EVT-05 — contenu du PDF du programme du jour J, séparé du rendu pour
// être testé : la variante « mariés » ne contient jamais de note interne.
import { formatDateTime, type Locale } from "@symbola/i18n";
import { programForVariant, type EventProgram, type ProgramVariant } from "@/modules/events/service";

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
};

export type ProgramPdfRow = {
  time: string;
  label: string;
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
  const rows = programForVariant(input.program.items, input.variant).map((item) => ({
    time: item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime,
    label: item.label,
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
