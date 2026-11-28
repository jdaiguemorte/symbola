import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import type { ReactNode } from "react";
import { getVendorBankSummary, listRequestedVendorDocuments } from "@/modules/vendors/service";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { VendorBankLinkForm, VendorDocumentDropForm } from "./vendor-records-forms";
import { getVendorConsultationView, getVendorLinkView, linkVendorRecordId, getVendorRoadmapView, LinkAccessDeniedError, listLinkMessageTopics, listLinkSharedDocuments, markLinkProgramSeen, type LinkAccess, type VendorConsultationView, type VendorRoadmapView } from "@/modules/events/service";
import { formatAmount } from "@symbola/i18n";
import { getOrganizationContact } from "@/modules/hub/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { closeLinkSessionAction } from "@/app/portail/actions";
import { LinkPrivacyNotice } from "@/app/portail/link-privacy-notice";
import { SharedDocuments } from "@/app/portail/shared-documents";
import { confirmRoadmapAction, toggleVendorTaskAction } from "./actions";
import { VendorAnswerForm, VendorInvoiceForm } from "./vendor-answer-form";
import { FloorplanLinkEntry } from "@/app/plans-de-salle/link-entry";

// Lot 26b (UX-11, POR-01 ; ADR 0053, décision D9) — espace minimal d'un
// prestataire, ouvert par son lien personnel, sans compte : l'événement
// (prénoms des clients, date), les lieux, les lignes du programme où figure son
// poste, le contact de l'organisation. Rien d'autre : ni prix, ni budget, ni
// autre prestataire, ni portail du client (SC-S3).
// Lot 47 (PRE-04 ; D3, ADR 0085) : un seul lien du brief au jour J ; ce qu'il montre dépend du
// statut. En consultation : le brief et une action (VendorConsultation) ; écarté : « un autre choix
// a été fait » et rien d'autre ; retenu : cet espace complet, plus la facture et la feuille de route.
// Lot 27a (POR-09) : le même rendu sert l'aperçu « vu par » de la planner
// (preview) : fermeture inactive, aucune trace sur le lien.
export async function VendorSpaceContent({ access, preview = false, banner, preselected = null }: { access: LinkAccess; preview?: boolean; banner?: ReactNode; preselected?: "available" | "unavailable" | null }) {
  const { organizationId, linkId } = access;
  const t = await getTranslations("VendorSpace");
  const tLink = await getTranslations("LinkPortal");
  const tHelp = await getTranslations("Help");
  const tEvents = await getTranslations("Events");
  const tAnswer = await getTranslations("VendorAnswer");
  // Lot 71e (R13) : une fin attendue d'un programme repris.
  const tGaps = await getTranslations("ProgramGaps");
  const locale = (await getLocale()) as Locale;

  // Dégradation propre (CLAUDE.md § 2.2) : module désactivé = « indisponible ».
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main className="portal">
        {banner}
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
        <LinkPrivacyNotice organizationId={organizationId} />
      </main>
    );
  }

  let consultation: VendorConsultationView;
  try {
    consultation = await getVendorConsultationView(organizationId, linkId);
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) redirect("/lien");
    throw error;
  }
  if (consultation.stage === "consultation" || consultation.stage === "declined") {
    return (
      <main className="portal">
        {banner}
        <VendorConsultation access={access} view={consultation} preview={preview} preselected={preselected} />
        <LinkPrivacyNotice organizationId={organizationId} />
      </main>
    );
  }

  let view;
  try {
    view = await getVendorLinkView(organizationId, linkId);
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) redirect("/lien");
    throw error;
  }
  const roadmap: VendorRoadmapView | null = consultation.stage === "retained" ? await getVendorRoadmapView(organizationId, linkId) : null;
  // Lot 48a (PRE-05, PRE-10) : la fiche du carnet derrière le lien (aucune en saisie libre).
  const recordVendorId = consultation.stage === "retained" && (await isVendorsModuleEnabled(organizationId)) ? await linkVendorRecordId(organizationId, linkId) : null;
  const records = recordVendorId
    ? { documents: await listRequestedVendorDocuments(organizationId, recordVendorId), ibanMasked: (await getVendorBankSummary(organizationId, recordVendorId)).ibanMasked }
    : null;
  const contact = await getOrganizationContact(appDatabase(), organizationId);
  // Lot 37a (POR-10, D6) : les documents partagés avec les prestataires de l'évènement (rien par défaut).
  const sharedDocuments = await listLinkSharedDocuments(organizationId, linkId);
  // Lot 37b (D11) : la version affichée est désormais vue ; jamais depuis l'aperçu « vu par ».
  const program = view.program;
  if (!preview && program.version) await markLinkProgramSeen(organizationId, linkId, program.version.number);

  return (
    <main className="portal">
      {banner}
      <p className="muted">{tLink("greeting", { name: access.personName })}</p>
      <h1>{view.clientFirstNames.length > 0 ? view.clientFirstNames.join(" & ") : t("title")}</h1>
      <p>{t("yourRole", { vendor: view.vendorName, slot: view.slotLabel })}</p>
      <ScreenHelp title={tHelp("vendorSpace.title")} body={tHelp("vendorSpace.body")} />
      <p>
        {t("eventDate")} : {view.eventDate ? formatCalendarDate(view.eventDate, locale) : t("dateUnset")}
      </p>
      {/* Lot 55 (MSG-03) : les sujets où la planner l'a ajouté, s'il y en a. */}
      {!preview && (await listLinkMessageTopics(organizationId, linkId).catch(() => [])).length > 0 ? (
        <p>
          <a href="/prestataire/messages">{tLink("messagesLink")}</a>
        </p>
      ) : null}

      {roadmap ? <VendorRoadmap roadmap={roadmap} preview={preview} /> : null}
      {/* Lot 60 (L60-PLA-05) : le plan de salle diffusé, son emplacement en évidence. */}
      {consultation.stage === "retained" ? <FloorplanLinkEntry access={access} audience="vendor" preview={preview} /> : null}

      <h2>{t("placesTitle")}</h2>
      {view.places.length === 0 ? (
        <p>{t("noPlaces")}</p>
      ) : (
        <ul aria-label={t("placesTitle")}>
          {view.places.map((place) => (
            <li key={place.id}>
              <strong>{place.label}</strong>
              {place.address || place.city ? ` — ${[place.address, place.city].filter(Boolean).join(", ")}` : ""}
              {place.startTime ? ` — ${place.endTime ? `${place.startTime} – ${place.endTime}` : place.startTime}` : ""}
            </li>
          ))}
        </ul>
      )}

      {/* Lot 34b (CHR-02, D12) : les tâches qui lui sont confiées, qu'il coche. */}
      <section aria-labelledby="vendor-tasks-title">
        <h2 id="vendor-tasks-title">{t("tasksTitle")}</h2>
        {view.tasks.length === 0 ? (
          <p>{t("noTasks")}</p>
        ) : (
          <ul aria-label={t("tasksTitle")}>
            {view.tasks.map((task) => (
              <li key={task.id}>
                <strong className={task.done ? "line-through" : undefined}>{task.label}</strong>
                {" — "}
                {formatCalendarDate(task.dueDate, locale)}
                {task.done ? ` — ${tEvents("taskDone")}` : ""}
                <form action={preview ? undefined : toggleVendorTaskAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="done" value={task.done ? "false" : "true"} />
                  <button type="submit" disabled={preview}>
                    {task.done ? tEvents("markTaskUndone", { label: task.label }) : tEvents("markTaskDone", { label: task.label })}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Lot 37b (CHR-07 ; D9, D11) : la dernière version diffusée, ses séquences en entier et le
          déroulé du jour en titres et horaires ; une nouvelle version est signalée une fois. */}
      <section aria-labelledby="vendor-program-title">
        <h2 id="vendor-program-title">{t("programTitle")}</h2>
        {program.version ? (
          <>
            {/* Lot 51 (JRJ-05 ; D3) : un décalage du jour J validé par la planner, en tête. */}
            {program.dayShift ? (
              <p role="status" className="badge-warning">
                {t("programDayShift", { minutes: program.dayShift.minutes })}
              </p>
            ) : null}
            {program.isNew ? (
              <p role="status" className="badge-warning">
                {t("programNew", { number: program.version.number, date: formatDateTime(new Date(program.version.publishedAt), locale) })}
              </p>
            ) : null}
            <p className="muted">{t("programVersion", { number: program.version.number, date: formatDateTime(new Date(program.version.publishedAt), locale) })}</p>
            <p>{preview ? <span>{t("programPdf")}</span> : <a href="/prestataire/programme/pdf" download>{t("programPdf")}</a>}</p>
            {program.ownItems.length === 0 ? (
              <p>{t("noProgramItems")}</p>
            ) : (
              <ul aria-label={t("programTitle")}>
                {program.ownItems.map((item) => (
                  <li key={item.id}>
                    <strong>
                      {item.endTime ? `${item.startTime} – ${item.endTime}` : item.endPending ? `${item.startTime} · ${tGaps("endPending")}` : item.startTime} — {item.label}
                    </strong>
                    {item.location ? ` — ${item.location}` : ""}
                    {item.responsible ? ` — ${tEvents("programResponsibleLine", { name: item.responsible })}` : ""}
                  </li>
                ))}
              </ul>
            )}
            <h3 id="vendor-outline-title">{t("outlineTitle")}</h3>
            <ul aria-labelledby="vendor-outline-title">
              {program.outline.map((line) => (
                <li key={line.id}>
                  {line.endTime ? `${line.startTime} – ${line.endTime}` : line.endPending ? `${line.startTime} · ${tGaps("endPending")}` : line.startTime} — {line.label}
                  {line.own ? ` (${t("outlineYours")})` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{t("programNotPublished")}</p>
        )}
      </section>

      {/* Lot 47 (PRE-04) : une fois retenu, le dépôt de la facture. */}
      {roadmap ? (
        <section aria-labelledby="vendor-invoice-title">
          <h2 id="vendor-invoice-title">{tAnswer("invoiceTitle")}</h2>
          {roadmap.invoice ? <p>{tAnswer("invoiceReceived", { date: formatDateTime(new Date(roadmap.invoice.uploadedAt), locale) })}</p> : <p>{tAnswer("invoiceIntro")}</p>}
          <VendorInvoiceForm preview={preview} />
        </section>
      ) : null}

      {/* Lot 48a (PRE-05, PRE-10 ; D3, D5) : pièces demandées par la planner, et IBAN du prestataire. */}
      {records ? (
        <section aria-labelledby="vendor-records-title">
          <h2 id="vendor-records-title">{t("documentsTitle")}</h2>
          {records.documents.length === 0 ? <p>{t("documentsNone")}</p> : null}
          <ul aria-labelledby="vendor-records-title">
            {records.documents.map((document) => (
              <li key={document.id}>
                <strong>{document.kindLabel}</strong>
                {document.status === "requested" ? (
                  <VendorDocumentDropForm documentId={document.id} label={document.kindLabel} preview={preview} />
                ) : (
                  <span> — {t("documentsReceived")}</span>
                )}
              </li>
            ))}
          </ul>
          <h3>{t("bankTitle")}</h3>
          <p>{records.ibanMasked ? t("bankCurrent", { iban: records.ibanMasked }) : t("bankNone")}</p>
          <p className="muted">{t("bankHint")}</p>
          <VendorBankLinkForm preview={preview} />
        </section>
      ) : null}

      {sharedDocuments.length > 0 ? <SharedDocuments documents={sharedDocuments} basePath="/prestataire/documents" locale={locale} preview={preview} headingId="vendor-documents-title" /> : null}

      <section aria-labelledby="vendor-contact-title">
        <h2 id="vendor-contact-title">{t("contactTitle")}</h2>
        <p>{contact.name}</p>
        {contact.email ? (
          <p>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </p>
        ) : null}
        {contact.phone ? (
          <p>
            <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a>
          </p>
        ) : null}
      </section>

      <p className="muted">{tLink("validUntil", { date: formatCalendarDate(access.expiresOn, locale) })}</p>
      <form action={preview ? undefined : closeLinkSessionAction}>
        <button type="submit" disabled={preview}>
          {tLink("closeSession")}
        </button>
      </form>
      <LinkPrivacyNotice organizationId={organizationId} />
    </main>
  );
}

// Lot 47 (PRE-03, PRE-04 ; D3, D4, D10) — la page de consultation : le brief de son poste (besoin,
// date, lieux, nombre d'invités, budget s'il est montré, inspirations) et une seule action. Écarté :
// « un autre choix a été fait », ou sa propre réponse « indisponible », et rien d'autre.
async function VendorConsultation({ access, view, preview, preselected }: { access: LinkAccess; view: VendorConsultationView; preview: boolean; preselected: "available" | "unavailable" | null }) {
  const t = await getTranslations("VendorAnswer");
  const tLink = await getTranslations("LinkPortal");
  const locale = (await getLocale()) as Locale;
  const brief = view.brief;
  if (view.stage === "declined" && !view.canAnswer) {
    return (
      <>
        <p className="muted">{tLink("greeting", { name: access.personName })}</p>
        <h1>{t("declinedTitle")}</h1>
        <p role="status">{view.answer.availability === "unavailable" ? t("thanksUnavailable") : t("declinedBody")}</p>
      </>
    );
  }
  return (
    <>
      <p className="muted">{tLink("greeting", { name: access.personName })}</p>
      <h1>{t("title", { slot: view.slotLabel })}</h1>
      <ScreenHelp title={t("helpTitle")} body={t("helpBody")} />
      <section aria-labelledby="brief-title" className="stack">
        <h2 id="brief-title" className="sr-only">
          {t("briefTitle")}
        </h2>
        <p>
          {view.clientFirstNames.length > 0 ? t("eventOf", { clients: view.clientFirstNames.join(" & ") }) : t("eventUnnamed")}
          {" — "}
          {view.eventDate ? formatCalendarDate(view.eventDate, locale) : t("dateUnset")}
        </p>
        {view.places.length > 0 ? <p>{view.places.map((place) => (place.city ? `${place.label}, ${place.city}` : place.label)).join(" · ")}</p> : null}
        {brief ? (
          <>
            <p className="text-reading">{brief.need}</p>
            {brief.guestCount !== null ? <p>{t("guests", { count: brief.guestCount })}</p> : null}
            {brief.budgetCents !== null ? <p>{t("budget", { amount: formatAmount(brief.budgetCents, locale) })}</p> : null}
            <p>
              <strong>{t("deadline", { date: formatCalendarDate(brief.deadline, locale) })}</strong>
            </p>
            {brief.documents.length > 0 ? (
              <ul aria-label={t("inspirations")}>
                {brief.documents.map((document) => (
                  <li key={document.id}>{preview ? document.label : <a href={`/prestataire/inspirations/${document.id}?apercu=1`}>{document.label}</a>}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>
      <VendorAnswerForm answer={{ availability: view.answer.availability, hasQuote: view.answer.hasQuoteFile }} canAnswer={view.canAnswer} preselected={preselected} preview={preview} />
    </>
  );
}

// Lot 47 (PAR-05 étapes 5 et 6 ; D8) — la feuille de route : le contact sur place et « J'ai bien
// reçu » (un seul bouton), horodaté ; les horaires, lieux et tâches suivent dans l'espace.
async function VendorRoadmap({ roadmap, preview }: { roadmap: VendorRoadmapView; preview: boolean }) {
  const t = await getTranslations("VendorAnswer");
  const locale = (await getLocale()) as Locale;
  if (roadmap.sent.length === 0 && roadmap.dayContacts.length === 0) return null;
  const last = roadmap.sent.at(-1);
  return (
    <section aria-labelledby="vendor-roadmap-title" className="card stack">
      <h2 id="vendor-roadmap-title">{t("roadmapTitle")}</h2>
      {roadmap.dayContacts.length > 0 ? (
        <ul aria-label={t("onSiteContacts")}>
          {roadmap.dayContacts.map((contact, index) => (
            <li key={index}>
              <strong>{contact.name}</strong>
              {contact.role ? ` — ${contact.role}` : ""} — <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a>
            </li>
          ))}
        </ul>
      ) : null}
      {roadmap.awaitingConfirmation ? (
        <form action={preview ? undefined : confirmRoadmapAction}>
          <button type="submit" className="primary" disabled={preview}>
            {t("confirmRoadmap")}
          </button>
        </form>
      ) : last?.confirmedAt ? (
        <p role="status">{t("roadmapConfirmed", { date: formatDateTime(new Date(last.confirmedAt), locale) })}</p>
      ) : null}
    </section>
  );
}
