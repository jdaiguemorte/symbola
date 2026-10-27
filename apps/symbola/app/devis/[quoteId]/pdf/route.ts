// DEV-01 — PDF A4 d'une version de devis (courante ou ancienne : les
// versions précédentes restent téléchargeables). Contrôles côté serveur :
// session planner, organisation, module souscrit, identifiants valides.
import { z } from "zod";
import { getQuote, QuoteNotFoundError, type QuoteDetail } from "@/modules/quotes/service";
import { isValidId } from "../../module-access";
import { authorizedPlanner } from "../../planner-access";
import { renderQuotePdf } from "../render-quote-pdf";

const versionSchema = z.coerce.number().int().min(1).max(10_000);

export async function GET(request: Request, { params }: { params: Promise<{ quoteId: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { organizationId } = planner;

  const { quoteId } = await params;
  const requested = versionSchema.safeParse(new URL(request.url).searchParams.get("version"));
  if (!isValidId(quoteId) || !requested.success) return new Response(null, { status: 404 });

  let quote: QuoteDetail;
  try {
    quote = await getQuote(organizationId, quoteId);
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
  const version = quote.versions.find((candidate) => candidate.version === requested.data);
  if (!version) return new Response(null, { status: 404 });

  const pdf = await renderQuotePdf({ organizationId, quote, version });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.number}-V${version.version}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
