// Lot 10 (AIDE-08) — résultats de la recherche instantanée (JSON), pour la
// boîte de recherche de l'équipe. Contrôles côté serveur : session complète,
// rôle d'équipe, organisation ; le terme est validé par Zod.
import { z } from "zod";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { runSearch } from "@/lib/search/run-search";

const querySchema = z.string().trim().min(2).max(100);

export async function GET(request: Request): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!parsed.success) return Response.json({ groups: [] }, { headers: { "Cache-Control": "private, no-store" } });
  const groups = await runSearch({ organizationId: auth.user.organizationId, role: auth.user.role, term: parsed.data });
  return Response.json({ groups }, { headers: { "Cache-Control": "private, no-store" } });
}
