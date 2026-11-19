// Lot 55 (POR-06, POR-10 ; ADR 0101) — la rubrique « Messages » du portail : les sujets partagés de
// l'évènement, un nouveau sujet, et le réglage des notifications de l'appareil (facultatif). Fermée
// par défaut ; sans elle, « indisponible ».
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { requireLink } from "@/lib/guards";
import { listLinkMessageTopics } from "@/modules/events/service";
import { getOrganizationContact, pushPublicKey } from "@/modules/hub/service";
import { LinkPrivacyNotice } from "../link-privacy-notice";
import { linkMessagingOpen } from "./access";
import { LinkNewTopicForm } from "./link-message-forms";
import { PortalPushToggle } from "./push-toggle";

export default async function PortalMessagesPage() {
  const access = await requireLink("client");
  const t = await getTranslations("PortalMessages");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const open = await linkMessagingOpen(access);
  const topics = open ? await listLinkMessageTopics(access.organizationId, access.linkId) : [];
  const organizationName = (await getOrganizationContact(appDatabase(), access.organizationId)).name;
  return (
    <main className="portal stack">
      <p>
        <Link href="/portail">{t("back")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("portalMessages.title")} body={tHelp("portalMessages.body")} />
      {!open ? (
        <p>{t("unavailable")}</p>
      ) : (
        <>
          <section aria-labelledby="portal-topics-title" className="stack">
            <h2 id="portal-topics-title">{t("topicsTitle")}</h2>
            {topics.length === 0 ? <p>{t("none")}</p> : null}
            <ul className="plain-list stack">
              {topics.map((topic) => (
                <li key={topic.id}>
                  <Link href={`/portail/messages/${topic.id}`}>{topic.name}</Link>{" "}
                  <span className="meta">
                    {t("topicMeta", { count: topic.messageCount })}
                    {topic.lastMessageAt ? ` — ${formatDateTime(new Date(topic.lastMessageAt), locale)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <LinkNewTopicForm endpoint="/portail/messages/nouveau" organizationName={organizationName} />
          <PortalPushToggle publicKey={pushPublicKey()} />
        </>
      )}
      <LinkPrivacyNotice organizationId={access.organizationId} />
    </main>
  );
}
