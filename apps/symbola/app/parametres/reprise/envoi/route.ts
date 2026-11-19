// Lot 35b (HUB-13 ; décisions D6 et D7 ; ADR 0097) — dépôt de l'archive d'un export Symbola à
// reprendre, par la route dédiée aux fichiers (L16-SEC-02, lib/uploads) : même origine, session,
// débit et taille contrôlés avant de lire le corps. Propriétaire seulement (vérifié ici et par le
// service). L'archive est écrite dans un fichier temporaire, rangée dans le stockage privé, puis
// reprise en arrière-plan ; le fichier temporaire est toujours effacé.
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { ORGANIZATION_IMPORT_MAX_BYTES } from "@/lib/export/import-limits";
import { OrganizationImportActiveError, OrganizationImportForbiddenError, requestOrganizationImport } from "@/modules/hub/service";

export async function POST(request: Request): Promise<Response> {
  const received = await receiveUpload(request, ORGANIZATION_IMPORT_MAX_BYTES + 64 * 1024);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("OrganizationImport");
  if (user.role !== "owner") return uploadResponse({ error: t("forbidden") }, 403);
  const file = formData.get("archive");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("fileMissing") });
  const path = join(tmpdir(), `symbola-depot-${randomUUID()}.zip`);
  try {
    await writeFile(path, new Uint8Array(await file.arrayBuffer()), { flag: "wx" });
    await requestOrganizationImport(appDatabase(), { organizationId: user.organizationId, userId: user.id, archivePath: path });
  } catch (error) {
    if (error instanceof OrganizationImportForbiddenError) return uploadResponse({ error: t("forbidden") }, 403);
    if (error instanceof OrganizationImportActiveError) return uploadResponse({ error: t("alreadyActive") });
    throw error;
  } finally {
    await rm(path, { force: true });
  }
  revalidatePath("/parametres/reprise");
  return uploadResponse({ success: true });
}
