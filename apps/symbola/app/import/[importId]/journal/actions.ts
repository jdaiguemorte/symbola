"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { undoImport, undoTakeover } from "@/lib/import/apply";
import { takeoverBackLink } from "@/lib/takeover/flow";
import { isValidId } from "../../access";

// IMP-05 — retrait d'un import confirmé. Lot 71d (HUB-14, C-66) : les éléments modifiés à la main
// depuis restent, sauf si la case « Retirer aussi les … modifiées depuis » est cochée ; ce qui est
// modifié est relu côté serveur, jamais pris du formulaire.
export async function undoImportAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;
  const back = await takeoverBackLink(auth.user.organizationId, importId);
  const result = await undoImport({ organizationId: auth.user.organizationId, userId: auth.user.id, importId, forceModified: formData.get("forceModified") === "on" });
  revalidatePath("/import");
  if (back) revalidatePath(back.href);
  if (result.status !== "done") redirect(`/import/${importId}/journal`);
  const { undone, kept_modified: keptModified, kept_in_use: keptInUse } = result.outcomes;
  redirect(`/import/${importId}/journal?annule=${undone}&gardes=${keptModified}&utilises=${keptInUse}`);
}

// Lot 71d (décision I10) — « Retirer toute la reprise… » : tout part, ou rien ; ensuite, la liste des
// reprises (la page de celle-ci n'existe plus).
export async function undoTakeoverAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;
  const result = await undoTakeover({ organizationId: auth.user.organizationId, userId: auth.user.id, importId });
  revalidatePath("/import");
  revalidatePath("/reprise");
  if (result.status !== "done") redirect(`/import/${importId}/journal?retrait=${result.status}`);
  redirect(`/reprise?retiree=${result.imports}`);
}
