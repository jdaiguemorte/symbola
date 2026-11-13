import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { ClientQuoteToSign } from "@/modules/quotes/service";

const OWN_STATUS_KEYS = { pending: "quoteToSign", signed: "quoteSignedByYou", declined: "quoteDeclinedByYou" } as const;

// DEV-02 — devis à signer : seulement ceux dont l'e-mail du lien est
// signataire, avec son seul lien de signature (jamais celui d'un autre).
// Lot 26a (SEC-17) : le lien sortant ne transmet pas l'adresse du portail.
// Lot 27a (POR-09) : dans l'aperçu de la planner, le lien de signature est inactif.
export async function ClientQuotes({ quotes, locale, preview = false }: { quotes: ClientQuoteToSign[]; locale: Locale; preview?: boolean }) {
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
                {preview ? (
                  <span>{t("signQuote", { number: quote.number })}</span>
                ) : (
                  <a href={quote.ownSigningUrl} rel="noreferrer">
                    {t("signQuote", { number: quote.number })}
                  </a>
                )}
              </>
            ) : null}
            {/* Lot 31a (JUR-08, D5) : acompte ou arrhes, rappelé avant de signer. */}
            {quote.advanceKind ? (
              <>
                <br />
                {t(quote.advanceKind === "earnest" ? "advanceEarnest" : "advanceDeposit")}
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
