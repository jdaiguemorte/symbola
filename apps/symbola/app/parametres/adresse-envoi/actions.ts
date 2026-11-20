"use server";

// Lot 55 (MSG-04 révisée, D1 ; ADR 0102) — choisir la partie locale de l'adresse d'expédition :
// Propriétaire seulement (elle engage l'image de l'organisation) ; unique, refusée sans dire à qui
// elle est.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { SenderAddressError, setSenderLocalPart } from "@/modules/hub/service";

export type SenderAddressFormState = { error?: string; success?: boolean };

export async function saveSenderAddressAction(_previous: SenderAddressFormState, formData: FormData): Promise<SenderAddressFormState> {
  const t = await getTranslations("SenderAddress");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || auth.user.role !== "owner") return { error: t("errors.forbidden") };
  try {
    await setSenderLocalPart(auth.user.organizationId, String(formData.get("localPart") ?? ""));
  } catch (error) {
    if (error instanceof SenderAddressError) return { error: t(`errors.${error.reason}`) };
    throw error;
  }
  revalidatePath("/parametres/adresse-envoi");
  return { success: true };
}
