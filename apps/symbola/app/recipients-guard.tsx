"use client";

// Lot 38a (MSG-02 ; D8 ; ADR 0072) — l'écran commun du garde-fou d'envoi groupé : avant tout envoi
// décidé par l'équipe vers plus d'une personne, le nombre et la liste (nom et adresse), puis
// « Envoyer à N personnes ». L'empreinte de la liste part avec le formulaire : le serveur refuse
// l'envoi si la liste qu'il calcule n'est plus celle-ci et rouvre l'écran avec la nouvelle.
import { useTranslations } from "next-intl";
import type { RecipientsReview } from "@symbola/contracts";

export function RecipientsGuard({ review, pending }: { review: RecipientsReview; pending: boolean }) {
  const t = useTranslations("RecipientsGuard");
  return (
    <section className="notice stack" aria-labelledby="recipients-guard-title">
      <h3 id="recipients-guard-title">{t("title", { count: review.count })}</h3>
      <p>{t("intro")}</p>
      <ul className="plain-list">
        {review.recipients.map((recipient) => (
          <li key={`${recipient.email}-${recipient.name}`}>
            {recipient.name} — {recipient.email}
          </li>
        ))}
      </ul>
      <input type="hidden" name="confirmedRecipients" value={review.digest} />
      <button type="submit" disabled={pending}>
        {t("confirm", { count: review.count })}
      </button>
    </section>
  );
}
