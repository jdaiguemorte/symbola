"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PrivacyErasureInvalidError } from "@/modules/hub/service";
import { executeErasure, previewErasure, retryErasure, type ErasurePreviewItem } from "@/lib/privacy/erasure";
import { parseSelection } from "./form-selection";
import { ownerContext } from "./owner-access";

export type ErasurePreviewState = { error?: string; items?: ErasurePreviewItem[]; selectedKeys?: string[] };
export type ErasureExecuteState = { error?: string };

const ERRORS = { incomplete: "exportIncomplete", changed: "exportChanged", empty: "exportNoSelection" } as const;

// RGPD-03 — aperçu de l'oubli des fiches cochées : rien n'est modifié.
export async function previewErasureAction(_prevState: ErasurePreviewState, formData: FormData): Promise<ErasurePreviewState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  const selection = parseSelection(formData);
  if (!selection) return { error: t("exportInvalid") };
  const preview = await previewErasure({ organizationId: owner.organizationId, ...selection });
  if (preview.status !== "ok") return { error: t(ERRORS[preview.status]) };
  return { items: preview.items, selectedKeys: selection.selectedKeys };
}

// RGPD-03 — validation : l'aperçu est recalculé côté serveur, rattaché à la
// demande d'oubli, puis chaque module exécute sa part. Irréversible : la
// confirmation est obligatoire.
export async function executeErasureAction(_prevState: ErasureExecuteState, formData: FormData): Promise<ErasureExecuteState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  if (formData.get("irreversibleAcknowledged") !== "on") return { error: t("erasureConfirmMissing") };
  const requestId = z.uuid().safeParse(formData.get("requestId"));
  if (!requestId.success) return { error: t("erasureRequestMissing") };
  const selection = parseSelection(formData);
  if (!selection) return { error: t("exportInvalid") };
  try {
    const result = await executeErasure({ organizationId: owner.organizationId, userId: owner.userId, requestId: requestId.data, ...selection });
    if (result.status !== "ok") return { error: t(ERRORS[result.status]) };
  } catch (error) {
    if (error instanceof PrivacyErasureInvalidError) return { error: t(error.code === "in_progress" ? "erasureInProgress" : "erasureRequestInvalid") };
    throw error;
  }
  revalidatePath("/rgpd");
  // Lot 18 (RGPD-07) : retour au dossier, sur l'étape de l'effacement.
  revalidatePath(`/rgpd/demandes/${requestId.data}`);
  redirect(`/rgpd/demandes/${requestId.data}?etape=action`);
}

// Relance des modules qui n'ont pas accusé réception.
export async function retryErasureAction(formData: FormData): Promise<void> {
  const owner = await ownerContext();
  if (!owner) return;
  const erasureId = z.uuid().safeParse(formData.get("erasureId"));
  if (!erasureId.success) return;
  await retryErasure({ organizationId: owner.organizationId, erasureId: erasureId.data });
  revalidatePath(`/rgpd/oublis/${erasureId.data}`);
}
