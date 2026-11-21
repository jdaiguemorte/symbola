// Lot 58 (PAR-09, étape 2 ; réponse de Julien du 18/11, option a ; ADR 0097) — le remerciement au client,
// avec le lien d'avis réglé par la planner (Google, Mariages.net, son site) : le texte de départ est
// rempli (prénoms, organisation, lien), relu et modifié avant l'envoi. Sans lien réglé, seulement le
// remerciement. Aucune incitation ni condition : le lien mène à une plateforme tierce choisie par elle.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { organizationName } from "@/lib/closing/load";
import { draftReviewRequest, eventNames, getClosingSettings, getEvent, getEventClosing } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";
import { ReviewLinkForm, ReviewSendForm } from "../closing-forms";

export default async function ReviewRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id } = await params;
  if (!isValidId(id) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const event = await getEvent(organizationId, id);
  const closing = event ? await getEventClosing(organizationId, id) : null;
  if (!event || !closing) notFound();
  const t = await getTranslations("Closing");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const settings = await getClosingSettings(organizationId);
  const recipients = event.clients.filter((client) => client.email && client.contactId);
  const draft = draftReviewRequest({ locale: locale === "en" ? "en" : "fr", firstNames: recipients.map((client) => client.firstName), organization: await organizationName(organizationId), reviewUrl: settings.reviewUrl });
  const archived = Boolean(event.archivedAt);
  return (
    <main>
      <Link href={`/events/${id}/cloture`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("checklistTitle")}
      </Link>
      <PageHeader title={t("reviewTitle")} subtitle={eventNames(event.clients, event.name)} />
      <ScreenHelp title={tHelp("eventClosing.title")} body={tHelp("eventClosing.body")} />
      <section className="card stack" aria-labelledby="review-link-title">
        <h2 id="review-link-title">{t("reviewLinkTitle")}</h2>
        <p className="muted">{t("reviewLinkHelp")}</p>
        <ReviewLinkForm eventId={id} reviewUrl={settings.reviewUrl} reviewLabel={settings.reviewLabel} />
      </section>
      <section className="card stack" aria-labelledby="review-message-title">
        <h2 id="review-message-title">{t("reviewOpen")}</h2>
        <p className="muted">{t("reviewHelp")}</p>
        {draft.withReview ? null : <p>{t("reviewNoLink")}</p>}
        {closing.reviewRequestedAt ? <p role="status">{t("reviewSentOn", { date: formatDateTime(new Date(closing.reviewRequestedAt), locale) })}</p> : null}
        <h3>{t("recipients")}</h3>
        {recipients.length === 0 ? (
          <p>{t("noRecipients")}</p>
        ) : (
          <ul className="plain-list">
            {recipients.map((client) => (
              <li key={client.id}>
                {[client.firstName, client.lastName].filter(Boolean).join(" ")} — {client.email}
              </li>
            ))}
          </ul>
        )}
        {recipients.length > 0 && !archived ? <ReviewSendForm eventId={id} subject={draft.subject} body={draft.body} withReview={draft.withReview} /> : null}
      </section>
    </main>
  );
}
