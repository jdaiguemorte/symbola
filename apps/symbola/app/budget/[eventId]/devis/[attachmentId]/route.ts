// PRD-BUD-03 — ouverture d'un devis joint : contrôle de la session planner,
// de l'organisation et du module, puis fichier servi par l'app depuis le
// stockage privé (ADR 0027 : jamais d'URL vers le stockage).
import { BudgetLineAttachmentNotFoundError, getBudgetLineAttachmentFile } from "@/modules/budget/service";
import { fileDownloadResponse } from "@/lib/file-response";
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
    return fileDownloadResponse(await getBudgetLineAttachmentFile(organizationId, attachmentId));
  } catch (error) {
    if (error instanceof BudgetLineAttachmentNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
