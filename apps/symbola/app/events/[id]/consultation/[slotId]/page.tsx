// Lot 47 (PRE-03, BUD-05, PRE-09, PAR-05 ; D1 à D7, D10 ; ADR 0085) — « Demander des devis » pour un
// poste : le brief, les destinataires (un e-mail et un lien chacun, après l'écran de contrôle), le
// comparatif des réponses (tableau sur ordinateur, une carte par prestataire sur téléphone), la
// sélection montrée au client, et le prestataire retenu, modifiable à tout moment (D6 révisée : aucun
// délai). Un membre de l'équipe y accède comme à la fiche de l'évènement ; sans le module
// Prestataires, les noms et e-mails se saisissent (ARC-07).
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatDateTime, formatAmountInput, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import {
  getDefaultVendorBriefDeadline,
  getEvent,
  getVendorComparison,
  listEventDecisions,
  listEventDocuments,
  listEventLinks,
  listEventVendorSlots,
  ENGAGED_CANDIDATE_STATUSES,
  type VendorComparisonRow,
} from "@/modules/events/service";
import { getVendorContacts } from "@/modules/vendors/service";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { AddConsultedForm, BriefForm, RecipientsForm, ShareSelectionForm } from "../consultation-forms";
import { changeRetainedAction } from "../actions";

type Translate = Awaited<ReturnType<typeof getTranslations<"VendorCoordination">>>;

function answerLabel(t: Translate, row: VendorComparisonRow): string {
  if (row.dismissalReason === "other_chosen") return t("compare.otherChosen");
  if (row.availability === "unavailable") return t("compare.unavailable");
  if (row.availability === "available") return t("compare.available");
  return row.remindedAt ? t("compare.reminded") : t("compare.waiting");
}

function amountLabel(t: Translate, row: VendorComparisonRow, locale: Locale): string {
  return row.quoteAmountCents !== null ? formatAmount(row.quoteAmountCents, locale) : t("compare.toBeSpecified");
}

export default async function VendorConsultationPage({ params }: { params: Promise<{ id: string; slotId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("VendorCoordination");
  const tCandidates = await getTranslations("VendorCandidates");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const { id: eventId, slotId } = await params;
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }
  if (!isValidId(eventId) || !isValidId(slotId)) notFound();
  const [event, slots] = await Promise.all([getEvent(organizationId, eventId), listEventVendorSlots(organizationId, eventId)]);
  const slot = slots.find((candidate) => candidate.id === slotId);
  if (!event || !slot) notFound();

  const [comparison, documents, links, decisions, vendorsAvailable, defaultDeadline] = await Promise.all([
    getVendorComparison(organizationId, eventId, slotId),
    listEventDocuments(organizationId, eventId),
    listEventLinks(organizationId, eventId),
    listEventDecisions(organizationId, eventId),
    isVendorsModuleEnabled(organizationId),
    getDefaultVendorBriefDeadline(organizationId, eventId, new Date()),
  ]);
  const brief = comparison.brief;
  // L'adresse de chaque prestataire : celle de son lien, sinon de sa fiche du carnet (si souscrit).
  const vendorIds = comparison.rows.map((row) => row.vendorId).filter((value): value is string => value !== null);
  const contacts = vendorsAvailable && vendorIds.length > 0 ? await getVendorContacts(organizationId, vendorIds) : [];
  const engagedStatuses: readonly string[] = ENGAGED_CANDIDATE_STATUSES;
  const recipientOptions = comparison.rows
    .filter((row) => !engagedStatuses.includes(row.status) && row.dismissalReason !== "other_chosen")
    .map((row) => {
      const link = links.find((candidate) => candidate.vendorCandidateId === row.candidateId && candidate.status === "active");
      const contact = contacts.find((candidate) => candidate.id === row.vendorId);
      return {
        candidateId: row.candidateId,
        vendorName: row.vendorName,
        email: link?.email ?? contact?.email ?? "",
        contactName: link?.personName ?? contact?.contactName ?? "",
        statusLabel: tCandidates(`status.${row.status as "shortlisted"}`),
        alreadySent: brief?.sentAt != null && row.status !== "shortlisted",
      };
    });
  const slotDecisions = decisions.filter((decision) => decision.kind === "option" && decision.slotId === slotId);
  const pending = slotDecisions.find((decision) => decision.status === "pending");
  const engaged = [...slotDecisions].reverse().find((decision) => decision.engagedAt);
  const retained = comparison.rows.filter((row) => engagedStatuses.includes(row.status));

  return (
    <main className="stack">
      <p>
        <Link href={`/events/${eventId}?onglet=budget&poste=${slotId}`}>{t("back")}</Link>
      </p>
      <div className="section-head">
        <h1>{t("pageTitle", { slot: slot.label })}</h1>
        <Link href={`/events/${eventId}/scenarios`} className="button-link">
          {t("scenariosLink")}
        </Link>
      </div>
      <ScreenHelp title={tHelp("vendorCoordination.title")} body={tHelp("vendorCoordination.body")} />
      {event.isDemo ? <p className="notice">{t("demoNotice")}</p> : null}

      {/* Lot 47 (D6, décision de Julien du 18/11/2026) : le prestataire retenu se modifie à tout
          moment ; aucun délai. Le choix du client y est rappelé. */}
      {comparison.rows.length > 0 ? (
        <section className="card stack" aria-labelledby="retained-title">
          <h2 id="retained-title">{t("retained.title")}</h2>
          {engaged && engaged.choiceId ? (
            <p>
              {t("engaged.body", {
                vendor: comparison.rows.find((row) => row.candidateId === engaged.choiceId)?.vendorName ?? "",
                name: engaged.decidedByName ?? t("engaged.someone"),
                date: formatDateTime(new Date(engaged.engagedAt!), locale),
              })}
            </p>
          ) : null}
          <p>{retained.length > 0 ? t("retained.current", { vendors: retained.map((row) => row.vendorName).join(", ") }) : t("retained.none")}</p>
          <form action={changeRetainedAction} className="stack">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="vendorSlotId" value={slotId} />
            <label>
              {t("retained.label")}
              <select name="candidateId" defaultValue={retained[0]?.candidateId ?? ""}>
                <option value="">{t("retained.nobody")}</option>
                {comparison.rows.map((row) => (
                  <option key={row.candidateId} value={row.candidateId}>
                    {row.vendorName} — {amountLabel(t, row, locale)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">{t("retained.submit")}</button>
            <p className="muted">{t("retained.hint")}</p>
          </form>
        </section>
      ) : null}

      <section className="card stack" aria-labelledby="brief-title">
        <h2 id="brief-title">{t("brief.title")}</h2>
        {brief?.sentAt ? <p className="muted">{t("brief.sentAt", { date: formatDateTime(new Date(brief.sentAt), locale) })}</p> : null}
        <p className="muted">
          {t("brief.fromEvent", { date: event.eventDate ? formatCalendarDate(event.eventDate, locale) : t("brief.noDate") })}
        </p>
        <BriefForm
          eventId={eventId}
          slotId={slotId}
          documents={documents.map((document) => ({ id: document.id, label: document.label }))}
          initial={{
            need: brief?.need ?? slot.brief ?? "",
            guestCount: brief?.guestCount != null ? String(brief.guestCount) : "",
            indicativeBudget: brief?.indicativeBudgetCents != null ? formatAmountInput(brief.indicativeBudgetCents, locale) : "",
            showBudget: brief?.showBudget ?? false,
            deadline: brief?.deadline ?? defaultDeadline,
            documentIds: brief?.documentIds ?? [],
          }}
        />
      </section>

      <section className="card stack" aria-labelledby="recipients-title">
        <h2 id="recipients-title">{t("recipients.title")}</h2>
        <p>{t("recipients.intro")}</p>
        <RecipientsForm eventId={eventId} slotId={slotId} options={recipientOptions} canSend={brief !== null && !event.isDemo} />
        <details>
          <summary>{vendorsAvailable ? t("recipients.addFromBookHint") : t("recipients.addTitle")}</summary>
          <AddConsultedForm eventId={eventId} slotId={slotId} />
        </details>
      </section>

      <section className="card stack" aria-labelledby="compare-title">
        <h2 id="compare-title">{t("compare.title")}</h2>
        {comparison.rows.length === 0 ? (
          <p>{t("compare.empty")}</p>
        ) : (
          <>
            <div className="list-table-wrap vendor-compare-table" role="region" aria-label={t("compare.caption", { slot: slot.label })} tabIndex={0}>
              <table className="data-table">
                <caption className="sr-only">{t("compare.caption", { slot: slot.label })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("compare.vendor")}</th>
                    <th scope="col">{t("compare.answer")}</th>
                    <th scope="col" className="num">
                      {t("compare.amount")}
                    </th>
                    <th scope="col">{t("compare.quote")}</th>
                    <th scope="col">{t("compare.message")}</th>
                    <th scope="col">{t("compare.answeredAt")}</th>
                    <th scope="col">{t("compare.notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.candidateId}>
                      <th scope="row">{row.vendorName}</th>
                      <td>{answerLabel(t, row)}</td>
                      <td className="num">{amountLabel(t, row, locale)}</td>
                      <td>{row.hasQuoteFile ? <a href={`/events/${eventId}/consultes/${row.candidateId}/devis`}>{t("compare.openQuote", { vendor: row.vendorName })}</a> : "—"}</td>
                      <td>{row.answerMessage ?? "—"}</td>
                      <td className="nowrap">{row.answeredAt ? formatDateTime(new Date(row.answeredAt), locale) : "—"}</td>
                      <td>
                        {[...row.internalNotes, ...row.feedback.map((entry) => t(entry.opinion === "dislike" ? "compare.feedbackDislike" : entry.opinion === "like" ? "compare.feedbackLike" : "compare.feedbackComment", { name: entry.personName ?? t("engaged.someone"), comment: entry.comment ?? "" }))].join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="plain-list stack vendor-compare-cards" aria-label={t("compare.caption", { slot: slot.label })}>
              {comparison.rows.map((row) => (
                <li key={row.candidateId} className="card stack">
                  <h3>{row.vendorName}</h3>
                  <p>
                    {answerLabel(t, row)} — <strong>{amountLabel(t, row, locale)}</strong>
                  </p>
                  {row.hasQuoteFile ? <a href={`/events/${eventId}/consultes/${row.candidateId}/devis`}>{t("compare.openQuote", { vendor: row.vendorName })}</a> : null}
                  {row.answerMessage ? <p>{row.answerMessage}</p> : null}
                  {row.feedback.map((entry, index) => (
                    <p key={index} className="muted">
                      {t(entry.opinion === "dislike" ? "compare.feedbackDislike" : entry.opinion === "like" ? "compare.feedbackLike" : "compare.feedbackComment", { name: entry.personName ?? t("engaged.someone"), comment: entry.comment ?? "" })}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card stack" aria-labelledby="share-title">
        <h2 id="share-title">{t("share.title")}</h2>
        <p>{t("share.intro")}</p>
        {pending ? (
          <p role="status">{t("share.pending", { date: formatDateTime(new Date(pending.requestedAt), locale) })}</p>
        ) : comparison.rows.filter((row) => row.dismissalReason === null && !engagedStatuses.includes(row.status)).length < 2 ? (
          <p className="muted">{t("share.needTwo")}</p>
        ) : (
          <ShareSelectionForm
            eventId={eventId}
            slotId={slotId}
            options={comparison.rows
              .filter((row) => row.dismissalReason === null && !engagedStatuses.includes(row.status))
              .map((row) => ({ candidateId: row.candidateId, label: `${row.vendorName} — ${amountLabel(t, row, locale)}`, shown: row.shownToClients }))}
          />
        )}
      </section>
    </main>
  );
}
