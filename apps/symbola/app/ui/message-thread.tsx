// Lot 55 (MSG-03, POR-06 ; D3 ; ADR 0102) — un fil de messages, pour l'équipe et pour un lien. Un
// message interne (que seule l'équipe reçoit) a son fond et son étiquette « Interne » : la
// distinction ne repose pas sur la couleur seule. Les pièces jointes s'ouvrent par une route de l'app
// qui contrôle les droits (ADR 0027).
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import type { MessageView } from "@symbola/contracts";

export async function MessageThread({ messages, attachmentHref, labelledBy }: { messages: MessageView[]; attachmentHref: (attachmentId: string) => string; labelledBy: string }) {
  const t = await getTranslations("MessageThread");
  const locale = (await getLocale()) as Locale;
  if (messages.length === 0) return <p>{t("empty")}</p>;
  return (
    <ol className="message-thread" aria-labelledby={labelledBy}>
      {messages.map((message) => (
        <li key={message.id} className={message.visibility === "internal" ? "message-item message-item-internal" : "message-item"}>
          <p className="message-meta">
            {message.visibility === "internal" ? <span className="message-badge-internal">{t("internalBadge")}</span> : null}
            <strong>{message.authorName}</strong>
            <span>{formatDateTime(new Date(message.createdAt), locale)}</span>
          </p>
          <p className="message-body">{message.body}</p>
          {message.attachments.length > 0 ? (
            <ul className="message-attachments" aria-label={t("attachments")}>
              {message.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <a href={attachmentHref(attachment.id)}>{attachment.label}</a> <span className="meta">({formatFileSize(attachment.sizeBytes, locale)})</span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
