// BUD-03 — ouverture d'un devis joint : contrôle de la session planner,
// de l'organisation et du module, puis redirection vers un lien signé à
// durée limitée (jamais d'URL publique permanente, jamais affichée
// d'avance dans la page).
import { BudgetLineAttachmentNotFoundError, getBudgetLineAttachmentUrl } from "@/modules/budget/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isBudgetModuleEnabled, isValidId } from "../../../module-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; attachmentId: string }> },
): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isBudgetModuleEnabled(organizationId))) return new Response(null, { status: 404 });

  const { attachmentId } = await params;
  if (!isValidId(attachmentId)) return new Response(null, { status: 404 });
  try {
    const url = await getBudgetLineAttachmentUrl(organizationId, attachmentId);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BudgetLineAttachmentNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
