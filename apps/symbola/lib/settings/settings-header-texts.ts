// Lot 74h (D7, P-22) — la ligne de portée de l'en-tête d'un écran de réglage, côté serveur : « Pour toute
// l'agence » ou « Pour vous seule », qui la change, et comment elle s'enregistre. Textes de
// « SettingsPattern » (espace lu côté serveur seulement, NFR-02 : rien de plus dans chaque page).
//
// Réemploi : `settingsScopeLine({ scope: "agency", editors: "owner", saving: "auto", isOwner })`.
// - editors « owner » : seule la titulaire change la rubrique ; un membre lit « Seule la titulaire la
//   change » et ne trouve aucune commande (critère 7) ; la titulaire lit « Vous seule la changez ».
// - editors « team » : toute l'équipe la change ; « self » : la personne connectée (ses réglages à elle).
import { getTranslations } from "next-intl/server";

export type SettingsScope = "agency" | "personal";
export type SettingsEditors = "owner" | "team" | "self";
export type SettingsSaving = "auto" | "bar" | "mixed" | "none";

export async function settingsScopeLine(input: { scope: SettingsScope; editors: SettingsEditors; saving: SettingsSaving; isOwner: boolean; submitLabel?: string }): Promise<string> {
  const t = await getTranslations("SettingsPattern");
  const parts = [t(`scope.${input.scope}`)];
  if (input.editors === "owner") parts.push(t(input.isOwner ? "editors.ownerSelf" : "editors.owner"));
  else if (input.editors === "team") parts.push(t("editors.team"));
  const canChange = input.editors !== "owner" || input.isOwner;
  if (canChange && input.saving === "auto") parts.push(t("saving.auto"));
  if (canChange && input.saving === "bar") parts.push(t("saving.bar", { button: input.submitLabel ?? "" }));
  if (canChange && input.saving === "mixed") parts.push(t("saving.mixed"));
  return parts.join(" · ");
}

// Les mots de « ✓ Enregistré » et de ses états, passés aux composants client en propriétés.
export async function savedIndicatorLabels(): Promise<{ saved: string; saving: string; failed: string }> {
  const t = await getTranslations("SettingsPattern");
  return { saved: t("saved.saved"), saving: t("saved.saving"), failed: t("saved.failed") };
}

// Les mots de la barre d'enregistrement d'un formulaire lié (settings-save-bar.tsx).
export async function saveBarLabels(): Promise<SaveBarLabels> {
  const t = await getTranslations("SettingsPattern");
  return {
    region: t("bar.region"),
    nothing: t("bar.nothing"),
    nothingToSave: t("bar.nothingToSave"),
    changedOne: t.raw("bar.changedOne") as string,
    changedOther: t.raw("bar.changedOther") as string,
    saved: t.raw("bar.saved") as string,
    saving: t("bar.saving"),
    reset: t("bar.reset"),
    leaveTitle: t("bar.leaveTitle"),
    leaveBody: t.raw("bar.leaveBody") as string,
    stay: t("bar.stay"),
    leave: t("bar.leave"),
    saveAndLeave: t("bar.saveAndLeave"),
    required: t("bar.required"),
  };
}

// Gabarits (« {count} », « {fields} », « {time} ») remplis côté client, sans catalogue de textes.
export type SaveBarLabels = {
  region: string;
  nothing: string;
  nothingToSave: string;
  changedOne: string;
  changedOther: string;
  saved: string;
  saving: string;
  reset: string;
  leaveTitle: string;
  leaveBody: string;
  stay: string;
  leave: string;
  saveAndLeave: string;
  required: string;
};
