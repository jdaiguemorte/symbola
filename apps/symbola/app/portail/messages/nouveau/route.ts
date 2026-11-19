// Lot 55 (POR-06 ; ADR 0101) — un client ouvre un sujet avec son premier message.
import { linkNewTopic } from "@/lib/messages/link-routes";

export async function POST(request: Request): Promise<Response> {
  return linkNewTopic(request);
}
