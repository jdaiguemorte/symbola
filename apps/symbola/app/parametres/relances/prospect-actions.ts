"use server";

// Lot 45 (CRM-06, CRM-05 ; D2 ; ADR 0090) — le réglage des relances des prospects (jusqu'à trois, leurs
// jours et leurs modèles, l'envoi automatique désactivé par défaut) et le retrait de la brochure.
// Contrôlé côté serveur : session, organisation, module Évènements ouvert.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { FollowUpSettingsInvalidError, removeProspectBrochure, saveProspectFollowUpSettings } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export type ProspectSettingsState = { ok?: string; error?: string };

async function access() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId };
}

export async function saveProspectFollowUpsAction(_state: ProspectSettingsState, form: FormData): Promise<ProspectSettingsState> {
  const t = await getTranslations("FollowUpSettings");
  const who = await access();
  if (!who) return { error: t("refused") };
  const steps = [1, 2, 3].flatMap((rank) => {
    const days = String(form.get(`days-${rank}`) ?? "").trim();
    if (!days) return [];
    const templateId = String(form.get(`template-${rank}`) ?? "");
    return [{ days: Number(days), messageTemplateId: isValidId(templateId) ? templateId : null }];
  });
  try {
    await saveProspectFollowUpSettings(who.organizationId, { enabled: form.get("enabled") === "on", autoSend: form.get("autoSend") === "on", steps });
  } catch (error) {
    if (error instanceof FollowUpSettingsInvalidError) return { error: t(`invalid.${error.reason}`) };
    throw error;
  }
  revalidatePath("/parametres/relances");
  return { ok: t("saved") };
}

export async function removeBrochureAction(): Promise<void> {
  const who = await access();
  if (!who) return;
  await removeProspectBrochure(who.organizationId);
  revalidatePath("/parametres/relances");
}
