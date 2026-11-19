// Lot 55 (MSG-03 ; ADR 0102) — les sujets où la planner a ajouté ce prestataire (messages partagés
// seulement). Un prestataire n'ouvre pas de sujet : il répond dans les siens.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { requireLink } from "@/lib/guards";
import { listLinkMessageTopics } from "@/modules/events/service";
import { linkMessagingOpen } from "@/app/portail/messages/access";

export default async function VendorMessagesPage() {
  const access = await requireLink("vendor");
  const t = await getTranslations("PortalMessages");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const open = await linkMessagingOpen(access);
  const topics = open ? await listLinkMessageTopics(access.organizationId, access.linkId) : [];
  return (
    <main className="portal stack">
      <p>
        <Link href="/prestataire">{t("backVendor")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("portalMessages.title")} body={tHelp("portalMessages.body")} />
      {!open ? <p>{t("unavailable")}</p> : topics.length === 0 ? <p>{t("noneVendor")}</p> : null}
      <ul className="plain-list stack">
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link href={`/prestataire/messages/${topic.id}`}>{topic.name}</Link>{" "}
            <span className="meta">
              {t("topicMeta", { count: topic.messageCount })}
              {topic.lastMessageAt ? ` — ${formatDateTime(new Date(topic.lastMessageAt), locale)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
