import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatDateTime, formatMonth, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import {
  getEvent,
  getEventProgram,
  getTaskRecalculation,
  listEventActivity,
  listEventClientAccesses,
  listEventTasks,
  listEventVendorSlots,
  listTaskTemplates,
  listLossReasons,
  listProgramTemplates,
  listProspectSources,
  monthKey,
  summarizeVendorSlots,
  type EventTask,
} from "@/modules/events/service";
import { getEventBudget, listBudgetLines } from "@/modules/budget/service";
import { confirmEventBudgetAction } from "@/app/budget/[eventId]/actions";
import { listEventQuotes } from "@/modules/quotes/service";
import { createQuoteAction } from "@/app/devis/actions";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { QUOTE_STATUS_LABEL_KEYS } from "@/app/devis/quote-display";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { ChangeStatusForm } from "./change-status-form";
import { endTrialAction } from "../trial-actions";
import { revokeClientAccessAction } from "./client-access-actions";
import { InviteClientForm } from "./client-access-forms";
import { removeProgramItemAction } from "./program-actions";
import { AddProgramItemForm, ApplyProgramTemplateForm, EditProgramItemForm } from "./program-forms";
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

const CLIENT_ACCESS_STATUS_KEYS = {
  invited: "clientAccessInvited",
  active: "clientAccessActive",
  expired: "clientAccessExpired",
  revoked: "clientAccessRevoked",
} as const;

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
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
  const [reasons, sources, vendorSlots, tasks, templates, recalculation, program, programTemplates, clientAccesses, activity] =
    await Promise.all([
      listLossReasons(organizationId),
      listProspectSources(organizationId),
      listEventVendorSlots(organizationId, id),
      listEventTasks(organizationId, id),
      listTaskTemplates(organizationId),
      getTaskRecalculation(organizationId, id),
      getEventProgram(organizationId, id),
      listProgramTemplates(organizationId),
      listEventClientAccesses(organizationId, id),
      listEventActivity(organizationId, id),
    ]);
  const programLabels = new Map(program.items.map((item) => [item.id, item.label]));
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

  // BUD-01/02 : « quand l'événement passe en Confirmé, l'app propose
  // d'en faire le budget prévu » — seulement si une simulation existe et
  // qu'aucune ligne de budget (budget_lines) n'a encore été créée.
  let suggestConfirmBudget = false;
  if (event.status === "confirmed") {
    const [eventBudget, linesView] = await Promise.all([
      getEventBudget(organizationId, id),
      listBudgetLines(organizationId, id),
    ]);
    suggestConfirmBudget = eventBudget !== null && linesView.lines.length === 0;
  }

  // DEV-01 : devis de l'événement, masqués si le module n'est pas souscrit
  // (dégradation propre, CLAUDE.md §2.3).
  const quotesAvailable = await isQuotesModuleEnabled(organizationId);
  const quotes = quotesAvailable ? await listEventQuotes(organizationId, id) : [];
  const tQuotes = await getTranslations("Quotes");

  return (
    <main>
      <h1>{clientNames}</h1>
      {/* AIDE-02 : bandeau de l'essai guidé, sur données fictives. */}
      {event.isDemo ? (
        <section aria-labelledby="trial-banner-title">
          <h2 id="trial-banner-title">{t("trialBannerTitle")}</h2>
          <p>{t("trialBannerBody")}</p>
          <ol>
            <li>{t("trialStepStatus")}</li>
            <li>{t("trialStepVendor")}</li>
            <li>{t("trialStepTask")}</li>
            <li>{t("trialStepProgram")}</li>
          </ol>
          <form action={endTrialAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit">{t("trialEnd")}</button>
          </form>
        </section>
      ) : null}
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

      {/* Lot 3, BUD-01/02 : simulation/suivi budgétaire de cet événement. */}
      <p>
        <Link href={`/budget/${event.id}`}>{t("budgetLink")}</Link>
      </p>
      {suggestConfirmBudget ? (
        <section aria-labelledby="confirm-budget-title">
          <h2 id="confirm-budget-title">{t("confirmBudgetTitle")}</h2>
          <p>{t("confirmBudgetBody")}</p>
          <form action={confirmEventBudgetAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit">{t("confirmAsPlanned")}</button>
          </form>
        </section>
      ) : null}

      {quotesAvailable ? (
        <section aria-labelledby="event-quotes-title">
          <h2 id="event-quotes-title">{tQuotes("eventQuotesTitle")}</h2>
          {quotes.length === 0 ? <p>{tQuotes("noEventQuotes")}</p> : null}
          <ul>
            {quotes.map((quote) => (
              <li key={quote.id}>
                <Link href={`/devis/${quote.id}`}>{quote.number}</Link> — {tQuotes(QUOTE_STATUS_LABEL_KEYS[quote.status])} —{" "}
                {tQuotes("versionLabel", { version: quote.currentVersion })} — {formatAmount(quote.totalTtcCents, locale)}
              </li>
            ))}
          </ul>
          <form action={createQuoteAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit">{tQuotes("createQuote")}</button>
          </form>
        </section>
      ) : null}

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

      {/* EVT-05 : programme du jour J. */}
      <h2>{t("programTitle")}</h2>
      <nav aria-label={t("programExports")}>
        <a href={`/events/${event.id}/programme/pdf?variant=couple`} download>
          {t("programExportCouple")}
        </a>
        {" · "}
        <a href={`/events/${event.id}/programme/pdf?variant=vendors`} download>
          {t("programExportVendors")}
        </a>
      </nav>
      {program.overlaps.length > 0 ? (
        <section aria-labelledby="program-overlaps-title">
          <h3 id="program-overlaps-title">{t("programOverlapsTitle")}</h3>
          <ul>
            {program.overlaps.map((overlap) => (
              <li key={`${overlap.participant}-${overlap.itemIds.join("-")}`}>
                {t("programOverlap", {
                  participant: overlap.participant,
                  first: programLabels.get(overlap.itemIds[0]) ?? "",
                  second: programLabels.get(overlap.itemIds[1]) ?? "",
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {programTemplates.length > 0 ? (
        <ApplyProgramTemplateForm eventId={event.id} templates={programTemplates} />
      ) : (
        <p>
          {t("noProgramTemplates")} <Link href="/events/modeles-programme">{t("programTemplatesLink")}</Link>
        </p>
      )}
      {program.items.length === 0 ? <p>{t("noProgramItems")}</p> : null}
      <ul aria-label={t("programTitle")}>
        {program.items.map((item) => (
          <li key={item.id}>
            <strong>
              {item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime} — {item.label}
            </strong>
            {item.location ? ` — ${item.location}` : ""}
            {item.participants.length > 0
              ? ` — ${t("programParticipants")} : ${item.participants.map((participant) => participant.label).join(", ")}`
              : ""}
            {item.internalNote ? (
              <p>
                {t("programInternalNote")} : {item.internalNote}
              </p>
            ) : null}
            <EditProgramItemForm
              key={JSON.stringify(item)}
              eventId={event.id}
              item={item}
              vendorSlots={vendorSlots}
            />
            <form action={removeProgramItemAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="itemId" value={item.id} />
              <button type="submit">{t("removeProgramItem", { label: item.label })}</button>
            </form>
          </li>
        ))}
      </ul>
      <AddProgramItemForm eventId={event.id} vendorSlots={vendorSlots} />

      {/* EVT-06 : accès des mariés et fil d'activité. */}
      <h2>{t("clientAccessTitle")}</h2>
      <p>{t("clientAccessIntro")}</p>
      {clientAccesses.length === 0 ? <p>{t("noClientAccess")}</p> : null}
      <ul aria-label={t("clientAccessTitle")}>
        {clientAccesses.map((access) => (
          <li key={access.id}>
            {access.email} — {t(CLIENT_ACCESS_STATUS_KEYS[access.status])}
            {access.status === "active" || access.status === "invited" ? (
              <form action={revokeClientAccessAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="accessId" value={access.id} />
                <button type="submit">{t("revokeClientAccess", { email: access.email })}</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {event.isDemo ? <p>{t("trialNoInvite")}</p> : <InviteClientForm eventId={event.id} />}

      <h2>{t("activityTitle")}</h2>
      {activity.length === 0 ? <p>{t("noActivity")}</p> : null}
      <ul aria-label={t("activityTitle")}>
        {activity.map((entry) => (
          <li key={entry.id}>
            {formatDateTime(new Date(entry.createdAt), locale)} —{" "}
            {t(entry.kind === "task_done" ? "activityTaskDone" : "activityTaskUndone", {
              actor: entry.actorEmail ?? t("activityFormerClient"),
              task: entry.taskLabel,
            })}
          </li>
        ))}
      </ul>
    </main>
  );
}
