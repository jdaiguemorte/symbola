"use client";

// Lot 31a (JUR-09, décision D4) — informations du professionnel reprises sur les devis :
// assurance de responsabilité civile professionnelle, médiateur de la consommation,
// conditions générales de vente. Leur absence bloque l'envoi d'un devis quand la liste des
// mentions requises les demande.
// Lot 62b (UX-12) : formulaire en grille, bouton secondaire.
// Lot 74h (D7, G8 ; page 30) : formulaire à champs liés, enregistré par sa barre collée en bas
// (SettingsSaveBar), qui nomme les champs modifiés.
import { useActionState, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SettingsSaveBar } from "@/app/ui/settings-save-bar";
import type { SaveBarLabels } from "@/lib/settings/settings-header-texts";
import type { SellerDetails } from "@/modules/hub/service";
import { saveProfessionalMentionsAction, type ProfessionalMentionsFormState } from "./actions";

export function ProfessionalMentionsForm({ details, pattern }: { details: SellerDetails; pattern: { bar: SaveBarLabels; fieldLabels: Record<string, string> } }) {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ProfessionalMentionsFormState, FormData>(saveProfessionalMentionsAction, {});
  const termsHint = useId();
  return (
    <form action={action} aria-label={t("professionalMentionsTitle")}>
      <div className="form-grid form-grid-3">
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
      <div className="field-group span-all">
        <label>
          {t("generalTerms")}
          <textarea name="generalTerms" rows={5} maxLength={20000} aria-describedby={termsHint} defaultValue={details.generalTerms ?? ""} />
        </label>
        <p id={termsHint} className="field-hint">
          {t("generalTermsHint")}
        </p>
      </div>
      </div>
      <SettingsSaveBar
        formKey="professional-mentions"
        fieldLabels={pattern.fieldLabels}
        labels={pattern.bar}
        submitLabel={t("professionalMentionsSave")}
        pending={pending}
        submission={state}
        saved={state.success === true}
        error={state.error}
        locale={locale}
      />
    </form>
  );
}
