// Lot 70c (CHR-02, CHR-03, UX-05 ; D3, A1, M4) — prépare, côté serveur, les lignes types d'un écran
// (« Tâches », la fiche, « Aujourd'hui ») : les mots traduits, les dates écrites, la personne nommée, le
// mot des clients du type de chaque évènement, les raccourcis de « Changer la date » et les choix de
// « Confier à… ». Les noms des collègues ne quittent jamais l'équipe (SEC-20).
import { createTranslator } from "next-intl";
import { getTranslations } from "next-intl/server";
import { formatMonth, formatShortCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { ENGAGED_CANDIDATE_STATUSES } from "@symbola/contracts";
import { listVendorCandidates, monthKey } from "@/modules/events/service";
import type { TaskMemberOption } from "@/app/events/[id]/task-responsible";
import { eventAudiences, messagesFor, organizationAudience } from "@/lib/vocabulary";
import { buildTaskLine, nameInitials, type TaskLineSource, type TaskLineView } from "./task-line";
import { DATE_SHORTCUTS, shortcutDate } from "./date-shortcuts";
import { eventTaskHref } from "./task-tab";
import type { DateShortcutOption } from "@/app/ui/task-date-panel";
import type { AssignOption } from "@/app/ui/task-assign-panel";
import type { TaskLineGroup } from "@/app/ui/task-line";

// Le mot des clients pour un évènement (« Les mariés », « Les clients »), selon son type (ADR 0045).
export async function clientsTerms(organizationId: string, locale: Locale): Promise<(eventId: string | null) => string> {
  const audiences = await eventAudiences(organizationId);
  const fallback = await organizationAudience(organizationId);
  const words = {
    couple: createTranslator({ locale, messages: messagesFor(locale, "couple"), namespace: "TaskLine" })("theClients"),
    clients: createTranslator({ locale, messages: messagesFor(locale, "clients"), namespace: "TaskLine" })("theClients"),
  };
  return (eventId) => words[(eventId ? audiences.get(eventId) : undefined) ?? fallback];
}

// Les prestataires retenus de chaque évènement, à qui confier une tâche (lot 34b).
export async function engagedVendors(organizationId: string, eventIds: string[]): Promise<Map<string, { candidateId: string; name: string }[]>> {
  const result = new Map<string, { candidateId: string; name: string }[]>();
  await Promise.all(
    [...new Set(eventIds)].map(async (eventId) => {
      const candidates = await listVendorCandidates(organizationId, eventId);
      result.set(
        eventId,
        candidates.filter((candidate) => ENGAGED_CANDIDATE_STATUSES.includes(candidate.status)).map((candidate) => ({ candidateId: candidate.id, name: candidate.vendorName })),
      );
    }),
  );
  return result;
}

// Lot 70d (D1) : l'instant d'une coche, à l'heure de Paris : « 25 nov. », « 14 h 40 ».
export function doneMoment(instant: string, locale: Locale): { day: string; date: string; time: string } {
  const at = new Date(instant);
  const intl = locale === "fr" ? "fr-FR" : "en-GB";
  const date = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(at).replace(/[\u00a0\u202f]/g, " ");
  const parts = new Intl.DateTimeFormat(intl, { hour: "numeric", minute: "2-digit", hour12: locale !== "fr", timeZone: "Europe/Paris" }).formatToParts(at);
  const time =
    locale === "fr"
      ? `${parts.find((part) => part.type === "hour")?.value ?? ""} h ${parts.find((part) => part.type === "minute")?.value ?? ""}`
      : parts
          .map((part) => part.value)
          .join("")
          .replace(/[\u00a0\u202f]/g, " ");
  return { day: parisToday(at), date, time };
}

export function dateShortcutOptions(locale: Locale, today: string = parisToday()): DateShortcutOption[] {
  return DATE_SHORTCUTS.map((key) => {
    const date = shortcutDate(key, today);
    return { key, date, label: formatShortCalendarDate(date, locale) };
  });
}

export type TaskLinesInput = {
  organizationId: string;
  locale: Locale;
  tasks: TaskLineSource[];
  members: TaskMemberOption[];
  // L'adresse qui ouvre le panneau de la tâche, sur l'écran courant.
  href: (task: TaskLineSource) => string;
  // Faut-il les prestataires retenus (fiche) ? Sur « Tâches » et « Aujourd'hui », on ne les lit que pour
  // nommer ceux qui ont une tâche.
  vendors?: Map<string, { candidateId: string; name: string }[]>;
};

export type TaskLines = {
  lines: TaskLineView[];
  shortcuts: DateShortcutOption[];
  assignOptions: Record<string, AssignOption[]>;
};

export async function buildTaskLines(input: TaskLinesInput): Promise<TaskLines> {
  const t = await getTranslations("TaskLine");
  const clientsLabel = await clientsTerms(input.organizationId, input.locale);
  const eventIds = input.tasks.flatMap((task) => (task.eventId ? [task.eventId] : []));
  const vendors = input.vendors ?? (await engagedVendors(input.organizationId, input.tasks.filter((task) => task.responsible === "vendor" && task.eventId).map((task) => task.eventId!)));
  const vendorNames = new Map([...vendors.values()].flat().map((vendor) => [vendor.candidateId, vendor.name]));
  const lines = input.tasks.map((task) =>
    buildTaskLine(task, {
      t: (key, values) => t(key as Parameters<typeof t>[0], values as never),
      formatDate: (date) => formatShortCalendarDate(date, input.locale),
      members: input.members,
      vendorName: (id) => vendorNames.get(id) ?? null,
      clientsLabel,
      href: input.href,
      eventHref: (eventId) => eventTaskHref(eventId),
      formatDone: (instant) => doneMoment(instant, input.locale),
    }),
  );
  const active = input.members.filter((member) => !member.removed);
  const memberOptions: AssignOption[] = active.map((member) => ({ value: `member:${member.id}`, label: member.me ? t("you") : member.name, initials: member.initials ?? nameInitials(member.name) }));
  const assignOptions: Record<string, AssignOption[]> = { none: memberOptions };
  for (const eventId of new Set(eventIds)) {
    const clients = clientsLabel(eventId);
    assignOptions[eventId] = [
      ...memberOptions,
      { value: "clients", label: clients, initials: nameInitials(clients) },
      ...(vendors.get(eventId) ?? []).map((vendor) => ({ value: `vendor:${vendor.candidateId}`, label: vendor.name, initials: nameInitials(vendor.name) })),
    ];
  }
  return { lines, shortcuts: dateShortcutOptions(input.locale), assignOptions };
}

// Regroupées par mois d'échéance, dans l'ordre reçu.
export function linesByMonth(lines: TaskLineView[], locale: Locale): TaskLineGroup[] {
  const groups = new Map<string, TaskLineGroup>();
  for (const line of lines) {
    const key = monthKey(line.dueDate);
    const group = groups.get(key) ?? { key, label: formatMonth(`${key}-01`, locale), lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }
  return [...groups.values()];
}
