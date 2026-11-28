"use server";

// Lot 44 (CRM-01 ; D1 à D3, D7 ; ADR 0084) — réglages du formulaire de contact, réservés à la
// titulaire : ouverture, adresse, champs masqués, politique de confidentialité, sites autorisés à
// l'encadrer, e-mail de nouvelle demande. Validés par le module (Zod côté formulaire, règles côté service).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { CONTACT_FORM_FIELDS } from "@symbola/contracts";
import { ContactFormInvalidError, ContactFormSlugTakenError, saveContactFormSettings } from "@/modules/events/service";
import { requireOwner } from "@/lib/guards";
import { isEventsModuleEnabled } from "../../module-access";

export type ContactSettingsState = { error?: string; saved?: boolean };

export async function saveContactSettingsAction(_previous: ContactSettingsState, formData: FormData): Promise<ContactSettingsState> {
  const t = await getTranslations("ContactForm.settings");
  const auth = await requireOwner();
  if (!auth) return { error: t("ownerOnly") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { error: t("moduleUnavailable") };
  const shown = new Set(formData.getAll("shownFields").map(String));
  const locale = String(formData.get("locale") ?? "") === "en" ? "en" : "fr";
  try {
    await saveContactFormSettings(organizationId, {
      active: formData.get("active") === "on",
      slug: String(formData.get("slug") ?? "").slice(0, 80),
      hiddenFields: CONTACT_FORM_FIELDS.filter((field) => !shown.has(field)),
      privacyPolicyUrl: String(formData.get("privacyPolicyUrl") ?? "").slice(0, 600) || null,
      allowedOrigins: String(formData.get("allowedOrigins") ?? "").slice(0, 2000).split(/\r?\n/),
      notifyOwner: formData.get("notifyOwner") === "on",
      locale,
    });
  } catch (error) {
    if (error instanceof ContactFormSlugTakenError) return { error: t("slugTaken") };
    if (error instanceof ContactFormInvalidError) return { error: t(`invalid.${error.field}`) };
    throw error;
  }
  revalidatePath("/events/parametres/etapes");
  return { saved: true };
}
