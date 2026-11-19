// Lot 51 (PAR-08, étape 7) — le bilan du lendemain mis en mots (fiche et PDF), dans le fuseau de
// l'évènement : une ligne par séquence (prévu, réel, écart), décalage, incident, case non cochée,
// remise. Les photos ne sortent pas du bilan : leur nombre seulement.
import type { DayHandover, DayReport, DayReportHandover } from "@symbola/contracts";

export function reportHandovers(handovers: DayHandover[]): DayReportHandover[] {
  return handovers.map((handover) => ({ paymentId: handover.paymentId, vendorName: handover.vendorName ?? handover.slotLabel, label: handover.label, amountCents: handover.amountCents, method: handover.method, handoverBy: handover.by, handedOverAt: handover.handedOverAt }));
}

export type DayReportWords = {
  sequence: (input: { label: string; planned: string; actual: string; gap: string }) => string;
  notPointed: string;
  gap: (minutes: number) => string;
  onTime: string;
  shift: (input: { minutes: number; time: string; items: number; notified: number }) => string;
  shiftRefused: (input: { minutes: number; time: string }) => string;
  incident: (input: { time: string; severity: string; body: string; photos: number }) => string;
  severity: (value: string | null) => string;
  unchecked: (input: { list: string; label: string }) => string;
  handover: (input: { vendor: string; amount: string; method: string; time: string | null }) => string;
  titles: { sequences: string; shifts: string; incidents: string; unchecked: string; handovers: string };
  empties: { sequences: string; shifts: string; incidents: string; unchecked: string; handovers: string };
};

export function dayReportSections(report: DayReport, words: DayReportWords, format: { time: (iso: string) => string; amount: (cents: number) => string }) {
  return [
    {
      title: words.titles.sequences,
      empty: words.empties.sequences,
      lines: report.sequences.map((sequence) =>
        words.sequence({
          label: sequence.label,
          planned: sequence.plannedEnd ? `${sequence.plannedStart} – ${sequence.plannedEnd}` : sequence.plannedStart,
          actual: sequence.actualStart ? [format.time(sequence.actualStart), sequence.actualEnd ? format.time(sequence.actualEnd) : null].filter(Boolean).join(" – ") : words.notPointed,
          gap: sequence.startGap === null ? "" : sequence.startGap === 0 ? words.onTime : words.gap(sequence.startGap),
        }),
      ),
    },
    {
      title: words.titles.shifts,
      empty: words.empties.shifts,
      lines: report.shifts.map((shift) =>
        shift.outcome === "applied"
          ? words.shift({ minutes: shift.minutes, time: format.time(shift.validatedAt), items: shift.itemIds.length, notified: shift.notifiedCount ?? 0 })
          : words.shiftRefused({ minutes: shift.minutes, time: format.time(shift.validatedAt) }),
      ),
    },
    {
      title: words.titles.incidents,
      empty: words.empties.incidents,
      lines: [...report.incidents]
        .sort((a, b) => a.deviceAt.localeCompare(b.deviceAt))
        .map((incident) => words.incident({ time: format.time(incident.deviceAt), severity: words.severity(incident.severity), body: incident.body, photos: incident.photos.filter((photo) => photo.state === "stored").length })),
    },
    { title: words.titles.unchecked, empty: words.empties.unchecked, lines: report.uncheckedItems.map((item) => words.unchecked({ list: item.checklistName, label: item.label })) },
    {
      title: words.titles.handovers,
      empty: words.empties.handovers,
      lines: report.handovers.map((handover) => words.handover({ vendor: handover.vendorName ?? "—", amount: format.amount(handover.amountCents), method: handover.method ?? "—", time: handover.handedOverAt ? format.time(handover.handedOverAt) : null })),
    },
  ];
}
