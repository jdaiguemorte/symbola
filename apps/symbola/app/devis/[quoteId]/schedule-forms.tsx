"use client";

import { useLocale, useTranslations } from "next-intl";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import type { PaymentMethod, ScheduleItemView } from "@/modules/quotes/service";
import { formatDecimal } from "../decimal-input";
import { QuoteActionForm } from "./quote-forms";
import { addScheduleItemAction, markPaidAction, markUnpaidAction, updateScheduleItemAction } from "./schedule-actions";

// Champs communs à l'ajout et à la modification d'une échéance.
function ScheduleFields({ idSuffix, item }: { idSuffix: string; item?: ScheduleItemView }) {
  const t = useTranslations("Quotes");
  const locale = useLocale() as "fr" | "en";
  const id = (name: string) => `${name}-${idSuffix}`;
  const kind = item?.percentageBasisPoints !== null && item?.percentageBasisPoints !== undefined ? "percent" : "amount";
  const value = item
    ? formatDecimal(kind === "percent" ? item.percentageBasisPoints! : item.fixedAmountCents!, 2, locale)
    : "";
  return (
    <>
      <label htmlFor={id("label")}>
        {t("scheduleLabel")}
        <input id={id("label")} type="text" name="label" required defaultValue={item?.label ?? ""} />
      </label>
      <label htmlFor={id("dueDate")} className="field-fit">
        {t("scheduleDueDate")}
        <input id={id("dueDate")} type="date" name="dueDate" required defaultValue={item?.dueDate ?? ""} className="field-date" />
      </label>
      <label htmlFor={id("kind")} className="field-fit">
        {t("scheduleKind")}
        <select id={id("kind")} name="kind" defaultValue={kind}>
          <option value="amount">{t("scheduleKindAmount")}</option>
          <option value="percent">{t("scheduleKindPercent")}</option>
        </select>
      </label>
      <label htmlFor={id("value")} className="field-fit">
        {t("scheduleValue")}
        <input id={id("value")} type="text" inputMode="decimal" name="value" required defaultValue={value} className="field-amount" />
      </label>
    </>
  );
}

export function AddScheduleItemForm({ quoteId }: { quoteId: string }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={addScheduleItemAction}
      quoteId={quoteId}
      label={t("addScheduleItem")}
      submitLabel={t("addScheduleItem")}
      successMessage={t("scheduleItemAdded")}
      layout="row"
    >
      <ScheduleFields idSuffix="new" />
    </QuoteActionForm>
  );
}

export function EditScheduleItemForm({ quoteId, item }: { quoteId: string; item: ScheduleItemView }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={updateScheduleItemAction}
      quoteId={quoteId}
      label={t("editScheduleItemNamed", { label: item.label })}
      submitLabel={t("saveScheduleItem")}
      successMessage={t("scheduleItemSaved")}
      layout="row"
    >
      <input type="hidden" name="scheduleItemId" value={item.id} />
      <ScheduleFields idSuffix={item.id} item={item} />
    </QuoteActionForm>
  );
}

export function MarkPaidForm({
  quoteId,
  item,
  methods,
  today,
}: {
  quoteId: string;
  item: ScheduleItemView;
  methods: PaymentMethod[];
  today: string;
}) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={markPaidAction}
      quoteId={quoteId}
      label={t("markPaidNamed", { label: item.label })}
      submitLabel={t("markPaid")}
      successMessage={t("markedPaid")}
      layout="row"
    >
      <input type="hidden" name="scheduleItemId" value={item.id} />
      <label htmlFor={`paidOn-${item.id}`} className="field-fit">
        {t("paidOn")}
        <input id={`paidOn-${item.id}`} type="date" name="paidOn" required max={today} defaultValue={today} className="field-date" />
      </label>
      <label htmlFor={`method-${item.id}`}>
        {t("paymentMethod")}
        <select id={`method-${item.id}`} name="paymentMethodId" required defaultValue="">
          <option value="" disabled>
            {t("choosePaymentMethod")}
          </option>
          {methods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.label}
            </option>
          ))}
        </select>
      </label>
    </QuoteActionForm>
  );
}

export function MarkUnpaidForm({ quoteId, item }: { quoteId: string; item: ScheduleItemView }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={markUnpaidAction}
      quoteId={quoteId}
      label={t("markUnpaidNamed", { label: item.label })}
      submitLabel={t("markUnpaid")}
      successMessage={t("markedUnpaid")}
      danger
    >
      <input type="hidden" name="scheduleItemId" value={item.id} />
      {/* Lot 23b (D2) : motif obligatoire, gardé avec l'écriture inverse. */}
      <label htmlFor={`reason-${item.id}`} className="field-wide">
        {t("reversalReason")}
        <input id={`reason-${item.id}`} type="text" name="reason" required maxLength={300} />
      </label>
      <FreeTextNotice />
    </QuoteActionForm>
  );
}
