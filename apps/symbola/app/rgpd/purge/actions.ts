"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { executePurge, retryPurge, type PurgeDecision } from "@/lib/privacy/purge";
import { ownerContext } from "../owner-access";

export type PurgeFormState = { error?: string };

// RGPD-09 (lot 19) : « request » pour la preuve d'une demande close.
const keySchema = z.string().regex(/^(event|account|invoice|credit_note|quote|request):[0-9a-f-]{36}$/i);

// RGPD-05 — « Quand elle valide la liste, alors la purge s'exécute ; elle
// peut exclure une ligne, avec un motif obligatoire. » Seules les lignes
// affichées sont traitées ; la liste est recalculée côté serveur.
export async function validatePurgeAction(_prevState: PurgeFormState, formData: FormData): Promise<PurgeFormState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  if (formData.get("purgeAcknowledged") !== "on") return { error: t("purgeConfirmMissing") };
  const keys = z.array(keySchema).max(5000).safeParse(formData.getAll("line"));
  if (!keys.success) return { error: t("exportInvalid") };
  const decisions: PurgeDecision[] = keys.data.map((key) => ({
    key,
    excluded: formData.get(`exclude:${key}`) === "on",
    reason: String(formData.get(`reason:${key}`) ?? "").slice(0, 2000),
  }));
  const result = await executePurge({ organizationId: owner.organizationId, userId: owner.userId, decisions });
  if (result.status === "reason_missing") return { error: t("purgeReasonMissing") };
  if (result.status !== "ok") return { error: t("purgeEmpty") };
  revalidatePath("/rgpd/purge");
  redirect(`/rgpd/purge/${result.purgeId}`);
}

export async function retryPurgeAction(formData: FormData): Promise<void> {
  const owner = await ownerContext();
  if (!owner) return;
  const purgeId = z.uuid().safeParse(formData.get("purgeId"));
  if (!purgeId.success) return;
  await retryPurge({ organizationId: owner.organizationId, purgeId: purgeId.data });
  revalidatePath(`/rgpd/purge/${purgeId.data}`);
}
