// RGPD-02 — téléchargement d'un export (PDF ou archive ZIP) : titulaire
// seulement, export de son organisation encore valide, puis fichier servi
// par l'app depuis le stockage privé (ADR 0027 : jamais d'URL vers le
// stockage).
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { fileDownloadResponse } from "@/lib/file-response";
import { getPrivacyExportFile, PrivacyExportNotFoundError } from "@/modules/hub/service";
import { ownerContext } from "../../../owner-access";

const paramsSchema = z.object({ id: z.uuid(), file: z.enum(["pdf", "archive"]) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; file: string }> }): Promise<Response> {
  const owner = await ownerContext();
  if (!owner) return new Response(null, { status: 403 });
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return new Response(null, { status: 404 });

  const db = appDatabase();
  try {
    return fileDownloadResponse(await getPrivacyExportFile(db, { organizationId: owner.organizationId, exportId: parsed.data.id, file: parsed.data.file }));
  } catch (error) {
    if (error instanceof PrivacyExportNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
