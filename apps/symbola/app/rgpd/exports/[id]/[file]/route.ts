// RGPD-02 — téléchargement d'un export (PDF ou archive ZIP) : titulaire
// seulement, export de son organisation encore valide, puis fichier servi
// par l'app depuis le stockage privé (ADR 0027 : jamais d'URL vers le
// stockage).
import { refusedResponse } from "@/lib/access-refusals";
import { z } from "zod";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { fileDownloadResponse } from "@/lib/file-response";
import { getPrivacyExportFile, PrivacyExportNotFoundError } from "@/modules/hub/service";
import { ownerContext } from "../../../owner-access";

const paramsSchema = z.object({ id: z.uuid(), file: z.enum(["pdf", "archive"]) });

export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }): Promise<Response> {
  const owner = await ownerContext();
  if (!owner) return new Response(null, { status: 403 });
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return new Response(null, { status: 404 });

  const db = appDatabase();
  try {
    const file = await getPrivacyExportFile(db, { organizationId: owner.organizationId, exportId: parsed.data.id, file: parsed.data.file });
    // Lot 23 (SEC-19) : téléchargement d'un export au journal.
    await recordAudit(db, { organizationId: owner.organizationId, action: "hub.privacy_export.downloaded", objectId: parsed.data.id, details: { file: parsed.data.file } });
    return fileDownloadResponse(file);
  } catch (error) {
    if (error instanceof PrivacyExportNotFoundError) return refusedResponse(request);
    throw error;
  }
}
