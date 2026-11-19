// Lot 29b (JRJ-04, décision D8 ; ADR 0064) — un document du jour J, ouvert dans le
// navigateur pour se lire sur le téléphone, et gardé avec l'écran du jour J s'il est
// embarqué. Contrôles de l'écran (session de la planner, module, événement confirmé
// ou réalisé et daté), puis la pièce doit figurer parmi les candidats de
// l'événement, donnés par chaque module (day-documents.ts) ; sinon introuvable.
import { DAY_DOCUMENT_SOURCES, type DayDocumentSource } from "@symbola/contracts";
// Lot 52 (EVT-06, D3) : le renfort du jour J n'ouvre que les documents gardés pour le jour J (choisis
// par la planner), jamais les autres pièces de l'évènement.
import { fileDownloadResponse } from "@/lib/file-response";
import { isValidId } from "@/app/events/module-access";
import { dayOfAccess } from "../../../access";
import { listDayDocumentCandidates, readDayDocument } from "../../../day-documents";

const NOT_FOUND_ERRORS = new Set(["EventDocumentNotFoundError", "SignatureDocumentNotFoundError", "BudgetLineAttachmentNotFoundError", "VendorCandidateNotFoundError", "QuoteNotFoundError"]);

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string; source: string; documentId: string }> }): Promise<Response> {
  const { eventId, source, documentId } = await params;
  if (!isValidId(documentId) || !(DAY_DOCUMENT_SOURCES as readonly string[]).includes(source)) return new Response(null, { status: 404 });
  const access = await dayOfAccess(request, eventId, { write: false });
  if (!access.ok) return new Response(null, { status: access.response.status });
  const { organizationId } = access;
  const helper = access.viewer.kind === "helper";
  const candidates = await listDayDocumentCandidates(organizationId, eventId);
  if (!candidates.some((candidate) => candidate.source === source && candidate.sourceId === documentId && (!helper || candidate.embedded))) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await readDayDocument(organizationId, source as DayDocumentSource, documentId), { inline: true });
  } catch (error) {
    if (error instanceof Error && NOT_FOUND_ERRORS.has(error.name)) return new Response(null, { status: 404 });
    throw error;
  }
}
