"use server";

import { revalidatePath } from "next/cache";
import { createAppConnection } from "@symbola/db/client";
import { decideFreeColumns, type FreeColumnDecision } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "../../access";

// IMP-04 — garder chaque colonne sans équivalent en champ libre, ou l'ignorer.
export async function decideFreeColumnsAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return;
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return;

  const decisions: FreeColumnDecision[] = [];
  for (const [name, value] of formData.entries()) {
    const match = /^column-(\d+)$/.exec(name);
    if (!match || (value !== "keep" && value !== "ignore")) continue;
    decisions.push({ columnIndex: Number(match[1]), keep: value === "keep" });
  }
  const { sql, db } = createAppConnection();
  try {
    await decideFreeColumns(db, { organizationId: auth.user.organizationId, importId, decisions });
  } finally {
    await sql.end();
  }
  revalidatePath(`/import/${importId}/ecarts`);
  revalidatePath(`/import/${importId}`);
}
