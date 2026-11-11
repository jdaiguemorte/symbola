// Lot 11 (L11-EVT-10) — devis d'un prestataire consulté, ouvert par l'équipe :
// session, organisation et module vérifiés, fichier servi par l'app depuis
// le stockage privé (ADR 0027).
import { refusedResponse } from "@/lib/access-refusals";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { attachVendorCandidateQuote, CandidateQuoteRejectedError, getVendorCandidateQuoteFile, VendorCandidateNotFoundError } from "@/modules/events/service";
import { fileDownloadResponse } from "@/lib/file-response";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { isEventsModuleEnabled, isValidId } from "../../../../module-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { candidateId } = await params;
  if (!isValidId(candidateId)) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await getVendorCandidateQuoteFile(organizationId, candidateId));
  } catch (error) {
    if (error instanceof VendorCandidateNotFoundError) return refusedResponse(request);
    throw error;
  }
}

// L11-EVT-10 — devis reçu d'un prestataire consulté, joint par l'équipe. Lot 16
// (L16-SEC-02, ADR 0044) : par cette route plutôt qu'une action serveur ; origine,
// session, limite de débit et taille sont vérifiées avant la lecture du
// fichier (lib/uploads/receive.ts).
export async function POST(request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }): Promise<Response> {
  const received = await receiveUpload(request);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("VendorCandidates");
  if (!(await isEventsModuleEnabled(user.organizationId))) return uploadResponse({ error: t("unauthorized") });
  const { id: eventId, candidateId } = await params;
  if (!isValidId(eventId) || !isValidId(candidateId)) return uploadResponse({ error: t("notFound") });
  const file = formData.get("quote");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("quoteMissing") });
  try {
    await attachVendorCandidateQuote({ organizationId: user.organizationId, candidateId, content: new Uint8Array(await file.arrayBuffer()) });
  } catch (error) {
    if (error instanceof CandidateQuoteRejectedError) {
      return uploadResponse({ error: t(error.reason === "too_large" ? "quoteTooLarge" : error.reason === "infected" ? "quoteInfected" : "quoteUnsupported") });
    }
    if (error instanceof VendorCandidateNotFoundError) return uploadResponse({ error: t("notFound") });
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return uploadResponse({ success: true });
}
