"use client";

// Lot 63c (BUD-01, BUD-03, BUD-04 ; Q42 bis, ADR 0107, maquette M12) — modifier une ligne de
// « Budget et prestataires » dans la grande fenêtre : à gauche le prestataire, le prévu, le réel,
// l'engagé et les pièces ; à droite l'échéancier. « Enregistrer, ligne suivante » enchaîne sur le poste
// suivant, sans y obliger. Le <dialog> natif, en modal : fond assombri, focus piégé, Échap ferme ;
// sur téléphone, il prend tout l'écran avec « Retour » (CSS).
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatAmount, formatAmountInput, type Locale } from "@symbola/i18n";
import { saveBudgetLinesAction, updateBudgetLineAction } from "@/app/budget/[eventId]/actions";
import { Documents, Payments } from "@/app/budget/[eventId]/budget-lines-table";
import { formatDecimal } from "@/app/devis/decimal-input";
import { signedAmount, type BudgetVendorRow } from "./budget-vendor-rows";

type Draft = { vendorCandidateId: string; estimated: string; quoted: string; committed: string };

export function BudgetLineDialog({
  eventId,
  row,
  index,
  count,
  nextLabel,
  vendors,
  locale,
  onClose,
  onMove,
}: {
  eventId: string;
  row: BudgetVendorRow;
  index: number;
  count: number;
  nextLabel: string | null;
  // Les prestataires rattachés au poste (hors écartés), pour le choix de la ligne.
  vendors: { id: string; name: string }[];
  locale: Locale;
  onClose: () => void;
  onMove: (step: -1 | 1) => void;
}) {
  const t = useTranslations("BudgetVendors");
  const tBudget = useTranslations("Budget");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const initial = (line: BudgetVendorRow["lines"][number] | null): Draft => ({
    vendorCandidateId: line?.vendorCandidateId ?? "",
    estimated: formatAmountInput(line?.estimatedAmountCents ?? null, locale),
    quoted: formatAmountInput(line?.quotedAmountCents ?? null, locale),
    committed: formatAmountInput(line?.committedAmountCents ?? null, locale),
  });
  // Un poste sans ligne de budget en reçoit une au premier montant saisi.
  const lines = row.lines.length > 0 ? row.lines : [null];
  const [drafts, setDrafts] = useState<Draft[]>(() => lines.map(initial));

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  const changed = (at: number) => {
    const before = initial(lines[at] ?? null);
    const after = drafts[at]!;
    return before.vendorCandidateId !== after.vendorCandidateId || before.estimated.trim() !== after.estimated.trim() || before.quoted.trim() !== after.quoted.trim() || before.committed.trim() !== after.committed.trim();
  };

  const save = (then: "close" | "next") =>
    startTransition(async () => {
      setError(null);
      const existing = row.lines.flatMap((line, at) => (changed(at) ? [{ line, draft: drafts[at]! }] : []));
      if (existing.length > 0) {
        const result = await saveBudgetLinesAction({
          eventId,
          lines: existing.map(({ line, draft }) => {
            const before = initial(line);
            const amounts: Record<string, string> = {};
            if (draft.estimated.trim() !== before.estimated.trim()) amounts.estimated = draft.estimated;
            if (draft.quoted.trim() !== before.quoted.trim()) amounts.quoted = draft.quoted;
            if (draft.committed.trim() !== before.committed.trim()) amounts.committed = draft.committed;
            return { lineId: line.id, label: line.label, vendorCandidateId: draft.vendorCandidateId === "" ? null : draft.vendorCandidateId, vatRate: formatDecimal(line.vatRateBasisPoints, 2, locale), amounts };
          }),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
      if (row.lines.length === 0 && changed(0)) {
        const data = new FormData();
        data.set("eventId", eventId);
        data.set("eventVendorSlotId", row.slotId);
        data.set("amount_estimated", drafts[0]!.estimated);
        data.set("amount_quoted", drafts[0]!.quoted);
        data.set("amount_committed", drafts[0]!.committed);
        const result = await updateBudgetLineAction({}, data);
        if (result.error) {
          setError(result.error);
          return;
        }
      }
      setSaved(true);
      router.refresh();
      if (then === "close") onClose();
      else onMove(1);
    });

  const set = (at: number, field: keyof Draft, value: string) => {
    setSaved(false);
    setDrafts(drafts.map((draft, other) => (other === at ? { ...draft, [field]: value } : draft)));
  };

  return (
    <dialog
      ref={dialog}
      className="window window-long"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="window-head">
        <button type="button" className="button-ghost window-back" onClick={onClose}>
          ‹ {t("windowBack")}
        </button>
        <h2 id={titleId}>
          {t("windowTitle", { slot: row.label, index: index + 1, count })}
          {row.engaged ? <span className="badge badge-sauge">{t("engaged")}</span> : null}
        </h2>
        <button type="button" className="button-ghost window-close" onClick={onClose}>
          {t("windowClose")}
        </button>
      </div>
      <div className="window-body">
        <section aria-labelledby={`${titleId}-amounts`} className="stack">
          <h3 id={`${titleId}-amounts`}>{t("windowAmounts")}</h3>
          {lines.map((line, at) => {
            const draft = drafts[at]!;
            const of = line && row.lines.length > 1 ? <span className="sr-only"> — {line.label}</span> : null;
            return (
              <fieldset key={line?.id ?? "nouvelle"} className="stack budget-window-line">
                {row.lines.length > 1 && line ? <legend>{line.label}</legend> : <legend className="sr-only">{row.label}</legend>}
                {vendors.length > 0 && line ? (
                  <label>
                    <span>
                      {tBudget("lineVendor")}
                      {of}
                    </span>
                    <select value={draft.vendorCandidateId} onChange={(event) => set(at, "vendorCandidateId", event.target.value)}>
                      <option value="">{tBudget("noVendor")}</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="field-row">
                  {(["estimated", "quoted", "committed"] as const).map((field) => (
                    <label key={field} className="field-fit">
                      <span>
                        {t(`amount.${field}`)}
                        {of}
                      </span>
                      <input type="text" inputMode="decimal" className="field-amount" value={draft[field]} onChange={(event) => set(at, field, event.target.value)} />
                    </label>
                  ))}
                </div>
                <p className="meta">{t("committedHint")}</p>
              </fieldset>
            );
          })}
          {row.varianceCents !== null ? (
            <p className={row.varianceCents > 0 ? "text-overdue" : row.varianceCents < 0 ? "text-paid" : undefined}>
              {t(row.varianceCents > 0 ? "varianceOver" : row.varianceCents < 0 ? "varianceUnder" : "varianceEqual", { amount: signedAmount(row.varianceCents, (cents) => formatAmount(cents, locale)) })}
            </p>
          ) : null}
          {row.lines.map((line) => (
            <section key={`docs-${line.id}`} aria-label={tBudget("documentsOf", { label: line.label })} className="stack">
              <h3>{tBudget("documentsTitle")}</h3>
              <Documents eventId={eventId} line={line} locale={locale} />
            </section>
          ))}
        </section>
        <section aria-labelledby={`${titleId}-schedule`} className="stack">
          <h3 id={`${titleId}-schedule`}>{t("windowSchedule")}</h3>
          {row.lines.length === 0 ? <p className="meta">{t("scheduleNeedsLine")}</p> : null}
          {row.lines.map((line) => (
            <Payments key={`pay-${line.id}`} eventId={eventId} line={line} locale={locale} />
          ))}
        </section>
      </div>
      {error ? (
        <p role="alert" className="notice notice-error">
          {error}
        </p>
      ) : null}
      {saved ? <p role="status">{t("windowSaved")}</p> : null}
      <div className="window-actions">
        <button type="button" className="button-ghost" disabled={index === 0 || pending} onClick={() => onMove(-1)}>
          ‹ {t("previousLine")}
        </button>
        <button type="button" className="button-secondary" disabled={pending} onClick={() => save("close")}>
          {t("saveAndClose")}
        </button>
        {nextLabel ? (
          <button type="button" className="button-primary" disabled={pending} onClick={() => save("next")}>
            {t("saveAndNext", { next: nextLabel })} ›
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
