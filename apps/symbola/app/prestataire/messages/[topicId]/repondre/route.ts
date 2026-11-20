// Lot 55 (MSG-03 ; ADR 0102) — réponse d'un prestataire sur un sujet où la planner l'a ajouté.
import { linkReply } from "@/lib/messages/link-routes";

export async function POST(request: Request, { params }: { params: Promise<{ topicId: string }> }): Promise<Response> {
  return linkReply(request, "vendor", (await params).topicId);
}
