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
import { Payments } from "@/app/budget/[eventId]/budget-lines-table";
import { BudgetLineDialog } from "./budget-line-dialog";
import { signedAmount, type BudgetVendorRow, type BudgetVendorTotals } from "./budget-vendor-rows";
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
                        <button type="button" className="button-ghost budget-unfold" aria-expanded={open} aria-controls={scheduleId} onClick={() => toggle(row.slotId)}>
                          {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                          <span className="sr-only">{t(open ? "foldSchedule" : "unfoldSchedule", { slot: row.label })}</span>
                        </button>
                        <span className="line-cell">
                          <BudgetLineIcon icon={row.icon} label={row.label} decorative />
                          <Link href={posteHrefs[row.slotId] ?? "#"}>{row.label}</Link>
                        </span>
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
                          {row.lines.map((line) => (
                            <Payments key={line.id} eventId={eventId} line={line} locale={locale} />
                          ))}
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
