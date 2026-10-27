// EVT-05, DEV-01 — logo de l'organisation pour les PDF (programme, devis).
// Facultatif : s'il manque ou ne se lit pas, le PDF porte le nom de
// l'organisation à la place (jamais d'erreur pour la planner).
import { createStorageClient, detectFileType, getPrivateObject } from "@symbola/files";

export type DocumentLogo = { data: Buffer; format: "png" | "jpg" };

export async function loadDocumentLogo(organizationId: string, logoKey: string | null): Promise<DocumentLogo | null> {
  if (!logoKey) return null;
  try {
    const data = await getPrivateObject(createStorageClient(), logoKey);
    const type = detectFileType(data);
    if (type?.mime === "image/png") return { data, format: "png" };
    if (type?.mime === "image/jpeg") return { data, format: "jpg" };
    return null;
  } catch {
    console.warn(`logo illisible pour l'organisation ${organizationId}`);
    return null;
  }
}
