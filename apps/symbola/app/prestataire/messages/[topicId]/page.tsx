// Lot 55 (MSG-03 ; ADR 0102) — le fil d'un sujet, vu par un prestataire ajouté au sujet : messages
// partagés seulement, puis sa réponse.
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
import { linkMessagingOpen } from "@/app/portail/messages/access";
import { LinkReplyForm } from "@/app/portail/messages/link-message-forms";

export default async function VendorMessageTopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const access = await requireLink("vendor");
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
        <Link href="/prestataire/messages">{t("backToTopics")}</Link>
      </p>
      <h1>{thread.name}</h1>
      <ScreenHelp title={tHelp("portalMessages.title")} body={tHelp("portalMessages.body")} />
      <section aria-labelledby="vendor-thread-title" className="stack">
        <h2 id="vendor-thread-title">{t("threadTitle")}</h2>
        <MessageThread messages={thread.messages} labelledBy="vendor-thread-title" attachmentHref={(attachmentId) => `/prestataire/messages/pieces/${attachmentId}`} />
      </section>
      <LinkReplyForm endpoint={`/prestataire/messages/${topicId}/repondre`} organizationName={organizationName} />
    </main>
  );
}
