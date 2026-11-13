"use server";

// Lot 31a (FAC-01, HUB-21, HUB-26 ; décision D3) — modèles de devis : renommer, changer le
// type d'événement, dupliquer, supprimer, ajouter le modèle de départ.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { addStarterQuoteTemplates, duplicateQuoteTemplate, QuoteTemplateNotFoundError, removeQuoteTemplate, renameQuoteTemplate } from "@/modules/quotes/service";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";

export type TemplateFormState = { error?: string; success?: boolean };

async function run(formData: FormData, write: (organizationId: string, templateId: string, t: Awaited<ReturnType<typeof getTranslations<"Quotes">>>) => Promise<TemplateFormState | void>): Promise<TemplateFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return { error: t("templateNotFound") };
  try {
    const result = await write(planner.organizationId, templateId, t);
    if (result) return result;
  } catch (error) {
    if (error instanceof QuoteTemplateNotFoundError) return { error: t("templateNotFound") };
    if (error instanceof RangeError) return { error: t("invalidTemplateName") };
    throw error;
  }
  revalidatePath("/devis/modeles");
  return { success: true };
}

export async function renameTemplateAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  return run(formData, async (organizationId, templateId) => {
    const eventTypeId = String(formData.get("eventTypeId") ?? "");
    await renameQuoteTemplate({ organizationId, templateId, name: String(formData.get("name") ?? ""), eventTypeId: isValidId(eventTypeId) ? eventTypeId : null });
  });
}

export async function duplicateTemplateAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  return run(formData, async (organizationId, templateId, t) => {
    const name = String(formData.get("name") ?? "").trim();
    await duplicateQuoteTemplate({ organizationId, templateId, name: name || t("templateCopyName", { name: String(formData.get("sourceName") ?? "") }).slice(0, 120) });
  });
}

export async function removeTemplateAction(formData: FormData): Promise<void> {
  await run(formData, async (organizationId, templateId) => {
    await removeQuoteTemplate(organizationId, templateId);
  });
}

export async function addStarterTemplatesAction(): Promise<void> {
  const planner = await authorizedPlanner();
  if (!planner) return;
  await addStarterQuoteTemplates(planner.organizationId, (await getLocale()) === "en" ? "en" : "fr");
  revalidatePath("/devis/modeles");
}
