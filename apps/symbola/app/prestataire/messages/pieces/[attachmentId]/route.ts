// Lot 55 (MSG-03 ; ADR 0027, ADR 0102) — pièce jointe d'un message partagé, ouverte par un prestataire.
import { linkAttachment } from "@/lib/messages/link-routes";

export async function GET(request: Request, { params }: { params: Promise<{ attachmentId: string }> }): Promise<Response> {
  return linkAttachment(request, "vendor", (await params).attachmentId);
}
