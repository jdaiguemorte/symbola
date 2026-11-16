// Lot 27a (CHR-04, décision D7) — règles pures des rappels des tâches confiées
// au client : quel seuil une tâche atteint aujourd'hui, à quelle heure on
// envoie, et le texte de l'e-mail. Sans base ni horloge implicite.
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { formatCalendarDate } from "@symbola/i18n";
import type { StarterClientTaskReminders } from "@symbola/starter-templates";

export type ReminderThreshold = "week" | "eve" | "overdue";

const DAY_MS = 24 * 60 * 60 * 1000;

// Jours du calendrier de « from » à « to » (AAAA-MM-JJ), négatif si « to » précède.
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

// Seuil atteint par une tâche dont l'échéance est « dueDate », vu « today » :
// la semaine qui précède (sauf les deux derniers jours), la veille et le jour
// même, puis le retard (dans la semaine qui suit). Rien en dehors.
export function reminderThreshold(dueDate: string, today: string, policy: StarterClientTaskReminders): ReminderThreshold | null {
  const left = daysBetween(today, dueDate);
  if (left > policy.daysBefore.eve && left <= policy.daysBefore.week) return "week";
  if (left >= 0 && left <= policy.daysBefore.eve) return "eve";
  if (-left >= policy.overdue.after && -left <= policy.overdue.within) return "overdue";
  return null;
}

// Heure (0 à 23) à Paris, changements d'heure compris.
export function parisHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(now);
  return Number(hour);
}

export function isSendingHour(now: Date, policy: StarterClientTaskReminders): boolean {
  const hour = parisHour(now);
  return hour >= policy.sendingHours.from && hour < policy.sendingHours.until;
}

export type ReminderTask = { label: string; dueDate: string; threshold: ReminderThreshold };

// Lot 38a (MSG-01 ; ADR 0072) : l'e-mail part du modèle « rappel des tâches » de l'organisation ;
// d'ici vient la valeur de « {{tâches}} » : une ligne par tâche, par date, sans le lien (seul son
// haché est gardé, ADR 0053), dans la langue du lien.
export function reminderTaskLines(input: { locale: "fr" | "en"; tasks: ReminderTask[]; today: string }): string {
  const t = createTranslator({ locale: input.locale, messages: input.locale === "en" ? enMessages : frMessages, namespace: "Emails.task" });
  const when = (task: ReminderTask) => {
    const left = daysBetween(input.today, task.dueDate);
    return left < 0 ? t("overdue") : left === 0 ? t("today") : left === 1 ? t("tomorrow") : t("inDays", { days: left });
  };
  return [...input.tasks]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((task) => t("line", { label: task.label, date: formatCalendarDate(task.dueDate, input.locale), when: when(task) }))
    .join("\n");
}
