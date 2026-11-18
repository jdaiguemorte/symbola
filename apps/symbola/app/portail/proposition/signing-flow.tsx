// Lot 43 (GC-01, SEC-16, JUR-07 ; D4 ; ADR 0087, ADR 0089) — « Accepter et signer », en un
// enchaînement sur téléphone : les options, le code reçu par e-mail (dix minutes), la commande et
// l'information selon le canal (règles du lot 31b, inchangées), la signature (Documenso), puis
// « Régler l'acompte ». Chaque étape montre son état ; l'aperçu de la planner n'agit pas.
import { getTranslations } from "next-intl/server";
import type { ProposalView, SigningFlowView } from "@symbola/contracts";
import { Stepper, type StepperStep } from "@/app/ui/stepper";
import { EarlyExecutionForm, OrderContractForm } from "../client-contract-forms";
import { SigningCodeForm } from "./signing-code-form";

const ORDER = ["options", "code", "order", "sign", "settle"] as const;

function position(step: SigningFlowView["step"]): number {
  if (step === "waiting_document") return 1;
  if (step === "done" || step === "settle") return 4;
  const index = (ORDER as readonly string[]).indexOf(step);
  return index < 0 ? 0 : index;
}

export async function SigningFlow({ flow, proposal, preview }: { flow: SigningFlowView; proposal: ProposalView; preview: boolean }) {
  const t = await getTranslations("Proposal.flow");
  const current = position(flow.step);
  const keys = ORDER.filter((key) => key !== "order" || flow.orderRequired);
  const steps: StepperStep[] = keys.map((key) => {
    const index = ORDER.indexOf(key);
    const done = flow.ownSigned ? key !== "settle" || flow.step === "done" : index < current;
    return { key, label: t(`steps.${key}`), state: done ? "done" : index === current ? "current" : "todo", href: null, summary: null };
  });
  return (
    <section id="signer" aria-labelledby="signing-flow-title" className="signing-flow card">
      <h2 id="signing-flow-title">{t("title")}</h2>
      <Stepper steps={steps} label={t("stepsLabel")} stateLabels={{ done: t("stateDone"), current: t("stateCurrent") }} />
      {flow.step === "options" ? (
        <p>
          {t("optionsFirst")} <a href="#options">{t("goOptions")}</a>
        </p>
      ) : null}
      {flow.step === "waiting_document" ? <p role="status">{t("waitingDocument", { organization: proposal.organization.name })}</p> : null}
      {flow.step === "expired" ? <p role="status">{t("expired", { organization: proposal.organization.name })}</p> : null}
      {flow.step === "declined" ? <p role="status">{t("declined")}</p> : null}
      {flow.step === "not_signer" ? <p role="status">{t("notSigner")}</p> : null}
      {flow.step === "code" ? <SigningCodeForm quoteId={proposal.quoteId} preview={preview} /> : null}
      {flow.step === "order" && flow.contractId ? (
        <>
          <p>{flow.withdrawalApplies ? t("orderWithdrawal") : t("orderHint")}</p>
          <OrderContractForm contractId={flow.contractId} preview={preview} />
        </>
      ) : null}
      {(flow.step === "order" || flow.step === "sign") && flow.contractId && flow.earlyExecutionText && !flow.earlyExecutionRequested ? (
        <EarlyExecutionForm contractId={flow.contractId} text={flow.earlyExecutionText} preview={preview} />
      ) : null}
      {flow.step === "sign" ? (
        <>
          <p>{t("signHint")}</p>
          <p>
            {flow.signingUrl && !preview ? (
              <a className="button-link button-link-primary" href={flow.signingUrl} rel="noreferrer">
                {t("signButton", { number: proposal.number })}
              </a>
            ) : (
              <span>{t("signButton", { number: proposal.number })}</span>
            )}
          </p>
        </>
      ) : null}
      {flow.step === "settle" ? (
        <>
          <p role="status">{flow.allSigned ? t("signedAll") : t("signedWaiting", { names: flow.waitingFor.join(", ") })}</p>
          {flow.settleScheduleItemId ? (
            <p>
              {preview ? (
                <span>{t("settleButton")}</span>
              ) : (
                <a className="button-link button-link-primary" href={`/portail/reglement/${flow.settleScheduleItemId}`}>
                  {t("settleButton")}
                </a>
              )}
            </p>
          ) : null}
        </>
      ) : null}
      {flow.step === "done" ? <p role="status">{t("done")}</p> : null}
    </section>
  );
}
