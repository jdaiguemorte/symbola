"use server";

// Lot 71d (HUB-14, BUD-01, PRE-01 ; spécification du lot 71, § 5.4 ; maquette 08) — les choix de
// « Doublons » d'un budget. Chaque choix est relu côté serveur contre ce que l'import a proposé, dans
// l'organisation de la personne (SEC-12, SEC-13) : un poste, une fiche ou une ligne qui n'en est pas
// n'écrit rien.
import { revalidatePath } from "next/cache";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { confirmBudgetSplit, decideBudgetDoublons, getBudgetDoublonsView, placeBudgetGroup } from "@/lib/import/budget-doublons";
import { isValidId } from "../../access";

async function authorized(formData: FormData): Promise<{ organizationId: string; importId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return null;
  return { organizationId: auth.user.organizationId, importId };
}

function rowIndexes(formData: FormData): number[] {
  return formData
    .getAll("rowIndex")
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0);
}

const refresh = (importId: string) => revalidatePath(`/import/${importId}/rapprochements`);

// « Rangé sous le poste » : un poste proposé pour ces lignes, ou « Nouveau poste » (valeur « new »).
export async function placeBudgetGroupAction(formData: FormData): Promise<void> {
  const context = await authorized(formData);
  if (!context) return;
  const slot = String(formData.get("slotId") ?? "");
  if (slot !== "new" && !isValidId(slot)) return;
  await placeBudgetGroup(context.organizationId, context.importId, { rowIndexes: rowIndexes(formData), slotId: slot === "new" ? null : slot });
  refresh(context.importId);
}

// « C'est juste » : le partage d'un poste du fichier entre deux postes, d'après le détail.
export async function confirmBudgetSplitAction(formData: FormData): Promise<void> {
  const context = await authorized(formData);
  if (!context) return;
  await confirmBudgetSplit(context.organizationId, context.importId, rowIndexes(formData));
  refresh(context.importId);
}

// « Le garder « à trouver » » ou « Le retirer de ce mariage ».
export async function decideUnusedSlotAction(formData: FormData): Promise<void> {
  const context = await authorized(formData);
  if (!context) return;
  const slotId = String(formData.get("slotId") ?? "");
  const decision = formData.get("decision");
  if (!isValidId(slotId) || (decision !== "keep" && decision !== "remove")) return;
  await decideBudgetDoublons(context.organizationId, context.importId, { slots: [{ slotId, decision }] });
  refresh(context.importId);
}

// « C'est la même fiche » ou « Ce n'est pas la même : créer une fiche ». Le nom vient de l'import (par son
// rang), jamais du formulaire.
export async function decideCarnetVendorAction(formData: FormData): Promise<void> {
  const context = await authorized(formData);
  if (!context) return;
  const index = Number(formData.get("index"));
  const decision = formData.get("decision");
  if (!Number.isInteger(index) || (decision !== "same" && decision !== "create")) return;
  const view = await getBudgetDoublonsView(context.organizationId, context.importId);
  const doubt = view?.vendors.doubts.find((entry) => entry.index === index);
  if (!doubt) return;
  await decideBudgetDoublons(context.organizationId, context.importId, { vendors: [{ name: doubt.name, decision }] });
  refresh(context.importId);
}
