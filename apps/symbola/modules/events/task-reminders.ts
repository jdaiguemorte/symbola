// Lot 27a (CHR-04, décision D7) — règles pures des rappels des tâches confiées
// au client : quel seuil une tâche atteint aujourd'hui, à quelle heure on
// envoie, et le texte de l'e-mail. Sans base ni horloge implicite.
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

// Texte de l'e-mail : la liste des tâches, sans le lien (seul son haché est
// gardé, ADR 0053). Un mariage parle de « votre mariage » (ADR 0045).
export function reminderMail(input: { personName: string; locale: "fr" | "en"; couple: boolean; tasks: ReminderTask[]; today: string }): { subject: string; text: string } {
  const { locale, couple } = input;
  const when = (task: ReminderTask) => {
    const left = daysBetween(input.today, task.dueDate);
    if (locale === "en") return left < 0 ? "overdue" : left === 0 ? "today" : left === 1 ? "tomorrow" : `in ${left} days`;
    return left < 0 ? "en retard" : left === 0 ? "aujourd'hui" : left === 1 ? "demain" : `dans ${left} jours`;
  };
  const lines = [...input.tasks]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((task) =>
      locale === "en"
        ? `- ${task.label}: due ${formatCalendarDate(task.dueDate, "en")} (${when(task)})`
        : `- ${task.label} : avant le ${formatCalendarDate(task.dueDate, "fr")} (${when(task)})`,
    )
    .join("\n");
  if (locale === "en") {
    return {
      subject: couple ? "Your next tasks for your wedding" : "Your next tasks for your event",
      text: `Hello ${input.personName},\n\nHere is what is coming up for ${couple ? "your wedding" : "your event"}:\n${lines}\n\nTo tick a task, open your space with the personal link you received by e-mail. Can't find it? Ask your organiser for a new one.\n\nYou no longer wish to receive these reminders? Just tell your organiser.\n\nSee you soon,\nThe Symbola team`,
    };
  }
  return {
    subject: couple ? "Vos prochaines tâches pour votre mariage" : "Vos prochaines tâches pour votre événement",
    text: `Bonjour ${input.personName},\n\nVoici ce qui vous attend pour ${couple ? "votre mariage" : "votre événement"} :\n${lines}\n\nPour cocher une tâche, ouvrez votre espace avec le lien personnel reçu par e-mail. Vous ne le retrouvez pas ? Demandez-en un nouveau à votre organisateur.\n\nVous ne souhaitez plus recevoir ces rappels ? Dites-le à votre organisateur.\n\nÀ bientôt,\nL'équipe Symbola`,
  };
}
