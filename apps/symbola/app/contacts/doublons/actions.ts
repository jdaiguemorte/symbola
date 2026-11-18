"use server";

// Lot 45 (CRM-07 ; D4, D5 ; ADR 0090) — « Ce ne sont pas les mêmes » et la fusion choisie champ par
// champ, après confirmation. Contrôlé côté serveur à chaque appel : session et organisation ; la paire
// et les fiches sont de l'organisation (RLS). La fusion publie hub.contact.merged : chaque module
// repointe ses références par son propre service.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ContactMergeRefusedError, dismissDuplicatePair, DuplicatePairNotFoundError, getDuplicatePair, MERGEABLE_FIELDS, mergeContacts, type MergeChoices } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "@/app/events/module-access";

export type MergeState = { error?: string };

async function access() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

export async function dismissPairAction(pairId: string): Promise<boolean> {
  const who = await access();
  if (!who || !isValidId(pairId)) return false;
  try {
    await dismissDuplicatePair(who.organizationId, pairId, who.userId);
  } catch (error) {
    if (error instanceof DuplicatePairNotFoundError) return false;
    throw error;
  }
  revalidatePath("/contacts/doublons");
  revalidatePath("/contacts");
  return true;
}

export async function mergePairAction(pairId: string, _state: MergeState, form: FormData): Promise<MergeState> {
  const t = await getTranslations("ContactDuplicates");
  const who = await access();
  if (!who || !isValidId(pairId)) return { error: t("refused") };
  const pair = await getDuplicatePair(who.organizationId, pairId);
  if (!pair) return { error: t("refused") };
  const keptContactId = String(form.get("kept") ?? "");
  if (keptContactId !== pair.firstContactId && keptContactId !== pair.secondContactId) return { error: t("refused") };
  if (form.get("confirm") !== "on") return { error: t("confirmRequired") };
  const absorbedContactId = keptContactId === pair.firstContactId ? pair.secondContactId : pair.firstContactId;
  // Pour chaque champ : « first » ou « second » (la fiche dont la valeur est gardée).
  const choices: MergeChoices = {};
  for (const field of MERGEABLE_FIELDS) {
    const side = form.get(`field-${field}`);
    if (side === "first" || side === "second") choices[field] = (side === "first" ? pair.firstContactId : pair.secondContactId) === keptContactId ? "kept" : "absorbed";
  }
  try {
    await mergeContacts({ organizationId: who.organizationId, keptContactId, absorbedContactId, choices, userId: who.userId });
  } catch (error) {
    if (error instanceof ContactMergeRefusedError) return { error: t(`refusedReason.${error.reason}`) };
    throw error;
  }
  revalidatePath("/contacts");
  revalidatePath("/contacts/doublons");
  redirect(`/contacts/${keptContactId}?fusion=1`);
}
