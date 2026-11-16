// Lot 38b (HUB-21, MSG-02 ; D8, D10 ; ADR 0072) — « Écrire au client » : le modèle du type de
// l'évènement d'abord, ses variables remplies avec la fiche, l'aperçu, les destinataires et les
// valeurs manquantes (aucune variable vide : le message ne s'ouvre pas tant qu'il en manque). Puis
// la messagerie de la planner s'ouvre avec le texte (mailto), ou le texte se copie : Symbola
// n'envoie rien. À plusieurs destinataires, le nombre et la liste sont montrés avant le bouton.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { requestAudience } from "@/lib/vocabulary";
import { eventNames, getEvent, getEventAudience } from "@/modules/events/service";
import { getDocumentHeader, messageTemplatesForEventType, renderMessageForTemplate, variableToken } from "@/modules/hub/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";
import { CopyMessageButton } from "./copy-message-button";

type Query = { modele?: string; a?: string | string[] };

function mailtoHref(emails: string[], subject: string, body: string): string {
  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;
  return `mailto:${emails.map(encodeURIComponent).join(",")}?${query}`;
}

function fullName(client: { firstName: string; lastName: string | null }): string {
  return [client.firstName, client.lastName].filter(Boolean).join(" ");
}

export default async function WriteToClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id } = await params;
  if (!isValidId(id) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const event = await getEvent(organizationId, id);
  if (!event) notFound();
  const t = await getTranslations("WriteToClient");
  const tHelp = await getTranslations("Help");
  const query = await searchParams;

  const withEmail = event.clients.filter((client) => client.email);
  const asked = new Set([query.a ?? []].flat());
  const recipients = asked.size > 0 ? withEmail.filter((client) => asked.has(client.id)) : withEmail;
  const templates = await messageTemplatesForEventType(organizationId, event.eventTypeId);
  const templateId = templates.some((template) => template.id === query.modele) ? query.modele! : templates[0]?.id;

  let rendered: Awaited<ReturnType<typeof renderMessageForTemplate>> = null;
  if (templateId) {
    const template = templates.find((candidate) => candidate.id === templateId)!;
    const tEmails = await getTranslations({ locale: template.locale, namespace: "Emails" });
    const couple = ((await getEventAudience(organizationId, id)) ?? (await requestAudience(organizationId))) === "couple";
    rendered = await renderMessageForTemplate(organizationId, templateId, {
      first_name: eventNames(recipients),
      clients: eventNames(event.clients.filter((client) => client.firstName.trim())),
      event: tEmails(couple ? "event.coupleClient" : "event.clientsClient"),
      event_date: event.eventDate ? formatCalendarDate(event.eventDate, template.locale) : "",
      place: event.venueName ?? "",
      organization: (await getDocumentHeader(appDatabase(), organizationId))?.organizationName ?? "",
    });
  }
  const missing = rendered ? rendered.missing.map((key) => variableToken(key, rendered!.template.locale)) : [];
  const emails = recipients.map((client) => client.email!);

  return (
    <main>
      <Link href={`/events/${event.id}`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={t("title")} subtitle={eventNames(event.clients)} />
      <ScreenHelp title={tHelp("messageTemplates.title")} body={tHelp("messageTemplates.body")} />

      {templates.length === 0 ? (
        <section className="stack" aria-label={t("title")}>
          <p>{t("noTemplate")}</p>
          <p>
            <Link href="/parametres/messages">{t("createTemplates")}</Link>
          </p>
          {withEmail.length > 0 ? (
            <p>
              <a href={`mailto:${withEmail.map((client) => encodeURIComponent(client.email!)).join(",")}`} className="button-link">
                {t("withoutTemplate")}
              </a>
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <form method="get" className="stack" aria-label={t("title")}>
            <label htmlFor="write-template">{t("template")}</label>
            <select id="write-template" name="modele" defaultValue={templateId}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <fieldset>
              <legend>{t("recipients")}</legend>
              {event.clients.map((client) => (
                <label key={client.id} className="checkbox">
                  <input type="checkbox" name="a" value={client.id} defaultChecked={recipients.some((recipient) => recipient.id === client.id)} disabled={!client.email} />
                  {client.email ? `${fullName(client)} — ${client.email}` : t("noEmail", { name: fullName(client) })}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="button-ghost">
              {t("update")}
            </button>
          </form>

          {rendered ? (
            <section aria-labelledby="write-preview-title" className="stack">
              <h2 id="write-preview-title">{t("previewTitle")}</h2>
              <div className="mail-preview" role="region" aria-label={t("previewLabel")} tabIndex={0}>
                <p className="mail-preview-subject">{t("subject", { subject: rendered.subject })}</p>
                <p className="message-text">{rendered.body}</p>
              </div>
              {missing.length > 0 ? (
                <p role="alert">{t("missing", { tokens: missing.join(", ") })}</p>
              ) : emails.length === 0 ? (
                <p role="alert">{t("noRecipient")}</p>
              ) : (
                <>
                  {emails.length > 1 ? (
                    <section className="notice stack" aria-labelledby="write-guard-title">
                      <h3 id="write-guard-title">{t("guardTitle", { count: emails.length })}</h3>
                      <ul className="plain-list">
                        {recipients.map((client) => (
                          <li key={client.id}>
                            {fullName(client)} — {client.email}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  <p className="meta">{t("openHint")}</p>
                  <div className="row-wrap">
                    <a href={mailtoHref(emails, rendered.subject, rendered.body)} className="button-link button-link-primary">
                      {t("open", { count: emails.length })}
                    </a>
                    <CopyMessageButton text={`${rendered.subject}\n\n${rendered.body}`} />
                  </div>
                </>
              )}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
