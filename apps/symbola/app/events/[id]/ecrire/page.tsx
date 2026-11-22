// Lot 38b (HUB-21, MSG-02 ; D8, D10 ; ADR 0072) — « Écrire au client » : le modèle du type de
// l'évènement d'abord, ses variables remplies avec la fiche, les destinataires et les valeurs
// manquantes (aucune variable vide).
// Lot 45 (CRM-05 ; D1 ; ADR 0090) — « Répondre » en un clic : le texte se relit et se modifie, puis part
// de Symbola (rangé dans l'historique du contact, point de départ des relances) ou s'ouvre dans la
// messagerie de la planner (noté « préparé »). Sans modèle de message, le texte de départ de la
// réponse (nature « prospect_reply ») est proposé. La brochure se joint par un lien sécurisé ; le
// modèle « rendez-vous » insère la page de réservation si le module Rendez-vous est ouvert, sinon des
// créneaux à compléter (ARC-07).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { bookingPageUrl } from "@/lib/prospect-follow-ups";
import { eventNames, getEvent, getProspectFollowUpSettings, prospectMessageContext, renderProspectText } from "@/modules/events/service";
import { getEmailTemplate, getMessageTemplate, messageTemplatesForEventType, preparesRelationEmail, variableToken } from "@/modules/hub/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";
import { WriteForm } from "./write-form";

type Query = { modele?: string; a?: string | string[] };

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
  const screenLocale = (await getLocale()) === "en" ? "en" : "fr";
  const query = await searchParams;

  const withEmail = event.clients.filter((client) => client.email && client.contactId);
  const asked = new Set([query.a ?? []].flat());
  const recipients = asked.size > 0 ? withEmail.filter((client) => asked.has(client.id)) : withEmail;
  const templates = await messageTemplatesForEventType(organizationId, event.eventTypeId);
  const templateId = templates.some((template) => template.id === query.modele) ? query.modele! : (templates[0]?.id ?? null);
  const template = templateId ? await getMessageTemplate(organizationId, templateId) : null;
  const locale = template?.locale ?? screenLocale;
  // Sans modèle de message : le texte de départ de la réponse à un prospect.
  const text = template ? { subject: template.subject, body: template.body } : await getEmailTemplate(organizationId, "prospect_reply", locale);
  const context = await prospectMessageContext({ organizationId, eventId: event.id, locale, contactIds: recipients.map((client) => client.contactId!), bookingUrl: await bookingPageUrl(organizationId) });
  const rendered = renderProspectText(text, context?.values ?? {});
  const missing = rendered.missing.map((key) => variableToken(key, locale));
  const usesBrochure = /\{\{\s*brochure\s*\}\}/.test(`${rendered.subject} ${rendered.body}`);
  const brochure = usesBrochure ? (await getProspectFollowUpSettings(organizationId)).brochure : null;

  return (
    <main>
      <Link href={`/events/${event.id}`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={t("title")} subtitle={eventNames(event.clients, event.name)} />
      <ScreenHelp title={tHelp("messageTemplates.title")} body={tHelp("messageTemplates.body")} />

      <form method="get" className="stack" aria-label={t("choiceLabel")}>
        {templates.length > 0 ? (
          <>
            <label htmlFor="write-template">{t("template")}</label>
            <select id="write-template" name="modele" defaultValue={templateId ?? undefined}>
              {templates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p>
            {t("noTemplate")} <Link href="/parametres/messages">{t("createTemplates")}</Link>
          </p>
        )}
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

      {missing.length > 0 ? (
        <p role="alert">{t("missing", { tokens: missing.join(", ") })}</p>
      ) : recipients.length === 0 ? (
        <p role="alert">{t("noRecipient")}</p>
      ) : (
        <>
          {recipients.length > 1 ? (
            <section className="notice stack" aria-labelledby="write-guard-title">
              <h2 id="write-guard-title">{t("guardTitle", { count: recipients.length })}</h2>
              <ul className="plain-list">
                {recipients.map((client) => (
                  <li key={client.id}>
                    {fullName(client)} — {client.email}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {usesBrochure ? <p className="meta">{brochure ? t("brochureHint", { name: brochure.fileName }) : t("noBrochure")}</p> : null}
          <WriteForm
            key={`${templateId ?? "depart"}-${recipients.map((client) => client.id).join("-")}`}
            eventId={event.id}
            templateId={templateId}
            contactIds={recipients.map((client) => client.contactId!)}
            subject={rendered.subject}
            body={rendered.body}
            locale={locale}
            recipientCount={recipients.length}
            plannerSends={await preparesRelationEmail(organizationId, "prospect_reply")}
          />
        </>
      )}
    </main>
  );
}
