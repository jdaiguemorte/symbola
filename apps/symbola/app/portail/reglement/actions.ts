"use server";

// Lot 43 (FAC-08 Divergent, GC-01, JUR-07 ; ADR 0087) — « J'ai fait le virement », depuis le lien d'un
// client (rubrique « Devis ») : l'échéance doit être de son évènement, son règlement ouvert (jamais
// avant le 8e jour hors établissement), et, si un payeur est désigné, ce lien doit être le sien.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { currentLinkAccess } from "@/lib/link-session";
import { isQuotesModuleEnabled, isValidId } from "@/app/devis/module-access";
import { declareTransfer, QuoteNotFoundError, TransferDeclarationError } from "@/modules/quotes/service";
import { designatedPayerLink } from "./payer";

export type TransferState = { error?: string; success?: boolean };

export async function declareTransferAction(_prev: TransferState, formData: FormData): Promise<TransferState> {
  const t = await getTranslations("Settlement");
  const access = await currentLinkAccess();
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("quotes") || !(await isQuotesModuleEnabled(access.organizationId))) return { error: t("declareError") };
  const scheduleItemId = String(formData.get("scheduleItemId") ?? "");
  if (!isValidId(scheduleItemId)) return { error: t("declareError") };
  try {
    await declareTransfer(access.organizationId, {
      eventId: access.eventId,
      linkId: access.linkId,
      personName: access.personName,
      scheduleItemId,
      paidOn: String(formData.get("paidOn") ?? ""),
      designatedLinkId: await designatedPayerLink(access.organizationId, access.eventId, scheduleItemId),
    });
  } catch (error) {
    if (error instanceof TransferDeclarationError) return { error: t(`declareRefused.${error.reason}`) };
    if (error instanceof QuoteNotFoundError) return { error: t("declareError") };
    throw error;
  }
  revalidatePath("/portail", "layout");
  return { success: true };
}
