"use server";

// Lot 24b (SEC-06, décision D3) — retrait de l'accès d'un collaborateur, par la
// titulaire seulement : ses sessions et appareils de confiance sont supprimés,
// il ne se connecte plus. La ligne va au journal de l'organisation.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { removeMember } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { requireOwner } from "@/lib/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function removeMemberAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;
  const userId = String(formData.get("userId") ?? "");
  if (!UUID.test(userId)) return;
  const outcome = await removeMember(appDatabase(), { organizationId: owner.user.organizationId, userId, removedByUserId: owner.user.id });
  revalidatePath("/parametres/equipe");
  redirect(outcome === "removed" ? "/parametres/equipe?retire=1" : "/parametres/equipe");
}
