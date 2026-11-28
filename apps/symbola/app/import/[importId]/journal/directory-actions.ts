"use server";

// Lot 71e (R14 ; spécification du lot 71, § 5.5, critère 8) — « Ajouter les N téléphones » : l'annuaire d'un
// programme repris complète le carnet. Session, organisation et rôle vérifiés ici ; l'import est relu
// dans l'organisation (SEC-13).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { addDirectoryToCarnet } from "@/lib/import/pdf-imports";
import { isValidId } from "../../access";

export async function addDirectoryToCarnetAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;
  const added = await addDirectoryToCarnet(auth.user.organizationId, importId);
  revalidatePath(`/import/${importId}/journal`);
  revalidatePath("/prestataires");
  redirect(added ? `/import/${importId}/journal?telephones=${added.phones}&fiches=${added.created}` : `/import/${importId}/journal`);
}
