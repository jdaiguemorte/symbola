// Lot 55 (POR-06 ; ADR 0027, ADR 0102) — pièce jointe d'un message partagé, ouverte depuis le portail.
import { linkAttachment } from "@/lib/messages/link-routes";

export async function GET(request: Request, { params }: { params: Promise<{ attachmentId: string }> }): Promise<Response> {
  return linkAttachment(request, "client", (await params).attachmentId);
}
