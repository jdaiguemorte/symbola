"use client";

// Lot 43 (FAC-02, FAC-15, FAC-09 ; D1, D2, D7) — formulaires de la proposition sur la fiche du devis.
import { useTranslations } from "next-intl";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { QuoteActionForm } from "./quote-forms";
import { extendValidityAction, notifyProposalAction, resumeRemindersAction, setGreetingAction, suspendRemindersAction } from "./proposal-actions";

export function GreetingForm({ quoteId, greeting, templateGreeting }: { quoteId: string; greeting: string | null; templateGreeting: string }) {
  const t = useTranslations("QuoteProposal");
  const inputId = `proposal-greeting-${quoteId}`;
  return (
    <QuoteActionForm action={setGreetingAction} quoteId={quoteId} label={t("greetingForm")} submitLabel={t("greetingSave")} successMessage={t("greetingSaved")} draftKey={`proposal-greeting-${quoteId}`}>
      <label htmlFor={inputId}>{t("greetingLabel")}</label>
      <textarea id={inputId} name="greeting" rows={5} maxLength={4000} defaultValue={greeting ?? ""} placeholder={templateGreeting} aria-describedby={`${inputId}-hint`} />
      <FreeTextNotice />
      <p id={`${inputId}-hint`} className="meta">
        {t("greetingHint")}
      </p>
    </QuoteActionForm>
  );
}

export function NotifyProposalForm({ quoteId }: { quoteId: string }) {
  const t = useTranslations("QuoteProposal");
  return <QuoteActionForm action={notifyProposalAction} quoteId={quoteId} label={t("notifyForm")} submitLabel={t("notifySubmit")} successMessage={t("notified")} />;
}

export function ExtendValidityForm({ quoteId, current, today }: { quoteId: string; current: string | null; today: string }) {
  const t = useTranslations("QuoteProposal");
  const inputId = `proposal-valid-until-${quoteId}`;
  return (
    <QuoteActionForm action={extendValidityAction} quoteId={quoteId} label={t("extendForm")} submitLabel={t("extendSubmit")} successMessage={t("extended")}>
      <label htmlFor={inputId}>{t("extendLabel")}</label>
      <input id={inputId} type="date" name="validUntil" min={today} defaultValue={current && current >= today ? current : today} required />
    </QuoteActionForm>
  );
}

export function SuspendRemindersForm({ quoteId, scheduleItemId, label }: { quoteId: string; scheduleItemId: string; label: string }) {
  const t = useTranslations("QuoteProposal");
  const inputId = `suspend-reason-${scheduleItemId}`;
  return (
    <QuoteActionForm action={suspendRemindersAction} quoteId={quoteId} label={t("suspendForm", { label })} submitLabel={t("suspendSubmit")} successMessage={t("suspended")}>
      <input type="hidden" name="scheduleItemId" value={scheduleItemId} />
      <label htmlFor={inputId}>{t("suspendReason")}</label>
      <input id={inputId} type="text" name="reason" maxLength={500} required />
      <FreeTextNotice />
    </QuoteActionForm>
  );
}

export function ResumeRemindersForm({ quoteId, scheduleItemId, label }: { quoteId: string; scheduleItemId: string; label: string }) {
  const t = useTranslations("QuoteProposal");
  return (
    <QuoteActionForm action={resumeRemindersAction} quoteId={quoteId} label={t("resumeForm", { label })} submitLabel={t("resumeSubmit")} successMessage={t("resumed")}>
      <input type="hidden" name="scheduleItemId" value={scheduleItemId} />
    </QuoteActionForm>
  );
}
