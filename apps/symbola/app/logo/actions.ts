"use server";

// Lot 17 (DEV-08) — retrait du logo : les prochains documents n'en ont plus ;
// le fichier reste dans le stockage, cité par les documents déjà émis.
import { revalidatePath } from "next/cache";
import { appDatabase } from "@symbola/db/client";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { removeOrganizationLogo } from "@/modules/hub/service";

export async function removeLogoAction(): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  await removeOrganizationLogo(appDatabase(), auth.user.organizationId);
  revalidatePath("/parametres");
  revalidatePath("/devis/parametres/documents");
}
