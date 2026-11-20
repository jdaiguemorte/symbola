// Lot 60 (L60-PLA-05) — le plan en PDF à l'échelle, pour l'équipe : le plan en cours (sans note
// interne), avec cartouche, tableau des éléments et tableau « Électricité ». Accès relu à chaque
// demande ; un plan d'ailleurs répond comme un absent.
import { getLocale } from "next-intl/server";
import { refusedResponse } from "@/lib/access-refusals";
import { downloadLayoutPdf, FloorplanNotFoundError } from "@/modules/floorplans/service";
import { isValidId } from "@/app/events/module-access";
import { layoutAccess } from "../../access";

export async function GET(request: Request, { params }: { params: Promise<{ layoutId: string }> }): Promise<Response> {
  const { layoutId } = await params;
  if (!isValidId(layoutId)) return new Response(null, { status: 404 });
  const access = await layoutAccess(layoutId);
  if (!access) return refusedResponse(request);
  try {
    const file = await downloadLayoutPdf(access.organizationId, layoutId, (await getLocale()) === "en" ? "en" : "fr");
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof FloorplanNotFoundError) return refusedResponse(request);
    throw error;
  }
}
