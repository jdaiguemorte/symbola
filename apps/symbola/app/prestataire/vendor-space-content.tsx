import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import type { ReactNode } from "react";
import { getVendorLinkView, LinkAccessDeniedError, listLinkSharedDocuments, markLinkProgramSeen, type LinkAccess } from "@/modules/events/service";
import { getOrganizationContact } from "@/modules/hub/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { closeLinkSessionAction } from "@/app/portail/actions";
import { LinkPrivacyNotice } from "@/app/portail/link-privacy-notice";
import { SharedDocuments } from "@/app/portail/shared-documents";
import { toggleVendorTaskAction } from "./actions";

// Lot 26b (UX-11, POR-01 ; ADR 0053, décision D9) — espace minimal d'un
// prestataire, ouvert par son lien personnel, sans compte : l'événement
// (prénoms des clients, date), les lieux, les lignes du programme où figure son
// poste, le contact de l'organisation. Rien d'autre : ni prix, ni budget, ni
// autre prestataire, ni portail du client (SC-S3). L'espace complet et le brief
// viennent au lot 47.
// Lot 27a (POR-09) : le même rendu sert l'aperçu « vu par » de la planner
// (preview) : fermeture inactive, aucune trace sur le lien.
export async function VendorSpaceContent({ access, preview = false, banner }: { access: LinkAccess; preview?: boolean; banner?: ReactNode }) {
  const { organizationId, linkId } = access;
  const t = await getTranslations("VendorSpace");
  const tLink = await getTranslations("LinkPortal");
  const tHelp = await getTranslations("Help");
  const tEvents = await getTranslations("Events");
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

  let view;
  try {
    view = await getVendorLinkView(organizationId, linkId);
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) redirect("/lien");
    throw error;
  }
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
                      {item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime} — {item.label}
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
                  {line.endTime ? `${line.startTime} – ${line.endTime}` : line.startTime} — {line.label}
                  {line.own ? ` (${t("outlineYours")})` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{t("programNotPublished")}</p>
        )}
      </section>

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
