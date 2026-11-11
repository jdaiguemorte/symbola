"use client";

// Lot 11 (L11-EVT-10 / L11-EVT-11) — prestataires consultés pour le poste choisi :
// statut, devis, notes (internes ou montrées aux clients), « Retenir ».
// Des cartes plutôt qu'un tableau : lisibles en 375 px. Lot 28a (PRE-02,
// BUD-02) : sept statuts ; « Retenir » au-delà du seuil se confirme d'abord.
import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import { formatAmount, formatAmountInput, type Locale } from "@symbola/i18n";
import { ENGAGED_CANDIDATE_STATUSES, VENDOR_CANDIDATE_STATUSES, type VendorCandidateStatus } from "@symbola/contracts";
import type { EventVendorSlot, VendorCandidate } from "@/modules/events/service";
import {
  addCandidateAction,
  addCandidateNoteAction,
  addCandidateToBookAction,
  removeCandidateAction,
  removeCandidateNoteAction,
  saveSlotBriefAction,
  selectCandidateAction,
  toggleCandidateNoteAction,
  updateCandidateAction,
  type CandidateFormState,
} from "./vendor-candidate-actions";

// Couleur toujours accompagnée du libellé (charte, contrastes AA).
const STATUS_CLASSES: Record<VendorCandidateStatus, string> = {
  shortlisted: "badge",
  contacted: "badge badge-ambre",
  quote_received: "badge badge-bleu",
  retained: "badge badge-sauge",
  contract_signed: "badge badge-sauge",
  paid_off: "badge badge-sauge",
  dismissed: "badge",
};

function isEngaged(status: VendorCandidateStatus): boolean {
  return ENGAGED_CANDIDATE_STATUSES.includes(status);
}

function Feedback({ state, success }: { state: CandidateFormState; success?: string }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.success && success) return <p role="status">{success}</p>;
  return null;
}

// BUD-02 : le dépassement chiffré du seuil, puis la confirmation, dans le
// formulaire qui engage (le même envoi, avec confirmed=1).
function ConfirmEngagement({ state, vendor }: { state: CandidateFormState; vendor: string }) {
  const t = useTranslations("VendorCandidates");
  if (!state.confirm) return null;
  return (
    <div className="notice">
      <p role="alert">{state.confirm}</p>
      <button type="submit" name="confirmed" value="1">
        {t("confirmEngagement", { vendor })}
      </button>
    </div>
  );
}

export type BookOption = { id: string; label: string };

export function SlotBriefForm({ eventId, slot }: { eventId: string; slot: EventVendorSlot }) {
  const t = useTranslations("VendorCandidates");
  const [state, action, pending] = useActionState(saveSlotBriefAction, {});
  const [brief, setBrief] = useState(slot.brief ?? "");
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorSlotId" value={slot.id} />
      <label>
        {t("briefLabel")}
        <textarea name="brief" rows={2} value={brief} onChange={(event) => setBrief(event.target.value)} />
      </label>
      <button type="submit" disabled={pending}>
        {t("briefSave")}
      </button>
      <Feedback state={state} success={t("briefSaved")} />
    </form>
  );
}

export function AddCandidateForm({ eventId, slot, bookOptions, vendorsAvailable }: { eventId: string; slot: EventVendorSlot; bookOptions: BookOption[]; vendorsAvailable: boolean }) {
  const t = useTranslations("VendorCandidates");
  const [state, action, pending] = useActionState(addCandidateAction, {});
  return (
    <form action={action} className="add-candidate">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorSlotId" value={slot.id} />
      <fieldset>
        <legend>{t("addTitle", { slot: slot.label })}</legend>
        {vendorsAvailable && bookOptions.length > 0 ? (
          <label>
            {t("fromBook")}
            <select name="vendorId" defaultValue="">
              <option value="">{t("fromBookNone")}</option>
              {bookOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          {vendorsAvailable ? t("newVendorName") : t("vendorName")}
          <input type="text" name="vendorName" autoComplete="off" />
        </label>
        {vendorsAvailable ? (
          <label className="checkbox">
            <input type="checkbox" name="addToBook" defaultChecked />
            {t("addToBookToo")}
          </label>
        ) : null}
        <button type="submit" disabled={pending}>
          {t("add")}
        </button>
        <Feedback state={state} />
      </fieldset>
    </form>
  );
}

function CandidateCard({
  eventId,
  candidate,
  vendorsAvailable,
  locale,
}: {
  eventId: string;
  candidate: VendorCandidate;
  vendorsAvailable: boolean;
  locale: Locale;
}) {
  const t = useTranslations("VendorCandidates");
  const [state, action, pending] = useActionState(updateCandidateAction, {});
  const [quoteState, quoteAction, quotePending] = useUploadAction<CandidateFormState>(`/events/${eventId}/consultes/${candidate.id}/devis`);
  const [noteState, noteAction, notePending] = useActionState(addCandidateNoteAction, {});
  const [selectState, selectAction, selectPending] = useActionState(selectCandidateAction, {});
  const [status, setStatus] = useState<VendorCandidateStatus>(candidate.status);
  const [contactedOn, setContactedOn] = useState(candidate.contactedOn ?? "");
  const [amount, setAmount] = useState(formatAmountInput(candidate.quoteAmountCents, locale));
  const [shown, setShown] = useState(candidate.shownToClients);
  const [shareRib, setShareRib] = useState(candidate.shareRibWithClients);
  const name = candidate.vendorName;
  const headingId = `candidate-${candidate.id}`;

  return (
    <li className="card candidate-card" aria-labelledby={headingId}>
      <div className="section-head">
        <h3 id={headingId}>
          {candidate.vendorId && vendorsAvailable ? <Link href={`/prestataires/${candidate.vendorId}`}>{name}</Link> : name}
        </h3>
        <span className={STATUS_CLASSES[candidate.status]}>{t(`status.${candidate.status}`)}</span>
      </div>
      {candidate.quoteAmountCents !== null ? <p className="strong">{t("quoteOf", { amount: formatAmount(candidate.quoteAmountCents, locale) })}</p> : null}

      <form action={action} className="candidate-form">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="candidateId" value={candidate.id} />
        <label>
          {t("statusLabel")}
          <select name="status" value={status} onChange={(event) => setStatus(event.target.value as VendorCandidateStatus)}>
            {VENDOR_CANDIDATE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("contactedOn")}
          <input type="date" name="contactedOn" value={contactedOn} onChange={(event) => setContactedOn(event.target.value)} />
        </label>
        <label>
          {t("quoteAmount")}
          <input type="text" inputMode="decimal" name="quoteAmount" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="checkbox">
          <input type="checkbox" name="shownToClients" checked={shown} onChange={(event) => setShown(event.target.checked)} />
          {t("shownToClients")}
        </label>
        {candidate.vendorId ? (
          <label className="checkbox">
            <input type="checkbox" name="shareRibWithClients" checked={shareRib} onChange={(event) => setShareRib(event.target.checked)} />
            {t("shareRibWithClients")}
          </label>
        ) : null}
        <button type="submit" disabled={pending} aria-label={t("saveFor", { vendor: name })}>
          {t("save")}
        </button>
        <Feedback state={state} success={t("saved")} />
        <ConfirmEngagement state={state} vendor={name} />
      </form>

      <div className="candidate-quote">
        {candidate.hasQuoteFile ? (
          <a href={`/events/${eventId}/consultes/${candidate.id}/devis`}>{t("openQuote", { vendor: name })}</a>
        ) : null}
        <form action={quoteAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="candidateId" value={candidate.id} />
          <label>
            {candidate.hasQuoteFile ? t("replaceQuote") : t("attachQuote")}
            <input type="file" name="quote" accept="application/pdf,image/*" />
          </label>
          <button type="submit" disabled={quotePending} aria-label={t("attachFor", { vendor: name })}>
            {t("attach")}
          </button>
          <Feedback state={quoteState} />
        </form>
      </div>

      <section aria-label={t("notesOf", { vendor: name })} className="candidate-notes">
        <h4>{t("notesTitle")}</h4>
        {candidate.notes.length === 0 ? <p className="muted">{t("noNotes")}</p> : null}
        <ul>
          {candidate.notes.map((note) => (
            <li key={note.id}>
              <span className={note.visibleToClients ? "badge badge-sauge" : "badge"}>{note.visibleToClients ? t("noteClients") : t("noteInternal")}</span> {note.body}
              <form action={toggleCandidateNoteAction} className="inline-form">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="noteId" value={note.id} />
                <input type="hidden" name="visibleToClients" value={note.visibleToClients ? "false" : "true"} />
                <button type="submit" className="link-button">
                  {note.visibleToClients ? t("noteMakeInternal") : t("noteShowClients")}
                </button>
              </form>
              <form action={removeCandidateNoteAction} className="inline-form">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="noteId" value={note.id} />
                <button type="submit" className="link-button">
                  {t("noteRemove")}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={noteAction} className="stack">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="candidateId" value={candidate.id} />
          <label>
            {t("newNote", { vendor: name })}
            <textarea name="body" rows={2} />
          </label>
          <label className="checkbox">
            <input type="checkbox" name="visibleToClients" />
            {t("noteVisibleToClients")}
          </label>
          <button type="submit" disabled={notePending} aria-label={t("addNoteFor", { vendor: name })}>
            {t("addNote")}
          </button>
          <Feedback state={noteState} />
        </form>
      </section>

      <div className="candidate-actions">
        {!isEngaged(candidate.status) && candidate.status !== "dismissed" ? (
          <form action={selectAction} className="primary-action">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="candidateId" value={candidate.id} />
            <button type="submit" disabled={selectPending}>
              {t("select", { vendor: name })}
            </button>
            <Feedback state={selectState} />
            <ConfirmEngagement state={selectState} vendor={name} />
          </form>
        ) : null}
        {vendorsAvailable && !candidate.vendorId ? (
          <form action={addCandidateToBookAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="candidateId" value={candidate.id} />
            <input type="hidden" name="vendorName" value={name} />
            <button type="submit">{t("addToBook", { vendor: name })}</button>
          </form>
        ) : null}
        <form action={removeCandidateAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="candidateId" value={candidate.id} />
          <button type="submit">{t("remove", { vendor: name })}</button>
        </form>
      </div>
    </li>
  );
}

export function VendorCandidates({
  eventId,
  slot,
  candidates,
  bookOptions,
  vendorsAvailable,
  locale,
}: {
  eventId: string;
  slot: EventVendorSlot;
  candidates: VendorCandidate[];
  bookOptions: BookOption[];
  vendorsAvailable: boolean;
  locale: Locale;
}) {
  const t = useTranslations("VendorCandidates");
  const withQuote = candidates.filter((candidate) => candidate.quoteAmountCents !== null || candidate.hasQuoteFile).length;
  return (
    <section className="card candidates" aria-labelledby="candidates-title" data-tour="vendor-candidates">
      <div className="section-head">
        <h2 id="candidates-title">{t("title", { slot: slot.label })}</h2>
        {candidates.length > 0 ? <span className="badge badge-bleu">{t("quotesReceived", { received: withQuote, total: candidates.length })}</span> : null}
        {vendorsAvailable ? <Link href={`/prestataires?evenement=${eventId}&poste=${slot.id}`}>{t("findOnMap")}</Link> : null}
      </div>
      <SlotBriefForm key={`brief-${slot.id}`} eventId={eventId} slot={slot} />
      {candidates.length === 0 ? <p>{t("empty")}</p> : null}
      <ul className="candidate-list">
        {candidates.map((candidate) => (
          <CandidateCard key={`${candidate.id}-${candidate.status}-${candidate.quoteAmountCents}-${candidate.shownToClients}-${candidate.shareRibWithClients}`} eventId={eventId} candidate={candidate} vendorsAvailable={vendorsAvailable} locale={locale} />
        ))}
      </ul>
      <p className="muted">{t("selectHint")}</p>
      <AddCandidateForm key={`add-${slot.id}-${candidates.length}`} eventId={eventId} slot={slot} bookOptions={bookOptions} vendorsAvailable={vendorsAvailable} />
    </section>
  );
}
