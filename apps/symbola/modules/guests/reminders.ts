// Lot 49 (INV-04 ; D10) — règles pures des relances : jusqu'à trois relances, N jours avant la
// clôture ; seule la plus récente échue part (un serveur arrêté ne rattrape pas toutes les
// relances le même jour) ; aucune après la clôture ; une clé par foyer et par relance pour la file
// hub.jobs (une relance rejouée ne part qu'une fois). Le choix des foyers (sans réponse, avec une
// adresse e-mail) est revérifié au moment de l'envoi, par le service.
import { addDays } from "./rsvp";

export function currentReminder(closeOn: string | null, reminderDays: number[], today: string): { day: number; date: string } | null {
  if (!closeOn || today > closeOn) return null;
  const due = reminderDays
    .map((day) => ({ day, date: addDays(closeOn, -day) }))
    .filter((reminder) => reminder.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  return due[0] ?? null;
}

// Sans donnée personnelle (ADR 0076) : des identifiants.
export function reminderKey(householdId: string, day: number): string {
  return `guests:reminder:${householdId}:${day}`;
}

export function invitationKey(guestId: string): string {
  return `guests:invitation:${guestId}`;
}

// Heure de Paris de l'instant, heure d'été comprise.
function parisHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(now));
}

export function withinSendingHours(now: Date, hours: { from: number; until: number }): boolean {
  const hour = parisHour(now);
  return hour >= hours.from && hour < hours.until;
}
