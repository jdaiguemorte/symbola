"use client";

// Lot 63c (BUD-01, BUD-03, BUD-04 ; Q42, maquette M9) — « Budget et prestataires » en un tableau qui
// tient dans la largeur : par poste, le prestataire et ses pièces, prévu, réel, écart (signe écrit),
// réglé, reste à payer et prochaine échéance (« En retard » si dépassée). La ligne se déplie sur son
// échéancier (« Ajouter une échéance », « Marquer payée ») ; « Modifier » ouvre la grande fenêtre (M12).
// Lot 65b (PRE-02, UX-03 ; maquette M14 A) : chaque ligne dit où en est le choix (« Retenu », « N en
// comparaison », « À trouver ») ; « Ouvrir », ou un clic sur la ligne, ouvre la fenêtre du poste.
// L'engagé : pastille « Engagé » sur la ligne, sous-total « dont engagé ». En 375 px, une carte par
// poste (globals.css, .budget-vendors).
import { Fragment, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { BudgetLineIcon } from "@/app/budget-line-icon";
import { setVendorPaymentPaidAction } from "@/app/budget/[eventId]/actions";
import { SlotWindow, type SlotPanel, type SlotRubric } from "./slot-window";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { removeVendorSlotAction } from "./vendor-slot-actions";
import { signedAmount, type BudgetVendorRow, type BudgetVendorTotals, type RowPayment } from "./budget-vendor-rows";
import { VendorChoice } from "./vendor-choice";

const COLUMNS = 8;

// Lot 65g : un poste vide se supprime sans rien perdre.
function removable(row: BudgetVendorRow, choice: { comparing: number }): boolean {
  return (
    row.vendorNames.length === 0 &&
    choice.comparing === 0 &&
    row.payments.length === 0 &&
    row.attachments.length === 0 &&
    row.lines.every((line) => !line.estimatedAmountCents && !line.quotedAmountCents && !line.committedAmountCents && !line.paidAmountCents)
  );
}

export function BudgetVendorsTable({
  eventId,
  rows,
  totals,
  locale,
  initialSlotId,
  slotPanels,
  choices,
  catalogHrefs,
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
  // ?poste=<id> : la fenêtre de ce poste s'ouvre d'emblée (liens d'autres écrans, tutoriels).
  initialSlotId: string | null;
  slotPanels: Record<string, SlotPanel>;
  // Prestataires en comparaison (hors écartés et retenus) et devis reçus, par poste.
  choices: Record<string, { comparing: number; quotes: number; signature?: string }>;
  // Le carnet filtré pour le poste, et la demande de devis.
  catalogHrefs: Record<string, string>;
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
  // Le poste ouvert, par son identifiant : un poste retiré ferme sa fenêtre, sans en ouvrir un autre.
  const [editingId, setEditingId] = useState<string | null>(initialSlotId && rows.some((row) => row.slotId === initialSlotId) ? initialSlotId : null);
  const [rubric, setRubric] = useState<SlotRubric>("vendors");
  const open = (index: number, at: SlotRubric = "vendors") => {
    setRubric(at);
    setEditingId(rows[index]?.slotId ?? null);
  };
  const editingIndex = editingId ? rows.findIndex((row) => row.slotId === editingId) : -1;
  const editing = editingIndex >= 0 ? editingIndex : null;
  // Un clic sur la ligne l'ouvre, sauf sur un lien, un bouton ou un champ.
  const onRowClick = (event: MouseEvent<HTMLTableRowElement>, index: number) => {
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label, dialog, [role='group']")) return;
    open(index);
  };
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
              const unfoldedRow = unfolded.has(row.slotId);
              const choice = choices[row.slotId] ?? { comparing: 0, quotes: 0 };
              const scheduleId = `echeancier-${row.slotId}`;
              return (
                <Fragment key={row.slotId}>
                  <tr className="budget-vendor-row" onClick={(event) => onRowClick(event, index)}>
                    <th scope="row">
                      <div className="budget-vendor-head">
                        <span className="line-cell">
                          <BudgetLineIcon icon={row.icon} label={row.label} decorative />
                          <button type="button" className="link-button" onClick={() => open(index)} aria-haspopup="dialog">
                            {row.label}
                          </button>
                        </span>
                        {/* PAR-04 : le statut du poste (à pourvoir, pressenti, retenu…), toujours en mots. */}
                        <span className={statusClasses[row.status]}>{statusLabels[row.status]}</span>
                        {row.engaged ? <span className="badge badge-sauge">{t("engaged")}</span> : null}
                      </div>
                      <div className="budget-vendor-who">
                        {row.vendorNames.length > 0 ? (
                          <span>{row.vendorNames.join(", ")}</span>
                        ) : (
                          // La liste « + Ajouter » reste à la même place quand un prestataire entre en
                          // comparaison : elle ne se ferme pas entre deux « Comparer ».
                          <>
                            {choice.comparing > 0 ? (
                              <button type="button" className="link-button" onClick={() => open(index)} aria-haspopup="dialog">
                                {t("choiceComparing", { count: choice.comparing })}
                                {choice.quotes > 0 ? ` · ${t("quotesReceived", { count: choice.quotes })}` : ""}
                                <span className="sr-only"> — {t("openFor", { slot: row.label })}</span>
                              </button>
                            ) : null}
                            {vendorsAvailable ? (
                              <VendorChoice eventId={eventId} slotId={row.slotId} slotLabel={row.label} catalogHref={catalogHrefs[row.slotId] ?? "/prestataires"} vendorTypes={vendorTypes} label={choice.comparing > 0 ? t("addMore") : undefined} />
                            ) : choice.comparing === 0 ? (
                              <button type="button" className="link-button" onClick={() => open(index)} aria-haspopup="dialog">
                                {t("addVendor")}
                                <span className="sr-only"> — {t("openFor", { slot: row.label })}</span>
                              </button>
                            ) : null}
                          </>
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
                      <button type="button" className="button-ghost budget-unfold" aria-expanded={unfoldedRow} aria-controls={scheduleId} onClick={() => toggle(row.slotId)}>
                        {unfoldedRow ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                        <span className="sr-only">{t(unfoldedRow ? "foldSchedule" : "unfoldSchedule", { slot: row.label })}</span>
                      </button>
                      <button type="button" className="button-secondary" onClick={() => open(index)} aria-haspopup="dialog">
                        {t("open")}
                        <span className="sr-only"> {t("openFor", { slot: row.label })}</span>
                      </button>
                      {/* Lot 65g (PRE-02 ; recette staging du 22/11/2026) : un évènement n'a pas besoin de tous
                          les postes ; « Supprimer » à côté d'« Ouvrir », après confirmation, pour un poste vide
                          (ni prestataire, ni montant, ni échéance, ni pièce) : rien ne se perd. Un poste qui en a
                          se retire depuis ses réglages. */}
                      {removable(row, choice) ? (
                        <ConfirmDialog
                          trigger={t("removeSlot")}
                          triggerLabel={t("removeSlotFor", { slot: row.label })}
                          triggerClassName="button-ghost"
                          title={t("removeSlotTitle", { slot: row.label })}
                          body={t("removeSlotBody")}
                          confirmLabel={t("removeSlotConfirm")}
                          cancelLabel={t("removeSlotCancel")}
                          action={removeVendorSlotAction}
                          fields={{ eventId, vendorSlotId: row.slotId }}
                        />
                      ) : null}
                    </td>
                  </tr>
                  {unfoldedRow ? (
                    <tr className="budget-vendor-schedule">
                      <td colSpan={COLUMNS}>
                        <section id={scheduleId} aria-label={t("scheduleOf", { slot: row.label })} className="stack">
                          {row.lines.length === 0 ? <p className="meta">{t("scheduleNeedsLine")}</p> : null}
                          {row.lines.length > 0 && row.payments.length === 0 ? <p className="meta">{t("scheduleEmpty")}</p> : null}
                          {row.payments.length > 0 ? <ScheduleList eventId={eventId} payments={row.payments} showLine={row.lines.length > 1} locale={locale} /> : null}
                          {row.lines.length > 0 ? (
                            <button type="button" className="link-button" onClick={() => open(index, "schedule")} aria-haspopup="dialog">
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
        <SlotWindow
          key={editingRow.slotId}
          eventId={eventId}
          row={editingRow}
          index={editing}
          count={rows.length}
          nextLabel={rows[editing + 1]?.label ?? null}
          vendors={slotVendors[editingRow.slotId] ?? []}
          locale={locale}
          rubric={rubric}
          onRubric={setRubric}
          panel={slotPanels[editingRow.slotId]}
          vendorsAvailable={vendorsAvailable}
          vendorTypes={vendorTypes}
          catalogHref={catalogHrefs[editingRow.slotId] ?? "/prestataires"}
          candidatesSignature={choices[editingRow.slotId]?.signature ?? ""}
          consultationHref={consultationHrefs[editingRow.slotId] ?? "#"}
          onClose={() => setEditingId(null)}
          onMove={(step) => setEditingId(rows[editing + step]?.slotId ?? null)}
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

