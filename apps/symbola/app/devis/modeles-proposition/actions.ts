"use server";

// Lot 43 (FAC-02, HUB-21 ; D2) — enregistrer le modèle de la page de proposition (pour tous, ou pour un
// type d'évènement) : mot d'accueil et ordre des blocs, le devis toujours présent.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { PROPOSAL_BLOCKS, type ProposalBlock } from "@symbola/contracts";
import { ProposalPhotoError, ProposalTemplateInvalidError, removeProposalTemplate, removeProposalTemplatePhoto, saveProposalTemplate } from "@/modules/quotes/service";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";

export type ProposalTemplateState = { error?: string; success?: boolean };

// Chaque bloc a sa place (1 à 6) ou « masqué » ; l'ordre suit les places.
function readBlocks(formData: FormData): ProposalBlock[] {
  return PROPOSAL_BLOCKS.map((block) => ({ block, place: Number(formData.get(`place-${block}`) ?? 0) }))
    .filter((entry) => Number.isInteger(entry.place) && entry.place >= 1 && entry.place <= PROPOSAL_BLOCKS.length)
    .sort((a, b) => a.place - b.place || PROPOSAL_BLOCKS.indexOf(a.block) - PROPOSAL_BLOCKS.indexOf(b.block))
    .map((entry) => entry.block);
}

export async function saveProposalTemplateAction(_prev: ProposalTemplateState, formData: FormData): Promise<ProposalTemplateState> {
  const t = await getTranslations("ProposalTemplates");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("errorUnauthenticated") };
  const eventTypeId = String(formData.get("eventTypeId") ?? "");
  if (eventTypeId && !isValidId(eventTypeId)) return { error: t("errorBlocks") };
  try {
    await saveProposalTemplate(planner.organizationId, { eventTypeId: eventTypeId || null, greeting: String(formData.get("greeting") ?? ""), blocks: readBlocks(formData) });
  } catch (error) {
    if (error instanceof ProposalTemplateInvalidError) return { error: t(error.reason === "greeting" ? "errorGreeting" : "errorBlocks") };
    throw error;
  }
  revalidatePath("/devis/modeles-proposition");
  return { success: true };
}

export async function removeProposalTemplateAction(formData: FormData): Promise<void> {
  const planner = await authorizedPlanner();
  const templateId = String(formData.get("templateId") ?? "");
  if (!planner || !isValidId(templateId)) return;
  await removeProposalTemplate(planner.organizationId, templateId);
  revalidatePath("/devis/modeles-proposition");
}

export async function removeProposalPhotoAction(formData: FormData): Promise<void> {
  const planner = await authorizedPlanner();
  const templateId = String(formData.get("templateId") ?? "");
  const index = Number(formData.get("index"));
  if (!planner || !isValidId(templateId) || !Number.isInteger(index) || index < 0 || index > 2) return;
  try {
    await removeProposalTemplatePhoto(planner.organizationId, templateId, index);
  } catch (error) {
    if (!(error instanceof ProposalPhotoError)) throw error;
  }
  revalidatePath("/devis/modeles-proposition");
}
