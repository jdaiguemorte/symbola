"use server";

// Lot 55 (POR-11 ; ADR 0101) — le push du portail, facultatif : le client l'active sur son appareil
// (nouveaux messages, décisions demandées) et le coupe. Session du lien d'un client, relue en base ;
// l'abonnement (adresse du service de push et clés publiques) est validé par le service.
import { currentLinkAccess } from "@/lib/link-session";
import { LinkAccessDeniedError, MessageInputError, removeLinkPushSubscription, saveLinkPushSubscription } from "@/modules/events/service";

export async function subscribeLinkPushAction(subscription: unknown): Promise<{ ok: boolean }> {
  const access = await currentLinkAccess();
  if (!access || access.audience !== "client") return { ok: false };
  try {
    await saveLinkPushSubscription(access.organizationId, access.linkId, subscription);
    return { ok: true };
  } catch (error) {
    if (error instanceof LinkAccessDeniedError || error instanceof MessageInputError) return { ok: false };
    throw error;
  }
}

export async function unsubscribeLinkPushAction(endpoint: string): Promise<{ ok: boolean }> {
  const access = await currentLinkAccess();
  if (!access || access.audience !== "client" || typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false };
  await removeLinkPushSubscription(access.organizationId, access.linkId, endpoint);
  return { ok: true };
}
