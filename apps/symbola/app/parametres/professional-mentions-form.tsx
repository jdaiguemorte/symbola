"use client";

// Lot 31a (JUR-09, décision D4) — informations du professionnel reprises sur les devis :
// assurance de responsabilité civile professionnelle, médiateur de la consommation,
// conditions générales de vente. Leur absence bloque l'envoi d'un devis quand la liste des
// mentions requises les demande.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { SellerDetails } from "@/modules/hub/service";
import { saveProfessionalMentionsAction, type ProfessionalMentionsFormState } from "./actions";

export function ProfessionalMentionsForm({ details }: { details: SellerDetails }) {
  const t = useTranslations("Settings");
  const [state, action, pending] = useActionState<ProfessionalMentionsFormState, FormData>(saveProfessionalMentionsAction, {});
  return (
    <form action={action} aria-label={t("professionalMentionsTitle")}>
      <label>
        {t("insurer")}
        <input type="text" name="insurer" maxLength={120} defaultValue={details.insurer ?? ""} />
      </label>
      <label>
        {t("insurancePolicy")}
        <input type="text" name="insurancePolicy" maxLength={80} defaultValue={details.insurancePolicy ?? ""} />
      </label>
      <label>
        {t("insuranceCoverage")}
        <input type="text" name="insuranceCoverage" maxLength={200} defaultValue={details.insuranceCoverage ?? ""} />
      </label>
      <label>
        {t("mediatorName")}
        <input type="text" name="mediatorName" maxLength={160} defaultValue={details.mediatorName ?? ""} />
      </label>
      <label>
        {t("mediatorUrl")}
        <input type="text" name="mediatorUrl" inputMode="url" maxLength={300} defaultValue={details.mediatorUrl ?? ""} />
      </label>
      <label>
        {t("generalTerms")}
        <textarea name="generalTerms" rows={8} maxLength={20000} defaultValue={details.generalTerms ?? ""} />
      </label>
      <p className="meta">{t("generalTermsHint")}</p>
      <button type="submit" disabled={pending}>
        {t("professionalMentionsSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("professionalMentionsSaved")}</p> : null}
    </form>
  );
}
