// Lot 29b (JRJ-04, décision D8) — ouverture d'un document de l'événement depuis la
// fiche : session de la planner, organisation (RLS) et module, puis fichier servi
// par l'app depuis le stockage privé (ADR 0027 : jamais d'URL vers le stockage).
// Lot 37a (DOC-01 ; D4, D5 ; ADR 0070) : « ?version=N » sert une version précédente,
// « ?apercu=1 » l'affiche dans le navigateur ; POST dépose une nouvelle version, par la même
// réception contrôlée que le premier envoi (L16-SEC-02, ADR 0044).
import { isStorageFullError, storageFullMessage } from "@/lib/storage-full";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { refusedResponse } from "@/lib/access-refusals";
import { addEventDocumentVersion, EventDocumentNotFoundError, EventDocumentRejectedError, getEventDocumentFile, getEventDocumentVersionFile } from "@/modules/events/service";
import { fileResponse } from "@/lib/file-response";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";

const versionSchema = z.coerce.number().int().min(1).max(10_000);

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { documentId } = await params;
  if (!isValidId(documentId)) return new Response(null, { status: 404 });
  const requested = new URL(request.url).searchParams.get("version");
  const version = requested === null ? null : versionSchema.safeParse(requested);
  if (version && !version.success) return new Response(null, { status: 404 });
  try {
    const file = version ? await getEventDocumentVersionFile(organizationId, documentId, version.data!) : await getEventDocumentFile(organizationId, documentId);
    return fileResponse(file, request);
  } catch (error) {
    if (error instanceof EventDocumentNotFoundError) return refusedResponse(request);
    throw error;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }): Promise<Response> {
  const received = await receiveUpload(request);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("EventDocuments");
  if (!(await isEventsModuleEnabled(user.organizationId))) return uploadResponse({ error: t("unauthorized") });
  const { id: eventId, documentId } = await params;
  if (!isValidId(eventId) || !isValidId(documentId)) return uploadResponse({ error: t("notFound") });
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("fileMissing") });
  try {
    await addEventDocumentVersion({ organizationId: user.organizationId, documentId, content: new Uint8Array(await file.arrayBuffer()), uploadedByUserId: user.id });
  } catch (error) {
    // Lot 54 (DOC-06) : quota de stockage plein, préavis passé.
    if (isStorageFullError(error)) return uploadResponse({ error: await storageFullMessage() });
    if (error instanceof EventDocumentRejectedError) {
      return uploadResponse({ error: t(error.reason === "too_large" ? "fileTooLarge" : error.reason === "infected" ? "fileInfected" : "fileUnsupported") });
    }
    if (error instanceof EventDocumentNotFoundError) return uploadResponse({ error: t("notFound") });
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return uploadResponse({ success: true });
}
