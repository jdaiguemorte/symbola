"use client";

// Lot 63c (BUD-01, BUD-03, BUD-04 ; Q42, maquette M9) — « Budget et prestataires » en un tableau qui
// tient dans la largeur : par poste, le prestataire et ses pièces, prévu, réel, écart (signe écrit),
// réglé, reste à payer et prochaine échéance (« En retard » si dépassée). La ligne se déplie sur son
// échéancier (« Ajouter une échéance », « Marquer payée ») ; « Modifier » ouvre la grande fenêtre (M12).
// L'engagé : pastille « Engagé » sur la ligne, sous-total « dont engagé ». En 375 px, une carte par
// poste (globals.css, .budget-vendors).
import Link from "next/link";
import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { BudgetLineIcon } from "@/app/budget-line-icon";
import { setVendorPaymentPaidAction } from "@/app/budget/[eventId]/actions";
import { BudgetLineDialog } from "./budget-line-dialog";
import { signedAmount, type BudgetVendorRow, type BudgetVendorTotals, type RowPayment } from "./budget-vendor-rows";
import { VendorChoice } from "./vendor-choice";

const COLUMNS = 8;

export function BudgetVendorsTable({
  eventId,
  rows,
  totals,
  locale,
  posteHrefs,
  consultationHrefs,
  vendorsAvailable,
  vendorTypes,
  slotVendors,
  statusLabels,
  statusClasses,
}: {
  eventId: string;
  rows: BudgetVendorRow[];
  totals: BudgetVendorTotals;
  locale: Locale;
  // Le détail du poste (statut, consultés) dans la fiche, et la consultation.
  posteHrefs: Record<string, string>;
  consultationHrefs: Record<string, string>;
  vendorsAvailable: boolean;
  vendorTypes: { id: string; label: string }[];
  slotVendors: Record<string, { id: string; name: string }[]>;
  // Le statut de chaque poste, libellé et classe de la charte (vendor-slot-status.ts).
  statusLabels: Record<string, string>;
  statusClasses: Record<string, string>;
}) {
  const t = useTranslations("BudgetVendors");
  const tBudget = useTranslations("Budget");
  const [unfolded, setUnfolded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const money = (cents: number) => formatAmount(cents, locale);
  const shown = (cents: number | null) => (cents === null ? "—" : money(cents));
  const toggle = (slotId: string) => {
    const next = new Set(unfolded);
    if (next.has(slotId)) next.delete(slotId);
    else next.add(slotId);
    setUnfolded(next);
  };
  const editingRow = editing !== null ? rows[editing] : undefined;

  return (
    <div className="stack">
      <div className="list-table-wrap" role="region" aria-labelledby="budget-vendors-caption" tabIndex={0}>
        <table className="list-table budget-vendors">
          <caption id="budget-vendors-caption" className="sr-only">
            {t("caption")}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("columnSlot")}</th>
              <th scope="col" className="num">
                {t("columnPlanned")}
              </th>
              <th scope="col" className="num">
                {t("columnActual")}
              </th>
              <th scope="col" className="num">
                {t("columnVariance")}
              </th>
              <th scope="col" className="num">
                {t("columnPaid")}
              </th>
              <th scope="col" className="num">
                {t("columnRemaining")}
              </th>
              <th scope="col">{t("columnNext")}</th>
              <th scope="col">
                <span className="sr-only">{t("columnActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const open = unfolded.has(row.slotId);
              const scheduleId = `echeancier-${row.slotId}`;
              return (
                <Fragment key={row.slotId}>
                  <tr>
                    <th scope="row">
                      <div className="budget-vendor-head">
                        <span className="line-cell">
                          <BudgetLineIcon icon={row.icon} label={row.label} decorative />
                          <Link href={posteHrefs[row.slotId] ?? "#"}>{row.label}</Link>
                        </span>
                        {/* PAR-04 : le statut du poste (à pourvoir, pressenti, retenu…), toujours en mots. */}
                        <span className={statusClasses[row.status]}>{statusLabels[row.status]}</span>
                        {row.engaged ? <span className="badge badge-sauge">{t("engaged")}</span> : null}
                      </div>
                      <div className="budget-vendor-who">
                        {row.vendorNames.length > 0 ? (
                          <span>{row.vendorNames.join(", ")}</span>
                        ) : vendorsAvailable ? (
                          <VendorChoice eventId={eventId} slotId={row.slotId} slotLabel={row.label} consultationHref={consultationHrefs[row.slotId] ?? "#"} vendorTypes={vendorTypes} />
                        ) : (
                          <Link href={posteHrefs[row.slotId] ?? "#"}>{t("addVendor")}</Link>
                        )}
                        {row.attachments.length > 0 ? (
                          <span className="budget-vendor-pieces">
                            {row.attachments.map((attachment) => (
                              <a key={attachment.id} href={`/budget/${eventId}/devis/${attachment.id}`} target="_blank" rel="noopener noreferrer">
                                {tBudget(`documentKind.${attachment.kind}`)}
                                <span className="sr-only"> {t("pieceOf", { slot: row.label })}</span>
                              </a>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </th>
                    <td className="num" data-label={t("columnPlanned")}>
                      {shown(row.plannedCents)}
                    </td>
                    <td className="num" data-label={t("columnActual")}>
                      {shown(row.actualCents)}
                    </td>
                    <td className={row.varianceCents === null ? "num" : row.varianceCents > 0 ? "num text-attention" : row.varianceCents < 0 ? "num text-paid" : "num"} data-label={t("columnVariance")}>
                      {row.varianceCents === null ? "—" : signedAmount(row.varianceCents, money)}
                    </td>
                    <td className="num" data-label={t("columnPaid")}>
                      {money(row.paidCents)}
                    </td>
                    <td className="num" data-label={t("columnRemaining")}>
                      {shown(row.remainingCents)}
                    </td>
                    <td data-label={t("columnNext")}>
                      {row.nextPayment ? (
                        <span className="budget-next">
                          {money(row.nextPayment.amountCents)} · {formatCalendarDate(row.nextPayment.dueOn, locale)}
                          {row.nextPayment.late ? <span className="badge badge-terracotta">{t("late")}</span> : null}
                        </span>
                      ) : row.settled ? (
                        <span className="badge badge-sauge">{t("settled")}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="actions">
                      <button type="button" className="button-ghost budget-unfold" aria-expanded={open} aria-controls={scheduleId} onClick={() => toggle(row.slotId)}>
                        {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                        <span className="sr-only">{t(open ? "foldSchedule" : "unfoldSchedule", { slot: row.label })}</span>
                      </button>
                      <button type="button" className="button-secondary" onClick={() => setEditing(index)} aria-haspopup="dialog">
                        {t("edit")}
                        <span className="sr-only"> {row.label}</span>
                      </button>
                    </td>
                  </tr>
                  {open ? (
                    <tr className="budget-vendor-schedule">
                      <td colSpan={COLUMNS}>
                        <section id={scheduleId} aria-label={t("scheduleOf", { slot: row.label })} className="stack">
                          {row.lines.length === 0 ? <p className="meta">{t("scheduleNeedsLine")}</p> : null}
                          {row.lines.length > 0 && row.payments.length === 0 ? <p className="meta">{t("scheduleEmpty")}</p> : null}
                          {row.payments.length > 0 ? <ScheduleList eventId={eventId} payments={row.payments} showLine={row.lines.length > 1} locale={locale} /> : null}
                          {row.lines.length > 0 ? (
                            <button type="button" className="link-button" onClick={() => setEditing(index)} aria-haspopup="dialog">
                              {t("addPayment")}
                              <span className="sr-only"> {t("chooseFor", { slot: row.label })}</span>
                            </button>
                          ) : null}
                        </section>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t("total")}</th>
              <td className="num" data-label={t("columnPlanned")}>
                {money(totals.plannedCents)}
              </td>
              <td className="num" data-label={t("columnActual")}>
                {money(totals.actualCents)}
              </td>
              <td className="num" data-label={t("columnVariance")}>
                {signedAmount(totals.varianceCents, money)}
              </td>
              <td className="num" data-label={t("columnPaid")}>
                {money(totals.paidCents)}
              </td>
              <td className="num" data-label={t("columnRemaining")}>
                {money(totals.remainingCents)}
              </td>
              <td colSpan={2} />
            </tr>
            <tr className="budget-engaged-total">
              <th scope="row">{t("engagedTotal")}</th>
              <td className="num" data-label={t("columnActual")}>
                {money(totals.engagedCents)}
              </td>
              <td colSpan={COLUMNS - 2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="meta">{t("legend")}</p>
      {editingRow && editing !== null ? (
        <BudgetLineDialog
          key={editingRow.slotId}
          eventId={eventId}
          row={editingRow}
          index={editing}
          count={rows.length}
          nextLabel={rows[editing + 1]?.label ?? null}
          vendors={slotVendors[editingRow.slotId] ?? []}
          locale={locale}
          onClose={() => setEditing(null)}
          onMove={(step) => {
            const next = editing + step;
            setEditing(next >= 0 && next < rows.length ? next : null);
          }}
        />
      ) : null}
    </div>
  );
}

// L'échéancier d'un poste, déplié sous sa ligne : chaque échéance, sa date et « Marquer payée » (à la
// date du jour) ; le reste (montant, payeur, remise le jour J) se règle dans la fenêtre.
function ScheduleList({ eventId, payments, showLine, locale }: { eventId: string; payments: RowPayment[]; showLine: boolean; locale: Locale }) {
  const t = useTranslations("BudgetVendors");
  const tBudget = useTranslations("Budget");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ul className="item-list budget-schedule">
      {payments.map((payment) => (
        <li key={payment.id}>
          <span>
            <strong>{payment.label}</strong>
            {showLine ? <span className="meta"> · {payment.lineLabel}</span> : null} — {formatAmount(payment.amountCents, locale)}
            {payment.percentageBasisPoints !== null ? ` (${tBudget("paymentPercent", { percent: payment.percentageBasisPoints / 100 })})` : ""}
          </span>
          {payment.status === "paid" ? (
            <span className="badge badge-sauge">{tBudget("paymentPaid", { date: formatCalendarDate(payment.paidOn!, locale) })}</span>
          ) : (
            <span className="row-wrap">
              <span className={payment.late ? "text-overdue" : undefined}>{tBudget(payment.late ? "paymentOverdue" : "paymentDue", { date: formatCalendarDate(payment.dueOn, locale) })}</span>
              <form action={setVendorPaymentPaidAction} className="inline-form">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="paidOn" value={today} />
                <button type="submit" className="button-secondary">
                  {t("markPaid")}
                  <span className="sr-only"> {payment.label}</span>
                </button>
              </form>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

