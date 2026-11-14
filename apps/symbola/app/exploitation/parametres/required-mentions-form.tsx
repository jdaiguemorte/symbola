"use client";

// Lot 31a (FAC-07, JUR-01, décision D4) — l'Admin choisit, pour chaque mention, les documents
// où elle est exigée avant l'émission ; les conditions de la liste en vigueur sont rappelées.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { RequiredMentionRule } from "@symbola/starter-templates";
import { saveRequiredMentionsAction, type RequiredMentionsFormState } from "./actions";

const FIELDS = ["organizationName", "address", "siren", "registration", "shareCapital", "vatNumber", "insurance", "mediator", "generalTerms", "paymentTerms", "professionalPaymentTerms", "latePenaltyRate"] as const;
const DOCUMENTS = ["quote", "deposit_invoice", "balance_invoice", "credit_note"] as const;

export function RequiredMentionsForm({ rules }: { rules: RequiredMentionRule[] }) {
  const t = useTranslations("AdminSettings");
  const [state, action, pending] = useActionState(saveRequiredMentionsAction, {} as RequiredMentionsFormState);
  return (
    <form action={action} aria-label={t("requiredMentionsTitle")}>
      <div role="region" aria-label={t("requiredMentionsTitle")} tabIndex={0}>
        <table>
          <caption>{t("requiredMentionsCaption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("requiredMentionsField")}</th>
              {DOCUMENTS.map((document) => (
                <th key={document} scope="col">
                  {t(`requiredMentionsDocument.${document}`)}
                </th>
              ))}
              <th scope="col">{t("requiredMentionsConditions")}</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((field) => {
              const rule = rules.find((candidate) => candidate.field === field);
              const conditions = [
                rule?.vatRegimes ? t("requiredMentionsVatRegimes", { list: rule.vatRegimes.join(", ") }) : null,
                rule?.clientKinds ? t("requiredMentionsClientKinds", { list: rule.clientKinds.join(", ") }) : null,
                rule?.legalForms ? t("requiredMentionsLegalForms", { list: rule.legalForms.join(", ") }) : null,
              ].filter(Boolean);
              return (
                <tr key={field}>
                  <th scope="row">{t(`requiredMentionsFieldName.${field}`)}</th>
                  {DOCUMENTS.map((document) => (
                    <td key={document}>
                      <label>
                        <input type="checkbox" name={`${field}:${document}`} defaultChecked={rule?.documents.includes(document) ?? false} />
                        <span className="sr-only">{t("requiredMentionsCheckbox", { field: t(`requiredMentionsFieldName.${field}`), document: t(`requiredMentionsDocument.${document}`) })}</span>
                      </label>
                    </td>
                  ))}
                  <td>{conditions.length > 0 ? conditions.join(" ; ") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="submit" disabled={pending}>
        {t("requiredMentionsSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("requiredMentionsSaved")}</p> : null}
    </form>
  );
}
