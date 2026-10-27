import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, formatMonth, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import { ClientAccessDeniedError, getClientEventView, monthKey, type EventTask } from "@/modules/events/service";
import { getClientAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { toggleClientTaskAction } from "./actions";

// EVT-06 — l'événement vu par le marié : rétroplanning (il coche ses
// tâches) et programme du jour J en variante « mariés », jamais de note
// interne. Budget et devis viendront avec leurs modules (lots 3 et 4).
export default async function ClientEventPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getClientAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect("/");
  if (!auth.user.organizationId) redirect("/login");
  // Dégradation propre (CLAUDE.md §2.3) : module désactivé = « indisponible ».
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) {
    const tUnavailable = await getTranslations("ClientSpace");
    return (
      <main>
        <h1>{tUnavailable("title")}</h1>
        <p>{tUnavailable("unavailable")}</p>
      </main>
    );
  }

  const { id } = await params;
  if (!isValidId(id)) notFound();
  let view;
  try {
    view = await getClientEventView(auth.user.organizationId, auth.user.id, id);
  } catch (error) {
    // Accès absent, retiré ou événement d'un autre couple : même réponse.
    if (error instanceof ClientAccessDeniedError) notFound();
    throw error;
  }

  const t = await getTranslations("ClientSpace");
  const tEvents = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  const tasksByMonth = new Map<string, EventTask[]>();
  for (const task of view.tasks) {
    const key = monthKey(task.dueDate);
    tasksByMonth.set(key, [...(tasksByMonth.get(key) ?? []), task]);
  }

  return (
    <main>
      <p>
        <Link href="/espace">{t("backToSpace")}</Link>
      </p>
      <h1>{view.event.clients.map((client) => client.firstName).join(" & ")}</h1>
      <HelpButton title={tHelp("clientEvent.title")} body={tHelp("clientEvent.body")} />
      <p>
        {tEvents("eventDate")} : {view.event.eventDate ? formatCalendarDate(view.event.eventDate, locale) : t("dateUnset")}
      </p>

      <h2>{tEvents("tasksTitle")}</h2>
      {view.tasks.length === 0 ? <p>{tEvents("noTasks")}</p> : null}
      {[...tasksByMonth.entries()].map(([month, monthTasks]) => (
        <section key={month} aria-labelledby={`client-tasks-${month}`}>
          <h3 id={`client-tasks-${month}`}>{formatMonth(`${month}-01`, locale)}</h3>
          <ul>
            {monthTasks.map((task) => (
              <li key={task.id}>
                <strong style={task.done ? { textDecoration: "line-through" } : undefined}>{task.label}</strong>
                {" — "}
                {formatCalendarDate(task.dueDate, locale)}
                {" — "}
                {task.responsible === "clients" ? t("responsibleYou") : t("responsiblePlanner")}
                {task.done ? ` — ${tEvents("taskDone")}` : ""}
                {task.responsible === "clients" ? (
                  <form action={toggleClientTaskAction}>
                    <input type="hidden" name="eventId" value={view.event.id} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="done" value={task.done ? "false" : "true"} />
                    <button type="submit">
                      {task.done
                        ? tEvents("markTaskUndone", { label: task.label })
                        : tEvents("markTaskDone", { label: task.label })}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2>{tEvents("programTitle")}</h2>
      <p>
        <a href={`/espace/${view.event.id}/programme/pdf`} download>
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
            {item.participants.length > 0
              ? ` — ${tEvents("programParticipants")} : ${item.participants.map((participant) => participant.label).join(", ")}`
              : ""}
          </li>
        ))}
      </ul>
    </main>
  );
}
