"use client";

// Lot 65b (PRE-02, BUD-02, BUD-05 ; maquette M14 B) — la rubrique « Prestataires » de la fenêtre du
// poste : les prestataires côte à côte (où on en est, devis, disponibilité, « Déjà travaillé
// ensemble », dernière relance, note), et les gestes du choix. En lice : « Retenir », « Écarter ».
// Retenu : en tête, « Changer de prestataire » (les autres proposent alors « Retenir à la place ») et
// « Ne plus retenir ». Écarté : grisé, « Remettre en comparaison ». Retenir au-delà du seuil d'alerte
// du budget se confirme d'abord (BUD-02). En 375 px, le tableau défile dans sa largeur.
import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { NoteReminderButton } from "@/app/accueil/note-reminder";
import { releaseSlotRetainedAction, retainSlotCandidateAction, setSlotCandidateDismissedAction, slotComparisonAction, type SlotComparisonColumn, type SlotVendorState } from "./budget-vendor-actions";

export function SlotComparison({ eventId, slotId, slotLabel, locale, version, addVendor }: { eventId: string; slotId: string; slotLabel: string; locale: Locale; version: number; addVendor: React.ReactNode }) {
  const t = useTranslations("BudgetVendors");
  const tStatus = useTranslations("VendorCandidates");
  const tReminder = useTranslations("Today.reminder");
  const router = useRouter();
  const captionId = useId();
  const [columns, setColumns] = useState<SlotComparisonColumn[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ candidateId: string; replace: boolean; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAction, startTransition] = useTransition();
  // Entre la fin d'un geste et la comparaison relue, les boutons restent inactifs : jamais un geste sur
  // un état périmé.
  const pending = pendingAction || refreshing;

  const load = useCallback(async () => {
    const result = await slotComparisonAction({ eventId, slotId });
    if (result.ok) {
      setColumns(result.columns);
      setFailed(false);
    } else setFailed(true);
  }, [eventId, slotId]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const after = (result: SlotVendorState, retry?: { candidateId: string; replace: boolean }) => {
    if (result.ok) {
      setError(null);
      setConfirm(null);
      setChanging(false);
      setRefreshing(true);
      void load().finally(() => setRefreshing(false));
      router.refresh();
      return;
    }
    if ("confirm" in result && retry) setConfirm({ ...retry, message: result.confirm });
    else if ("error" in result) setError(result.error);
  };
  const retain = (candidateId: string, replace: boolean, confirmed = false) => startTransition(async () => after(await retainSlotCandidateAction({ eventId, slotId, candidateId, replace, confirmed }), { candidateId, replace }));
  const release = () => startTransition(async () => after(await releaseSlotRetainedAction({ eventId, slotId })));
  const setDismissed = (candidateId: string, dismissed: boolean) => startTransition(async () => after(await setSlotCandidateDismissedAction({ eventId, slotId, candidateId, dismissed })));

  const active = (columns ?? []).filter((column) => !column.dismissed);
  const retained = (columns ?? []).filter((column) => column.retained);
  const money = (cents: number) => formatAmount(cents, locale);
  const availability = (column: SlotComparisonColumn) => (column.availability === "available" ? t("availabilityYes") : column.availability === "unavailable" ? t("availabilityNo") : t("availabilityUnknown"));

  return (
    <div className="stack">
      <div className="section-head">
        <h3 id={captionId}>{columns ? t("comparisonTitle", { count: active.length }) : t("tabVendors")}</h3>
        {addVendor}
      </div>
      {!columns && !failed ? <p className="meta">{t("comparisonLoading")}</p> : null}
      {failed ? (
        <p role="alert" className="notice notice-error">
          {t("comparisonError")}
        </p>
      ) : null}
      {columns && columns.length === 0 ? <p className="meta">{t("comparisonEmpty")}</p> : null}
      {changing && retained[0] ? <p className="notice">{t("changeHint", { name: retained[0].vendorName })}</p> : null}
      {columns && columns.length > 0 ? (
        <div className="list-table-wrap" role="region" aria-labelledby={captionId} tabIndex={0}>
          <table className="slot-comparison">
            <caption className="sr-only">{t("comparisonCaption", { slot: slotLabel })}</caption>
            <thead>
              <tr>
                <td />
                {columns.map((column) => (
                  <th key={column.candidateId} scope="col" className={column.dismissed ? "is-dismissed" : column.retained ? "is-retained" : undefined}>
                    {column.vendorName}
                    {column.retained ? <span className="badge badge-sauge">{t("retainedBadge")}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t("rowStatus")}</th>
                {columns.map((column) => (
                  <td key={column.candidateId} className={column.dismissed ? "is-dismissed" : undefined}>
                    {tStatus(`status.${column.status}`)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t("rowQuote")}</th>
                {columns.map((column) => (
                  <td key={column.candidateId} className={column.dismissed ? "is-dismissed" : undefined}>
                    {column.quoteAmountCents !== null ? money(column.quoteAmountCents) : "—"}
                    {column.hasQuoteFile ? (
                      <>
                        {" · "}
                        <a href={`/events/${eventId}/consultes/${column.candidateId}/devis`} target="_blank" rel="noopener noreferrer">
                          {t("quotePdf")}
                          <span className="sr-only"> — {t("quotePdfOf", { name: column.vendorName })}</span>
                        </a>
                      </>
                    ) : null}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t("rowAvailability")}</th>
                {columns.map((column) => (
                  <td key={column.candidateId} className={column.dismissed ? "is-dismissed" : undefined}>
                    {availability(column)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t("rowWorkedWith")}</th>
                {columns.map((column) => (
                  <td key={column.candidateId} className={column.dismissed ? "is-dismissed" : undefined}>
                    {t("workedWithEvents", { count: column.workedWithCount })}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t("rowReminded")}</th>
                {columns.map((column) => (
                  <td key={column.candidateId} className={column.dismissed ? "is-dismissed" : undefined}>
                    {column.remindedOn ? [formatCalendarDate(column.remindedOn, locale), column.remindedBy ? tReminder(`channels.${column.remindedBy}`) : null].filter(Boolean).join(" · ") : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t("rowNote")}</th>
                {columns.map((column) => (
                  <td key={column.candidateId} className={column.dismissed ? "is-dismissed slot-comparison-note" : "slot-comparison-note"}>
                    {column.note ?? "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">
                  <span className="sr-only">{t("rowActions")}</span>
                </th>
                {columns.map((column) => (
                  <td key={column.candidateId} className="slot-comparison-actions">
                    {column.retained ? (
                      <>
                        {changing ? (
                          <button type="button" className="button-secondary" disabled={pending} onClick={() => setChanging(false)}>
                            {t("cancelChange")}
                          </button>
                        ) : (
                          <button type="button" className="button-secondary" disabled={pending || columns.length < 2} onClick={() => setChanging(true)}>
                            {t("change")}
                            <span className="sr-only"> — {t("actionFor", { name: column.vendorName })}</span>
                          </button>
                        )}
                        <button type="button" className="button-ghost" disabled={pending} onClick={release} title={t("releaseHint")}>
                          {t("release")}
                          <span className="sr-only"> — {t("actionFor", { name: column.vendorName })}</span>
                        </button>
                      </>
                    ) : retained.length > 0 ? (
                      changing ? (
                        <button type="button" className="button-primary" disabled={pending} onClick={() => retain(column.candidateId, true)}>
                          {t("retainInstead")}
                          <span className="sr-only"> — {t("actionFor", { name: column.vendorName })}</span>
                        </button>
                      ) : null
                    ) : column.dismissed ? (
                      <button type="button" className="button-ghost" disabled={pending} onClick={() => setDismissed(column.candidateId, false)}>
                        {t("restore")}
                        <span className="sr-only"> — {t("actionFor", { name: column.vendorName })}</span>
                      </button>
                    ) : (
                      <>
                        <button type="button" className="button-primary" disabled={pending} onClick={() => retain(column.candidateId, false)}>
                          {t("retain")}
                          <span className="sr-only"> — {t("actionFor", { name: column.vendorName })}</span>
                        </button>
                        <button type="button" className="button-ghost" disabled={pending} onClick={() => setDismissed(column.candidateId, true)}>
                          {t("dismiss")}
                          <span className="sr-only"> — {t("actionFor", { name: column.vendorName })}</span>
                        </button>
                      </>
                    )}
                    {/* Lot 65d (M16) : la relance d'un prestataire encore en lice ou retenu se note. */}
                    {!column.dismissed ? <NoteReminderButton eventId={eventId} candidateId={column.candidateId} vendorName={column.vendorName} className="button-ghost" /> : null}
                    {confirm?.candidateId === column.candidateId ? (
                      <div className="notice notice-attention">
                        <p role="alert">{confirm.message}</p>
                        <button type="button" className="button-primary" disabled={pending} onClick={() => retain(column.candidateId, confirm.replace, true)}>
                          {t("confirmRetain")}
                        </button>
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="notice notice-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
