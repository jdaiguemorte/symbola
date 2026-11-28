"use client";

// La langue de l'interface, pour la personne connectée.
// Lot 74h (D7, G8 ; page 30) : réglage isolé, enregistré au changement de la liste, « ✓ Enregistré » à côté ;
// plus de bouton « Enregistrer ».
import { useTranslations } from "next-intl";
import { AutoSettingForm, SettingStatus } from "@/app/ui/auto-setting-form";
import type { SavedLabels } from "@/app/ui/saved-indicator";
import { setLanguageAction } from "./actions";

export function LanguageForm({ currentLanguage, saved }: { currentLanguage: "fr" | "en"; saved: SavedLabels }) {
  const t = useTranslations("Profile");
  return (
    <AutoSettingForm action={setLanguageAction} labels={saved} className="setting-line-control">
      <label>
        {t("language")}
        <select name="language" defaultValue={currentLanguage}>
          <option value="fr">{t("languageFr")}</option>
          <option value="en">{t("languageEn")}</option>
        </select>
      </label>
      <SettingStatus name="language" />
    </AutoSettingForm>
  );
}
