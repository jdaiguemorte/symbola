// Lot 72c (PAR-10, HUB-03, HUB-08 ; C-14, A7, J3, J4 ; spécification du lot 72, § 5.3 ; maquette 14 du lot 68)
// — « Moi · L'agence » sur « Aujourd'hui », règles pures :
// - la bascule n'existe que dans une agence (plus d'un membre actif) ; « Moi » par défaut ; `?vue=agence` et
//   `?vue=moi` choisissent, le dernier choix est gardé sur l'appareil (cookie, J4) ; les vues du calendrier
//   (`?vue=semaine`, `?vue=mois`) sont celles de « Moi » ;
// - « Mes évènements » de « Moi » : ceux dont on est planner principal, ceux sans planner principal (J3), et
//   ceux d'une ligne qui nous revient ;
// - la vue d'agence : une ligne par membre actif (la personne en tête), un accès retiré seulement s'il lui reste
//   des tâches ; « Attendu des mariés ou d'un prestataire » ; « Sans personne » (tâches sans personne de
//   l'équipe), pour que la colonne « En retard » se recompte (critère 2) ; les évènements avec un retard (le
//   plus de retards, puis la date la plus proche), les évènements à jour repliés et lus seulement sur demande
//   (aucune ligne cachée dans la page, critère 5) ; le filtre « Planner principal » filtre la table.
import type { AgencyOverview, AgencyWhoCounts, EventSummary } from "@symbola/contracts";
import type { TaskMemberOption } from "@/app/events/[id]/task-responsible";
import type { MeScopeInput } from "./scope";

export type HomeScope = "me" | "agency";
export const HOME_SCOPE_COOKIE = "symbola_accueil_vue";
// La valeur du cookie et du paramètre `vue` : des mots d'adresse, jamais affichés.
export const HOME_SCOPE_WORDS: Record<HomeScope, string> = { me: "moi", agency: "agence" };

export function homeScope(input: { vue: string | undefined; cookie: string | undefined; activeMembers: number }): { toggle: boolean; scope: HomeScope; remember: HomeScope | null } {
  if (input.activeMembers <= 1) return { toggle: false, scope: "me", remember: null };
  if (input.vue === HOME_SCOPE_WORDS.agency) return { toggle: true, scope: "agency", remember: "agency" };
  if (input.vue === HOME_SCOPE_WORDS.me) return { toggle: true, scope: "me", remember: "me" };
  if (input.vue) return { toggle: true, scope: "me", remember: null };
  return { toggle: true, scope: input.cookie === HOME_SCOPE_WORDS.agency ? "agency" : "me", remember: null };
}

export function meEvents<T extends Pick<EventSummary, "id">>(events: T[], input: MeScopeInput, scopedItems: { eventId: string | null }[]): T[] {
  if (input.activeMembers <= 1) return events;
  const mine = new Set(scopedItems.flatMap((item) => (item.eventId ? [item.eventId] : [])));
  return events.filter((event) => {
    const lead = input.leads.get(event.id);
    return !lead || lead === input.userId || mine.has(event.id);
  });
}

export type AgencyCounts = { late: number; today: number; horizon: number };
export type AgencyPerson = AgencyCounts & { id: string; name: string; initials: string; me: boolean; removed: boolean; followed: number; href: string };
export type AgencyEventRow<E extends EventSummary = EventSummary> = { event: E; leadId: string | null; leadName: string | null; done: number; total: number; late: number; oldestLate: { label: string; dueDate: string } | null };
export type AgencyView<E extends EventSummary = EventSummary> = {
  late: number;
  lateEvents: number;
  people: AgencyPerson[];
  expected: AgencyCounts;
  nobody: AgencyCounts | null;
  withDelay: AgencyEventRow<E>[];
  upToDate: AgencyEventRow<E>[];
  upToDateCount: number;
  leadOptions: { id: string; name: string }[];
  plannerFilter: string | null;
};

const ZERO: AgencyCounts = { late: 0, today: 0, horizon: 0 };

function add(a: AgencyCounts, b: AgencyCounts): AgencyCounts {
  return { late: a.late + b.late, today: a.today + b.today, horizon: a.horizon + b.horizon };
}

function countsOf(row: AgencyWhoCounts | undefined): AgencyCounts {
  return row ? { late: row.late, today: row.today, horizon: row.horizon } : ZERO;
}

export function personTasksHref(userId: string): string {
  return `/taches?${new URLSearchParams({ qui: userId, grouper: "evenement" }).toString()}`;
}

export function agencyView<E extends EventSummary>(input: { overview: AgencyOverview; members: TaskMemberOption[]; events: E[]; leads: ReadonlyMap<string, string>; plannerFilter: string | null; showUpToDate: boolean }): AgencyView<E> {
  const byWho = new Map(input.overview.byWho.map((row) => [row.who, row]));
  const known = new Set(input.members.map((member) => `member:${member.id}`));
  const people: AgencyPerson[] = input.members.flatMap((member) => {
    const counts = countsOf(byWho.get(`member:${member.id}`));
    if (member.removed && counts.horizon === 0) return [];
    return [{ ...counts, id: member.id, name: member.name, initials: member.initials ?? "", me: member.me, removed: member.removed, followed: input.overview.followedBy[member.id] ?? 0, href: personTasksHref(member.id) }];
  });
  // Sans personne de l'équipe : les tâches à personne, et celles d'un compte qui n'est plus de l'équipe.
  let nobody = countsOf(byWho.get("nobody"));
  for (const row of input.overview.byWho) if (row.who.startsWith("member:") && !known.has(row.who)) nobody = add(nobody, countsOf(row));
  const expected = add(countsOf(byWho.get("clients")), countsOf(byWho.get("vendors")));

  const names = new Map(input.members.map((member) => [member.id, member.name]));
  const progress = new Map(input.overview.byEvent.map((row) => [row.eventId, row]));
  const rows: AgencyEventRow<E>[] = input.events.map((event) => {
    const counts = progress.get(event.id);
    const leadId = input.leads.get(event.id) ?? null;
    return { event, leadId, leadName: leadId ? (names.get(leadId) ?? null) : null, done: counts?.done ?? 0, total: counts?.total ?? 0, late: counts?.late ?? 0, oldestLate: counts?.oldestLate ?? null };
  });
  const leadIds = new Set(rows.flatMap((row) => (row.leadId ? [row.leadId] : [])));
  const leadOptions = input.members.filter((member) => leadIds.has(member.id)).map((member) => ({ id: member.id, name: member.name }));
  const plannerFilter = input.plannerFilter && leadIds.has(input.plannerFilter) ? input.plannerFilter : null;
  const filtered = plannerFilter ? rows.filter((row) => row.leadId === plannerFilter) : rows;
  const byDate = (a: AgencyEventRow<E>, b: AgencyEventRow<E>) => (a.event.eventDate ?? "9999-12-31").localeCompare(b.event.eventDate ?? "9999-12-31");
  const withDelay = filtered.filter((row) => row.late > 0).sort((a, b) => b.late - a.late || byDate(a, b));
  const upToDate = filtered.filter((row) => row.late === 0).sort(byDate);

  const late = people.reduce((sum, person) => sum + person.late, 0) + expected.late + nobody.late;
  return {
    late,
    lateEvents: rows.filter((row) => row.late > 0).length,
    people,
    expected,
    nobody: nobody.horizon > 0 ? nobody : null,
    withDelay,
    upToDate: input.showUpToDate ? upToDate : [],
    upToDateCount: upToDate.length,
    leadOptions,
    plannerFilter,
  };
}
