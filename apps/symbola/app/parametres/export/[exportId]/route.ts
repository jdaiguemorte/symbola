// Lot 35a (HUB-13, D4, D5) — téléchargement de l'archive d'un export complet : Propriétaire
// seulement, export de son organisation prêt et encore gardé, puis archive servie en flux par
// l'app depuis le stockage privé (ADR 0027 : jamais d'URL vers le stockage) ; le téléchargement
// va au journal. Un identifiant inconnu ou d'une autre organisation répond comme un objet
// inexistant (SEC-13).
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { ownerContext } from "@/app/rgpd/owner-access";
import { refusedResponse } from "@/lib/access-refusals";
import { openOrganizationExportArchive, OrganizationExportForbiddenError, OrganizationExportNotFoundError } from "@/modules/hub/service";

export async function GET(request: Request, { params }: { params: Promise<{ exportId: string }> }): Promise<Response> {
  const owner = await ownerContext();
  if (!owner) return new Response(null, { status: 403 });
  const parsed = z.uuid().safeParse((await params).exportId);
  if (!parsed.success) return new Response(null, { status: 404 });
  try {
    const archive = await openOrganizationExportArchive(appDatabase(), { organizationId: owner.organizationId, userId: owner.userId, exportId: parsed.data });
    return new Response(archive.stream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        ...(archive.sizeBytes ? { "Content-Length": String(archive.sizeBytes) } : {}),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(archive.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof OrganizationExportNotFoundError) return refusedResponse(request);
    if (error instanceof OrganizationExportForbiddenError) return new Response(null, { status: 403 });
    throw error;
  }
}
