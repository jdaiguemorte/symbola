import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatMonth, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import {
  getEvent,
  getTaskRecalculation,
  listEventTasks,
  listEventVendorSlots,
  listTaskTemplates,
  listLossReasons,
  listProspectSources,
  monthKey,
  summarizeVendorSlots,
  type EventTask,
} from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { ChangeStatusForm } from "./change-status-form";
import {
  moveEventTaskAction,
  removeEventTaskAction,
  resolveRecalculationAction,
  toggleEventTaskAction,
} from "./task-actions";
import {
  AddEventTaskForm,
  ApplyTaskTemplateForm,
  EditEventTaskForm,
  EventDateForm,
} from "./task-forms";
import { RESPONSIBLE_LABEL_KEYS } from "./task-responsible";
import { removeVendorSlotAction } from "./vendor-slot-actions";
import { AddVendorSlotForm, VendorSlotForm } from "./vendor-slot-forms";
import { VENDOR_STATUS_COLORS, VENDOR_STATUS_LABEL_KEYS } from "./vendor-slot-status";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const { id } = await params;
  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");

  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  if (!isValidId(id)) notFound();

  const event = await getEvent(organizationId, id);
  if (!event) notFound();
  const [reasons, sources, vendorSlots, tasks, templates, recalculation] = await Promise.all([
    listLossReasons(organizationId),
    listProspectSources(organizationId),
    listEventVendorSlots(organizationId, id),
    listEventTasks(organizationId, id),
    listTaskTemplates(organizationId),
    getTaskRecalculation(organizationId, id),
  ]);
  const locale = (await getLocale()) as Locale;
  const progress = summarizeVendorSlots(vendorSlots);
  const sourceLabel = sources.find((candidate) => candidate.id === event.prospectSourceId)?.label;

  // EVT-04 : vue par mois, dans l'ordre renvoyé par le module.
  const tasksByMonth = new Map<string, EventTask[]>();
  for (const task of tasks) {
    const key = monthKey(task.dueDate);
    tasksByMonth.set(key, [...(tasksByMonth.get(key) ?? []), task]);
  }

  const clientNames = event.clients.length
    ? event.clients.map((client) => client.firstName).join(" & ")
    : t("noClient");

  // EVT-02 : « étant donné un événement confirmé dont la date est passée,
  // alors l'app propose de le passer en Réalisé ».
  const isPastConfirmed =
    event.status === "confirmed" && event.eventDate !== null && event.eventDate < new Date().toISOString().slice(0, 10);

  return (
    <main>
      <h1>{clientNames}</h1>
      <HelpButton title={tHelp("eventsDetail.title")} body={tHelp("eventsDetail.body")} />

      {/* EVT-03 : barre d'avancement en haut de la fiche. */}
      <p id="vendor-progress-label">
        {t("vendorProgress", { booked: progress.booked, required: progress.required })}
      </p>
      <progress
        aria-labelledby="vendor-progress-label"
        value={progress.booked}
        max={Math.max(progress.required, 1)}
      />

      <p>
        {t("eventDate")} : {event.eventDate ? formatCalendarDate(event.eventDate, locale) : t("dateUnset")}
      </p>
      <EventDateForm eventId={event.id} eventDate={event.eventDate} />
      <p>
        {t("venueName")} : {event.venueName ?? "—"} {event.venueCity ? `(${event.venueCity})` : ""}
      </p>
      <p>
        {t("source")} : {sourceLabel ?? "—"}
      </p>

      {isPastConfirmed ? <p role="status">{t("suggestMarkDone")}</p> : null}

      <ChangeStatusForm eventId={event.id} currentStatus={event.status} reasons={reasons} />

      <h2>{t("vendorSlotsTitle")}</h2>
      {vendorSlots.length === 0 ? <p>{t("noVendorSlots")}</p> : null}
      <ul>
        {vendorSlots.map((slot) => (
          <li key={slot.id}>
            <strong>{slot.label}</strong>{" "}
            <span style={{ ...VENDOR_STATUS_COLORS[slot.status], padding: "0 0.4em", borderRadius: "0.3em" }}>
              {t(VENDOR_STATUS_LABEL_KEYS[slot.status])}
            </span>
            {slot.status === "booked" && slot.vendorName ? ` — ${slot.vendorName}` : ""}
            {slot.status === "booked" && slot.amountCents !== null ? ` — ${formatAmount(slot.amountCents, locale)}` : ""}
            <VendorSlotForm eventId={event.id} slot={slot} />
            <form action={removeVendorSlotAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="vendorSlotId" value={slot.id} />
              <button type="submit">{t("removeVendorSlot", { label: slot.label })}</button>
            </form>
          </li>
        ))}
      </ul>
      <AddVendorSlotForm eventId={event.id} />

      {/* EVT-04 : rétroplanning. */}
      <h2>{t("tasksTitle")}</h2>
      {recalculation.pending ? (
        <section aria-labelledby="recalculation-title">
          <h3 id="recalculation-title">{t("recalculationTitle")}</h3>
          <p>
            {t("recalculationProposal", {
              days: Math.abs(recalculation.shiftDays),
              direction: recalculation.shiftDays > 0 ? "later" : "earlier",
              count: recalculation.undoneTasks,
            })}
          </p>
          <form action={resolveRecalculationAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit" name="decision" value="accept">
              {t("recalculationAccept")}
            </button>{" "}
            <button type="submit" name="decision" value="decline">
              {t("recalculationDecline")}
            </button>
          </form>
        </section>
      ) : null}

      {!event.eventDate ? (
        <p>{t("taskTemplateNeedsDate")}</p>
      ) : templates.length === 0 ? (
        <p>
          {t("noTaskTemplates")} <Link href="/events/modeles">{t("taskTemplatesLink")}</Link>
        </p>
      ) : !recalculation.pending ? (
        <ApplyTaskTemplateForm eventId={event.id} templates={templates} />
      ) : null}

      {tasks.length === 0 ? <p>{t("noTasks")}</p> : null}
      {[...tasksByMonth.entries()].map(([month, monthTasks]) => (
        <section key={month} aria-labelledby={`tasks-${month}`}>
          <h3 id={`tasks-${month}`}>{formatMonth(`${month}-01`, locale)}</h3>
          <ul>
            {monthTasks.map((task, index) => (
              <li key={task.id}>
                <strong style={task.done ? { textDecoration: "line-through" } : undefined}>{task.label}</strong>
                {" — "}
                {formatCalendarDate(task.dueDate, locale)}
                {" — "}
                {t(RESPONSIBLE_LABEL_KEYS[task.responsible])}
                {task.done ? ` — ${t("taskDone")}` : ""}
                <form action={toggleEventTaskAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="done" value={task.done ? "false" : "true"} />
                  <button type="submit">
                    {task.done ? t("markTaskUndone", { label: task.label }) : t("markTaskDone", { label: task.label })}
                  </button>
                </form>
                <form action={moveEventTaskAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <button type="submit" name="direction" value="up" disabled={index === 0}>
                    {t("moveTaskUp", { label: task.label })}
                  </button>{" "}
                  <button type="submit" name="direction" value="down" disabled={index === monthTasks.length - 1}>
                    {t("moveTaskDown", { label: task.label })}
                  </button>
                </form>
                {/* Clé liée au contenu : après un recalcul, le formulaire repart des nouvelles valeurs. */}
                <EditEventTaskForm
                  key={`${task.id}-${task.dueDate}-${task.label}-${task.responsible}`}
                  eventId={event.id}
                  task={task}
                />
                <form action={removeEventTaskAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <button type="submit">{t("removeTask", { label: task.label })}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <AddEventTaskForm eventId={event.id} />
    </main>
  );
}
