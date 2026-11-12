import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, formatMonth, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getLinkEventView, getLinkVendorOptions, LinkAccessDeniedError, monthKey, type EventTask } from "@/modules/events/service";
import { getLinkBudgetView, LinkBudgetAccessDeniedError } from "@/modules/budget/service";
import { listClientQuotesToSign } from "@/modules/quotes/service";
import { requireLink } from "@/lib/guards";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { ClientBudget } from "./client-budget";
import { ClientQuotes } from "./client-quotes";
import { ClientVendorOptions } from "./client-vendor-options";
import { LinkPrivacyNotice } from "./link-privacy-notice";
import { closeLinkSessionAction, toggleLinkTaskAction } from "./actions";

// PRD-EVT-06, lot 26a (UX-11, POR-01, POR-10 ; ADR 0053) — le portail d'un tiers,
// ouvert par son lien personnel, sans compte. Il ne montre que les rubriques que
// la planner a ouvertes à ce lien (rien par défaut) ; chaque service relit
// l'accès du lien. Programme en variante « mariés », jamais de note interne.
// Le contenu nouveau du portail vient au lot 27.
export default async function PortalPage() {
  // Lot 26b (SC-S3) : le portail est celui du client.
  const access = await requireLink("client");
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

  let budget = null;
  if (rubrics.includes("budget") && (await isBudgetModuleEnabled(organizationId))) {
    try {
      budget = await getLinkBudgetView(organizationId, linkId);
    } catch (error) {
      if (!(error instanceof LinkBudgetAccessDeniedError)) throw error;
    }
  }
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

  return (
    <main className="portal">
      <p className="muted">{tLink("greeting", { name: access.personName })}</p>
      <h1>{view.event.clients.map((client) => client.firstName).join(" & ")}</h1>
      <ScreenHelp title={tHelp("clientEvent.title")} body={tHelp("clientEvent.body")} />
      <p>
        {tEvents("eventDate")} : {view.event.eventDate ? formatCalendarDate(view.event.eventDate, locale) : t("dateUnset")}
      </p>
      {nothingShared ? <p>{tLink("nothingShared")}</p> : null}

      {view.tasks ? (
        <>
          <h2>{tEvents("tasksTitle")}</h2>
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
                    {task.responsible === "clients" ? (
                      <form action={toggleLinkTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="done" value={task.done ? "false" : "true"} />
                        <button type="submit">{task.done ? tEvents("markTaskUndone", { label: task.label }) : tEvents("markTaskDone", { label: task.label })}</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : null}

      {view.program ? (
        <>
          <h2>{tEvents("programTitle")}</h2>
          <p>
            <a href="/portail/programme/pdf" download>
              {t("downloadProgram")}
            </a>
          </p>
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
        </>
      ) : null}

      {vendorOptions.length > 0 ? <ClientVendorOptions groups={vendorOptions} locale={locale} /> : null}

      {budget ? (
        <section aria-labelledby="client-budget-title">
          <h2 id="client-budget-title">{t("budgetTitle")}</h2>
          <ClientBudget view={budget} locale={locale} />
        </section>
      ) : null}

      {quotesToSign.length > 0 ? <ClientQuotes quotes={quotesToSign} locale={locale} /> : null}

      <p className="muted">{tLink("validUntil", { date: formatCalendarDate(access.expiresOn, locale) })}</p>
      <form action={closeLinkSessionAction}>
        <button type="submit">{tLink("closeSession")}</button>
      </form>
      <LinkPrivacyNotice organizationId={organizationId} />
    </main>
  );
}
