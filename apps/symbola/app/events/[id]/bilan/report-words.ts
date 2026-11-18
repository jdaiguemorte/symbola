// Lot 51 (PAR-08, étape 7) — les mots du bilan, d'un traducteur next-intl (espace « DayReport »).
import type { DayReportWords } from "./day-report-view";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export function dayReportWords(t: Translate): DayReportWords {
  return {
    sequence: (input) => t("sequence", input),
    notPointed: t("notPointed"),
    gap: (minutes) => t("gap", { minutes }),
    onTime: t("onTime"),
    shift: (input) => t("shift", input),
    shiftRefused: (input) => t("shiftRefused", input),
    incident: (input) => t("incident", input),
    severity: (value) => (value ? t(`severity.${value}`) : t("severity.none")),
    unchecked: (input) => t("unchecked", input),
    handover: (input) => (input.time ? t("handoverDone", { ...input, time: input.time }) : t("handoverMissing", { vendor: input.vendor, amount: input.amount, method: input.method })),
    titles: { sequences: t("titles.sequences"), shifts: t("titles.shifts"), incidents: t("titles.incidents"), unchecked: t("titles.unchecked"), handovers: t("titles.handovers") },
    empties: { sequences: t("empties.sequences"), shifts: t("empties.shifts"), incidents: t("empties.incidents"), unchecked: t("empties.unchecked"), handovers: t("empties.handovers") },
  };
}
