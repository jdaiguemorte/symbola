"use server";

import { revalidatePath } from "next/cache";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { addManualMatch, decideMatches, decideVendorTypes, getImportMatchesView } from "@/lib/import/matching";
import { isValidId } from "../../access";

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
  if (decision === "accept_all") {
    const view = await getImportMatchesView(context.organizationId, context.importId);
    rowIndexes = view?.rows.filter((row) => row.match?.status === "proposed").map((row) => row.rowIndex) ?? [];
  }
  const kind = decision === "refuse" ? "refuse" : "accept";
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

// Lot 14 (décision N) — types du fichier : rapprochés d'un type du carnet
// (vérifié dans l'organisation par l'orchestrateur) ou créés.
export async function decideVendorTypesAction(formData: FormData): Promise<void> {
  const context = await authorized(formData);
  if (!context) return;
  const count = Math.min(Number(formData.get("count") ?? 0) || 0, 500);
  const decisions: { label: string; typeId: string | null }[] = [];
  for (let index = 0; index < count; index += 1) {
    const label = String(formData.get(`label-${index}`) ?? "").slice(0, 200);
    const typeId = String(formData.get(`type-${index}`) ?? "");
    if (!label) continue;
    if (typeId !== "" && !isValidId(typeId)) return;
    decisions.push({ label, typeId: typeId === "" ? null : typeId });
  }
  if (decisions.length > 0) await decideVendorTypes(context.organizationId, context.importId, decisions);
  revalidatePath(`/import/${context.importId}/rapprochements`);
}
