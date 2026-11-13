// Lot 30b (CHR-06) — mots des durées du programme (« 1 h 30 », « 16:00 – 17:00 · 1 h »),
// tirés des traductions du jour J : la fiche, le PDF et l'écran du jour J disent la même
// chose.
import { getTranslations } from "next-intl/server";
import type { SpanWords } from "./program-spans";

export async function programSpanWords(): Promise<SpanWords> {
  const t = await getTranslations("DayOf");
  return {
    minutes: (minutes) => t("durationMinutes", { minutes }),
    hours: (hours) => t("durationHours", { hours }),
    hoursMinutes: (hours, minutes) => t("durationHoursMinutes", { hours, minutes }),
    range: (start, end, duration) => t("fieldHours", { start, end, duration }),
  };
}
