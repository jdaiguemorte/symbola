// Lot 29b (JRJ-04, décision D8 ; ADR 0064) — un document du jour J, ouvert dans le
// navigateur pour se lire sur le téléphone, et gardé avec l'écran du jour J s'il est
// embarqué. Contrôles de l'écran (session de la planner, module, événement confirmé
// ou réalisé et daté), puis la pièce doit figurer parmi les candidats de
// l'événement, donnés par chaque module (day-documents.ts) ; sinon introuvable.
import { DAY_DOCUMENT_SOURCES, type DayDocumentSource } from "@symbola/contracts";
import { getEvent } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { fileDownloadResponse } from "@/lib/file-response";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { isDayOfOpen } from "../../../day-of-view";
import { listDayDocumentCandidates, readDayDocument } from "../../../day-documents";

const NOT_FOUND_ERRORS = new Set(["EventDocumentNotFoundError", "SignatureDocumentNotFoundError", "BudgetLineAttachmentNotFoundError", "VendorCandidateNotFoundError", "QuoteNotFoundError"]);

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string; source: string; documentId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  const { eventId, source, documentId } = await params;
  if (!isValidId(eventId) || !isValidId(documentId) || !(DAY_DOCUMENT_SOURCES as readonly string[]).includes(source)) return new Response(null, { status: 404 });
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const event = await getEvent(organizationId, eventId);
  if (!event || !isDayOfOpen(event)) return new Response(null, { status: 404 });

  const candidates = await listDayDocumentCandidates(organizationId, eventId);
  if (!candidates.some((candidate) => candidate.source === source && candidate.sourceId === documentId)) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await readDayDocument(organizationId, source as DayDocumentSource, documentId), { inline: true });
  } catch (error) {
    if (error instanceof Error && NOT_FOUND_ERRORS.has(error.name)) return new Response(null, { status: 404 });
    throw error;
  }
}
