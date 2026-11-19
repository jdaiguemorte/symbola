// Lot 45 (CRM-05, CRM-06, CRM-03, POR-07 ; D1 à D3 ; ADR 0090) — les échanges avec le contact sur la
// fiche de l'évènement : « Répondre » (un modèle, relu avant l'envoi), « Questionnaires », les gestes
// « a répondu » et « ne plus relancer » (Symbola ne lit aucune boîte e-mail), les relances prêtes à
// relire, et l'historique des messages (envoyés, préparés, notés).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listEventFollowUps, listEventMessages } from "@/modules/events/service";
import { ProspectGestures } from "./prospect-gestures";

function when(iso: string, locale: "fr" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { timeZone: "Europe/Paris", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export async function ProspectExchanges({ organizationId, eventId, isOption, locale }: { organizationId: string; eventId: string; isOption: boolean; locale: "fr" | "en" }) {
  const t = await getTranslations("ProspectExchanges");
  const [messages, followUps] = await Promise.all([listEventMessages(organizationId, eventId), listEventFollowUps(organizationId, eventId)]);
  const now = Date.now();
  const ready = followUps.filter((followUp) => !followUp.sentAt && !followUp.stoppedAt && new Date(followUp.readyAt).getTime() <= now);
  const upcoming = followUps.filter((followUp) => !followUp.sentAt && !followUp.stoppedAt && new Date(followUp.readyAt).getTime() > now);
  return (
    <section className="card stack" aria-labelledby="prospect-exchanges-title">
      <h2 id="prospect-exchanges-title">{t("title")}</h2>
      <div className="row-wrap">
        <Link href={`/events/${eventId}/ecrire`} className="button-link button-link-primary">
          {t("reply")}
        </Link>
        <Link href={`/events/${eventId}/questionnaires`} className="button-link">
          {t("questionnaires")}
        </Link>
      </div>
      {isOption ? <ProspectGestures eventId={eventId} /> : null}
      {ready.length > 0 ? (
        <ul className="plain-list">
          {ready.map((followUp) => (
            <li key={followUp.id}>
              <Link href={`/events/${eventId}/relances/${followUp.id}`}>{t("readyFollowUp", { rank: followUp.rank })}</Link>
            </li>
          ))}
        </ul>
      ) : null}
      {upcoming.map((followUp) => (
        <p key={followUp.id} className="meta">
          {t("upcomingFollowUp", { rank: followUp.rank, date: when(followUp.readyAt, locale) })}
        </p>
      ))}
      <h3>{t("historyTitle")}</h3>
      {messages.length === 0 ? (
        <p className="meta">{t("noHistory")}</p>
      ) : (
        <ul className="plain-list exchange-history">
          {messages.map((message) => (
            <li key={message.id}>
              <span className="meta">{when(message.occurredAt, locale)}</span> — {t(`kind.${message.kind}`)}
              {message.delivery === "prepared" ? ` (${t("prepared")})` : ""}
              {message.subject ? ` : ${message.subject}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
