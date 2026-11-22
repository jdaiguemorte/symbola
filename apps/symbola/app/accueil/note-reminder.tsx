"use client";

// Lot 65d (PRE-02, HUB-08 ; recette staging du 22/11/2026, maquette M16) — « Noter une relance » :
// relancer depuis l'app est risqué ; la planner relance par son moyen habituel, puis déclare ici
// comment (téléphone, e-mail, SMS, de vive voix), quand, avec une note facultative et le rappel. Le
// message type se déplie, à copier ; rien n'est envoyé ni ouvert d'office. Une fenêtre (ADR 0107) :
// dialog natif, fond assombri, Échap ferme ; une page entière sur téléphone.
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { noteVendorReminderAction, vendorReminderDraftAction, type NoteReminderState, type ReminderDraft } from "./actions";

const CHANNELS = ["phone", "email", "sms", "in_person"] as const;
const RECALLS = ["2", "3", "7", "14", "none"] as const;

function parisToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function NoteReminderButton({ eventId, candidateId, vendorName, className }: { eventId: string; candidateId: string; vendorName: string; className?: string }) {
  const t = useTranslations("Today.reminder");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReminderDraft | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState<NoteReminderState, FormData>(noteVendorReminderAction, {});
  const ids = { title: useId(), date: useId(), note: useId(), recall: useId(), template: useId() };
  const today = parisToday();

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  useEffect(() => {
    if (!open || draft !== undefined) return;
    let current = true;
    void vendorReminderDraftAction({ eventId, candidateId }).then((result) => {
      if (current) setDraft(result);
    });
    return () => {
      current = false;
    };
  }, [open, draft, eventId, candidateId]);

  // Notée : la fenêtre se ferme, l'écran se met à jour (le prestataire quitte « Aujourd'hui » jusqu'au rappel).
  useEffect(() => {
    if (!state.saved) return;
    setOpen(false);
    router.refresh();
  }, [state, router]);

  const copy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    setCopied(true);
  };

  return (
    <div className="today-action">
      <button type="button" className={className ?? "button-secondary"} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {t("button")}
        <span className="sr-only"> — {vendorName}</span>
      </button>
      {state.saved ? <p role="status">{state.saved}</p> : null}
      <dialog
        ref={dialog}
        className="window window-short"
        aria-labelledby={ids.title}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div className="window-head">
          <button type="button" className="button-ghost window-back" onClick={() => setOpen(false)}>
            ‹ {t("back")}
          </button>
          <h2 id={ids.title}>{t("title", { vendor: vendorName })}</h2>
          <button type="button" className="button-ghost window-close" onClick={() => setOpen(false)}>
            {t("close")}
          </button>
        </div>
        <form action={formAction} className="stack">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="candidateId" value={candidateId} />
          <RequiredLegend text={tCommon("requiredLegend")} />
          <fieldset className="stack">
            <legend>
              {t("channel")}
              <RequiredMark />
            </legend>
            <div className="row-wrap">
              {CHANNELS.map((channel, index) => (
                <label key={channel}>
                  <input type="radio" name="channel" value={channel} defaultChecked={index === 0} required />
                  {t(`channels.${channel}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field-row">
            <label htmlFor={ids.date} className="field-fit">
              <span>
                {t("date")}
                <RequiredMark />
              </span>
              <input id={ids.date} type="date" name="remindedOn" defaultValue={today} max={today} required />
            </label>
            <label htmlFor={ids.recall} className="field-fit">
              {t("recall")}
              <select id={ids.recall} name="recallDays" defaultValue="3">
                {RECALLS.map((recall) => (
                  <option key={recall} value={recall}>
                    {t(`recallOptions.${recall}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label htmlFor={ids.note}>
            {t("note")}
            <textarea id={ids.note} name="note" rows={3} maxLength={2000} />
          </label>
          <FreeTextNotice />
          <details className="reminder-template">
            <summary>{t("template")}</summary>
            {draft === undefined ? <p className="meta">{t("templateLoading")}</p> : null}
            {draft ? (
              <div className="stack">
                {draft.email ? <p className="meta">{t("templateTo", { email: draft.email })}</p> : <p className="meta">{t("templateNoEmail")}</p>}
                <label htmlFor={ids.template}>
                  {t("templateLabel")}
                  <textarea id={ids.template} readOnly rows={7} value={`${draft.subject}\n\n${draft.body}`} />
                </label>
                <button type="button" className="button-secondary" onClick={() => void copy()}>
                  {t("copy")}
                </button>
                {copied ? <p role="status">{t("copied")}</p> : null}
              </div>
            ) : null}
          </details>
          {state.error ? (
            <p role="alert" className="notice notice-error">
              {state.error}
            </p>
          ) : null}
          <div className="window-actions">
            <button type="button" className="button-secondary" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </button>
            <button type="submit" className="button-primary" disabled={pending}>
              {t("save")}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
