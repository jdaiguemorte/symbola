// Lot 55 (POR-06, MSG-03 ; ADR 0101, ADR 0027) — routes de la messagerie d'un lien (portail du client,
// espace du prestataire) : origine, session du lien au public attendu, débit et taille avant la
// lecture (receiveLinkUpload) ; puis le service relit le lien et ses droits. Un lien n'écrit que des
// messages partagés : aucun champ ne choisit la visibilité.
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { receiveLinkUpload, uploadResponse } from "@/lib/uploads/receive";
import { currentLinkAccess } from "@/lib/link-session";
import { fileResponse } from "@/lib/file-response";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { getLinkMessageAttachmentFile, LinkAccessDeniedError, MessageNotFoundError, postLinkMessage, startLinkMessageTopic } from "@/modules/events/service";
import { messageErrorResponse, messageFilesOf } from "./receive";

type LinkAudience = "client" | "vendor";

function base(audience: LinkAudience): string {
  return audience === "client" ? "/portail/messages" : "/prestataire/messages";
}

export async function linkReply(request: Request, audience: LinkAudience, topicId: string): Promise<Response> {
  const received = await receiveLinkUpload(request, audience);
  if (!received.ok) return received.response;
  const { access, formData } = received;
  const t = await getTranslations("MessageThread");
  if (!isValidId(topicId) || !(await isEventsModuleEnabled(access.organizationId))) return uploadResponse({ error: t("errors.notFound") });
  const files = await messageFilesOf(formData);
  if (!files) return uploadResponse({ error: t("errors.files") });
  try {
    await postLinkMessage({ organizationId: access.organizationId, linkId: access.linkId, topicId, body: String(formData.get("body") ?? ""), files });
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) return uploadResponse({ error: t("errors.notFound") });
    const refused = await messageErrorResponse(error);
    if (refused) return refused;
    throw error;
  }
  revalidatePath(`${base(audience)}/${topicId}`);
  return uploadResponse({ success: true });
}

export async function linkNewTopic(request: Request): Promise<Response> {
  const received = await receiveLinkUpload(request, "client");
  if (!received.ok) return received.response;
  const { access, formData } = received;
  const t = await getTranslations("MessageThread");
  if (!(await isEventsModuleEnabled(access.organizationId))) return uploadResponse({ error: t("errors.notFound") });
  const files = await messageFilesOf(formData);
  if (!files) return uploadResponse({ error: t("errors.files") });
  try {
    const { topicId } = await startLinkMessageTopic({ organizationId: access.organizationId, linkId: access.linkId, name: String(formData.get("name") ?? ""), body: String(formData.get("body") ?? ""), files });
    return uploadResponse({ success: true, redirect: `/portail/messages/${topicId}` });
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) return uploadResponse({ error: t("errors.notFound") });
    const refused = await messageErrorResponse(error);
    if (refused) return refused;
    throw error;
  }
}

// Une pièce jointe ouverte depuis un lien : celle d'un message partagé d'un sujet qu'il voit ; toute
// autre répond 404, sans dire si elle existe.
export async function linkAttachment(request: Request, audience: LinkAudience, attachmentId: string): Promise<Response> {
  const access = await currentLinkAccess();
  if (!access || access.audience !== audience || !isValidId(attachmentId) || !(await isEventsModuleEnabled(access.organizationId))) return new Response(null, { status: 404 });
  try {
    const response = fileResponse(await getLinkMessageAttachmentFile(access.organizationId, access.linkId, attachmentId), request);
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof MessageNotFoundError || error instanceof LinkAccessDeniedError) return new Response(null, { status: 404 });
    throw error;
  }
}
