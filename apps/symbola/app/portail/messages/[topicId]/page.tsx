// Lot 55 (POR-06 ; ADR 0101) — le fil d'un sujet partagé, vu par le client : seulement les messages
// partagés (le service ne lit jamais une note interne pour un lien), puis sa réponse, avec pièces
// jointes. Un sujet qu'il ne voit pas répond comme absent.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { MessageThread } from "@/app/ui/message-thread";
import { requireLink } from "@/lib/guards";
import { isValidId } from "@/app/events/module-access";
import { getLinkMessageThread, LinkAccessDeniedError, MessageNotFoundError } from "@/modules/events/service";
import { getOrganizationContact } from "@/modules/hub/service";
import { LinkPrivacyNotice } from "../../link-privacy-notice";
import { linkMessagingOpen } from "../access";
import { LinkReplyForm } from "../link-message-forms";

export default async function PortalMessageTopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const access = await requireLink("client");
  const { topicId } = await params;
  if (!isValidId(topicId) || !(await linkMessagingOpen(access))) notFound();
  let thread;
  try {
    thread = await getLinkMessageThread(access.organizationId, access.linkId, topicId);
  } catch (error) {
    if (error instanceof MessageNotFoundError || error instanceof LinkAccessDeniedError) notFound();
    throw error;
  }
  const t = await getTranslations("PortalMessages");
  const tHelp = await getTranslations("Help");
  const organizationName = (await getOrganizationContact(appDatabase(), access.organizationId)).name;
  return (
    <main className="portal stack">
      <p>
        <Link href="/portail/messages">{t("backToTopics")}</Link>
      </p>
      <h1>{thread.name}</h1>
      <ScreenHelp title={tHelp("portalMessages.title")} body={tHelp("portalMessages.body")} />
      <section aria-labelledby="portal-thread-title" className="stack">
        <h2 id="portal-thread-title">{t("threadTitle")}</h2>
        <MessageThread messages={thread.messages} labelledBy="portal-thread-title" attachmentHref={(attachmentId) => `/portail/messages/pieces/${attachmentId}`} />
      </section>
      <LinkReplyForm endpoint={`/portail/messages/${topicId}/repondre`} organizationName={organizationName} />
      <LinkPrivacyNotice organizationId={access.organizationId} />
    </main>
  );
}
