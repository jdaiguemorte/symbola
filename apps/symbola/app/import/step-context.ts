// Lot 16 (IMP-11) — accès commun aux étapes de l'assistant d'import : session,
// organisation et rôle vérifiés côté serveur, import de l'organisation, état
// de l'assistant (étapes, étape suivante).
import { notFound, redirect } from "next/navigation";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { getImportWizard, type ImportWizard } from "@/lib/import/wizard";
import { isValidId } from "./access";

export async function importStepContext(importId: string): Promise<{ organizationId: string; userId: string; wizard: ImportWizard }> {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  if (!isValidId(importId)) notFound();
  const wizard = await getImportWizard(auth.user.organizationId, importId);
  if (!wizard) notFound();
  return { organizationId: auth.user.organizationId, userId: auth.user.id, wizard };
}

export const wantsAbandon = (query: Record<string, string | string[] | undefined>) => query.abandon === "1";
