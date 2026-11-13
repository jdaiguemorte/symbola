// Lot 32a (HUB-08, UX-01, UX-06, EVT-02 ; décisions D2 et D4) — tri des urgences, tous évènements
// confondus, sans base. Quatre groupes, dans cet ordre :
// - en retard : le plus en retard d'abord ;
// - aujourd'hui : l'échéance du jour, et ce qui vous revient sans date (à faire maintenant) ;
// - attend un tiers : ce que le client ou un prestataire doit faire, le plus ancien d'abord ;
// - à venir : ce qui vous revient dans les quatorze prochains jours, par date.
// Une échéance au-delà de l'horizon n'apparaît pas ; une attente sans date reste. Les trois premiers
// éléments forment « À traiter en premier ». Dates en « AAAA-MM-JJ », jours calendaires de Paris.

// EVT-02 : « échéances des quatorze jours » ; HUB-08 et le bloc des tâches de l'accueil (PRD-HUB-02).
export const TODAY_HORIZON_DAYS = 14;
// UX-01 et PAR-03 : « les trois actions les plus urgentes sont visibles sans défiler ».
export const FIRST_COUNT = 3;

// UX-06 et D4 : qui doit agir.
export type TodayActor = { kind: "you" } | { kind: "client" } | { kind: "vendor"; name: string };

export type TodayItemKind =
  | "task"
  | "client_task"
  | "client_payment"
  | "vendor_payment"
  | "decision"
  | "payment_declaration"
  | "quote_follow_up"
  | "prospect_follow_up"
  | "deposit_blocked"
  | "vendor_contract"
  | "date_conflict"
  | "link_renewal";

// L'action en un clic (HUB-08) : cocher une tâche, relancer un prestataire, ou ouvrir l'objet.
export type TodayAction =
  | { kind: "check_task"; eventId: string; taskId: string }
  | { kind: "remind_vendor"; eventId: string; candidateId: string }
  | { kind: "open" };

export type TodayItem = {
  key: string;
  kind: TodayItemKind;
  eventId: string | null;
  eventNames: string | null;
  // Ce qu'il faut faire, déjà en mots (le chargeur les tire des traductions).
  title: string;
  detail?: string | undefined;
  dueOn: string | null;
  // Début de l'attente (décision demandée, devis envoyé…), pour trier les attentes.
  since: string | null;
  actor: TodayActor;
  href: string;
  action?: TodayAction | undefined;
};

export type TodayGroup = "overdue" | "today" | "waiting" | "upcoming";
export const TODAY_GROUPS: TodayGroup[] = ["overdue", "today", "waiting", "upcoming"];

export type RankedItem = TodayItem & { group: TodayGroup; daysLate: number };

export type RankedToday = {
  first: RankedItem[];
  groups: Record<TodayGroup, RankedItem[]>;
  // Tous, dans l'ordre des groupes.
  all: RankedItem[];
  // En retard, aujourd'hui et attentes (l'à-venir ne demande pas encore attention).
  attentionCount: number;
  attentionByEvent: Map<string, number>;
};

function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

// Jours calendaires de « from » à « date » (négatif une fois passée) ; sans heure, donc sans effet du
// passage à l'heure d'été.
export function daysUntil(date: string, from: string): number {
  return dayNumber(date) - dayNumber(from);
}

function groupOf(item: TodayItem, today: string, horizonDays: number): TodayGroup | null {
  if (item.dueOn !== null && daysUntil(item.dueOn, today) > horizonDays) return null;
  if (item.dueOn !== null && item.dueOn < today) return "overdue";
  if (item.dueOn === today) return "today";
  if (item.actor.kind !== "you") return "waiting";
  return item.dueOn === null ? "today" : "upcoming";
}

const byKey = (a: TodayItem, b: TodayItem) => a.key.localeCompare(b.key);

function sortGroup(group: TodayGroup, items: RankedItem[]): RankedItem[] {
  const reference = (entry: TodayItem) => entry.dueOn ?? entry.since ?? "9999-12-31";
  switch (group) {
    case "overdue":
      return items.sort((a, b) => a.dueOn!.localeCompare(b.dueOn!) || byKey(a, b));
    case "today":
      return items.sort((a, b) => (a.since ?? "").localeCompare(b.since ?? "") || byKey(a, b));
    case "waiting":
    case "upcoming":
      return items.sort((a, b) => reference(a).localeCompare(reference(b)) || byKey(a, b));
  }
}

export function rankToday(items: TodayItem[], today: string, horizonDays: number = TODAY_HORIZON_DAYS): RankedToday {
  const groups: Record<TodayGroup, RankedItem[]> = { overdue: [], today: [], waiting: [], upcoming: [] };
  for (const entry of items) {
    const group = groupOf(entry, today, horizonDays);
    if (!group) continue;
    groups[group].push({ ...entry, group, daysLate: group === "overdue" ? -daysUntil(entry.dueOn!, today) : 0 });
  }
  for (const group of TODAY_GROUPS) sortGroup(group, groups[group]);
  const all = TODAY_GROUPS.flatMap((group) => groups[group]);
  const attention = all.filter((entry) => entry.group !== "upcoming");
  const attentionByEvent = new Map<string, number>();
  for (const entry of attention) {
    if (entry.eventId) attentionByEvent.set(entry.eventId, (attentionByEvent.get(entry.eventId) ?? 0) + 1);
  }
  return { first: all.slice(0, FIRST_COUNT), groups, all, attentionCount: attention.length, attentionByEvent };
}

// UX-01 : la prochaine action d'un évènement, première de ses urgences.
export function nextActionFor(ranked: RankedToday, eventId: string): RankedItem | null {
  return ranked.all.find((entry) => entry.eventId === eventId) ?? null;
}
