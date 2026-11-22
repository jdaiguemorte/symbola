// Lot 66a (HUB-28, CHR-05 ; D1 ; ADR 0112) — règles pures de l'heure d'envoi des automatismes : un envoi
// part à partir de son heure (« HH:MM », heure locale du fuseau donné), et encore pendant le rattrapage
// (un envoi manqué, serveur arrêté, part au passage suivant le jour même) ; jamais avant, jamais après
// minuit. Les règles de chaque automatisme (un rappel à partir de tel jour, une seule fois) restent les
// siennes.
import { starterSending } from "@symbola/starter-templates";

const PARIS = "Europe/Paris";

export function sendTimeMinutes(sendTime: string): number {
  const [hours, minutes] = sendTime.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function localMinutes(now: Date, timeZone: string = PARIS): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function sendWindowOpen(input: { now: Date; sendTime: string; catchUpHours: number; timeZone?: string }): boolean {
  const start = sendTimeMinutes(input.sendTime);
  const minute = localMinutes(input.now, input.timeZone ?? PARIS);
  return minute >= start && minute < Math.min(start + input.catchUpHours * 60, 24 * 60);
}

// Une heure de la base (« HH:MM:SS ») en « HH:MM ».
export function fromDatabaseTime(value: string | null | undefined): string | null {
  return value ? value.slice(0, 5) : null;
}

// L'heure d'envoi est-elle venue pour un envoi de cet évènement ? isSendTime vient de l'automatisme
// (lib/automation-gates.ts) ; sans lui (appel direct), l'heure par défaut de départ.
export function sendTimeReached(isSendTime: ((now: Date, timeZone?: string) => boolean) | undefined, now: Date, timeZone: string = PARIS): boolean {
  if (isSendTime) return isSendTime(now, timeZone);
  const { defaultSendTime, catchUpHours } = starterSending();
  return sendWindowOpen({ now, sendTime: defaultSendTime, catchUpHours, timeZone });
}
