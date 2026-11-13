import { getTranslations } from "next-intl/server";
import { formatAmount, formatDateTime, type Locale } from "@symbola/i18n";
import { starterContractRules } from "@symbola/starter-templates";
import type { ClientQuoteToSign } from "@/modules/quotes/service";
import { EarlyExecutionForm, OrderContractForm } from "./client-contract-forms";

const OWN_STATUS_KEYS = { pending: "quoteToSign", signed: "quoteSignedByYou", declined: "quoteDeclinedByYou" } as const;

// DEV-02 — devis à signer : seulement ceux dont l'e-mail du lien est
// signataire, avec son seul lien de signature (jamais celui d'un autre).
// Lot 26a (SEC-17) : le lien sortant ne transmet pas l'adresse du portail.
// Lot 27a (POR-09) : dans l'aperçu de la planner, le lien de signature est inactif.
// Lot 31b (JUR-07, DOC-03 ; D9, D13) : le contrat signé avec le devis (ou seul) se lit ici ; à
// distance, le client commande avant de voir son lien ; il peut demander l'exécution anticipée.
export async function ClientQuotes({ quotes, locale, preview = false }: { quotes: ClientQuoteToSign[]; locale: Locale; preview?: boolean }) {
  const t = await getTranslations("ClientSpace");
  const days = starterContractRules().withdrawal.periodDays;
  return (
    <section aria-labelledby="client-quotes-title">
      <h2 id="client-quotes-title">{t("quotesTitle")}</h2>
      <ul>
        {quotes.map((quote) => (
          <li key={`${quote.quoteId}-${quote.kind}`}>
            <strong>{quote.kind === "contract" ? t("contractOfQuote", { number: quote.number }) : t("quoteNumber", { number: quote.number, version: quote.version })}</strong> —{" "}
            {quote.kind === "contract" ? null : <>{formatAmount(quote.totalTtcCents, locale)} — </>}
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
            {quote.advanceKind && quote.kind !== "contract" ? (
              <>
                <br />
                {t(quote.advanceKind === "earnest" ? "advanceEarnest" : "advanceDeposit")}
              </>
            ) : null}
            {quote.contract ? (
              <div className="client-contract">
                <p>
                  {t(quote.kind === "contract" ? "contractAlone" : "contractWithQuote", { title: quote.contract.title, version: quote.contract.version })} —{" "}
                  {preview ? <span>{t("readContract")}</span> : <a href={`/portail/contrat/${quote.contract.contractId}`}>{t("readContract")}</a>}
                </p>
                <p>{quote.contract.withdrawalApplies ? t("withdrawalInfo", { days }) : t("noWithdrawalInfo")}</p>
                {quote.contract.orderedAt ? (
                  <p>{t("orderedOn", { date: formatDateTime(new Date(quote.contract.orderedAt), locale) })}</p>
                ) : quote.contract.open && quote.contract.orderRequired ? (
                  <OrderContractForm contractId={quote.contract.contractId} preview={preview} />
                ) : null}
                {quote.contract.earlyExecutionRequestedAt ? (
                  <p>{t("earlyExecutionOn", { date: formatDateTime(new Date(quote.contract.earlyExecutionRequestedAt), locale) })}</p>
                ) : quote.contract.open && quote.contract.earlyExecutionText ? (
                  <EarlyExecutionForm contractId={quote.contract.contractId} text={quote.contract.earlyExecutionText} preview={preview} />
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
