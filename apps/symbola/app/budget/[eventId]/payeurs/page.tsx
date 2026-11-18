// Lot 43 (BUD-06, D8) — les payeurs de l'évènement : les mariés (d'office, 100 % par défaut), une
// famille, une entreprise ; la part de chacun sur chaque ligne (pourcentage ou montant), au centime ; le
// payeur de chaque échéance ; ce que voit chaque payeur (sa part seule par défaut, le client décide).
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { getEvent, listEventLinks } from "@/modules/events/service";
import { getPayerShares, listBudgetLines } from "@/modules/budget/service";
import { listEventInstalments } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { isBudgetModuleEnabled, isValidId } from "../../module-access";
import { removePayerAction } from "./actions";
import { AddPayerForm, LineSharesForm, PaymentPayerForm, VisibilityForm } from "./payer-forms";

export default async function EventPayersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { eventId } = await params;
  const t = await getTranslations("Payers");
  const tHelp = await getTranslations("Help");
  if (!(await isBudgetModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  if (!isValidId(eventId)) notFound();
  const event = await getEvent(organizationId, eventId);
  if (!event) notFound();
  const locale = (await getLocale()) as Locale;
  const [shares, lines, links, instalments] = await Promise.all([
    getPayerShares(organizationId, eventId),
    listBudgetLines(organizationId, eventId),
    listEventLinks(organizationId, eventId),
    (await isQuotesModuleEnabled(organizationId)) ? listEventInstalments(organizationId, eventId) : Promise.resolve([]),
  ]);
  const payerName = new Map(shares.payers.map((payer) => [payer.id, payer.name]));
  const clientLinks = links.filter((link) => link.audience === "client" && link.status !== "revoked").map((link) => ({ id: link.id, personName: link.personName }));
  const instalmentPayer = new Map(shares.instalmentPayers.map((entry) => [entry.scheduleItemId, entry.payerId]));
  const payments = lines.categories.flatMap((category) => category.lines.flatMap((line) => line.payments.map((payment) => ({ payment, label: [category.label, line.vendorName, payment.label].filter(Boolean).join(" — ") }))));
  return (
    <main>
      <PageHeader
        title={t("title")}
        subtitle={event.clients.map((client) => client.firstName).join(" & ")}
        actions={
          <Link href={`/budget/${eventId}`} className="button-link">
            {t("backToBudget")}
          </Link>
        }
      />
      <ScreenHelp title={tHelp("budgetPayers.title")} body={tHelp("budgetPayers.body")} />
      <section aria-labelledby="payers-list-title">
        <h2 id="payers-list-title">{t("listTitle")}</h2>
        <ul className="item-list">
          {shares.payers.map((payer) => {
            const total = shares.byPayer.find((entry) => entry.payerId === payer.id)?.totalCents ?? 0;
            return (
              <li key={payer.id}>
                <p>
                  <strong>{payer.name}</strong> — {t(`kinds.${payer.kind}`)} — {t("totalShare", { amount: formatAmount(total, locale) })}
                </p>
                {payer.kind !== "couple" ? (
                  <>
                    <VisibilityForm eventId={eventId} payer={payer} />
                    <form action={removePayerAction}>
                      <input type="hidden" name="eventId" value={eventId} />
                      <input type="hidden" name="payerId" value={payer.id} />
                      <button type="submit">{t("remove", { name: payer.name })}</button>
                    </form>
                  </>
                ) : (
                  <p className="meta">{t("coupleHint")}</p>
                )}
              </li>
            );
          })}
        </ul>
        <details>
          <summary>{t("addSummary")}</summary>
          <AddPayerForm eventId={eventId} links={clientLinks} />
        </details>
      </section>
      <section aria-labelledby="payers-lines-title">
        <h2 id="payers-lines-title">{t("linesTitle")}</h2>
        {shares.lines.length === 0 ? <p>{t("noLines")}</p> : null}
        <ul className="item-list">
          {shares.lines.map((line) => (
            <li key={line.lineId}>
              <p>
                <strong>{[line.slotLabel, line.label].filter(Boolean).join(" — ")}</strong> — {formatAmount(line.referenceCents, locale)}
              </p>
              <p className="meta">{line.split.map((entry) => t("splitEntry", { name: payerName.get(entry.payerId) ?? "", amount: formatAmount(entry.amountCents, locale) })).join(" · ")}</p>
              {shares.payers.length > 1 ? <LineSharesForm eventId={eventId} line={{ lineId: line.lineId, label: [line.slotLabel, line.label].filter(Boolean).join(" — "), shares: line.shares }} payers={shares.payers} /> : null}
            </li>
          ))}
        </ul>
      </section>
      {shares.payers.length > 1 && (payments.length > 0 || instalments.length > 0) ? (
        <section aria-labelledby="payers-payments-title">
          <h2 id="payers-payments-title">{t("paymentsTitle")}</h2>
          <ul className="item-list">
            {instalments.map((instalment) => (
              <li key={instalment.scheduleItemId}>
                <p>
                  {instalment.label} · {instalment.quoteNumber} — {formatAmount(instalment.amountCents, locale)} — {formatCalendarDate(instalment.dueDate, locale)}
                </p>
                <PaymentPayerForm eventId={eventId} target={{ scheduleItemId: instalment.scheduleItemId }} label={`${instalment.label} · ${instalment.quoteNumber}`} payers={shares.payers} current={instalmentPayer.get(instalment.scheduleItemId) ?? null} />
              </li>
            ))}
            {payments.map(({ payment, label }) => (
              <li key={payment.id}>
                <p>
                  {label} — {formatAmount(payment.amountCents, locale)} — {formatCalendarDate(payment.dueOn, locale)}
                </p>
                <PaymentPayerForm eventId={eventId} target={{ paymentId: payment.id }} label={label} payers={shares.payers} current={payment.payerId} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
