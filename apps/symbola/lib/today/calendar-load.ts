// Lot 63d (HUB-08, BUD-03, BUD-11, CHR-03 ; maquette M3) — ce que montre le calendrier du mois
// d'« Aujourd'hui », lu par la porte d'entrée de chaque module (ARC-01) : évènements et tâches (events),
// rendez-vous (appointments), échéances des prestataires non réglées (budget). Un module non souscrit
// n'apporte rien (ARC-06) ; une source en panne est signalée et le reste s'affiche (ARC-07).
import { formatAmount, type Locale } from "@symbola/i18n";
import { appointmentsCalendarColor, paymentsCalendarColor } from "@symbola/starter-templates";
import { eventNames, FIRM_STATUSES, listEvents, listOrganizationTasks, listStandaloneTasks, TENTATIVE_STATUSES, type TaskCategory } from "@/modules/events/service";
import { listVendorPaymentsDueBetween } from "@/modules/budget/service";
import { listAgendaAppointments } from "@/modules/appointments/service";
import { withinScope } from "@/lib/event-visibility";
import { addDays, parisDay, type CalendarItem } from "./calendar";

export type CalendarModules = { events: boolean; budget: boolean; appointments?: boolean };
export type CalendarSource = "events" | "tasks" | "appointments" | "budget";
export type CalendarWords = { payments: string; standaloneTask: string };

const SHOWN: readonly string[] = [...FIRM_STATUSES, ...TENTATIVE_STATUSES];

function time(instant: string): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(instant));
}

export async function loadCalendarItems(input: {
  organizationId: string;
  modules: CalendarModules;
  from: string;
  until: string;
  today: string;
  locale: Locale;
  // Lot 52 (EVT-06) : les évènements visibles de la personne ; null : tous.
  scope: Set<string> | null;
  categories: TaskCategory[];
  words: CalendarWords;
}): Promise<{ items: CalendarItem[]; unavailable: CalendarSource[] }> {
  const { organizationId, modules, from, until, today, locale, scope, categories, words } = input;
  const inRange = (date: string) => date >= from && date <= until;
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const items: CalendarItem[] = [];
  const unavailable: CalendarSource[] = [];
  const names = new Map<string, string>();

  const attempt = async (source: CalendarSource, enabled: boolean, load: () => Promise<void>) => {
    if (!enabled) return;
    try {
      await load();
    } catch {
      unavailable.push(source);
    }
  };

  await attempt("events", modules.events, async () => {
    const events = withinScope(scope, await listEvents({ organizationId }), (event) => event.id);
    for (const event of events) {
      names.set(event.id, eventNames(event.clients));
      if (event.isDemo || !event.eventDate || !inRange(event.eventDate) || !SHOWN.includes(event.status)) continue;
      items.push({ key: `event:${event.id}`, kind: "event", date: event.eventDate, label: eventNames(event.clients), detail: null, href: `/events/${event.id}`, color: null, categoryLabel: null, overdue: false, highPriority: false, time: null });
    }
  });

  await attempt("tasks", modules.events, async () => {
    const tasks = withinScope(scope, await listOrganizationTasks({ organizationId, today, horizonDays: null }), (task) => task.eventId);
    for (const task of tasks) {
      if (task.event.isDemo || !inRange(task.dueDate)) continue;
      const category = task.categoryId ? categoryById.get(task.categoryId) : undefined;
      items.push({
        key: `task:${task.id}`,
        kind: "task",
        date: task.dueDate,
        label: task.label,
        detail: task.event.names,
        href: `/taches?tache=${task.id}`,
        color: category?.color ?? null,
        categoryLabel: category?.label ?? null,
        overdue: task.overdue,
        highPriority: task.priority === "high",
        time: null,
      });
    }
    for (const task of await listStandaloneTasks(organizationId, { until })) {
      if (!inRange(task.dueDate)) continue;
      items.push({ key: `task:${task.id}`, kind: "task", date: task.dueDate, label: task.label, detail: words.standaloneTask, href: "/taches#hors-evenement", color: null, categoryLabel: null, overdue: task.dueDate < today, highPriority: false, time: null });
    }
  });

  await attempt("appointments", modules.appointments === true, async () => {
    // Un jour de marge de chaque côté : le jour de Paris d'un instant peut être la veille ou le lendemain UTC.
    const appointments = await listAgendaAppointments(organizationId, new Date(`${addDays(from, -1)}T00:00:00Z`), new Date(`${addDays(until, 2)}T00:00:00Z`));
    for (const appointment of withinScope(scope, appointments, (row) => row.eventId)) {
      const date = parisDay(appointment.startsAt);
      if (!inRange(date)) continue;
      const at = time(appointment.startsAt);
      items.push({
        key: `appointment:${appointment.id}`,
        kind: "appointment",
        date,
        label: `${at} ${appointment.typeName}`,
        detail: appointment.personName,
        href: `/rendez-vous/${appointment.id}`,
        color: appointmentsCalendarColor(),
        categoryLabel: null,
        overdue: false,
        highPriority: false,
        time: at,
      });
    }
  });

  await attempt("budget", modules.budget, async () => {
    const payments = withinScope(scope, await listVendorPaymentsDueBetween(organizationId, today, from, until), (payment) => payment.eventId);
    for (const payment of payments) {
      items.push({
        key: `payment:${payment.id}`,
        kind: "payment",
        date: payment.dueOn,
        label: `${payment.label} ${payment.vendorName ?? payment.lineLabel} ${formatAmount(payment.amountCents, locale)}`,
        detail: payment.eventName || names.get(payment.eventId) || null,
        href: `/events/${payment.eventId}?onglet=budget`,
        color: paymentsCalendarColor(),
        categoryLabel: words.payments,
        overdue: payment.overdue,
        highPriority: false,
        time: null,
      });
    }
  });

  return { items, unavailable };
}
