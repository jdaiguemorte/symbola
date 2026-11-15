"use server";

import { redirect } from "next/navigation";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { setContactRowFilter } from "@/lib/import/matching";
import { getImportWizard, importStepHref } from "@/lib/import/wizard";
import { isValidId } from "../../access";

const MAX_VALUES = 50;

// Lot 36b (D11, SC-10) — « Continuer » de l'étape « Lignes » : les valeurs cochées d'une seule
// colonne écartent leurs lignes (rien de coché : toutes les lignes sont gardées). Colonne et
// valeurs sont vérifiées contre le fichier ; les doublons sont recalculés.
export async function saveRowFilterAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const organizationId = auth.user.organizationId;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;

  const byColumn = new Map<number, string[]>();
  for (const [key, value] of formData.entries()) {
    const match = /^exclude-(\d{1,3})$/.exec(key);
    if (!match || typeof value !== "string") continue;
    const columnIndex = Number(match[1]);
    byColumn.set(columnIndex, [...(byColumn.get(columnIndex) ?? []), value.slice(0, 200)].slice(0, MAX_VALUES));
  }
  if (byColumn.size > 1) redirect(`${importStepHref(importId, "rows")}?erreur=colonnes`);
  const [entry] = [...byColumn];
  const saved = await setContactRowFilter(organizationId, importId, entry ? { columnIndex: entry[0], excluded: entry[1] } : null);
  if (!saved) redirect(`${importStepHref(importId, "rows")}?erreur=valeurs`);
  const wizard = await getImportWizard(organizationId, importId);
  redirect(wizard ? importStepHref(importId, wizard.next) : "/import");
}
