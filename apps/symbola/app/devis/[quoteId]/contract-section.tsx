// Lot 31b (FAC-04, DOC-02, DOC-03, JUR-07, JUR-20 ; D7, D9, D11 à D16, partie N) — contrat d'un
// devis envoyé : choix du modèle, génération (canal, catégorie du client, clauses facultatives,
// avertissement « base à adapter »), contrat courant (régime, version et revue du modèle,
// signature, actes du client, dossier de preuve), versions précédentes ; contrat signé seul
// quand il est généré après le devis.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { contractTemplateWarning, starterContractRules } from "@symbola/starter-templates";
import { checkContract, listContractTemplates, listQuoteContracts, type ContractView, type QuoteDetail } from "@/modules/quotes/service";
import { addStarterContractTemplatesAction } from "../modeles-contrat/actions";
import { ClientKindForm } from "./invoice-forms";
import { ContractProblems, GenerateContractForm, SendContractAloneForm } from "./contract-forms";

const PREVIEW_PROBLEMS = new Set(["variable_missing", "variable_unknown", "clause_unwritten"]);

export async function ContractSection({
  organizationId,
  userId,
  quote,
  eventTypeId,
  selectedTemplateId,
  locale,
}: {
  organizationId: string;
  userId: string;
  quote: QuoteDetail;
  eventTypeId: string | null;
  selectedTemplateId: string | null;
  locale: Locale;
}) {
  const t = await getTranslations("Contracts");
  const sent = quote.current.sentAt !== null;
  const [templates, contracts] = await Promise.all([listContractTemplates(organizationId), sent ? listQuoteContracts(organizationId, quote.id) : Promise.resolve([] as ContractView[])]);
  const current = [...contracts].reverse().find((contract) => contract.quoteVersion === quote.current.version) ?? null;
  const older = contracts.filter((contract) => contract.id !== current?.id).reverse();
  const signing = contracts.some((contract) => contract.signature?.status === "pending");
  const quoteLocked = quote.status !== "sent" && quote.status !== "signed";
  const template =
    templates.find((candidate) => candidate.id === selectedTemplateId) ??
    templates.find((candidate) => candidate.eventTypeId !== null && candidate.eventTypeId === eventTypeId) ??
    (templates.length === 1 ? templates[0] : undefined);
  const preview =
    sent && template && !signing && !quoteLocked
      ? await checkContract({ organizationId, quoteId: quote.id, templateId: template.id, optionalClauseIds: [], channel: "on_premises", smallBusinessConfirmed: false, userId, locale })
      : null;
  const warning = contractTemplateWarning(locale);

  return (
    <section id="contrat" aria-labelledby="contract-title">
      <h2 id="contract-title">{t("sectionTitle")}</h2>
      {!sent ? <p>{t("sendQuoteFirst")}</p> : null}

      {current ? <CurrentContract quote={quote} contract={current} locale={locale} /> : null}

      {sent && !quoteLocked ? (
        <>
          <h3>{current ? t("regenerateTitle") : t("generateTitle")}</h3>
          {/* Signé, le type de client se règle avec les factures (une seule fois sur la page). */}
          {quote.status === "sent" ? <ClientKindForm quoteId={quote.id} clientKind={quote.clientKind} /> : null}
          {signing ? <p role="status">{t("signingInProgress")}</p> : null}
          {templates.length === 0 ? (
            <>
              <p>
                {t("noTemplatesHint")} <Link href="/devis/modeles-contrat">{t("templatesLink")}</Link>
              </p>
              <form action={addStarterContractTemplatesAction}>
                <button type="submit">{t("addStarterTemplates")}</button>
              </form>
            </>
          ) : !signing ? (
            <>
              <form method="get" action={`/devis/${quote.id}#contrat`} aria-label={t("chooseTemplate")}>
                <label>
                  {t("chooseTemplate")}
                  <select name="modele" defaultValue={template?.id ?? ""}>
                    {template ? null : <option value="">{t("chooseTemplatePlaceholder")}</option>}
                    {templates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">{t("chooseTemplateSubmit")}</button>
              </form>
              {template && preview ? (
                <>
                  <p role="note" className="adapt-warning">
                    {warning}
                  </p>
                  <p className="meta">
                    {t("templateVersion", { version: template.version })} —{" "}
                    {template.legalReviewedOn ? t("templateReviewed", { date: formatCalendarDate(template.legalReviewedOn, locale) }) : t("templateNotReviewed")} —{" "}
                    <Link href={`/devis/modeles-contrat/${template.id}`}>{t("editTemplate", { name: template.name })}</Link>
                  </p>
                  {preview.signature.recommended === "advanced" ? <p role="note">{t("advancedSignatureRecommended", { amount: formatAmount(starterContractRules().signature.advancedThresholdCents, locale) })}</p> : null}
                  {preview.problems.some((problem) => PREVIEW_PROBLEMS.has(problem.kind)) ? (
                    <div role="note" className="missing-mentions-panel">
                      <p>{t("previewProblems")}</p>
                      <ContractProblems problems={preview.problems.filter((problem) => PREVIEW_PROBLEMS.has(problem.kind))} />
                    </div>
                  ) : null}
                  <GenerateContractForm
                    quoteId={quote.id}
                    templateId={template.id}
                    optionalClauses={template.clauses.filter((clause) => clause.optional)}
                    warning={warning}
                    warningAccepted={preview.warningAccepted}
                    showSmallBusiness={quote.clientKind !== "individual"}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {older.length > 0 ? (
        <details>
          <summary>{t("olderContracts")}</summary>
          <ul>
            {older.map((contract) => (
              <li key={contract.id}>
                {t("contractVersionLabel", { version: contract.version, quoteVersion: contract.quoteVersion })} — {formatDateTime(new Date(contract.generatedAt), locale)} —{" "}
                <a href={`/devis/${quote.id}/contrat/${contract.id}/pdf`}>{t("downloadContract", { version: contract.version })}</a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

async function CurrentContract({ quote, contract, locale }: { quote: QuoteDetail; contract: ContractView; locale: Locale }) {
  const t = await getTranslations("Contracts");
  const signatureKey = contract.signature ? `signature_${contract.signature.status}` : "signature_none";
  return (
    <div className="card">
      <h3>
        {contract.title} — {t("contractVersionLabel", { version: contract.version, quoteVersion: contract.quoteVersion })}
      </h3>
      <ul>
        <li>{t(`channel_${contract.conclusionChannel}`)}</li>
        <li>{t(`category_${contract.clientCategory}`)}</li>
        <li>{contract.regime.withdrawalApplies ? t("withdrawalApplies") : t("withdrawalNotApplies")}</li>
        {contract.regime.orderRequired ? <li>{t("orderRequired")}</li> : null}
        {contract.regime.noPaymentDays !== null ? <li>{t("noPaymentBefore", { days: contract.regime.noPaymentDays })}</li> : null}
        <li>
          {t("templateVersion", { version: contract.templateVersion })} —{" "}
          {contract.templateReviewedOn ? t("templateReviewed", { date: formatCalendarDate(contract.templateReviewedOn, locale) }) : t("templateNotReviewed")}
        </li>
        <li>{t("generatedOn", { date: formatDateTime(new Date(contract.generatedAt), locale) })}</li>
        <li>{t(signatureKey, { kind: contract.signature ? t(`requestKind_${contract.signature.kind}`) : "" })}</li>
      </ul>
      {contract.outdated ? <p role="alert">{t("contractOutdated")}</p> : null}
      {contract.recommendedSignatureLevel === "advanced" ? <p role="note">{t("advancedSignatureRecommended", { amount: formatAmount(starterContractRules().signature.advancedThresholdCents, locale) })}</p> : null}
      {contract.acts.length > 0 ? (
        <>
          <h4>{t("actsTitle")}</h4>
          <ul>
            {contract.acts.map((act) => (
              <li key={`${act.signerId}-${act.kind}`}>{t("actLine", { name: act.signerName, kind: t(act.kind === "order" ? "actOrder" : "actEarlyExecution"), date: formatDateTime(new Date(act.actedAt), locale) })}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p>
        <a href={`/devis/${quote.id}/contrat/${contract.id}/pdf`}>{t("downloadContract", { version: contract.version })}</a>
        {contract.hasEvidence ? (
          <>
            {" — "}
            <a href={`/devis/${quote.id}/contrat/${contract.id}/preuve`}>{t("downloadEvidence")}</a>
          </>
        ) : null}
        {contract.signature?.kind === "contract" && contract.signature.hasSignedDocument ? (
          <>
            {" — "}
            <a href={`/devis/${quote.id}/signature/signed?portee=contrat`}>{t("downloadSignedContract")}</a>
            {" — "}
            <a href={`/devis/${quote.id}/signature/certificate?portee=contrat`}>{t("downloadContractCertificate")}</a>
          </>
        ) : null}
      </p>
      {quote.status === "signed" && !contract.signature && !contract.outdated ? <SendContractAloneForm quoteId={quote.id} contractId={contract.id} /> : null}
    </div>
  );
}
