"use server";

import { redirect } from "next/navigation";
import { appDatabase } from "@symbola/db/client";
import { markImportStepReviewed, type ImportVendorTypeTarget } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { decideVendorTypes } from "@/lib/import/matching";
import { getImportWizard, importStepHref } from "@/lib/import/wizard";
import { isValidId } from "../../access";
import { parseTypeTarget } from "../../type-target";

// IMP-12 — « Continuer » de l'étape « Types » : ce que devient chaque libellé
// (vérifié contre l'organisation), puis l'étape suivante.
export async function saveTypesAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const organizationId = auth.user.organizationId;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;
  const count = Math.min(Number(formData.get("count") ?? 0) || 0, 500);
  const decisions: { label: string; target: ImportVendorTypeTarget }[] = [];
  for (let index = 0; index < count; index += 1) {
    const label = String(formData.get(`label-${index}`) ?? "").slice(0, 200);
    const target = parseTypeTarget(String(formData.get(`type-${index}`) ?? ""));
    if (!label || !target) continue;
    decisions.push({ label, target });
  }
  if (decisions.length > 0 && !(await decideVendorTypes(organizationId, importId, decisions))) redirect(importStepHref(importId, "types"));
  const db = appDatabase();
  await markImportStepReviewed(db, { organizationId, importId, step: "types" });
  const wizard = await getImportWizard(organizationId, importId);
  redirect(wizard ? importStepHref(importId, wizard.next) : "/import");
}
