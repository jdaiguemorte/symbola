// Lot 63b (HUB-14, UX-07) — « Vérifier les N prestataires » : les éléments écrits par un import
// confirmé (créés, mis à jour, ou les deux), encore présents, pour filtrer la liste de leur écran sur
// cet import. Lu par la porte d'entrée du hub ; l'import doit être de l'organisation.
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { getAppliedImport } from "@/modules/hub/service";

export type ImportPart = "created" | "updated";
export type ImportFilter = { importId: string; appliedAt: Date; part: ImportPart | null; ids: string[] };

// Paramètres d'adresse : « import=<id> » et, facultatif, « quoi=crees » ou « quoi=maj ».
export const IMPORT_PART_PARAM: Record<string, ImportPart> = { crees: "created", maj: "updated" };

const uuid = z.uuid();

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export async function importFilterOf(organizationId: string, query: Record<string, string | string[] | undefined>, kind: string): Promise<ImportFilter | null> {
  const importId = one(query.import);
  if (!uuid.safeParse(importId).success) return null;
  const view = await getAppliedImport(appDatabase(), organizationId, importId);
  if (!view?.appliedAt) return null;
  const part = IMPORT_PART_PARAM[one(query.quoi)] ?? null;
  const ids = [
    ...new Set(
      view.items
        .filter((item) => item.kind === kind && item.undoOutcome !== "undone" && item.undoOutcome !== "missing" && (part === null || item.action === part))
        .map((item) => item.elementId),
    ),
  ];
  return { importId, appliedAt: view.appliedAt, part, ids };
}
