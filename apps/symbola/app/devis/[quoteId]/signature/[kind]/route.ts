// DEV-02 — document signé ou certificat de preuve de la version courante :
// redirection vers un lien signé temporaire (stockage privé). Contrôles côté
// serveur : session planner, organisation, module souscrit.
import { z } from "zod";
import { getSignatureDocumentUrl, QuoteNotFoundError, SignatureDocumentNotFoundError } from "@/modules/quotes/service";
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
    const url = await getSignatureDocumentUrl(planner.organizationId, quoteId, parsed.data);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof QuoteNotFoundError || error instanceof SignatureDocumentNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
