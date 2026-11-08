// Lot 16 (IMP-11) — accès commun aux étapes de l'assistant d'import : session,
// organisation et rôle vérifiés côté serveur, import de l'organisation, état
// de l'assistant (étapes, étape suivante).
import { notFound } from "next/navigation";
import { requirePlanner } from "@/lib/guards";
import { getImportWizard, type ImportWizard } from "@/lib/import/wizard";
import { isValidId } from "./access";

export async function importStepContext(importId: string): Promise<{ organizationId: string; userId: string; wizard: ImportWizard }> {
  const auth = await requirePlanner();
  if (!isValidId(importId)) notFound();
  const wizard = await getImportWizard(auth.user.organizationId, importId);
  if (!wizard) notFound();
  return { organizationId: auth.user.organizationId, userId: auth.user.id, wizard };
}

export const wantsAbandon = (query: Record<string, string | string[] | undefined>) => query.abandon === "1";
