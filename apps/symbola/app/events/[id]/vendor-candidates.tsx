"use client";

// Lot 11 (L11-EVT-10 / L11-EVT-11) — prestataires consultés pour le poste choisi :
// statut, devis, notes (internes ou montrées aux clients), « Retenir ».
// Des cartes plutôt qu'un tableau : lisibles en 375 px. Lot 28a (PRE-02,
// BUD-02) : sept statuts ; « Retenir » au-delà du seuil se confirme d'abord.
// Lot 63d (PRE-02, UX-13 ; recette du 21/11/2026, #36) : le motif de ligne des tâches (maquette M6). Chaque
// prestataire est une ligne (nom, statut, devis) avec ses actions visibles, « Modifier », « Retenir » et
// « Retirer » ; « Modifier » ou un clic sur la ligne ouvre sa fenêtre (statut, devis, notes).
import Link from "next/link";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { useActionState, useRef, useState, type MouseEvent } from "react";
import { EditDialog, type EditDialogHandle } from "@/app/ui/edit-dialog";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import { formatAmount, formatAmountInput, type Locale } from "@symbola/i18n";
import { ENGAGED_CANDIDATE_STATUSES, VENDOR_CANDIDATE_STATUSES, type VendorCandidateStatus } from "@symbola/contracts";
import type { EventVendorSlot, VendorCandidate, VendorFollowUpStatus } from "@/modules/events/service";
import { formatDateTime } from "@symbola/i18n";
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
      <FreeTextNotice />
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

function CandidateDetails({
  eventId,
  candidate,
  vendorsAvailable,
  locale,
  followUp,
}: {
  eventId: string;
  candidate: VendorCandidate;
  vendorsAvailable: boolean;
  locale: Locale;
  followUp: VendorFollowUpStatus | undefined;
}) {
  const t = useTranslations("VendorCandidates");
  const tCoordination = useTranslations("VendorCoordination");
  const [state, action, pending] = useActionState(updateCandidateAction, {});
  const [quoteState, quoteAction, quotePending] = useUploadAction<CandidateFormState>(`/events/${eventId}/consultes/${candidate.id}/devis`);
  const [noteState, noteAction, notePending] = useActionState(addCandidateNoteAction, {});
  const [status, setStatus] = useState<VendorCandidateStatus>(candidate.status);
  const [contactedOn, setContactedOn] = useState(candidate.contactedOn ?? "");
  const [amount, setAmount] = useState(formatAmountInput(candidate.quoteAmountCents, locale));
  const [shown, setShown] = useState(candidate.shownToClients);
  const [shareRib, setShareRib] = useState(candidate.shareRibWithClients);
  const name = candidate.vendorName;
  const headingId = `candidate-${candidate.id}`;

  return (
    <div className="candidate-card" aria-labelledby={headingId}>
      <div className="section-head">
        <h3 id={headingId}>
          {candidate.vendorId && vendorsAvailable ? <Link href={`/prestataires/${candidate.vendorId}`}>{name}</Link> : name}
        </h3>
        <span className={STATUS_CLASSES[candidate.status]}>{t(`status.${candidate.status}`)}</span>
      </div>
      {candidate.quoteAmountCents !== null ? <p className="strong">{t("quoteOf", { amount: formatAmount(candidate.quoteAmountCents, locale) })}</p> : null}
      {/* Lot 47 (PAR-05 ; D8) : feuilles de route envoyées, confirmées ou non ; facture déposée. */}
      {followUp
        ? followUp.roadmaps.map((roadmap) => (
            <p key={roadmap.stage} className="muted">
              {roadmap.confirmedAt
                ? tCoordination("followUp.confirmed", { stage: tCoordination(`followUp.stage.${roadmap.stage}`), date: formatDateTime(new Date(roadmap.confirmedAt), locale) })
                : tCoordination("followUp.sent", { stage: tCoordination(`followUp.stage.${roadmap.stage}`), date: formatDateTime(new Date(roadmap.sentAt), locale) })}
            </p>
          ))
        : null}
      {followUp?.invoiceDocumentId ? <a href={`/events/${eventId}/documents/${followUp.invoiceDocumentId}`}>{tCoordination("followUp.invoice", { vendor: name })}</a> : null}
      {followUp && !followUp.hasLink ? <p className="muted">{tCoordination("followUp.noLink")}</p> : null}

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
          <FreeTextNotice />
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

      {vendorsAvailable && !candidate.vendorId ? (
        <div className="candidate-actions">
          <form action={addCandidateToBookAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="candidateId" value={candidate.id} />
            <input type="hidden" name="vendorName" value={name} />
            <button type="submit">{t("addToBook", { vendor: name })}</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

// Un clic sur la ligne ouvre la fenêtre, sauf s'il vise un contrôle de la ligne.
function fromControl(event: MouseEvent): boolean {
  return (event.target as HTMLElement).closest("a, button, input, select, label, summary, details, form, dialog") !== null;
}

function CandidateRow(props: { eventId: string; candidate: VendorCandidate; vendorsAvailable: boolean; locale: Locale; followUp: VendorFollowUpStatus | undefined }) {
  const { eventId, candidate, vendorsAvailable, locale } = props;
  const t = useTranslations("VendorCandidates");
  const [selectState, selectAction, selectPending] = useActionState(selectCandidateAction, {});
  const dialog = useRef<EditDialogHandle>(null);
  const name = candidate.vendorName;
  return (
    <li
      className="choice-row"
      aria-label={name}
      onClick={(event) => {
        if (!fromControl(event)) dialog.current?.open();
      }}
    >
      <div className="choice-row-main">
        <span className="choice-row-title">{candidate.vendorId && vendorsAvailable ? <Link href={`/prestataires/${candidate.vendorId}`}>{name}</Link> : name}</span>
        <span className={STATUS_CLASSES[candidate.status]}>{t(`status.${candidate.status}`)}</span>
        {candidate.quoteAmountCents !== null ? <span className="choice-row-meta">{t("quoteOf", { amount: formatAmount(candidate.quoteAmountCents, locale) })}</span> : null}
        {candidate.shownToClients ? <span className="badge badge-sauge">{t("shownToClientsShort")}</span> : null}
      </div>
      <div className="row-actions choice-row-actions">
        <EditDialog ref={dialog} title={t("editTitle", { vendor: name })} long trigger={{ label: t("edit"), ariaLabel: t("editFor", { vendor: name }) }}>
          <CandidateDetails {...props} />
        </EditDialog>
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
        <form action={removeCandidateAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="candidateId" value={candidate.id} />
          <button type="submit" className="button-danger">
            {t("remove", { vendor: name })}
          </button>
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
  followUps = [],
}: {
  eventId: string;
  slot: EventVendorSlot;
  candidates: VendorCandidate[];
  bookOptions: BookOption[];
  vendorsAvailable: boolean;
  locale: Locale;
  followUps?: VendorFollowUpStatus[];
}) {
  const t = useTranslations("VendorCandidates");
  const tCoordination = useTranslations("VendorCoordination");
  const withQuote = candidates.filter((candidate) => candidate.quoteAmountCents !== null || candidate.hasQuoteFile).length;
  return (
    <section className="card candidates" aria-labelledby="candidates-title" data-tour="vendor-candidates">
      <div className="section-head">
        <h2 id="candidates-title">{t("title", { slot: slot.label })}</h2>
        {candidates.length > 0 ? <span className="badge badge-bleu">{t("quotesReceived", { received: withQuote, total: candidates.length })}</span> : null}
        {vendorsAvailable ? <Link href={`/prestataires?evenement=${eventId}&poste=${slot.id}`}>{t("findOnMap")}</Link> : null}
      </div>
      {/* Lot 47 (PRE-03, BUD-05) : le brief à plusieurs prestataires, le comparatif, les scénarios. */}
      <p className="link-actions">
        <Link href={`/events/${eventId}/consultation/${slot.id}`} className="button-link button-link-primary">
          {tCoordination("askQuotes")}
        </Link>
        <Link href={`/events/${eventId}/scenarios`} className="button-link">
          {tCoordination("scenariosLink")}
        </Link>
      </p>
      <SlotBriefForm key={`brief-${slot.id}`} eventId={eventId} slot={slot} />
      {candidates.length === 0 ? <p>{t("empty")}</p> : null}
      <ul className="choice-list">
        {candidates.map((candidate) => (
          <CandidateRow key={`${candidate.id}-${candidate.status}-${candidate.quoteAmountCents}-${candidate.shownToClients}-${candidate.shareRibWithClients}`} eventId={eventId} candidate={candidate} vendorsAvailable={vendorsAvailable} locale={locale} followUp={followUps.find((entry) => entry.candidateId === candidate.id)} />
        ))}
      </ul>
      <p className="muted">{t("selectHint")}</p>
      <AddCandidateForm key={`add-${slot.id}-${candidates.length}`} eventId={eventId} slot={slot} bookOptions={bookOptions} vendorsAvailable={vendorsAvailable} />
    </section>
  );
}
