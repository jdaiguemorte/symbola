import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatMonth, parisToday, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getLinkEventView, getLinkVendorOptions, LinkAccessDeniedError, monthKey, type EventTask, type LinkAccess } from "@/modules/events/service";
import { getLinkBudgetView, LinkBudgetAccessDeniedError } from "@/modules/budget/service";
import { listClientQuotesToSign } from "@/modules/quotes/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { ClientBudget } from "./client-budget";
import { ClientQuotes } from "./client-quotes";
import { ClientVendorOptions } from "./client-vendor-options";
import { LinkPrivacyNotice } from "./link-privacy-notice";
import { declarablePaymentMethods } from "./payment-methods";
import { countdown, nextActions, progress } from "./portal-home";
import { closeLinkSessionAction, toggleLinkTaskAction } from "./actions";

// PRD-EVT-06, lot 26a (UX-11, POR-01, POR-10 ; ADR 0053) — le portail d'un tiers,
// ouvert par son lien personnel, sans compte. Il ne montre que les rubriques que
// la planner a ouvertes à ce lien (rien par défaut) ; chaque service relit
// l'accès du lien. Programme en variante « mariés », jamais de note interne.
// Lot 27a (POR-02, POR-05, POR-09) : accueil (compte à rebours, avancement, trois
// prochaines actions), budget en trois chiffres et échéances. Le même rendu sert
// l'aperçu « vu par » de la planner (preview) : actions inactives, fichiers
// fermés, aucune trace sur le lien.
export async function PortalContent({ access, preview = false, banner }: { access: LinkAccess; preview?: boolean; banner?: ReactNode }) {
  const { organizationId, linkId } = access;
  const t = await getTranslations("ClientSpace");
  const tLink = await getTranslations("LinkPortal");
  const tEvents = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  // Dégradation propre (CLAUDE.md § 2.2) : module désactivé = « indisponible ».
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main className="portal">
        {banner}
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
        <LinkPrivacyNotice organizationId={organizationId} />
      </main>
    );
  }

  let view;
  try {
    view = await getLinkEventView(organizationId, linkId);
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) redirect("/lien");
    throw error;
  }
  const rubrics = access.rights.rubrics;
  const today = parisToday();

  let budget = null;
  if (rubrics.includes("budget") && (await isBudgetModuleEnabled(organizationId))) {
    try {
      budget = await getLinkBudgetView(organizationId, linkId);
    } catch (error) {
      if (!(error instanceof LinkBudgetAccessDeniedError)) throw error;
    }
  }
  const methods = budget ? await declarablePaymentMethods(organizationId) : [];
  // DEV-02 : devis à signer, reconnus par l'e-mail du lien.
  const quotesToSign = rubrics.includes("quotes") && (await isQuotesModuleEnabled(organizationId)) ? await listClientQuotesToSign(organizationId, access.eventId, access.email) : [];
  let vendorOptions: Awaited<ReturnType<typeof getLinkVendorOptions>> = [];
  if (rubrics.includes("vendor_options")) {
    try {
      vendorOptions = await getLinkVendorOptions(organizationId, linkId);
    } catch (error) {
      if (!(error instanceof LinkAccessDeniedError)) throw error;
    }
  }

  const tasksByMonth = new Map<string, EventTask[]>();
  for (const task of view.tasks ?? []) {
    const key = monthKey(task.dueDate);
    tasksByMonth.set(key, [...(tasksByMonth.get(key) ?? []), task]);
  }
  const nothingShared = rubrics.length === 0;
  const until = countdown(view.event.eventDate, today);
  const done = view.tasks ? progress(view.tasks) : null;
  const actions = nextActions({ tasks: view.tasks, quotes: quotesToSign, payments: budget?.payments ?? null, today });
  const sections = [
    view.tasks ? ["taches", tLink("navTasks")] : null,
    view.program ? ["programme", tLink("navProgram")] : null,
    vendorOptions.length > 0 ? ["options", tLink("navOptions")] : null,
    budget ? ["budget", tLink("navBudget")] : null,
    quotesToSign.length > 0 ? ["devis", tLink("navQuotes")] : null,
  ].filter((entry): entry is [string, string] => entry !== null);

  const taskToggle = (task: Pick<EventTask, "id" | "label" | "done">) => (
    <form action={preview ? undefined : toggleLinkTaskAction}>
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="done" value={task.done ? "false" : "true"} />
      <button type="submit" disabled={preview}>
        {task.done ? tEvents("markTaskUndone", { label: task.label }) : tEvents("markTaskDone", { label: task.label })}
      </button>
    </form>
  );

  return (
    <main className="portal">
      {banner}
      <p className="muted">{tLink("greeting", { name: access.personName })}</p>
      <h1>{view.event.clients.map((client) => client.firstName).join(" & ")}</h1>
      <ScreenHelp title={tHelp("clientEvent.title")} body={tHelp("clientEvent.body")} />

      {/* POR-02 : accueil, avant les rubriques. */}
      <section aria-labelledby="portal-home-title" className="portal-home">
        <h2 id="portal-home-title" className="sr-only">
          {tLink("homeTitle")}
        </h2>
        <p>
          {tEvents("eventDate")} : {view.event.eventDate ? formatCalendarDate(view.event.eventDate, locale) : t("dateUnset")}
          {until.kind === "days" ? ` — ${tLink("countdownDays", { days: until.days })}` : ""}
          {until.kind === "tomorrow" ? ` — ${tLink("countdownTomorrow")}` : ""}
          {until.kind === "today" ? ` — ${tLink("countdownToday")}` : ""}
        </p>
        {done && done.total > 0 ? (
          <p className="portal-progress">
            <label htmlFor="portal-progress">{tLink("progressLabel", { done: done.done, total: done.total })}</label>
            <progress id="portal-progress" value={done.done} max={done.total} />
          </p>
        ) : null}
        {nothingShared ? (
          <p>{tLink("nothingShared")}</p>
        ) : (
          <>
            <h3>{tLink("nextActionsTitle")}</h3>
            {actions.length === 0 ? <p>{tLink("nothingToDo")}</p> : null}
            <ol className="next-actions">
              {actions.map((action) => (
                <li key={`${action.kind}-${action.id}`} className="card">
                  {action.kind === "task" ? (
                    <>
                      <p>
                        <strong>{action.label}</strong>
                      </p>
                      <p className={action.overdue ? "text-overdue" : "muted"}>
                        {action.overdue ? tLink("actionOverdue", { date: formatCalendarDate(action.dueDate, locale) }) : tLink("actionBefore", { date: formatCalendarDate(action.dueDate, locale) })}
                      </p>
                      {taskToggle({ id: action.id, label: action.label, done: false })}
                    </>
                  ) : null}
                  {action.kind === "payment" ? (
                    <>
                      <p>
                        <strong>{tLink("actionPayment", { label: [action.slotLabel, action.vendorName, action.label].filter(Boolean).join(" — "), amount: formatAmount(action.amountCents, locale) })}</strong>
                      </p>
                      <p className={action.overdue ? "text-overdue" : "muted"}>
                        {action.overdue ? tLink("actionOverdue", { date: formatCalendarDate(action.dueDate, locale) }) : tLink("actionBefore", { date: formatCalendarDate(action.dueDate, locale) })}
                      </p>
                      <a href="#echeances">{tLink("actionGoPayment")}</a>
                    </>
                  ) : null}
                  {action.kind === "quote" ? (
                    <>
                      <p>
                        <strong>{tLink("actionQuote", { number: action.number, version: action.version })}</strong>
                      </p>
                      <a href="#devis">{tLink("actionGoQuote")}</a>
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        )}
        {sections.length > 1 ? (
          <nav aria-label={tLink("contentsLabel")} className="portal-contents">
            <ul>
              {sections.map(([anchor, label]) => (
                <li key={anchor}>
                  <a href={`#${anchor}`}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </section>

      {view.tasks ? (
        <section aria-labelledby="portal-tasks-title" id="taches">
          <h2 id="portal-tasks-title">{tEvents("tasksTitle")}</h2>
          {view.tasks.length === 0 ? <p>{tEvents("noTasks")}</p> : null}
          {[...tasksByMonth.entries()].map(([month, monthTasks]) => (
            <section key={month} aria-labelledby={`client-tasks-${month}`}>
              <h3 id={`client-tasks-${month}`}>{formatMonth(`${month}-01`, locale)}</h3>
              <ul>
                {monthTasks.map((task) => (
                  <li key={task.id}>
                    <strong className={task.done ? "line-through" : undefined}>{task.label}</strong>
                    {" — "}
                    {formatCalendarDate(task.dueDate, locale)}
                    {" — "}
                    {task.responsible === "clients" ? t("responsibleYou") : t("responsiblePlanner")}
                    {task.done ? ` — ${tEvents("taskDone")}` : ""}
                    {task.responsible === "clients" ? taskToggle(task) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      ) : null}

      {view.program ? (
        <section aria-labelledby="portal-program-title" id="programme">
          <h2 id="portal-program-title">{tEvents("programTitle")}</h2>
          <p>{preview ? <span>{t("downloadProgram")}</span> : <a href="/portail/programme/pdf" download>{t("downloadProgram")}</a>}</p>
          {view.program.items.length === 0 ? <p>{tEvents("noProgramItems")}</p> : null}
          <ul aria-label={tEvents("programTitle")}>
            {view.program.items.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime} — {item.label}
                </strong>
                {item.location ? ` — ${item.location}` : ""}
                {item.participants.length > 0 ? ` — ${tEvents("programParticipants")} : ${item.participants.map((participant) => participant.label).join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {vendorOptions.length > 0 ? (
        <div id="options">
          <ClientVendorOptions groups={vendorOptions} locale={locale} preview={preview} />
        </div>
      ) : null}

      {budget ? (
        <section aria-labelledby="client-budget-title" id="budget">
          <h2 id="client-budget-title">{t("budgetTitle")}</h2>
          <ClientBudget view={budget} locale={locale} methods={methods} today={today} preview={preview} />
        </section>
      ) : null}

      {quotesToSign.length > 0 ? (
        <div id="devis">
          <ClientQuotes quotes={quotesToSign} locale={locale} preview={preview} />
        </div>
      ) : null}

      <p className="muted">{tLink("validUntil", { date: formatCalendarDate(access.expiresOn, locale) })}</p>
      <form action={preview ? undefined : closeLinkSessionAction}>
        <button type="submit" disabled={preview}>
          {tLink("closeSession")}
        </button>
      </form>
      <LinkPrivacyNotice organizationId={organizationId} />
    </main>
  );
}
