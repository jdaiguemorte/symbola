// DEV-02 — document signé ou certificat de preuve de la version courante,
// servi par l'app depuis le stockage privé (ADR 0027). Contrôles côté
// serveur : session planner, organisation, module souscrit.
import { z } from "zod";
import { fileDownloadResponse } from "@/lib/file-response";
import { getSignatureDocument, OriginalAlteredError, QuoteNotFoundError, SignatureDocumentNotFoundError } from "@/modules/quotes/service";
import { isValidId } from "../../../module-access";
import { authorizedPlanner } from "../../../planner-access";

const kindSchema = z.enum(["signed", "certificate"]);

export async function GET(_request: Request, { params }: { params: Promise<{ quoteId: string; kind: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { quoteId, kind } = await params;
  const parsed = kindSchema.safeParse(kind);
  if (!isValidId(quoteId) || !parsed.success) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await getSignatureDocument(planner.organizationId, quoteId, parsed.data));
  } catch (error) {
    if (error instanceof QuoteNotFoundError || error instanceof SignatureDocumentNotFoundError) return new Response(null, { status: 404 });
    // Lot 23b (DOC-08) : fichier relu différent de celui archivé.
    if (error instanceof OriginalAlteredError) return new Response(null, { status: 409 });
    throw error;
  }
}
