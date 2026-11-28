"use client";

// Lot 72e (EVT-03, EVT-05, UX-09, UX-10 ; C-26, D7, M1, J14 ; page 16 des maquettes du lot 68) — la fenêtre
// « Modifier les informations » : fenêtre longue de DESIGN.md (860 px), cinq rubriques à gauche (Date et
// lieux, Mariés, Invités et budget, Style et notes, Type et origine), un seul « Enregistrer » toujours
// visible en bas, « Rubrique suivante : … » pour enchaîner sans y obliger. Tous les champs restent dans le
// formulaire, quelle que soit la rubrique montrée : tout s'enregistre d'un coup. « Fermer », Échap et
// « ← » demandent, dans le pied, « Fermer sans enregistrer ? » s'il reste des changements (règle de la
// fenêtre d'une tâche, lot 70c) ; jamais de seconde fenêtre par-dessus. Sur téléphone, une page entière.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { BusyRule } from "@symbola/contracts";
import { FieldError } from "@/app/ui/field-error";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { useFeedback } from "@/app/ui/feedback";
import { changedDetails, DETAILS_FIELDS, DETAILS_RUBRICS, type DetailsField, type DetailsRaw, type DetailsRubric } from "@/lib/events/event-details";
import { BusyRuleFields } from "../busy-rule-fields";
import { SameDayNotice } from "../same-day-notice";
import { saveEventInfoAction, type InfoWindowState } from "./info-actions";

export type InfoWindowProps = {
  eventId: string;
  names: string;
  version: string;
  initialRubric: DetailsRubric;
  closeHref: string;
  // « Reporter l'évènement… » : la fiche, qui ouvre la fenêtre du report (jamais deux fenêtres empilées).
  postponeHref: string | null;
  initial: DetailsRaw;
  dateEditable: boolean;
  dateWords: string;
  busy: { typeRule: BusyRule; eventDate: string | null };
  clients: { name: string; email: string | null; phone: string | null }[];
  clientsTab: { label: string; href: string };
  guestsFromReplies: number | null;
  notes: { readable: boolean };
  types: { id: string; label: string }[];
  sources: { id: string; label: string }[];
};

function readForm(form: HTMLFormElement | null): DetailsRaw {
  const raw: DetailsRaw = {};
  if (!form) return raw;
  const data = new FormData(form);
  for (const field of Object.keys(DETAILS_FIELDS) as DetailsField[]) {
    const value = data.get(field);
    if (typeof value === "string") raw[field] = value;
  }
  // Une case décochée n'est pas envoyée : elle vaut « vide », comme à l'ouverture.
  if (!data.has("notesConfidential")) raw.notesConfidential = "";
  return raw;
}

export function InfoWindow(props: InfoWindowProps) {
  const t = useTranslations("EventOverview.window");
  const locale = useLocale();
  const router = useRouter();
  const feedback = useFeedback();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const formId = useId();
  const [rubric, setRubric] = useState<DetailsRubric>(props.initialRubric);
  const [current, setCurrent] = useState<DetailsRaw>(props.initial);
  const [confirming, setConfirming] = useState(false);
  const [timeZoneOpen, setTimeZoneOpen] = useState(props.initial.timeZone !== "Europe/Paris");
  const [busyMode, setBusyMode] = useState(props.initial.busyMode ?? "type");
  const [state, action, pending] = useActionState<InfoWindowState, FormData>(saveEventInfoAction, {});
  const closingTo = useRef<string>(props.closeHref);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  // Le formulaire initial (à l'ouverture) sert de référence ; il se relit après chaque saisie.
  const initial = useRef<DetailsRaw | null>(null);
  useEffect(() => {
    initial.current = readForm(form.current);
    setCurrent(initial.current);
  }, []);
  const changed = initial.current ? changedDetails(initial.current, current) : [];

  const close = (target: string = closingTo.current) => {
    dialog.current?.close();
    router.push(target, { scroll: false });
  };
  const requestClose = (target: string = props.closeHref) => {
    closingTo.current = target;
    if (changed.length === 0) close(target);
    else setConfirming(true);
  };

  // Enregistré : le message de retour, la fiche relue, la fenêtre fermée. En erreur : la rubrique du premier
  // champ refusé s'ouvre et le champ reçoit le focus (lot 70b).
  const seen = useRef<InfoWindowState | null>(null);
  useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (state.success) {
      feedback?.show({ title: t("saved", { names: props.names }) });
      initial.current = readForm(form.current);
      close();
      router.refresh();
      return;
    }
    setConfirming(false);
    if (state.rubric) setRubric(state.rubric);
    const first = state.fieldErrors ? (Object.keys(state.fieldErrors)[0] as DetailsField | undefined) : undefined;
    if (first) requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  }, [state]);

  const error = (field: DetailsField) => state.fieldErrors?.[field];
  const fieldProps = (field: DetailsField) => ({
    "aria-invalid": error(field) ? true : undefined,
    "aria-describedby": error(field) ? `${formId}-${field}-error` : undefined,
  });
  const errorCount = Object.keys(state.fieldErrors ?? {}).length;
  const index = DETAILS_RUBRICS.indexOf(rubric);
  const next = DETAILS_RUBRICS[index + 1];
  const rubricWords = (key: DetailsRubric) => (key === "clients" ? props.clientsTab.label : t(`rubric.${key}`));
  const listFormat = new Intl.ListFormat(locale, { type: "conjunction" });
  const changedText = listFormat.format(changed.map(rubricWords));
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [props.initial.timeZone ?? "Europe/Paris"];
  const typeRule = props.busy.typeRule;

  const onInput = (event: FormEvent<HTMLFormElement>) => setCurrent(readForm(event.currentTarget));

  return (
    <dialog
      ref={dialog}
      className="window window-long info-window"
      aria-labelledby={titleId}
      onCancel={(cancel) => {
        // Échap : la même règle que « Fermer » (M1).
        cancel.preventDefault();
        if (confirming) setConfirming(false);
        else requestClose();
      }}
    >
      <div className="window-head">
        <button type="button" className="button-ghost window-back" onClick={() => requestClose()}>
          <span aria-hidden="true">← </span>
          {t("back", { names: props.names })}
        </button>
        <h2 id={titleId}>
          <span className="info-window-title-long">{t("title", { names: props.names })}</span>
          <span className="info-window-title-short">{t("phoneTitle")}</span>
        </h2>
      </div>
      <form
        ref={form}
        id={formId}
        // React 19 vide un formulaire non contrôlé après une action : l'envoi passe par onSubmit, pour qu'un
        // refus garde toute la saisie (rien n'est perdu, seul le champ refusé est à corriger).
        onSubmit={(submit) => {
          submit.preventDefault();
          const data = new FormData(submit.currentTarget);
          startTransition(() => action(data));
        }}
        onInput={onInput}
        onChange={onInput}
        className="window-rubrics"
        noValidate
      >
        <input type="hidden" name="eventId" value={props.eventId} />
        <input type="hidden" name="version" value={props.version} />
        <nav className="window-rubrics-nav" aria-label={t("rubricsLabel")}>
          <ol>
            {DETAILS_RUBRICS.map((key) => (
              <li key={key}>
                <button type="button" className="window-rubric" aria-current={key === rubric ? "step" : undefined} onClick={() => setRubric(key)}>
                  {rubricWords(key)}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="window-rubrics-body">
          {errorCount > 0 ? (
            <p className="field-error" role="alert">
              {t("errorSummary", { count: errorCount })}
            </p>
          ) : null}
          {state.error ? (
            <p className="field-error" role="alert">
              {state.error}
            </p>
          ) : null}

          <section hidden={rubric !== "dates"} aria-label={t("rubric.dates")} className="stack">
            <h3>{t("rubric.dates")}</h3>
            {props.dateEditable ? (
              <label>
                {t("eventDate")}
                <input type="date" className="field-date" defaultValue={props.initial.eventDate ?? ""} name="eventDate" {...fieldProps("eventDate")} />
                <FieldError id={`${formId}-eventDate-error`} message={error("eventDate")} />
                {/* Lot 32b (CRM-04) : les autres évènements du même jour, avant d'enregistrer. */}
                <SameDayNotice date={current.eventDate ?? ""} excludeEventId={props.eventId} />
              </label>
            ) : (
              <div className="info-window-locked">
                <p>
                  <span className="info-window-label">{t("eventDate")}</span> {props.dateWords}
                </p>
                <p className="meta">{t("dateLocked")}</p>
                {props.postponeHref ? (
                  <button type="button" className="button-secondary" onClick={() => requestClose(props.postponeHref!)}>
                    {t("postpone")}
                  </button>
                ) : null}
                <FieldError id={`${formId}-eventDate-error`} message={error("eventDate")} />
              </div>
            )}
            <label>
              {t("venueName")}
              <input type="text" maxLength={200} defaultValue={props.initial.venueName ?? ""} autoComplete="off" name="venueName" {...fieldProps("venueName")} />
              <FieldError id={`${formId}-venueName-error`} message={error("venueName")} />
            </label>
            <label>
              {t("venueCity")}
              <input type="text" maxLength={200} defaultValue={props.initial.venueCity ?? ""} autoComplete="address-level2" name="venueCity" {...fieldProps("venueCity")} />
              <FieldError id={`${formId}-venueCity-error`} message={error("venueCity")} />
            </label>
            {/* Le fuseau, dit en mots, ne s'ouvre qu'à la demande (un mariage à l'étranger). */}
            {timeZoneOpen ? (
              <label>
                {t("timeZone")}
                <select defaultValue={props.initial.timeZone ?? "Europe/Paris"} name="timeZone" {...fieldProps("timeZone")}>
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone === "Europe/Paris" ? t("timeZoneParis") : zone.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <FieldError id={`${formId}-timeZone-error`} message={error("timeZone")} />
              </label>
            ) : (
              <p className="info-window-inline">
                <input type="hidden" name="timeZone" value={props.initial.timeZone ?? "Europe/Paris"} />
                <span className="info-window-label">{t("timeZone")}</span> {t("timeZoneParis")}{" "}
                <button type="button" className="button-ghost" onClick={() => setTimeZoneOpen(true)}>
                  {t("timeZoneChange")}
                </button>
              </p>
            )}
            <fieldset className="info-window-busy">
              <legend>{t("busy")}</legend>
              <label className="choice-item">
                <input type="radio" name="busyMode" value="type" checked={busyMode === "type"} onChange={() => setBusyMode("type")} />
                <span>{t("busyType")}</span>
              </label>
              <label className="choice-item">
                <input type="radio" name="busyMode" value="event" checked={busyMode === "event"} onChange={() => setBusyMode("event")} />
                <span>{t("busyEvent")}</span>
              </label>
              {busyMode === "event" ? (
                <>
                  <BusyRuleFields
                    defaultRule={{
                      startDayOffset: Number(props.initial.startDayOffset ?? typeRule.startDayOffset),
                      startTime: props.initial.startTime ?? typeRule.startTime,
                      endDayOffset: Number(props.initial.endDayOffset ?? typeRule.endDayOffset),
                      endTime: props.initial.endTime ?? typeRule.endTime,
                    }}
                    eventDate={props.busy.eventDate}
                  />
                  <FieldError id={`${formId}-endTime-error`} message={error("endTime") ?? error("startTime") ?? error("startDayOffset") ?? error("endDayOffset")} />
                </>
              ) : null}
              <p className="meta">{props.busy.eventDate ? t("busyHint") : t("busyNoDate")}</p>
            </fieldset>
          </section>

          <section hidden={rubric !== "clients"} aria-label={props.clientsTab.label} className="stack">
            <h3>{props.clientsTab.label}</h3>
            {props.clients.length === 0 ? <p>{t("clientsNone")}</p> : null}
            <ul className="plain-list stack">
              {props.clients.map((client) => (
                <li key={client.name}>
                  <strong>{client.name}</strong>
                  {[client.email, client.phone].filter(Boolean).length > 0 ? <span className="meta"> · {[client.email, client.phone].filter(Boolean).join(" · ")}</span> : null}
                </li>
              ))}
            </ul>
            <p className="meta">{t("clientsHint", { tab: props.clientsTab.label })}</p>
            <p>
              <Link
                href={props.clientsTab.href}
                onClick={(click) => {
                  click.preventDefault();
                  requestClose(props.clientsTab.href);
                }}
              >
                {t("clientsManage", { tab: props.clientsTab.label })}
              </Link>
            </p>
          </section>

          <section hidden={rubric !== "guests"} aria-label={t("rubric.guests")} className="stack">
            <h3>{t("rubric.guests")}</h3>
            <label>
              {t("guestsEstimated")}
              <input type="text" inputMode="numeric" defaultValue={props.initial.guestsEstimated ?? ""} name="guestsEstimated" {...fieldProps("guestsEstimated")} />
              <FieldError id={`${formId}-guestsEstimated-error`} message={error("guestsEstimated")} />
            </label>
            <label>
              {t("guestsConfirmed")}
              <input type="text" inputMode="numeric" defaultValue={props.initial.guestsConfirmed ?? ""} name="guestsConfirmed" {...fieldProps("guestsConfirmed")} />
              <FieldError id={`${formId}-guestsConfirmed-error`} message={error("guestsConfirmed")} />
            </label>
            {props.guestsFromReplies !== null ? <p className="meta">{t("guestsFromReplies", { count: props.guestsFromReplies })}</p> : null}
            <label>
              {t("wantedBudget")}
              <input type="text" inputMode="decimal" defaultValue={props.initial.wantedBudget ?? ""} name="wantedBudget" {...fieldProps("wantedBudget")} />
              <FieldError id={`${formId}-wantedBudget-error`} message={error("wantedBudget")} />
              <span className="field-hint">{t("wantedBudgetHint")}</span>
            </label>
          </section>

          <section hidden={rubric !== "style"} aria-label={t("rubric.style")} className="stack">
            <h3>{t("rubric.style")}</h3>
            <label>
              {t("style")}
              <textarea rows={2} maxLength={2000} defaultValue={props.initial.style ?? ""} name="style" {...fieldProps("style")} />
              <FieldError id={`${formId}-style-error`} message={error("style")} />
            </label>
            {/* RGP-04 : un champ libre porte sa mise en garde. */}
            <FreeTextNotice />
            {props.notes.readable ? (
              <>
                <label>
                  {t("notes")}
                  <textarea rows={4} maxLength={10_000} defaultValue={props.initial.notes ?? ""} name="notes" {...fieldProps("notes")} />
                  <FieldError id={`${formId}-notes-error`} message={error("notes")} />
                </label>
                <FreeTextNotice />
                <label className="choice-item">
                  <input type="checkbox" name="notesConfidential" defaultChecked={props.initial.notesConfidential === "on"} />
                  <span>{t("notesConfidential")}</span>
                </label>
              </>
            ) : (
              <p className="muted">{t("notesHidden")}</p>
            )}
          </section>

          <section hidden={rubric !== "origin"} aria-label={t("rubric.origin")} className="stack">
            <h3>{t("rubric.origin")}</h3>
            <label>
              {t("type")}
              <select defaultValue={props.initial.eventTypeId ?? ""} name="eventTypeId" {...fieldProps("eventTypeId")}>
                {props.types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <FieldError id={`${formId}-eventTypeId-error`} message={error("eventTypeId")} />
            </label>
            <label>
              {t("source")}
              <select defaultValue={props.initial.prospectSourceId ?? ""} name="prospectSourceId" {...fieldProps("prospectSourceId")}>
                <option value="">{t("sourceNone")}</option>
                {props.sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.label}
                  </option>
                ))}
              </select>
              <FieldError id={`${formId}-prospectSourceId-error`} message={error("prospectSourceId")} />
              <span className="field-hint">{t("sourceHint")}</span>
            </label>
          </section>
        </div>
      </form>

      <div className="window-actions info-window-actions" data-confirming={confirming ? "true" : undefined}>
        {confirming ? (
          <div className="task-panel-confirm" role="alertdialog" aria-labelledby={`${titleId}-confirm`} aria-describedby={`${titleId}-confirm-body`}>
            <p id={`${titleId}-confirm`} className="task-panel-confirm-title">
              {t("confirmTitle")}
            </p>
            <p id={`${titleId}-confirm-body`}>{t("confirmBody", { rubrics: changedText.charAt(0).toLocaleUpperCase(locale) + changedText.slice(1) })}</p>
            <span className="task-panel-confirm-actions">
              <button
                type="button"
                className="button-secondary"
                autoFocus
                onClick={() => {
                  closingTo.current = props.closeHref;
                  setConfirming(false);
                }}
              >
                {t("confirmBack")}
              </button>
              <button type="button" className="button-secondary" onClick={() => close()}>
                {t("confirmDiscard")}
              </button>
              <button type="submit" form={formId} disabled={pending}>
                {t("confirmSave")}
              </button>
            </span>
          </div>
        ) : (
          <>
            {next ? (
              <button type="button" className="button-secondary info-window-next" onClick={() => setRubric(next)}>
                {t("next", { rubric: rubricWords(next) })}
              </button>
            ) : (
              <span />
            )}
            <span className="info-window-actions-end">
              <button type="button" className="button-secondary info-window-close" onClick={() => requestClose()}>
                {t("close")}
              </button>
              <button type="submit" form={formId} disabled={pending}>
                {t("save")}
              </button>
            </span>
          </>
        )}
      </div>
    </dialog>
  );
}
