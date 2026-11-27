"use client";

// Lot 72d (EVT-05, UX-06, UX-07 ; C-25, C-27, P-17 ; E1, E2, J1, J2, J12 ; page 15 des maquettes du lot 68)
// — la frise du statut, en lecture : quatre étapes (« Une demande en cours », « Signé, en préparation »,
// « Jour J », « Clôturé ») ; une étape franchie a sa coche et sa date, celle en cours dit depuis quand.
// Aucun rond ne se clique. Au bout, le bouton de l'étape qui se franchit à la main : « Le contrat est
// signé… » (la question s'ouvre juste dessous, avec la date de signature, qui peut être passée) ou
// « Clôturer l'évènement… » le lendemain du jour J (la liste de clôture, lot 58). Reporté, Annulé et
// Archivé remplacent la frise par une ligne d'état et leur seule suite : « Fixer la nouvelle date… »,
// « Rétablir l'évènement… » (fenêtres de niveau 2), « Ouvrir la clôture ». Sur téléphone, une ligne
// (« Signé, en préparation · étape 2 sur 4 ») et « Les étapes », qui ouvre la frise en panneau du bas.
// Remplace la frise cliquable du lot 34a (change-status-form.tsx).
import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { formatAmount, type Locale } from "@symbola/i18n";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { useFeedback } from "@/app/ui/feedback";
import { FieldError } from "@/app/ui/field-error";
import { TaskPopover, usePopover } from "@/app/ui/task-popover";
import type { EventTimelineView } from "@/lib/events/event-header";
import { changeEventStatusAction, confirmPostponementAction, markContractSignedAction, reactivateEventAction, type ChangeStatusFormState, type ContractSignedState } from "./actions";

const STEP_KEYS = { request: "request", signed: "signed", day_of: "day_of", closed: "closed" } as const;

function shortDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)).replace(/[  ]/g, " ");
}

function longDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export type PostponementPreview = { newDate: string | null; moves: number; inThePast: { taskId: string; label: string; toDate: string }[] };

export type StatusTimelineProps = {
  eventId: string;
  names: string;
  view: EventTimelineView;
  locale: Locale;
  today: string;
  closingHref: string;
  editInfoHref: string;
  quotesHref: string;
  reason: string | null;
  postponement: PostponementPreview | null;
  hasSignedQuote: boolean;
  invoicesToCredit: { id: string; number: string; amountCents: number; quoteId: string }[];
};

function Steps({ view, locale, labelId }: { view: EventTimelineView; locale: Locale; labelId?: string }) {
  const t = useTranslations("EventHeader.timeline");
  return (
    <ol className="event-steps" aria-label={labelId ? undefined : t("label")} aria-labelledby={labelId}>
      {view.steps.map((step, index) => (
        <li key={step.step} className={`event-step event-step-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
          <span className="event-step-dot" aria-hidden="true">
            {step.state === "passed" ? "✓" : step.state === "current" ? "" : String(index + 1)}
          </span>
          {step.step === "request" ? (
            <span className="event-step-label">
              <span className="event-step-label-long">{t("request")}</span>
              <span className="event-step-label-short">{t("requestShort")}</span>
            </span>
          ) : (
            <span className="event-step-label">{t(STEP_KEYS[step.step])}</span>
          )}
          {step.date ? <span className="event-step-date">{step.state === "current" && step.step !== "day_of" ? t("since", { date: shortDate(step.date, locale) }) : shortDate(step.date, locale)}</span> : null}
        </li>
      ))}
    </ol>
  );
}

type ActionHandle<S> = { state: S; action: (formData: FormData) => void; pending: boolean };

// « Le contrat est signé… » : la question s'ouvre juste dessous (E2), avec « Signé le ». L'état de l'action
// est tenu par la frise : l'étape franchie, ce bouton disparaît, et le message de retour doit encore partir.
function SignGesture({ eventId, names, today, sign }: { eventId: string; names: string; today: string; sign: ActionHandle<ContractSignedState> }) {
  const t = useTranslations("EventHeader.timeline");
  const [asked, setAsked] = useState(false);
  const { state, action, pending } = sign;
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (asked) field.current?.focus();
  }, [asked]);
  useEffect(() => {
    if (state.success) setAsked(false);
  }, [state]);

  return (
    <div className="event-gesture">
      <button ref={button} type="button" className="button-secondary" aria-expanded={asked} aria-controls={`${id}-question`} onClick={() => setAsked((value) => !value)}>
        {t("sign")}
      </button>
      {asked ? (
        <form id={`${id}-question`} action={action} className="event-sign-question" noValidate aria-labelledby={`${id}-title`}>
          <input type="hidden" name="eventId" value={eventId} />
          <h2 id={`${id}-title`} className="event-sign-title">
            {t("signQuestion", { names })}
          </h2>
          <p>{t("signBody")}</p>
          <label htmlFor={`${id}-date`}>{t("signedOn")}</label>
          <input
            ref={field}
            id={`${id}-date`}
            type="date"
            name="signedOn"
            defaultValue={today}
            max={today}
            className="field-short"
            aria-invalid={state.field === "signedOn" ? true : undefined}
            aria-describedby={state.field === "signedOn" ? `${id}-error ${id}-format` : `${id}-format`}
          />
          <p id={`${id}-format`} className="muted">
            {t("signedOnFormat")}
          </p>
          <FieldError id={`${id}-error`} message={state.field === "signedOn" ? state.error : undefined} />
          {state.error && state.field !== "signedOn" ? <p role="alert">{state.error}</p> : null}
          <div className="row-wrap">
            <button
              type="button"
              onClick={() => {
                setAsked(false);
                button.current?.focus();
              }}
            >
              {t("keepRequest")}
            </button>
            <button type="submit" className="button-primary" disabled={pending}>
              {t("markSigned")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Gesture(props: StatusTimelineProps & { sign: ActionHandle<ContractSignedState> }) {
  const t = useTranslations("EventHeader.timeline");
  if (props.view.gesture === "sign") return <SignGesture eventId={props.eventId} names={props.names} today={props.today} sign={props.sign} />;
  if (props.view.gesture === "close")
    return (
      <div className="event-gesture">
        <Link className="button-link" href={props.closingHref}>
          {t("close")}
        </Link>
      </div>
    );
  // Clôturé, pas encore archivé : la liste de clôture reste à portée (lot 58).
  if (props.view.current === "closed")
    return (
      <div className="event-gesture">
        <Link href={props.closingHref}>{t("openClosing")}</Link>
      </div>
    );
  return null;
}

// La ligne d'état d'un évènement reporté, annulé ou archivé, et sa seule suite.
function StatusLine(props: StatusTimelineProps & { restore: ActionHandle<ChangeStatusFormState>; confirm: ActionHandle<ChangeStatusFormState> }) {
  const t = useTranslations("EventHeader.timeline");
  const tEvents = useTranslations("Events");
  const { state: restoreState, action: restoreAction, pending: restoring } = props.restore;
  const { state: confirmState, action: confirmAction, pending: confirming } = props.confirm;
  const restoreRef = useRef<HTMLDialogElement>(null);
  const dateRef = useRef<HTMLDialogElement>(null);

  const line = props.view.line!;
  if (line.kind === "archived") {
    return (
      <p className="event-status-line">
        <strong>{t("archived")}</strong> · {t("readOnly")} <Link href={props.closingHref}>{t("openClosing")}</Link>
      </p>
    );
  }
  if (line.kind === "postponed") {
    const preview = props.postponement;
    return (
      <div className="event-status-line">
        <p>
          <strong>{t("postponed")}</strong>
          {line.previousDate ? ` · ${t("postponedFrom", { date: longDate(line.previousDate, props.locale) })}` : ""}
        </p>
        <p className="muted">{t("postponedNext")}</p>
        <ConfirmDialog
          dialogRef={dateRef}
          tone="primary"
          level={2}
          trigger={t("setNewDate")}
          triggerLabel={t("setNewDate")}
          triggerClassName="button-secondary"
          title={t("setNewDateTitle", { names: props.names })}
          body={preview?.newDate ? tEvents("postponementBody", { date: longDate(preview.newDate, props.locale) }) : t("setNewDateNoDate")}
          confirmLabel={tEvents("confirmPostponement")}
          keepLabel={t("setNewDateKeep")}
          action={confirmAction}
          pending={confirming}
          fields={{ eventId: props.eventId }}
        >
          {preview?.newDate ? (
            <>
              <p>{tEvents("postponementMoves", { count: preview.moves })}</p>
              {preview.inThePast.length > 0 ? (
                <>
                  <p>{tEvents("postponementPastTitle", { count: preview.inThePast.length })}</p>
                  <ul>
                    {preview.inThePast.map((task) => (
                      <li key={task.taskId}>{tEvents("postponementPastItem", { label: task.label, date: longDate(task.toDate, props.locale) })}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {props.hasSignedQuote ? (
                <label className="choice-item">
                  <input type="checkbox" name="shiftQuote" value="1" defaultChecked />
                  <span>{tEvents("postponementShiftQuote")}</span>
                </label>
              ) : null}
            </>
          ) : (
            <p>
              <Link href={props.editInfoHref}>{t("setNewDateEdit")}</Link>
            </p>
          )}
          {confirmState.error ? <p role="alert">{confirmState.error}</p> : null}
        </ConfirmDialog>
      </div>
    );
  }
  return (
    <div className="event-status-line">
      <p>
        <strong>{line.date ? t("cancelledOn", { date: shortDate(line.date, props.locale) }) : t("cancelled")}</strong>
        {props.reason ? ` · ${t("reason", { reason: props.reason })}` : ""}
      </p>
      <div className="row-wrap">
        <ConfirmDialog
          dialogRef={restoreRef}
          tone="primary"
          level={2}
          trigger={t("restore")}
          triggerLabel={t("restore")}
          triggerClassName="button-secondary"
          title={t("restoreTitle", { names: props.names })}
          body={t("restoreBody")}
          confirmLabel={t("restoreConfirm")}
          keepLabel={t("keepCancelled")}
          action={restoreAction}
          pending={restoring}
          fields={{ eventId: props.eventId }}
        >
          {/* J12 : ce que fait vraiment l'app au rétablissement (vérifié par lot-72d.integration.test.ts). */}
          <ul className="confirm-dialog-consequences">
            <li>{t("restoreLinks")}</li>
            <li>{t("restoreReminders")}</li>
            <li>{t("restoreNobody")}</li>
          </ul>
          {restoreState.error ? <p role="alert">{restoreState.error}</p> : null}
        </ConfirmDialog>
        <Link href={props.closingHref}>{t("openClosing")}</Link>
      </div>
      {/* FAC-13, D7 : un avoir est proposé pour chaque facture émise ; la planner décide. */}
      {props.invoicesToCredit.length > 0 ? (
        <div className="event-invoices-check">
          <p>{t("invoicesCheck", { count: props.invoicesToCredit.length })}</p>
          <ul>
            {props.invoicesToCredit.map((invoice) => (
              <li key={invoice.id}>
                {invoice.number} — {formatAmount(invoice.amountCents, props.locale)} <Link href={`/devis/${invoice.quoteId}`}>{tEvents("issueCreditNote")}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function StatusTimeline(props: StatusTimelineProps) {
  const t = useTranslations("EventHeader");
  const tTimeline = useTranslations("EventHeader.timeline");
  const tEvents = useTranslations("Events");
  const router = useRouter();
  const feedback = useFeedback();
  const sheet = usePopover();
  const opener = useRef<HTMLButtonElement>(null);
  const sheetTitle = useId();
  // Les gestes de la frise ; tenus ici, car l'étape franchie, leur bouton disparaît (lot 70b : chaque
  // changement est dit dans le message de retour).
  const [signState, signAction, signing] = useActionState<ContractSignedState, FormData>(markContractSignedAction, {});
  const [, undo] = useActionState<ChangeStatusFormState, FormData>(changeEventStatusAction, {});
  const [restoreState, restoreAction, restoring] = useActionState<ChangeStatusFormState, FormData>(reactivateEventAction, {});
  const [confirmState, confirmAction, confirming] = useActionState<ChangeStatusFormState, FormData>(confirmPostponementAction, {});
  const announced = useRef<object | null>(null);
  const { names, eventId, locale, today } = props;
  useEffect(() => {
    if (signState.success && announced.current !== signState) {
      announced.current = signState;
      // Contrat signé, avec « Annuler » dix secondes (retour en demande).
      feedback?.show({
        title: tTimeline("signedMessage", { names }),
        detail: tTimeline("signedDetail", { date: shortDate(signState.signedOn ?? today, locale) }),
        action: {
          kind: "undo",
          label: tTimeline("undoSigned"),
          run: () => {
            const formData = new FormData();
            formData.set("eventId", eventId);
            formData.set("toStatus", "option");
            startTransition(() => undo(formData));
            feedback.show({ title: tTimeline("undoneSigned", { names }) });
          },
        },
      });
      router.refresh();
    }
    for (const [changed, title] of [
      [restoreState, tEvents("statusRestoredMessage", { names })],
      [confirmState, tEvents("statusChanged")],
    ] as const) {
      if (changed.success && announced.current !== changed) {
        announced.current = changed;
        feedback?.show({ title });
        router.refresh();
      }
    }
  }, [signState, restoreState, confirmState, feedback, names, eventId, locale, today, tTimeline, tEvents, router, undo]);
  const sign = { state: signState, action: signAction, pending: signing };
  if (props.view.line) return <StatusLine {...props} restore={{ state: restoreState, action: restoreAction, pending: restoring }} confirm={{ state: confirmState, action: confirmAction, pending: confirming }} />;
  const currentIndex = props.view.steps.findIndex((step) => step.state === "current");
  const current = props.view.current;
  return (
    <div className="event-timeline">
      {/* À l'ordinateur : la frise sur une ligne, et le geste de l'étape suivante au bout. */}
      <div className="event-timeline-wide">
        <Steps view={props.view} locale={props.locale} />
        <Gesture {...props} sign={sign} />
      </div>
      {/* Sur téléphone : l'étape en cours, et « Les étapes » en panneau du bas (avec le geste). */}
      <p className="event-timeline-compact">
        {current ? <strong>{tTimeline(STEP_KEYS[current])}</strong> : null}
        {currentIndex >= 0 ? <span> · {t("stepOf", { n: currentIndex + 1 })}</span> : null}
        <span> · </span>
        <button ref={opener} type="button" className="button-ghost event-steps-open" aria-haspopup="dialog" onClick={() => sheet.open(opener.current)}>
          {t("steps")}
        </button>
      </p>
      <TaskPopover handle={sheet} label={t("stepsTitle", { names: props.names })} className="event-steps-sheet">
        <p id={sheetTitle} className="task-popover-title">
          {t("stepsTitle", { names: props.names })}
        </p>
        <Steps view={props.view} locale={props.locale} labelId={sheetTitle} />
        <Gesture {...props} sign={sign} />
        <button type="button" className="button-ghost" onClick={() => sheet.close()}>
          {t("close")}
        </button>
      </TaskPopover>
    </div>
  );
}
