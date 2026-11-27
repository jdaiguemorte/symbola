// Lot 70c (CHR-02, CHR-03, CHR-05, UX-09 ; D3, M1, A1, A7, A8, A22, C-90 ; page 1 des maquettes du lot 68)
// — prépare le panneau unique d'une tâche, côté serveur, pour tous les écrans qui l'ouvrent (« Aujourd'hui »,
// « Tâches », la fiche) : la tâche (introuvable, d'une autre organisation ou d'un évènement hors de
// l'équipe : rien ne s'ouvre), les collègues, les catégories, les prestataires retenus, le mot des clients,
// et la colonne de droite (place dans le rétroplanning, pièces jointes, commentaires de l'équipe).
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, formatFileSize, formatShortCalendarDate, type Locale } from "@symbola/i18n";
import { eventNames, getTask, isInProgress, listEvents, listTaskAttachments, listTaskComments, type TaskDetail } from "@/modules/events/service";
import { ensureTaskCategories } from "@/lib/events/task-categories";
import { canSeeEvent, visibleEventScope } from "@/lib/event-visibility";
import { taskMemberOptions } from "@/lib/tasks/members";
import { clientsTerms, dateShortcutOptions, engagedVendors } from "@/lib/tasks/task-lines";
import { copyDraft, createDraft, daysBeforeEvent, draftOf, type TaskDraft } from "@/lib/tasks/task-panel-model";
import { responsibleValueOf } from "@/lib/tasks/task-line";
import { ImportedFields } from "@/app/imported-fields";
import { moveEventTaskAction, releaseEventTaskAction, setTaskMilestoneAction } from "@/app/events/[id]/task-actions";
import { TaskAttachmentUploadForm, TaskCommentForm } from "@/app/events/[id]/task-extra-forms";
import { removeTaskAttachmentAction, removeTaskCommentAction } from "@/app/events/[id]/task-extra-actions";
import { TaskPanel, type TaskPanelEvent } from "./task-panel";

export type TaskPanelOpen = { kind: "edit"; taskId: string } | { kind: "create"; eventId: string | null; copyOf: string | null };

// Les paramètres d'adresse qui ouvrent le panneau : « tache=<id> », « nouvelle=1 » (avec « evenement » et
// « copie »).
export function panelFromQuery(query: { tache?: string | undefined; nouvelle?: string | undefined; evenement?: string | undefined; copie?: string | undefined }, isValidId: (value: string) => boolean, fixedEventId: string | null = null): TaskPanelOpen | null {
  if (query.tache && isValidId(query.tache)) return { kind: "edit", taskId: query.tache };
  if (query.nouvelle === "1") {
    const eventId = fixedEventId ?? (query.evenement && isValidId(query.evenement) ? query.evenement : null);
    return { kind: "create", eventId, copyOf: query.copie && isValidId(query.copie) ? query.copie : null };
  }
  return null;
}

function eventLabel(event: { names: string; eventDate: string | null }, locale: Locale, t: Awaited<ReturnType<typeof getTranslations<"TaskLine">>>): string {
  return event.eventDate ? t("eventOption", { names: event.names, date: formatCalendarDate(event.eventDate, locale) }) : t("eventOptionNoDate", { names: event.names });
}

// « 14 h 40 » en français, « 2:40 PM » en anglais, à l'heure de Paris.
function timeLabel(instant: Date, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { hour: "numeric", minute: "2-digit", hour12: locale !== "fr", timeZone: "Europe/Paris" }).formatToParts(instant);
  if (locale !== "fr") return parts.map((part) => part.value).join("").replace(/[  ]/g, " ");
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  return `${hour} h ${minute}`;
}

function parisDay(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export async function TaskPanelLoader({
  organizationId,
  userId,
  role,
  locale,
  today,
  open,
  closeHref,
  backLabel,
  screenHref,
}: {
  organizationId: string;
  userId: string;
  // Lot 52 (ADR 0094) : une Planner restreinte ne voit que les évènements de son équipe.
  role: string;
  locale: Locale;
  today: string;
  open: TaskPanelOpen;
  closeHref: string;
  backLabel: string;
  // L'adresse de l'écran courant avec d'autres paramètres (« Dupliquer la tâche »).
  screenHref: (params: Record<string, string>) => string;
}) {
  const t = await getTranslations("TaskLine");
  const tEvents = await getTranslations("Events");
  const [members, categories, clientsLabel] = await Promise.all([taskMemberOptions(organizationId, userId), ensureTaskCategories(organizationId, locale), clientsTerms(organizationId, locale)]);
  const categoryOptions = categories.map((category) => ({ id: category.id, label: category.label }));
  const me = members.find((member) => member.me && !member.removed);
  const mine = me ? `member:${me.id}` : "planner";
  const shortcuts = dateShortcutOptions(locale, today);

  if (open.kind === "create") {
    const source = open.copyOf ? await getTask(organizationId, open.copyOf, today) : null;
    const viewer = { user: { id: userId, role, organizationId } };
    const scope = role === "member" ? await visibleEventScope(viewer) : null;
    const all = (await listEvents({ organizationId })).filter((event) => isInProgress(event.status) && (scope === null || scope.has(event.id)));
    const events: TaskPanelEvent[] = all
      .sort((a, b) => (a.eventDate ?? "9999").localeCompare(b.eventDate ?? "9999"))
      .map((event) => {
        const names = eventNames(event.clients, event.name);
        return { id: event.id, names, label: eventLabel({ names, eventDate: event.eventDate }, locale, t), eventDate: event.eventDate };
      });
    const eventId = source ? source.eventId : open.eventId;
    const knownEvent = eventId && events.some((event) => event.id === eventId) ? eventId : null;
    const initial: TaskDraft = source ? { ...copyDraft(draftOfTask(source)), eventId: knownEvent ?? "" } : createDraft({ eventId: knownEvent, responsible: mine });
    const vendors = knownEvent ? await engagedVendors(organizationId, [knownEvent]) : new Map();
    return (
      <TaskPanel
        key={`create-${knownEvent ?? "none"}-${open.copyOf ?? ""}`}
        mode="create"
        initial={initial}
        events={events}
        preselected={knownEvent !== null && open.eventId !== null}
        categories={categoryOptions}
        members={members}
        vendorsByEvent={Object.fromEntries(vendors)}
        clientsByEvent={Object.fromEntries(events.map((event) => [event.id, clientsLabel(event.id)]))}
        shortcuts={shortcuts}
        closeHref={closeHref}
        backLabel={backLabel}
      />
    );
  }

  const task = await getTask(organizationId, open.taskId, today);
  if (!task) return null;
  // Une tâche d'un évènement hors de vue ne s'ouvre pas, comme une tâche inexistante.
  if (task.eventId && role === "member" && !(await canSeeEvent({ user: { id: userId, role, organizationId } }, task.eventId))) return null;
  const vendors = task.eventId ? await engagedVendors(organizationId, [task.eventId]) : new Map<string, { candidateId: string; name: string }[]>();
  const event = task.event ? { id: task.event.id, names: task.event.names, label: eventLabel(task.event, locale, t), eventDate: task.event.eventDate } : null;

  // « Faite le 25 nov. à 14 h 40, par vous » (qui a coché, pas qui s'en chargeait ; A9 : seulement le sûr).
  let doneText: string | null = null;
  if (task.done && task.doneAt) {
    const instant = new Date(task.doneAt);
    const date = formatShortCalendarDate(parisDay(instant), locale);
    const time = timeLabel(instant, locale);
    const by = task.doneBy;
    const who =
      by?.kind === "member" && by.userId
        ? by.userId === userId
          ? t("doneByYou")
          : (members.find((member) => member.id === by.userId)?.name ?? null)
        : by?.kind === "clients"
          ? clientsLabel(task.eventId).toLocaleLowerCase(locale)
          : by?.kind === "vendor"
            ? t("doneByVendor")
            : null;
    doneText = who ? t("doneOn", { date, time, who }) : t("doneOnUnknown", { date, time });
  }

  const [attachments, comments] = task.eventId ? await Promise.all([listTaskAttachments(organizationId, task.id), listTaskComments(organizationId, task.id)]) : [[], []];
  const memberName = new Map(members.map((member) => [member.id, member.me ? t("you") : member.name]));
  const days = task.eventId && task.event?.eventDate && task.offsetDays !== null ? daysBeforeEvent(task.event.eventDate, task.dueDate) : null;

  const side = task.eventId ? (
    <>
      {/* C-90 : « Rang et jalon » devient « Place dans le rétroplanning » et « Étape clé ». */}
      <section className="task-panel-section" aria-labelledby="task-panel-place">
        <h3 id="task-panel-place">{t("place")}</h3>
        {days !== null ? (
          <p>
            {days >= 0 ? t("daysBeforeDay", { days }) : t("daysAfterDay", { days: -days })}
            {task.isMilestone ? ` · ${t("keyStep")}` : ""}
          </p>
        ) : task.isMilestone ? (
          <p>{t("keyStep")}</p>
        ) : null}
        {task.fixed && days !== null ? (
          <form action={releaseEventTaskAction} className="row-wrap">
            <span className="muted">{t("fixed")}</span>
            <input type="hidden" name="eventId" value={task.eventId} />
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" className="button-ghost">
              {t("release")}
            </button>
          </form>
        ) : days !== null ? (
          <p className="muted">{t("follows")}</p>
        ) : null}
        <div className="row-wrap">
          {task.responsible === "planner" ? (
            <form action={setTaskMilestoneAction}>
              <input type="hidden" name="eventId" value={task.eventId} />
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="milestone" value={task.isMilestone ? "false" : "true"} />
              <button type="submit" className="button-ghost">
                {task.isMilestone ? t("keyStepOff") : t("keyStepOn")}
              </button>
            </form>
          ) : null}
          <form action={moveEventTaskAction} className="row-wrap">
            <input type="hidden" name="eventId" value={task.eventId} />
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" name="direction" value="up" className="button-ghost">
              {t("moveUp", { label: task.label })}
            </button>
            <button type="submit" name="direction" value="down" className="button-ghost">
              {t("moveDown", { label: task.label })}
            </button>
          </form>
        </div>
        <ImportedFields fields={task.importedFields} compact />
      </section>
      <section className="task-panel-section" aria-labelledby="task-panel-attachments">
        <h3 id="task-panel-attachments">{attachments.length > 0 ? t("attachmentsCount", { count: attachments.length }) : t("attachments")}</h3>
        {attachments.length === 0 ? <p className="muted">{tEvents("taskAttachmentsEmpty")}</p> : null}
        {attachments.length > 0 ? (
          <ul className="item-list">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="row-wrap">
                <a href={`/events/${task.eventId}/taches/${task.id}/pieces/${attachment.id}`}>{attachment.label}</a>
                <span className="muted">{formatFileSize(attachment.sizeBytes, locale)}</span>
                <form action={removeTaskAttachmentAction}>
                  <input type="hidden" name="eventId" value={task.eventId!} />
                  <input type="hidden" name="attachmentId" value={attachment.id} />
                  <button type="submit" className="button-ghost">
                    {tEvents("taskAttachmentRemove", { label: attachment.label })}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <TaskAttachmentUploadForm eventId={task.eventId} taskId={task.id} />
      </section>
      <section className="task-panel-section" aria-labelledby="task-panel-comments">
        <h3 id="task-panel-comments">{comments.length > 0 ? t("commentsCount", { count: comments.length }) : t("comments")}</h3>
        {comments.length === 0 ? <p className="muted">{tEvents("taskCommentsEmpty")}</p> : null}
        {comments.length > 0 ? (
          <ol className="item-list task-comments">
            {comments.map((comment) => (
              <li key={comment.id}>
                <p className="meta">
                  {(comment.authorUserId ? memberName.get(comment.authorUserId) : null) ?? tEvents("taskCommentFormerMember")} · {formatShortCalendarDate(parisDay(new Date(comment.createdAt)), locale)}
                </p>
                <p className="task-comment-body">{comment.body}</p>
                {comment.authorUserId === userId ? (
                  <form action={removeTaskCommentAction}>
                    <input type="hidden" name="eventId" value={task.eventId!} />
                    <input type="hidden" name="commentId" value={comment.id} />
                    <button type="submit" className="button-ghost">
                      {tEvents("taskCommentRemove")}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
        <TaskCommentForm eventId={task.eventId} taskId={task.id} />
      </section>
    </>
  ) : null;

  return (
    <TaskPanel
      key={`${task.id}-${task.done}-${task.dueDate}-${task.label}-${responsibleValueOf(task)}`}
      mode="edit"
      task={{ id: task.id, label: task.label, dateLabel: formatShortCalendarDate(task.dueDate, locale), done: task.done, doneText }}
      initial={draftOfTask(task)}
      events={event ? [event] : []}
      categories={categoryOptions}
      members={members}
      vendorsByEvent={Object.fromEntries(vendors)}
      clientsByEvent={task.eventId ? { [task.eventId]: clientsLabel(task.eventId) } : {}}
      shortcuts={shortcuts}
      closeHref={closeHref}
      backLabel={backLabel}
      copyHref={screenHref({ nouvelle: "1", copie: task.id })}
    >
      {side}
    </TaskPanel>
  );
}

function draftOfTask(task: TaskDetail): TaskDraft {
  return draftOf({ label: task.label, eventId: task.eventId, dueDate: task.dueDate, responsibleValue: responsibleValueOf(task), categoryId: task.categoryId, note: task.note, priority: task.priority, recurrence: task.recurrence });
}

