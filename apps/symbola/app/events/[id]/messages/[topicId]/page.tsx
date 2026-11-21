// Lot 55 (MSG-03 ; D3 ; ADR 0102) — le fil d'un sujet, pour l'équipe : messages partagés et notes
// internes (fond et étiquette « Interne »), puis les deux zones d'écriture, distinctes. La zone
// partagée nomme ses destinataires sur son bouton ; sans destinataire, elle explique comment en avoir.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { MessageThread } from "@/app/ui/message-thread";
import { requirePlanner } from "@/lib/guards";
import { eventNames, getEvent, getMessageThread, listTopicVendorChoices, MessageNotFoundError, messageRecipientsDigest } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";
import { InternalNoteForm, SharedMessageForm, TopicVendorsForm } from "../topic-forms";

export default async function EventMessageTopicPage({ params }: { params: Promise<{ id: string; topicId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id, topicId } = await params;
  if (!isValidId(id) || !isValidId(topicId) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const event = await getEvent(organizationId, id);
  if (!event) notFound();
  let thread;
  try {
    thread = await getMessageThread(organizationId, topicId, id);
  } catch (error) {
    if (error instanceof MessageNotFoundError) notFound();
    throw error;
  }
  const t = await getTranslations("Messages");
  const tHelp = await getTranslations("Help");
  const vendorChoices = await listTopicVendorChoices(organizationId, id);
  // « Léa et Maxime » : les destinataires nommés sur le bouton, dans la langue de l'écran.
  const recipientsLabel = new Intl.ListFormat(await getLocale(), { style: "long", type: "conjunction" }).format(thread.recipients.map((recipient) => recipient.name));
  return (
    <main>
      <Link href={`/events/${id}/messages`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("backToTopics")}
      </Link>
      <PageHeader title={thread.name} subtitle={eventNames(event.clients, event.name)} />
      <ScreenHelp title={tHelp("eventMessages.title")} body={tHelp("eventMessages.body")} />
      <section aria-labelledby="thread-title" className="stack">
        <h2 id="thread-title">{t("threadTitle")}</h2>
        <MessageThread messages={thread.messages} labelledBy="thread-title" attachmentHref={(attachmentId) => `/events/${id}/messages/pieces/${attachmentId}`} />
      </section>
      <section aria-labelledby="compose-title" className="stack">
        <h2 id="compose-title">{t("composeTitle")}</h2>
        {thread.recipients.length > 0 ? (
          <SharedMessageForm endpoint={`/events/${id}/messages/${topicId}/partage`} recipientsLabel={recipientsLabel} recipientsDigest={messageRecipientsDigest(thread.recipients)} />
        ) : (
          <div className="composer composer-shared">
            <h3>{t("sharedZoneTitle")}</h3>
            <p>{t("noRecipients")}</p>
          </div>
        )}
        <InternalNoteForm endpoint={`/events/${id}/messages/${topicId}/interne`} />
      </section>
      {vendorChoices.length > 0 ? (
        <section aria-labelledby="topic-vendors-title" className="stack">
          <h2 id="topic-vendors-title">{t("vendorsSectionTitle")}</h2>
          <TopicVendorsForm eventId={id} topicId={topicId} choices={vendorChoices} selected={thread.vendorLinkIds} />
        </section>
      ) : null}
    </main>
  );
}
