// Lot 48b (BUD-08, PRE-07, JUR-10 ; D6, D8 ; ADR 0093) — honoraires et commissions d'un évènement :
// honoraires (forfait, pourcentage du budget ou les deux), hors des dépenses de l'évènement ;
// commissions et apports d'affaires par prestataire (attendue, facturée, reçue), affichées d'office à
// un client particulier ; facture de commission au prestataire.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { eventNames, getEvent, listVendorCandidates } from "@/modules/events/service";
import { eventClientKind, getPlannerFeeTerms, isCommissionShown, listEventCommissions } from "@/modules/quotes/service";
import { plannerFeeAmount } from "@/lib/money/planner-fees";
import { isQuotesModuleEnabled, isValidId } from "../../module-access";
import { updateCommissionAction } from "./actions";
import { AddCommissionForm, IssueCommissionInvoiceForm, PlannerFeeForm } from "./forms";

const STATUS_BADGE = { expected: "badge badge-ambre", invoiced: "badge badge-bleu", received: "badge badge-sauge" } as const;

export default async function PlannerMoneyPage({ params }: { params: Promise<{ eventId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("PlannerMoney");
  const tHelp = await getTranslations("Help");
  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("pageTitle")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }
  const { eventId } = await params;
  if (!isValidId(eventId)) notFound();
  const event = await getEvent(organizationId, eventId);
  if (!event) notFound();
  const locale = (await getLocale()) as Locale;
  const [terms, commissions, candidates, clientKind] = await Promise.all([
    getPlannerFeeTerms(organizationId, eventId),
    listEventCommissions(organizationId, eventId),
    listVendorCandidates(organizationId, eventId),
    eventClientKind(organizationId, eventId),
  ]);
  const fee = terms ? await plannerFeeAmount(organizationId, eventId, terms) : null;
  const decimal = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false }).format(value / 100);
  const vendors = [...new Map(candidates.filter((candidate) => candidate.outcome === "selected").map((candidate) => [candidate.vendorId ?? candidate.vendorName, { id: candidate.vendorId, name: candidate.vendorName }])).values()];
  return (
    <main>
      <p>
        <Link href={`/events/${eventId}`}>{t("backToEvent", { names: eventNames(event.clients, event.name) })}</Link>
      </p>
      <h1>{t("pageTitle")}</h1>
      <ScreenHelp title={tHelp("plannerMoney.title")} body={tHelp("plannerMoney.body")} />

      <section className="card" aria-labelledby="fees-title">
        <h2 id="fees-title">{t("feesTitle")}</h2>
        <p>{fee !== null ? t("feeAmount", { amount: formatAmount(fee, locale) }) : t("feeNone")}</p>
        <p className="muted">{t("feesHint")}</p>
        <PlannerFeeForm
          eventId={eventId}
          terms={terms ? { kind: terms.kind, flat: terms.flatCents ? decimal(terms.flatCents) : "", percent: terms.percentBasisPoints ? decimal(terms.percentBasisPoints) : "", base: terms.base } : null}
        />
      </section>

      <section className="card" aria-labelledby="commissions-title">
        <h2 id="commissions-title">{t("commissionsTitle")}</h2>
        <p className="muted">{clientKind === "professional" ? t("commissionsProfessional") : t("commissionsIndividual")}</p>
        {commissions.length === 0 ? <p>{t("commissionsNone")}</p> : null}
        <ul className="vendor-documents">
          {commissions.map((commission) => (
            <li key={commission.id}>
              <strong>{commission.vendorName}</strong> · {formatAmount(commission.amountCents, locale)} · {t(commission.nature === "referral" ? "natureReferral" : "natureCommission")}{" "}
              <span className={STATUS_BADGE[commission.status]}>{t(`status_${commission.status}`)}</span>
              {commission.receivedOn ? <span className="meta"> {t("receivedOn", { date: formatCalendarDate(commission.receivedOn, locale) })}</span> : null}
              <span className="meta"> {isCommissionShown(clientKind, commission) ? t("shownToClient") : t("hiddenFromClient")}</span>
              {commission.invoice ? (
                <a href={`/devis/argent/factures/${commission.invoice.id}`}>{t("invoiceDownload", { number: commission.invoice.number })}</a>
              ) : (
                <IssueCommissionInvoiceForm eventId={eventId} commissionId={commission.id} vendorName={commission.vendorName} />
              )}
              <form action={updateCommissionAction} className="inline-form">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="commissionId" value={commission.id} />
                {commission.status !== "received" ? (
                  <button type="submit" name="action" value="received">
                    {t("markReceived", { vendor: commission.vendorName })}
                  </button>
                ) : null}
                {clientKind === "professional" ? (
                  <button type="submit" name="action" value={commission.shownToClient ? "hide" : "show"}>
                    {t(commission.shownToClient ? "hide" : "show", { vendor: commission.vendorName })}
                  </button>
                ) : null}
                {!commission.invoice ? (
                  <button type="submit" name="action" value="remove">
                    {t("remove", { vendor: commission.vendorName })}
                  </button>
                ) : null}
              </form>
            </li>
          ))}
        </ul>
        {vendors.length > 0 ? <AddCommissionForm eventId={eventId} vendors={vendors} professional={clientKind === "professional"} /> : <p>{t("commissionsNoVendor")}</p>}
      </section>
    </main>
  );
}
