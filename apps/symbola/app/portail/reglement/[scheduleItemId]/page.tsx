import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatDateTime, parisToday, type Locale } from "@symbola/i18n";
import { requireLink } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isQuotesModuleEnabled, isValidId } from "@/app/devis/module-access";
import { getSettlement, QuoteNotFoundError } from "@/modules/quotes/service";
import { CopyButton } from "../copy-button";
import { TransferDeclarationForm } from "../declaration-form";
import { designatedPayerLink } from "../payer";

// Lot 43 (FAC-08 Divergent, GC-01, JUR-07 ; D5, D6 ; ADR 0087) — « Régler l'acompte » par virement au
// RIB de l'organisation : montant, IBAN, BIC et référence unique à copier, QR code européen (EPC) pour
// l'application de la banque, puis « J'ai fait le virement ». Selon le canal de conclusion (textes de
// contract-rules.json) : hors établissement, rien avant le 8e jour ; à distance, le rappel des quatorze
// jours et du formulaire. Aucun paiement ne transite par Symbola.
export default async function SettlementPage({ params }: { params: Promise<{ scheduleItemId: string }> }) {
  const access = await requireLink("client");
  const { scheduleItemId } = await params;
  if (!isValidId(scheduleItemId) || !access.rights.rubrics.includes("quotes") || !(await isQuotesModuleEnabled(access.organizationId))) notFound();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Settlement");
  const tHelp = await getTranslations("Help");
  let view;
  try {
    view = await getSettlement(access.organizationId, {
      eventId: access.eventId,
      linkId: access.linkId,
      scheduleItemId,
      designatedLinkId: await designatedPayerLink(access.organizationId, access.eventId, scheduleItemId),
      locale: locale === "en" ? "en" : "fr",
    });
  } catch (error) {
    if (error instanceof QuoteNotFoundError) notFound();
    throw error;
  }
  const state = view.state;
  return (
    <main className="portal settlement">
      <p className="muted">{t("quoteLine", { number: view.quoteNumber })}</p>
      <h1>{t("title", { label: view.label })}</h1>
      <ScreenHelp title={tHelp("settlement.title")} body={tHelp("settlement.body")} />
      <p className="settlement-amount">
        <strong>{formatAmount(view.amountCents, locale)}</strong>
        <span className="meta"> — {t("dueOn", { date: formatCalendarDate(view.dueDate, locale) })}</span>
      </p>
      {view.notice ? (
        <p role="note" className="settlement-notice">
          {view.notice}
        </p>
      ) : null}
      {state.kind === "awaiting_signatures" ? <p role="status">{t("awaitingSignatures")}</p> : null}
      {state.kind === "paid" ? <p role="status">{t("paid", { date: formatCalendarDate(state.paidOn, locale) })}</p> : null}
      {state.kind === "declared" ? <p role="status">{t("declared", { date: formatCalendarDate(state.paidOn, locale), when: formatDateTime(new Date(state.declaredAt), locale) })}</p> : null}
      {state.kind === "open" && view.bankDetailsMissing ? <p role="status">{t("bankDetailsMissing")}</p> : null}
      {state.kind === "open" && view.transfer ? (
        <section aria-labelledby="transfer-title" className="card settlement-transfer">
          <h2 id="transfer-title">{t("transferTitle")}</h2>
          <dl className="settlement-details">
            <dt>{t("beneficiary")}</dt>
            <dd>{view.transfer.beneficiary}</dd>
            <dt>{t("iban")}</dt>
            <dd>
              <code>{view.transfer.iban.replace(/(.{4})/g, "$1 ").trim()}</code> <CopyButton value={view.transfer.iban} label={t("iban")} />
            </dd>
            {view.transfer.bic ? (
              <>
                <dt>{t("bic")}</dt>
                <dd>
                  <code>{view.transfer.bic}</code> <CopyButton value={view.transfer.bic} label={t("bic")} />
                </dd>
              </>
            ) : null}
            <dt>{t("reference")}</dt>
            <dd>
              <code>{view.transfer.reference}</code> <CopyButton value={view.transfer.reference} label={t("reference")} />
            </dd>
          </dl>
          <p className="meta">{t("referenceHint")}</p>
          {view.transfer.qrSvg ? (
            <figure className="settlement-qr">
              {/* QR code produit par Symbola (bibliothèque qrcode) à partir de données vérifiées : une image SVG, jamais insérée dans la page. */}
              <img src={`data:image/svg+xml;base64,${Buffer.from(view.transfer.qrSvg).toString("base64")}`} alt={t("qrLabel")} width={192} height={192} />
              <figcaption className="meta">{t("qrHint")}</figcaption>
            </figure>
          ) : null}
          {view.canDeclare ? <TransferDeclarationForm scheduleItemId={view.scheduleItemId} today={parisToday()} /> : <p className="meta">{t("otherPayer")}</p>}
        </section>
      ) : null}
      {view.isDemo ? <p className="meta">{t("demo")}</p> : null}
      <p>
        <a href="/portail">{t("backToSpace")}</a>
      </p>
    </main>
  );
}
