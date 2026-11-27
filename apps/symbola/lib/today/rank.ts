// Lot 32a (HUB-08, UX-01, UX-06, EVT-02 ; décisions D2 et D4), réécrit au lot 72a (décisions A1 et A2 de la
// note 09 du lot 68) — tri des urgences, tous évènements confondus, sans base. Deux rangs :
// - les retards, le plus ancien en tête ;
// - puis tout le reste par date, quel que soit qui agit : une échéance à sa date, une attente sans
//   échéance à sa date de début, une ligne sans date (alerte du radar, ce qui vous revient) au jour même.
// Une échéance au-delà de l'horizon n'apparaît pas ; une ligne sans échéance reste. Un point est une
// ligne : le compte du haut est le nombre de lignes. Dates « AAAA-MM-JJ », jours calendaires de Paris.
// Le groupe (en retard, aujourd'hui, attente, à venir) reste un mot de la ligne, pas un rang.
import { HOME_FIRST_COUNT, TODAY_HORIZON_DAYS, type TodayContact } from "@symbola/contracts";
import type { TaskLineSource } from "@/lib/tasks/task-line";

export { HOME_FIRST_COUNT, TODAY_HORIZON_DAYS };
// UX-01 et PAR-03 : « les trois actions les plus urgentes sont visibles sans défiler ».
export const FIRST_COUNT = 3;

// UX-06 et D4 : qui doit agir. Lot 72a (UX-13) : la fiche du prestataire, pour son contact.
export type TodayActor = { kind: "you" } | { kind: "client" } | { kind: "vendor"; name: string; vendorId?: string | null | undefined };

export type TodayItemKind =
  | "task"
  | "client_task"
  | "client_payment"
  | "vendor_payment"
  | "decision"
  | "payment_declaration"
  // Lot 43 (FAC-08) : virement déclaré par le payeur d'une échéance de la planner.
  | "transfer_declaration"
  | "quote_follow_up"
  | "prospect_follow_up"
  | "deposit_blocked"
  | "vendor_contract"
  | "date_conflict"
  | "link_renewal"
  // Lot 49 (RGP-08) : préavis de purge des invités, opposition d'un invité.
  | "guest_purge"
  | "guest_opposition"
  // Lot 46 (HUB-08) : rendez-vous du jour, rendez-vous pris, reportés ou annulés depuis la veille,
  // agenda extérieur en erreur.
  | "appointment"
  | "appointment_change"
  | "calendar_source_error"
  // Lot 44 (CRM-01) : nouvelle demande du formulaire de contact, demandes « à vérifier ».
  | "prospect_request"
  | "prospect_review"
  // Lot 45 (CRM-06, POR-07, CRM-07) : relance prête à relire, questionnaire terminé, doublons possibles.
  | "prospect_follow_up_ready"
  | "questionnaire_finished"
  | "contact_duplicates"
  // Lot 47 (PAR-05 ; D3, D6, D8) : réponse d'un prestataire à un brief, choix du client engagé,
  // feuille de route non confirmée.
  | "vendor_answer"
  | "vendor_choice"
  | "vendor_roadmap"
  // Lot 48a (PRE-05, PRE-10, SEC-27) : pièce d'un prestataire à surveiller, IBAN « à vérifier ».
  | "vendor_document"
  | "vendor_bank_check"
  // Lot 58 (PAR-09) : évènement à clôturer, dès le lendemain (fuseau de l'évènement).
  | "closing_due"
  // Lot 65d (MSG-01, HUB-28 ; ADR 0110) : un message de la relation préparé, « À envoyer » de la
  // messagerie de la planner (déposé par un geste ou par un automatisme).
  | "email_to_send"
  // Lot 72a (HUB-08, GC-02) : une alerte du radar des risques, « À regarder ».
  | "watch";

// L'action en un clic (HUB-08) : cocher une tâche, relancer un prestataire, ou ouvrir l'objet.
export type TodayAction =
  | { kind: "check_task"; eventId: string; taskId: string }
  | { kind: "remind_vendor"; eventId: string; candidateId: string }
  // Lot 53 (CHR-10) : cocher une tâche hors évènement.
  | { kind: "check_standalone_task"; taskId: string }
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
  // Lot 70c (CHR-02, HUB-08 ; D3, M4) : une tâche, pour sa ligne type allégée.
  task?: TaskLineSource | undefined;
  // Lot 72a (UX-13, J7) : qui appeler, quand la ligne attend les mariés ou un prestataire.
  contact?: TodayContact | undefined;
};

export type TodayGroup = "overdue" | "today" | "waiting" | "upcoming";
export const TODAY_GROUPS: TodayGroup[] = ["overdue", "today", "waiting", "upcoming"];

export type RankedItem = TodayItem & { group: TodayGroup; daysLate: number };

export type RankedToday = {
  // Les trois premières (PAR-03).
  first: RankedItem[];
  // Les lignes par groupe (mot de la ligne), chacune dans l'ordre du rang.
  groups: Record<TodayGroup, RankedItem[]>;
  // Toutes, dans l'ordre du rang : les retards, puis le reste par date.
  all: RankedItem[];
  // A1 : un point est une ligne ; « dont N en retard ».
  points: number;
  late: number;
  pointsByEvent: Map<string, number>;
  lateByEvent: Map<string, number>;
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

// A2 : la date de rang d'une ligne qui n'est pas en retard.
function rankDate(item: TodayItem, today: string): string {
  return item.dueOn ?? item.since ?? today;
}

function increment(map: Map<string, number>, key: string | null): void {
  if (key) map.set(key, (map.get(key) ?? 0) + 1);
}

export function rankToday(items: TodayItem[], today: string, horizonDays: number = TODAY_HORIZON_DAYS): RankedToday {
  const groups: Record<TodayGroup, RankedItem[]> = { overdue: [], today: [], waiting: [], upcoming: [] };
  const late: RankedItem[] = [];
  const rest: RankedItem[] = [];
  for (const entry of items) {
    const group = groupOf(entry, today, horizonDays);
    if (!group) continue;
    const ranked = { ...entry, group, daysLate: group === "overdue" ? -daysUntil(entry.dueOn!, today) : 0 };
    (group === "overdue" ? late : rest).push(ranked);
  }
  late.sort((a, b) => a.dueOn!.localeCompare(b.dueOn!) || byKey(a, b));
  rest.sort((a, b) => rankDate(a, today).localeCompare(rankDate(b, today)) || byKey(a, b));
  const all = [...late, ...rest];
  for (const entry of all) groups[entry.group].push(entry);
  const pointsByEvent = new Map<string, number>();
  const lateByEvent = new Map<string, number>();
  for (const entry of all) {
    increment(pointsByEvent, entry.eventId);
    if (entry.group === "overdue") increment(lateByEvent, entry.eventId);
  }
  return { first: all.slice(0, FIRST_COUNT), groups, all, points: all.length, late: late.length, pointsByEvent, lateByEvent };
}

// UX-01 : la prochaine action d'un évènement, première de ses urgences.
export function nextActionFor(ranked: RankedToday, eventId: string): RankedItem | null {
  return ranked.all.find((entry) => entry.eventId === eventId) ?? null;
}
