"use server";

// Lot 37a (DOC-04, SEC-17 ; D7 ; ADR 0070) — ce que la page d'un lien de partage montre avant
// l'ouverture : l'intitulé du document, si le lien est encore valable. Le jeton arrive en POST,
// n'est écrit nulle part ; débit limité par adresse IP et par organisation (SEC-04), comme
// l'ouverture d'un lien personnel. Rien n'est compté ici : l'ouverture, c'est le fichier servi.
import { z } from "zod";
import { describeEventDocumentLink } from "@/modules/events/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { isPreviewableMime } from "@/lib/file-response";

export type ShareLinkOutcome = { outcome: "valid"; label: string; previewable: boolean } | { outcome: "invalid" } | { outcome: "retry"; minutes: number };

const tokenSchema = z.string().max(200);

export async function describeShareLinkAction(token: unknown): Promise<ShareLinkOutcome> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { outcome: "invalid" };
  const organizationId = parsed.data.split(".")[0] ?? "";
  const limit = await checkRateLimit("linkOpen", { account: z.uuid().safeParse(organizationId).success ? organizationId : null });
  if (!limit.allowed) return { outcome: "retry", minutes: Math.max(1, Math.ceil(limit.retryAfterSeconds / 60)) };
  const document = await describeEventDocumentLink(parsed.data);
  if (!document) return { outcome: "invalid" };
  return { outcome: "valid", label: document.label, previewable: isPreviewableMime(document.mime) };
}
