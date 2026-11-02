// RGPD-02 — téléchargement d'un export (PDF ou archive ZIP) : titulaire
// seulement, export de son organisation encore valide, puis redirection vers
// un lien signé de courte durée (jamais d'URL permanente, jamais affichée
// d'avance dans la page).
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import { getPrivacyExportDownloadUrl, PrivacyExportNotFoundError } from "@/modules/hub/service";
import { ownerContext } from "../../../owner-access";

const paramsSchema = z.object({ id: z.uuid(), file: z.enum(["pdf", "archive"]) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; file: string }> }): Promise<Response> {
  const owner = await ownerContext();
  if (!owner) return new Response(null, { status: 403 });
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return new Response(null, { status: 404 });

  const { sql, db } = createAppConnection();
  try {
    const url = await getPrivacyExportDownloadUrl(db, { organizationId: owner.organizationId, exportId: parsed.data.id, file: parsed.data.file });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PrivacyExportNotFoundError) return new Response(null, { status: 404 });
    throw error;
  } finally {
    await sql.end();
  }
}
