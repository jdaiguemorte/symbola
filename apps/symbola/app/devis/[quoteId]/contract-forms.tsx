"use client";

// Lot 31b (FAC-04, DOC-02, JUR-07, JUR-20 ; D7, D11 à D13, partie N) — génération du contrat :
// canal de conclusion (obligatoire, sans valeur proposée), petite entreprise, clauses
// facultatives, avertissement « base à adapter » ; chaque problème qui empêche la génération est
// nommé. Signature du contrat seul.
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import type { ContractProblem, ContractTemplateClause } from "@/modules/quotes/service";
import { generateContractAction, sendContractAloneAction, type ContractFormState } from "./contract-actions";

const CHANNELS = ["on_premises", "distance", "off_premises", "fair"] as const;

export function ContractProblems({ problems }: { problems: ContractProblem[] }) {
  const t = useTranslations("Contracts");
  const locale = useLocale() as Locale;
  const message = (problem: ContractProblem): string => {
    switch (problem.kind) {
      case "variable_missing":
        return t("problem_variable_missing", { variable: t(`variable_${problem.variable.replace(".", "_")}`) });
      case "variable_unknown":
        return t("problem_variable_unknown", { variable: `{${problem.variable}}` });
      case "clause_unwritten":
        return t("problem_clause_unwritten", { clause: problem.clause });
      case "role_missing":
        return t("problem_role_missing", { role: t(`role_${problem.role}`) });
      case "advance_missing":
        return t("problem_advance_missing", { kind: t(`advance_${problem.advanceKind}`) });
      case "advance_mismatch":
        return t("problem_advance_mismatch", { kind: problem.advanceKind ? t(`advance_${problem.advanceKind}`) : t("advance_none") });
      case "payment_too_soon":
        return t("problem_payment_too_soon", { date: formatCalendarDate(problem.firstAllowed, locale) });
      default:
        return t(`problem_${problem.kind}`);
    }
  };
  return (
    <ul className="missing-mentions">
      {problems.map((problem, index) => (
        <li key={`${problem.kind}-${index}`}>{message(problem)}</li>
      ))}
    </ul>
  );
}

export function GenerateContractForm({
  quoteId,
  templateId,
  optionalClauses,
  warning,
  warningAccepted,
  showSmallBusiness,
}: {
  quoteId: string;
  templateId: string;
  optionalClauses: ContractTemplateClause[];
  warning: string;
  warningAccepted: boolean;
  showSmallBusiness: boolean;
}) {
  const t = useTranslations("Contracts");
  const [state, action, pending] = useActionState(generateContractAction, {} as ContractFormState);
  return (
    <form action={action} aria-label={t("generateContract")}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="templateId" value={templateId} />
      <fieldset>
        <legend>{t("channelLegend")}</legend>
        <p className="meta">{t("channelHint")}</p>
        {CHANNELS.map((channel) => (
          <label key={channel}>
            <input type="radio" name="channel" value={channel} required defaultChecked={state.values?.channel === channel} /> {t(`channel_${channel}`)}
          </label>
        ))}
      </fieldset>
      {showSmallBusiness ? (
        <label>
          <input type="checkbox" name="smallBusiness" defaultChecked={state.values?.smallBusiness ?? false} /> {t("smallBusiness")}
        </label>
      ) : null}
      {optionalClauses.length > 0 ? (
        <fieldset>
          <legend>{t("optionalClausesLegend")}</legend>
          {optionalClauses.map((clause) => (
            <label key={clause.id}>
              <input type="checkbox" name="clause" value={clause.id} defaultChecked={state.values?.clauseIds.includes(clause.id) ?? false} /> {clause.title}
              {clause.role && t(`role_${clause.role}`) !== clause.title ? ` — ${t(`role_${clause.role}`)}` : ""}
            </label>
          ))}
        </fieldset>
      ) : null}
      {warningAccepted ? (
        <p className="meta">{t("warningAlreadyAccepted")}</p>
      ) : (
        <label>
          <input type="checkbox" name="acceptWarning" required defaultChecked={state.values?.acceptWarning ?? false} /> {t("acceptWarning", { warning })}
        </label>
      )}
      <button type="submit" disabled={pending}>
        {t("generateContract")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.problems && state.problems.length > 0 ? <ContractProblems problems={state.problems} /> : null}
      {state.success ? <p role="status">{t("contractGenerated")}</p> : null}
    </form>
  );
}

export function SendContractAloneForm({ quoteId, contractId }: { quoteId: string; contractId: string }) {
  const t = useTranslations("Contracts");
  const [state, action, pending] = useActionState(sendContractAloneAction, {} as ContractFormState);
  return (
    <form action={action} aria-label={t("sendContractAlone")}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="contractId" value={contractId} />
      <p className="meta">{t("sendContractAloneHint")}</p>
      <button type="submit" disabled={pending}>
        {t("sendContractAlone")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("contractSentAlone")}</p> : null}
    </form>
  );
}
