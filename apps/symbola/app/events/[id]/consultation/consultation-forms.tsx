"use client";

// Lot 47 (PRE-03, PRE-09 ; D1, D4, D10 ; ADR 0085) — formulaires de l'écran « Demander des devis » :
// le brief du poste, les destinataires (puis l'écran de contrôle avant l'envoi, MSG-02), l'ajout
// d'un prestataire consulté, la sélection montrée au client. Lisibles en 375 px.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { addConsultedAction, recipientsAction, saveBriefAction, shareSelectionAction, type BriefFormState, type RecipientsState, type ShareState } from "./actions";

function Feedback({ state, success }: { state: { error?: string | undefined; success?: boolean | undefined }; success?: string }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.success && success) return <p role="status">{success}</p>;
  return null;
}

export type BriefFormValues = {
  need: string;
  guestCount: string;
  indicativeBudget: string;
  showBudget: boolean;
  deadline: string;
  documentIds: string[];
};

export function BriefForm({ eventId, slotId, initial, documents }: { eventId: string; slotId: string; initial: BriefFormValues; documents: { id: string; label: string }[] }) {
  const t = useTranslations("VendorCoordination");
  const [state, action, pending] = useActionState<BriefFormState, FormData>(saveBriefAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorSlotId" value={slotId} />
      <label>
        {t("brief.need")}
        <textarea name="need" rows={4} required maxLength={4000} defaultValue={initial.need} />
      </label>
      <FreeTextNotice />
      <label>
        {t("brief.guestCount")}
        <input type="number" name="guestCount" min={0} inputMode="numeric" defaultValue={initial.guestCount} />
      </label>
      <label>
        {t("brief.budget")}
        <input type="text" name="indicativeBudget" inputMode="decimal" defaultValue={initial.indicativeBudget} />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="showBudget" defaultChecked={initial.showBudget} />
        {t("brief.showBudget")}
      </label>
      <p className="muted">{t("brief.budgetHint")}</p>
      <label>
        {t("brief.deadline")}
        <input type="date" name="deadline" required defaultValue={initial.deadline} />
      </label>
      {documents.length > 0 ? (
        <fieldset>
          <legend>{t("brief.inspirations")}</legend>
          {documents.map((document) => (
            <label key={document.id} className="checkbox">
              <input type="checkbox" name="documentIds" value={document.id} defaultChecked={initial.documentIds.includes(document.id)} />
              {document.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="muted">{t("brief.noDocuments")}</p>
      )}
      <button type="submit" className="primary" disabled={pending}>
        {t("brief.save")}
      </button>
      <Feedback state={state} success={t("brief.saved")} />
    </form>
  );
}

export type RecipientOption = { candidateId: string; vendorName: string; email: string; contactName: string; statusLabel: string; alreadySent: boolean };

export function RecipientsForm({ eventId, slotId, options, canSend }: { eventId: string; slotId: string; options: RecipientOption[]; canSend: boolean }) {
  const t = useTranslations("VendorCoordination");
  const [state, action, pending] = useActionState<RecipientsState, FormData>(recipientsAction, {});
  const [chosen, setChosen] = useState<string[]>(options.filter((option) => !option.alreadySent).map((option) => option.candidateId));
  if (state.sent) return <p role="status">{t("recipients.sent", { count: state.sent })}</p>;
  if (state.review) {
    // Écran de contrôle (MSG-02) : la liste exacte ; chacun reçoit son propre e-mail, sans copie.
    return (
      <form action={action} className="stack">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="vendorSlotId" value={slotId} />
        <input type="hidden" name="step" value="send" />
        <input type="hidden" name="digest" value={state.digest ?? ""} />
        <h3>{t("recipients.reviewTitle", { count: state.review.length })}</h3>
        <p>{t("recipients.reviewIntro")}</p>
        <ul aria-label={t("recipients.reviewTitle", { count: state.review.length })}>
          {state.review.map((recipient) => (
            <li key={recipient.candidateId}>
              <input type="hidden" name="candidateIds" value={recipient.candidateId} />
              <input type="hidden" name={`name-${recipient.candidateId}`} value={recipient.name} />
              <input type="hidden" name={`email-${recipient.candidateId}`} value={recipient.email} />
              <strong>{recipient.name}</strong> — {recipient.email}
            </li>
          ))}
        </ul>
        {state.error ? <p role="alert">{state.error}</p> : null}
        <div className="link-actions">
          <button type="submit" className="primary" disabled={pending}>
            {t("recipients.send", { count: state.review.length })}
          </button>
        </div>
      </form>
    );
  }
  if (options.length === 0) return <p>{t("recipients.none")}</p>;
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorSlotId" value={slotId} />
      <input type="hidden" name="step" value="review" />
      <ul className="plain-list stack">
        {options.map((option) => {
          const checked = chosen.includes(option.candidateId);
          return (
            <li key={option.candidateId} className="card stack">
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="candidateIds"
                  value={option.candidateId}
                  checked={checked}
                  onChange={(event) => setChosen((current) => (event.target.checked ? [...current, option.candidateId] : current.filter((id) => id !== option.candidateId)))}
                />
                <strong>{option.vendorName}</strong> <span className="badge">{option.statusLabel}</span>
              </label>
              {option.alreadySent ? <p className="muted">{t("recipients.alreadySent")}</p> : null}
              <label>
                {t("recipients.name", { vendor: option.vendorName })}
                <input type="text" name={`name-${option.candidateId}`} defaultValue={option.contactName || option.vendorName} autoComplete="off" />
              </label>
              <label>
                {t("recipients.email", { vendor: option.vendorName })}
                <input type="email" name={`email-${option.candidateId}`} defaultValue={option.email} autoComplete="off" />
              </label>
            </li>
          );
        })}
      </ul>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" className="primary" disabled={pending || !canSend || chosen.length === 0}>
        {t("recipients.review")}
      </button>
      {!canSend ? <p className="muted">{t("recipients.saveBriefFirst")}</p> : null}
    </form>
  );
}

export function AddConsultedForm({ eventId, slotId }: { eventId: string; slotId: string }) {
  const t = useTranslations("VendorCoordination");
  const [state, action, pending] = useActionState<BriefFormState, FormData>(addConsultedAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorSlotId" value={slotId} />
      <label>
        {t("recipients.addName")}
        <input type="text" name="vendorName" autoComplete="off" maxLength={200} />
      </label>
      <button type="submit" disabled={pending}>
        {t("recipients.add")}
      </button>
      <Feedback state={state} success={t("recipients.added")} />
    </form>
  );
}

export function ShareSelectionForm({ eventId, slotId, options }: { eventId: string; slotId: string; options: { candidateId: string; label: string; shown: boolean }[] }) {
  const t = useTranslations("VendorCoordination");
  const [state, action, pending] = useActionState<ShareState, FormData>(shareSelectionAction, {});
  if (state.success) return <p role="status">{t("share.sent")}</p>;
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorSlotId" value={slotId} />
      <fieldset>
        <legend>{t("share.legend")}</legend>
        {options.map((option) => (
          <label key={option.candidateId} className="checkbox">
            <input type="checkbox" name="shownIds" value={option.candidateId} defaultChecked={option.shown} />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label>
        {t("share.note")}
        <textarea name="note" rows={2} maxLength={500} />
      </label>
      <label>
        {t("share.dueOn")}
        <input type="date" name="dueOn" />
      </label>
      <button type="submit" className="primary" disabled={pending}>
        {t("share.submit")}
      </button>
      <Feedback state={state} />
    </form>
  );
}
