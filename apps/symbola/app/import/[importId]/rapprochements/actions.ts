"use server";

import { revalidatePath } from "next/cache";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { addManualMatch, decideMatches, getImportMatchesView, setContactRowsIgnored } from "@/lib/import/matching";
import { redirect } from "next/navigation";
import { appDatabase } from "@symbola/db/client";
import { markImportStepReviewed } from "@/modules/hub/service";
import { getImportWizard, importStepHref, SAFE_MATCH_SCORE, undecidedMatchCount } from "@/lib/import/wizard";
import { isValidId } from "../../access";
import { pendingBudgetDoublons } from "@/lib/import/budget-doublons";
import { doublonsContinueHref } from "@/lib/import/doublons-rules";


async function authorized(formData: FormData): Promise<{ organizationId: string; importId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return null;
  return { organizationId: auth.user.organizationId, importId };
}

function rowIndexOf(value: FormDataEntryValue): number | null {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

// IMP-03 — valider ou refuser des rapprochements, un par un ou en lot.
export async function decideMatchesAction(formData: FormData): Promise<void> {
  const context = await authorized(formData);
  if (!context) return;
  const decision = String(formData.get("decision") ?? "");
  let rowIndexes = formData
    .getAll("rowIndex")
    .map(rowIndexOf)
    .filter((index): index is number => index !== null);
  // Lot 67a (HUB-14 ; R04) : « Tout créer comme nouveau » refuse en lot les propositions en attente.
  if (decision === "accept_all" || decision === "accept_safe" || decision === "refuse_all") {
    const view = await getImportMatchesView(context.organizationId, context.importId);
    rowIndexes =
      view?.rows
        .filter((row) => row.errors.length === 0 && row.match?.status === "proposed" && (decision !== "accept_safe" || row.match.score >= SAFE_MATCH_SCORE))
        .map((row) => row.rowIndex) ?? [];
  }
  // Lot 63b (HUB-14) : « Décider plus tard » remet la proposition en attente.
  const kind = decision === "refuse" || decision === "refuse_all" ? "refuse" : decision === "later" ? "later" : "accept";
  if (rowIndexes.length > 0) {
    await decideMatches(
      context.organizationId,
      context.importId,
      rowIndexes.map((rowIndex) => ({ rowIndex, decision: kind })),
    );
  }
  revalidatePath(`/import/${context.importId}/rapprochements`);
}

// IMP-03 — rapprochement ajouté à la main.
export async function manualMatchAction(formData: FormData): Promise<void> {
  const context = await authorized(formData);
  if (!context) return;
  const rowIndex = rowIndexOf(formData.get("rowIndex") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  if (rowIndex === null || !isValidId(candidateId)) return;
  await addManualMatch(context.organizationId, context.importId, rowIndex, candidateId);
  revalidatePath(`/import/${context.importId}/rapprochements`);
}

// Lot 16 (IMP-11) — « Continuer » de l'étape « Doublons » : étape vérifiée,
// l'assistant passe à « Vérifier et confirmer ».
export async function reviewMatchesAction(formData: FormData): Promise<void> {
  const context = await authorized(formData);
  if (!context) return;
  // Lot 67a (HUB-14 ; R04) : tant qu'un rapprochement proposé attend, on reste ici et l'écran le dit.
  const view = await getImportMatchesView(context.organizationId, context.importId);
  // Lot 71d (HUB-14, P-16) : un budget nomme les choix qui restent et mène au premier.
  if (view?.entityType === "budget_lines") {
    const target = doublonsContinueHref(importStepHref(context.importId, "matches"), await pendingBudgetDoublons(context.organizationId, context.importId));
    if (target) redirect(target);
  }
  if (view && undecidedMatchCount(view.rows) > 0) redirect(`${importStepHref(context.importId, "matches")}?filtre=a-verifier&reste=1#rapprochements-a-decider`);
  const db = appDatabase();
  await markImportStepReviewed(db, { organizationId: context.organizationId, importId: context.importId, step: "matches" });
  const wizard = await getImportWizard(context.organizationId, context.importId);
  redirect(wizard ? importStepHref(context.importId, wizard.next) : "/import");
}

// Lot 36b (DAT-12) — une ligne de contact qui répète une adresse plus haut dans le fichier :
// ignorée, ou de nouveau gardée (elle complète alors la première).
export async function ignoreContactRowsAction(formData: FormData): Promise<void> {
  const context = await authorized(formData);
  if (!context) return;
  const rowIndex = rowIndexOf(formData.get("rowIndex") ?? "");
  if (rowIndex === null) return;
  await setContactRowsIgnored(context.organizationId, context.importId, [rowIndex], formData.get("ignored") === "1");
  revalidatePath(`/import/${context.importId}/rapprochements`);
}
