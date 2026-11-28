// Lot 16 (IMP-11) — accès commun aux étapes de l'assistant d'import : session,
// organisation et rôle vérifiés côté serveur, import de l'organisation, état
// de l'assistant (étapes, étape suivante).
import { notFound, redirect } from "next/navigation";
import { isPdfImportEntityType } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { getImportWizard, type ImportWizard } from "@/lib/import/wizard";
import { isValidId } from "./access";

// Lot 71e : un PDF de prestataires retenus ou de programme a son propre écran (`pdf`) ; les autres étapes
// y renvoient.
export async function importStepContext(importId: string, options: { pdf?: boolean } = {}): Promise<{ organizationId: string; userId: string; wizard: ImportWizard }> {
  const auth = await requirePlanner();
  if (!isValidId(importId)) notFound();
  const wizard = await getImportWizard(auth.user.organizationId, importId);
  if (!wizard) notFound();
  const pdf = isPdfImportEntityType(wizard.entityType);
  if (pdf && !options.pdf) redirect(`/import/${importId}/pdf`);
  if (!pdf && options.pdf) redirect(`/import/${importId}`);
  return { organizationId: auth.user.organizationId, userId: auth.user.id, wizard };
}

export const wantsAbandon = (query: Record<string, string | string[] | undefined>) => query.abandon === "1";
