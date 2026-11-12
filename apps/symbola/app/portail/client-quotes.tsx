import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { ClientQuoteToSign } from "@/modules/quotes/service";

const OWN_STATUS_KEYS = { pending: "quoteToSign", signed: "quoteSignedByYou", declined: "quoteDeclinedByYou" } as const;

// DEV-02 — devis à signer : seulement ceux dont l'e-mail du lien est
// signataire, avec son seul lien de signature (jamais celui d'un autre).
// Lot 26a (SEC-17) : le lien sortant ne transmet pas l'adresse du portail.
export async function ClientQuotes({ quotes, locale }: { quotes: ClientQuoteToSign[]; locale: Locale }) {
  const t = await getTranslations("ClientSpace");
  return (
    <section aria-labelledby="client-quotes-title">
      <h2 id="client-quotes-title">{t("quotesTitle")}</h2>
      <ul>
        {quotes.map((quote) => (
          <li key={quote.quoteId}>
            <strong>{t("quoteNumber", { number: quote.number, version: quote.version })}</strong> —{" "}
            {formatAmount(quote.totalTtcCents, locale)} —{" "}
            {quote.status === "completed"
              ? t("quoteSigned")
              : quote.ownStatus
                ? t(OWN_STATUS_KEYS[quote.ownStatus])
                : t("quoteLinkByEmail")}
            {quote.ownSigningUrl ? (
              <>
                {" "}
                —{" "}
                <a href={quote.ownSigningUrl} rel="noreferrer">
                  {t("signQuote", { number: quote.number })}
                </a>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
