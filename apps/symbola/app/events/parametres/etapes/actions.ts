"use server";

// Lot 44 (CRM-02 ; D9 ; ADR 0084) — étapes du pipeline, réservées à la titulaire (données de
// l'organisation, HUB-20) : ajouter, renommer, monter, descendre, retirer (une étape non vide se vide
// d'abord, ou ses cartes passent à l'étape choisie). Entre une et dix étapes.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { addPipelineStage, movePipelineStage, PipelineStageInvalidError, removePipelineStage, renamePipelineStage } from "@/modules/events/service";
import { requireOwner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "../../module-access";

const PAGE = "/events/parametres/etapes";

async function ownerAccess(): Promise<{ organizationId: string; userId: string; locale: "fr" | "en" } | null> {
  const auth = await requireOwner();
  if (!auth || !(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id, locale: (await getLocale()) === "en" ? "en" : "fr" };
}

// Un refus revient sur la page avec sa raison (?refus=…), lue par l'écran.
async function guarded(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (error instanceof PipelineStageInvalidError) redirect(`${PAGE}?refus=${error.reason}`);
    throw error;
  }
  revalidatePath(PAGE);
  revalidatePath("/events/pipeline");
}

export async function addStageAction(formData: FormData): Promise<void> {
  const access = await ownerAccess();
  if (!access) return;
  await guarded(() => addPipelineStage(access.organizationId, String(formData.get("label") ?? "").slice(0, 200), access.locale));
}

export async function renameStageAction(formData: FormData): Promise<void> {
  const access = await ownerAccess();
  const stageId = String(formData.get("stageId") ?? "");
  if (!access || !isValidId(stageId)) return;
  await guarded(() => renamePipelineStage(access.organizationId, stageId, String(formData.get("label") ?? "").slice(0, 200)));
}

export async function moveStageAction(formData: FormData): Promise<void> {
  const access = await ownerAccess();
  const stageId = String(formData.get("stageId") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!access || !isValidId(stageId)) return;
  await guarded(() => movePipelineStage(access.organizationId, stageId, direction, access.locale));
}

export async function removeStageAction(formData: FormData): Promise<void> {
  const access = await ownerAccess();
  const stageId = String(formData.get("stageId") ?? "");
  const destination = String(formData.get("destinationId") ?? "");
  if (!access || !isValidId(stageId)) return;
  await guarded(() => removePipelineStage({ organizationId: access.organizationId, stageId, destinationId: isValidId(destination) ? destination : null, userId: access.userId, locale: access.locale }));
}
