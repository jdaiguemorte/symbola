// Lot 63d (CHR-02 ; recette du 21/11/2026, maquette M6) — « Reporter » une tâche depuis sa ligne :
// à demain, dans une semaine (comptés depuis aujourd'hui, à Paris), ou à une date choisie. Le menu
// montre la date obtenue, pour qu'une tâche à venir ne soit jamais avancée par surprise.
import { parisToday } from "@symbola/i18n";

export const POSTPONE_CHOICES = ["tomorrow", "next_week"] as const;
export type PostponeChoice = (typeof POSTPONE_CHOICES)[number];

const DAYS: Record<PostponeChoice, number> = { tomorrow: 1, next_week: 7 };

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isPostponeChoice(value: string): value is PostponeChoice {
  return (POSTPONE_CHOICES as readonly string[]).includes(value);
}

// La nouvelle échéance (« AAAA-MM-JJ »), d'après l'heure de Paris : la journée change à minuit à Paris,
// pas à minuit UTC.
export function postponedDueDate(choice: PostponeChoice, now: Date = new Date()): string {
  return addDays(parisToday(now), DAYS[choice]);
}
