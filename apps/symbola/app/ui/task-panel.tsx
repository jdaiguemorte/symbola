"use client";

// Lot 70c (CHR-02, CHR-03, CHR-04, CHR-10, UX-09, UX-10, UX-14 ; D3, M1, M11, P-11, P-12, A3, A6, A7, A8,
// A22, C-04, C-08, C-38, C-90 ; ADR 0119 ; pages 1 et 2 des maquettes du lot 68) — le panneau unique d'une
// tâche, le même depuis « Aujourd'hui », « Tâches », la fiche, une notification et la recherche, en
// édition comme en création. Fenêtre longue de DESIGN.md (860 px, deux colonnes) ; sur téléphone, une
// page entière avec « ← {écran d'origine} », « Fait » et « Enregistrer » en bas.
//
// En tête : l'évènement en lien vers sa fiche (P-11), le titre, le menu « ⋯ » (« Dupliquer la tâche »,
// « Ouvrir l'évènement », à part « Supprimer la tâche »). Les champs : Tâche, Évènement (en création),
// Échéance (le même choix que « Changer la date »), Qui s'en charge, Répétition (sans évènement),
// Catégorie, Note, Prioritaire ; à droite, ce que le serveur rend (place dans le rétroplanning, pièces
// jointes, commentaires). Pied : « Fait » à gauche, « Fermer » et « Enregistrer » (seul bouton plein) à
// droite. M1 : tout s'enregistre d'un coup ; « Fait » enregistre aussi. « Fermer », la croix, Échap et
// « ← … » demandent, dans le pied, « Fermer sans enregistrer ? » s'il reste des changements : jamais de
// seconde fenêtre par-dessus.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RequiredLegend, RequiredMark } from "./required-mark";
import { ErrorSummary } from "./error-summary";
import { FieldError } from "./field-error";
import { useFeedback } from "./feedback";
import { useFieldValidation } from "./use-field-validation";
import { useRetryableAction } from "./use-retryable-action";
import { TaskPopover, usePopover } from "./task-popover";
import { TaskDatePanel, type DateShortcutOption } from "./task-date-panel";
import { taskFieldsSchema } from "@/lib/forms/task-fields";
import { formatShortCalendarDate } from "@symbola/i18n";
import { changedFields, closeDecision, daysBeforeEvent, dueFromDaysBefore, repetitionOffered, type TaskDraft } from "@/lib/tasks/task-panel-model";
import { responsibleSelection, UNCHANGED_RESPONSIBLE, type TaskMemberOption } from "@/app/events/[id]/task-responsible";
import { createTaskPanelAction, saveTaskPanelAction, setTaskDoneAction, type TaskPanelState } from "@/app/taches/task-line-actions";
import { deleteTaskAction } from "@/app/taches/task-row-actions";

export type TaskPanelEvent = { id: string; names: string; label: string; eventDate: string | null };

export type TaskPanelTask = {
  id: string;
  label: string;
  dateLabel: string;
  done: boolean;
  // « Faite le 25 nov. à 14 h 40, par vous ».
  doneText: string | null;
};

const RECURRENCES = ["weekly", "monthly", "quarterly", "yearly"] as const;

export function TaskPanel({
  mode,
  task,
  initial,
  events,
  preselected = false,
  categories,
  members,
  vendorsByEvent,
  clientsByEvent,
  shortcuts,
  closeHref,
  backLabel,
  copyHref,
  children,
}: {
  mode: "edit" | "create";
  task?: TaskPanelTask;
  initial: TaskDraft;
  // Les évènements en cours (création) ; en édition, celui de la tâche seulement.
  events: TaskPanelEvent[];
  // Depuis la fiche (ou un filtre) : l'évènement est déjà choisi.
  preselected?: boolean;
  categories: { id: string; label: string }[];
  members: TaskMemberOption[];
  vendorsByEvent: Record<string, { candidateId: string; name: string }[]>;
  clientsByEvent: Record<string, string>;
  shortcuts: DateShortcutOption[];
  // L'écran sans le panneau : fermer y revient, à la même place (P-12).
  closeHref: string;
  // Le nom de l'écran d'origine (« Tâches », « Aujourd'hui », « Léa & Maxime »), pour « ← … » sur téléphone.
  backLabel: string;
  copyHref?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("TaskLine");
  const tFeedback = useTranslations("Feedback");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const feedback = useFeedback();
  const dialog = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const formId = `${titleId}-form`;
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [confirming, setConfirming] = useState(false);
  const [more, setMore] = useState(mode === "edit");
  const closing = useRef(false);
  const menu = usePopover();
  const dates = usePopover();
  const menuButton = useRef<HTMLButtonElement>(null);
  const dueButton = useRef<HTMLButtonElement>(null);
  const [deleting, startDelete] = useTransition();
  const [reopening, startReopen] = useTransition();

  const event = events.find((candidate) => candidate.id === draft.eventId) ?? null;
  const set = <K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) => setDraft((current) => ({ ...current, [field]: value }));

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    dialog.current?.close();
    router.replace(closeHref, { scroll: false });
  };
  const requestClose = () => {
    if (closeDecision(initial, draft) === "confirm") setConfirming(true);
    else close();
  };

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  // Enregistrée ou créée : le message le dit, et le panneau se ferme dès la réponse.
  const submit = useRetryableAction(
    async (previous: TaskPanelState, formData: FormData) => {
      const result = mode === "create" ? await createTaskPanelAction(previous, formData) : await saveTaskPanelAction(previous, formData);
      if (result.ok) {
        const label = String(formData.get("label") ?? "").trim();
        if (result.message === "done" && task) {
          feedback?.show({
            title: t("doneMessage", { label }),
            action: {
              kind: "undo",
              label: t("undo"),
              run: async () => {
                await setTaskDoneAction(task.id, false);
                feedback.show({ title: t("reopenedMessage", { label }) });
                router.refresh();
              },
            },
          });
        } else {
          feedback?.show({ title: mode === "create" ? t("created", { label }) : tFeedback("taskSaved", { label }) });
        }
        close();
      }
      return result;
    },
    formRef,
    tFeedback("taskNotSaved"),
  );
  const [state, action, pending] = useActionState(submit, {} as TaskPanelState);
  const validation = useFieldValidation(taskFieldsSchema, state.fieldErrors);

  // « Qui s'en charge » : vous, chaque collègue, les clients (le mot du type), les prestataires retenus.
  const vendors = event ? (vendorsByEvent[event.id] ?? []) : [];
  const whoSelection = useMemo(
    () => (mode === "edit" ? responsibleSelection(initial.responsible, members, vendors.map((vendor) => vendor.candidateId)) : null),
    [mode, initial.responsible, members, vendors],
  );
  const activeMembers = members.filter((member) => !member.removed);
  const whoValue = mode === "edit" && whoSelection?.unchanged && draft.responsible === initial.responsible ? UNCHANGED_RESPONSIBLE : draft.responsible;

  const changed = changedFields(initial, draft);
  const listFormat = new Intl.ListFormat(locale, { type: "conjunction" });
  const changedText = listFormat.format(changed.map((field) => t(`changed.${field}`)));
  const capitalized = changedText.charAt(0).toLocaleUpperCase(locale) + changedText.slice(1);

  const remove = () =>
    startDelete(async () => {
      if (!task) return;
      menu.close();
      const formData = new FormData();
      formData.set("taskId", task.id);
      await deleteTaskAction(formData);
      close();
    });

  const reopen = () =>
    startReopen(async () => {
      if (!task) return;
      const result = await setTaskDoneAction(task.id, false);
      feedback?.show(result.ok ? { title: t("reopenedMessage", { label: task.label }) } : { tone: "error", title: result.error ?? t("notFound") });
      router.refresh();
    });

  const heading = mode === "create" ? t("newTask") : (task?.label ?? draft.label);
  const daysBefore = event?.eventDate && draft.dueDate ? daysBeforeEvent(event.eventDate, draft.dueDate) : null;

  return (
    <dialog
      ref={dialog}
      className="task-panel"
      aria-labelledby={titleId}
      onCancel={(cancel) => {
        // Échap : la même règle que « Fermer » (M1).
        cancel.preventDefault();
        if (confirming) setConfirming(false);
        else requestClose();
      }}
    >
      <div className="task-panel-head">
        <button type="button" className="button-ghost task-panel-back" onClick={requestClose}>
          <span aria-hidden="true">← </span>
          {t("backTo", { screen: backLabel })}
        </button>
        <div className="task-panel-heading">
          {mode === "edit" && event ? (
            <p className="task-panel-event">
              <Link href={`/events/${event.id}?onglet=taches`}>{event.label}</Link>
            </p>
          ) : null}
          <h2 id={titleId}>{heading}</h2>
        </div>
        {mode === "edit" && task ? (
          <>
            <button ref={menuButton} type="button" className="task-menu-button" aria-haspopup="menu" aria-controls={menu.id} onClick={() => menu.open(menuButton.current)}>
              <span aria-hidden="true">⋯</span>
              <span className="sr-only">{t("panelMenu")}</span>
            </button>
            <TaskPopover handle={menu} label={t("panelMenu")} className="task-menu">
              <div role="menu" aria-label={t("panelMenu")}>
                {copyHref ? (
                  <Link role="menuitem" href={copyHref} scroll={false} data-autofocus onClick={() => menu.close()}>
                    <span>{t("duplicate")}</span>
                  </Link>
                ) : null}
                {event ? (
                  <Link role="menuitem" href={`/events/${event.id}?onglet=taches`} onClick={() => menu.close()}>
                    <span>{t("openEvent")}</span>
                    <span className="task-menu-hint">{t("openEventHint", { event: event.names })}</span>
                  </Link>
                ) : null}
                <hr className="task-menu-separator" />
                <button type="button" role="menuitem" className="task-menu-danger" onClick={remove} disabled={deleting}>
                  <span>{t("deleteTask")}</span>
                  <span className="task-menu-hint">{t("deleteHint")}</span>
                </button>
              </div>
            </TaskPopover>
          </>
        ) : null}
        <button type="button" className="button-ghost task-panel-x" onClick={requestClose}>
          <span aria-hidden="true">×</span>
          <span className="sr-only">{t("closeX")}</span>
        </button>
      </div>

      <div className="task-panel-body">
        <form
          ref={formRef}
          id={formId}
          action={action}
          className="task-panel-main"
          noValidate
          onSubmit={(submitEvent) => {
            if (!validation.onSubmit(submitEvent)) setConfirming(false);
          }}
          onInput={validation.onInput}
        >
          <ErrorSummary errors={validation.errors} labels={{ label: t("fieldLabel"), dueDate: t("fieldDue") }} fieldId={validation.fieldId} summaryKey="summaryTask" />
          {task ? <input type="hidden" name="taskId" value={task.id} /> : null}
          <label className="task-panel-field">
            <span>
              {t("fieldLabel")}
              <RequiredMark />
            </span>
            <input
              type="text"
              name="label"
              maxLength={300}
              autoFocus={mode === "create"}
              placeholder={mode === "create" ? t("fieldLabelPlaceholder") : undefined}
              value={draft.label}
              onChange={(change) => set("label", change.target.value)}
              {...validation.fieldProps("label")}
            />
            <FieldError id={validation.errorId("label")} message={validation.errorFor("label")} />
          </label>

          {mode === "create" ? (
            <label className="task-panel-field">
              <span>{t("fieldEvent")}</span>
              <select
                name="eventId"
                value={draft.eventId}
                onChange={(change) => setDraft((current) => ({ ...current, eventId: change.target.value, recurrence: change.target.value === "" ? current.recurrence : "", responsible: change.target.value === "" && !current.responsible.startsWith("member:") ? (activeMembers.find((member) => member.me) ? `member:${activeMembers.find((member) => member.me)!.id}` : "planner") : current.responsible }))}
              >
                <option value="">{t("noEventOption")}</option>
                {events.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
              <span className="field-hint">{draft.eventId === "" ? t("noEventHint") : preselected && draft.eventId === initial.eventId ? t("preselected") : null}</span>
            </label>
          ) : null}

          <div className="task-panel-field">
            <label htmlFor={validation.fieldId("dueDate")}>
              <span>
                {t("fieldDue")}
                <RequiredMark />
              </span>
            </label>
            <span className="task-panel-due">
              <input type="date" name="dueDate" className="field-date" value={draft.dueDate} onChange={(change) => set("dueDate", change.target.value)} {...validation.fieldProps("dueDate")} />
              <button ref={dueButton} type="button" className="button-secondary" aria-haspopup="dialog" aria-controls={dates.id} onClick={() => dates.open(dueButton.current)}>
                {t("dueChange")}
              </button>
            </span>
            <FieldError id={validation.errorId("dueDate")} message={validation.errorFor("dueDate")} />
            {/* A8 : en création, l'échéance peut se dire en jours avant le jour J ; la tâche suit alors la date. */}
            {mode === "create" && event?.eventDate ? (
              <label className="task-panel-days">
                <span>{t("dueDays", { date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${event.eventDate}T00:00:00Z`)) })}</span>
                <span className="task-panel-days-input">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={-366}
                    max={1000}
                    value={daysBefore ?? ""}
                    onChange={(change) => {
                      const days = Number.parseInt(change.target.value, 10);
                      if (Number.isFinite(days)) set("dueDate", dueFromDaysBefore(event.eventDate!, days));
                    }}
                  />
                  <span>{t("dueDaysUnit")}</span>
                </span>
              </label>
            ) : null}
          </div>
          <TaskDatePanel
            handle={dates}
            task={{ id: task?.id ?? "", label: draft.label.trim() || t("newTask"), dueDate: draft.dueDate, dateLabel: /^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) ? formatShortCalendarDate(draft.dueDate, locale === "en" ? "en" : "fr") : "—" }}
            shortcuts={shortcuts}
            onPick={(date) => set("dueDate", date)}
          />

          <label className="task-panel-field">
            <span>{t("fieldWho")}</span>
            <select name="responsible" value={whoValue} onChange={(change) => set("responsible", change.target.value)}>
              {whoSelection?.unchanged ? (
                <option value={UNCHANGED_RESPONSIBLE}>
                  {whoSelection.unchanged.kind === "removedMember"
                    ? t("whoUnchangedRemoved", { name: whoSelection.unchanged.name })
                    : whoSelection.unchanged.kind === "nobody"
                      ? t("whoNobodyOption")
                      : t("whoUnchangedVendor")}
                </option>
              ) : null}
              {activeMembers.length === 0 ? <option value="planner">{t("you")}</option> : null}
              {activeMembers.map((member) => (
                <option key={member.id} value={`member:${member.id}`}>
                  {member.me ? t("you") : member.name}
                </option>
              ))}
              {event ? <option value="clients">{clientsByEvent[event.id] ?? t("theClients")}</option> : null}
              {vendors.map((vendor) => (
                <option key={vendor.candidateId} value={`vendor:${vendor.candidateId}`}>
                  {t("whoVendor", { name: vendor.name })}
                </option>
              ))}
            </select>
            {draft.responsible === "clients" ? <span className="field-hint">{t("whoClientsHint")}</span> : null}
            {draft.responsible.startsWith("vendor:") ? <span className="field-hint">{t("whoVendorHint")}</span> : null}
          </label>

          {repetitionOffered(draft) ? (
            <label className="task-panel-field">
              <span>{t("fieldRepeat")}</span>
              <select name="recurrence" value={draft.recurrence} onChange={(change) => set("recurrence", change.target.value)}>
                <option value="">{t("repeatNone")}</option>
                {RECURRENCES.map((value) => (
                  <option key={value} value={value}>
                    {t(`repeat.${value}`)}
                  </option>
                ))}
              </select>
              <span className="field-hint">{t("repeatHint")}</span>
            </label>
          ) : (
            <input type="hidden" name="recurrence" value="" />
          )}

          {/* Sur téléphone, en création : « + Ajouter une catégorie ou une note » replie le reste. */}
          {more ? null : (
            <button type="button" className="button-ghost task-panel-more-toggle" onClick={() => setMore(true)}>
              {t("moreFields")}
            </button>
          )}
          <div className="task-panel-more" data-open={more ? "true" : undefined}>
            <label className="task-panel-field">
              <span>{t("fieldCategory")}</span>
              <select name="categoryId" value={draft.categoryId} onChange={(change) => set("categoryId", change.target.value)}>
                <option value="">{t("noCategory")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="task-panel-field">
              <span>
                {t("fieldNote")} <span className="muted">· {t("optional")}</span>
              </span>
              <textarea name="note" rows={3} maxLength={2000} value={draft.note} onChange={(change) => set("note", change.target.value)} />
              <span className="field-hint">{t("noteHint")}</span>
            </label>
            <label className="task-panel-check">
              <input type="checkbox" name="priority" value="high" checked={draft.priority === "high"} onChange={(change) => set("priority", change.target.checked ? "high" : "normal")} />
              <span>
                <span aria-hidden="true">↑ </span>
                {t("fieldPriority")}
              </span>
            </label>
          </div>
          <RequiredLegend text={tCommon("requiredLegend")} />
          {state.error ? (
            <p className="field-error" role="alert">
              {state.error}
            </p>
          ) : null}
        </form>
        {children ? <div className="task-panel-side">{children}</div> : null}
      </div>

      <div className="task-panel-foot" data-confirming={confirming ? "true" : undefined}>
        {confirming ? (
          <div className="task-panel-confirm" role="alertdialog" aria-labelledby={`${titleId}-confirm`} aria-describedby={`${titleId}-confirm-body`}>
            <p id={`${titleId}-confirm`} className="task-panel-confirm-title">
              {t("confirmTitle")}
            </p>
            <p id={`${titleId}-confirm-body`}>{t("confirmBody", { count: changed.length, fields: capitalized, label: draft.label.trim() || heading })}</p>
            <span className="task-panel-confirm-actions">
              <button type="button" className="button-secondary" autoFocus onClick={() => setConfirming(false)}>
                {t("confirmBack")}
              </button>
              <button type="button" className="button-secondary" onClick={close}>
                {t("confirmDiscard")}
              </button>
              <button type="submit" form={formId} disabled={pending}>
                {t("confirmSave")}
              </button>
            </span>
          </div>
        ) : (
          <>
            <span className="task-panel-foot-start">
              {mode === "edit" && task && !task.done ? (
                <button type="submit" form={formId} name="done" value="true" className="button-secondary task-done-button" disabled={pending}>
                  {t("done")}
                </button>
              ) : null}
              {task?.done ? (
                <>
                  <span className="task-panel-done">{task.doneText}</span>
                  <button type="button" className="button-secondary" onClick={reopen} disabled={reopening}>
                    {t("reopenTask")}
                  </button>
                </>
              ) : null}
            </span>
            <span className="task-panel-foot-end">
              <button type="button" className="button-secondary task-panel-close" onClick={requestClose}>
                {t("close")}
              </button>
              <button type="submit" form={formId} className={task?.done ? "button-secondary" : undefined} disabled={pending}>
                {mode === "create" ? t("create") : t("save")}
              </button>
            </span>
          </>
        )}
      </div>
    </dialog>
  );
}
