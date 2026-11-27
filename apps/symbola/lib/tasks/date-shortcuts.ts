// Lot 70c (CHR-02, UX-07 ; C-36 ; page 2 des maquettes du lot 68) — les raccourcis de « Changer la
// date » : demain, lundi prochain, dans une semaine, comptés depuis le jour à Paris. Les jours se comptent
// en dates (« AAAA-MM-JJ ») : un changement d'heure ne fait ni gagner ni perdre un jour. « Lundi
// prochain » est toujours un lundi à venir : un lundi, c'est celui de la semaine suivante.
// Remplace « Reporter » (demain, dans une semaine) du lot 63d.

export const DATE_SHORTCUTS = ["tomorrow", "next_monday", "in_a_week"] as const;
export type DateShortcut = (typeof DATE_SHORTCUTS)[number];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function addDays(date: string, days: number): string {
  if (!DAY.test(date)) throw new RangeError("date attendue au format AAAA-MM-JJ");
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isDateShortcut(value: string): value is DateShortcut {
  return (DATE_SHORTCUTS as readonly string[]).includes(value);
}

export function shortcutDate(shortcut: DateShortcut, today: string): string {
  switch (shortcut) {
    case "tomorrow":
      return addDays(today, 1);
    case "in_a_week":
      return addDays(today, 7);
    case "next_monday": {
      // getUTCDay : 0 dimanche … 1 lundi ; de 1 à 7 jours plus tard.
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      return addDays(today, ((8 - weekday) % 7) || 7);
    }
  }
}

export function dateShortcuts(today: string): Record<DateShortcut, string> {
  return { tomorrow: shortcutDate("tomorrow", today), next_monday: shortcutDate("next_monday", today), in_a_week: shortcutDate("in_a_week", today) };
}
