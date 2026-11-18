// Lot 45 (POR-07, CRM-09) — une réponse ou une valeur de la fiche, lisible : la date en clair, le
// montant en euros, les choix séparés par une virgule.
import type { QuestionEventField, QuestionnaireAnswerValue } from "@symbola/contracts";

export function formatAnswer(value: QuestionnaireAnswerValue | null, locale: "fr" | "en", field: QuestionEventField | null, nature?: string): string {
  if (value === null) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") {
    if (field === "budget" || nature === "amount") return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", { style: "currency", currency: "EUR" }).format(value / 100);
    return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR").format(value);
  }
  if ((field === "event_date" || nature === "date") && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  }
  return value;
}
