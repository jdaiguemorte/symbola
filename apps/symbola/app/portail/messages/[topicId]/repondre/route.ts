// Lot 55 (POR-06 ; ADR 0102) — réponse du client sur un sujet partagé, avec pièces jointes.
import { linkReply } from "@/lib/messages/link-routes";

export async function POST(request: Request, { params }: { params: Promise<{ topicId: string }> }): Promise<Response> {
  return linkReply(request, "client", (await params).topicId);
}
