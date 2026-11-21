// Lot 55 (MSG-03 ; D3 ; ADR 0102) — les sujets de discussion d'un évènement (« Traiteur »,
// « Cérémonie »), chacun avec son fil ; un nouveau sujet. Le journal des envois de l'évènement est à
// un clic.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { eventNames, getEvent, listMessageTopics } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";
import { NewTopicForm } from "./topic-forms";

export default async function EventMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id } = await params;
  if (!isValidId(id) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const event = await getEvent(organizationId, id);
  if (!event) notFound();
  const t = await getTranslations("Messages");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const topics = await listMessageTopics(organizationId, id);
  return (
    <main>
      <Link href={`/events/${id}`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("backToEvent")}
      </Link>
      <PageHeader title={t("title")} subtitle={eventNames(event.clients, event.name)} actions={<Link href={`/parametres/envois?evenement=${id}`}>{t("journalLink")}</Link>} />
      <ScreenHelp title={tHelp("eventMessages.title")} body={tHelp("eventMessages.body")} />
      <section aria-labelledby="topics-title" className="stack">
        <h2 id="topics-title">{t("topicsTitle")}</h2>
        {topics.length === 0 ? <p>{t("noTopics")}</p> : null}
        <ul className="plain-list stack">
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link href={`/events/${id}/messages/${topic.id}`}>{topic.name}</Link>{" "}
              <span className="meta">
                {t("topicMeta", { count: topic.messageCount })}
                {topic.lastMessageAt ? ` — ${t("topicLast", { date: formatDateTime(new Date(topic.lastMessageAt), locale) })}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <NewTopicForm eventId={id} />
    </main>
  );
}
