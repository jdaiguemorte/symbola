// PRD-BUD-03 — devis prestataire joint à une ligne du budget (PDF ou image,
// 20 Mo). Lot 16 (L16-SEC-02, ADR 0044) : par cette route dédiée plutôt qu'une
// action serveur ; origine, session, limite de débit et taille sont vérifiées
// avant la lecture du fichier (lib/uploads/receive.ts).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  BudgetLineNotFoundError,
  EventNotFoundError,
  QuoteFileInfectedError,
  QuoteFileTooLargeError,
  QuoteFileUnsupportedTypeError,
  attachBudgetLineQuote,
} from "@/modules/budget/service";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { isBudgetModuleEnabled, isValidId } from "../../module-access";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const received = await receiveUpload(request);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("Budget");
  if (!(await isBudgetModuleEnabled(user.organizationId))) return uploadResponse({ error: t("unauthenticated") });

  const { eventId } = await params;
  const eventVendorSlotId = String(formData.get("eventVendorSlotId") ?? "");
  if (!isValidId(eventId) || !isValidId(eventVendorSlotId)) return uploadResponse({ error: t("quoteLineNotFound") });
  const file = formData.get("quote");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("quoteMissing") });

  try {
    await attachBudgetLineQuote({
      organizationId: user.organizationId,
      eventId,
      eventVendorSlotId,
      content: new Uint8Array(await file.arrayBuffer()),
      uploadedByUserId: user.id,
    });
  } catch (error) {
    if (error instanceof QuoteFileTooLargeError) return uploadResponse({ error: t("quoteTooLarge") });
    if (error instanceof QuoteFileUnsupportedTypeError) return uploadResponse({ error: t("quoteUnsupported") });
    if (error instanceof QuoteFileInfectedError) return uploadResponse({ error: t("quoteInfected") });
    if (error instanceof EventNotFoundError) return uploadResponse({ error: t("eventNotFound") });
    if (error instanceof BudgetLineNotFoundError) return uploadResponse({ error: t("quoteLineNotFound") });
    throw error;
  }

  revalidatePath(`/budget/${eventId}`);
  return uploadResponse({ success: true });
}
