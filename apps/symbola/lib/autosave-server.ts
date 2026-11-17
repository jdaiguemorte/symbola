// Lot 39b (UX-09 ; D8 ; ADR 0074) — côté serveur, l'enregistrement automatique d'une fiche : relire la
// fiche, comparer sa version à celle de l'écran, fusionner (lib/autosave.ts) ou signaler le conflit,
// écrire, relire. Les droits sont vérifiés par l'action qui l'appelle ; la base garantit
// l'organisation. Une erreur imprévue rend un message avec sa référence (lib/action-errors.ts).
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { unexpectedActionError } from "./action-errors";
import { mergeEdits, parseBaseline, sameValues, type FieldValues } from "./autosave";

export type AutosaveConflict = { field: string; theirs: string; mine: string };

export type AutosaveState =
  | { status: "idle" }
  | { status: "saved"; values: FieldValues; version: string; at: number }
  | { status: "conflict"; conflicts: AutosaveConflict[]; stored: FieldValues; version: string; by: string | null; at: number }
  | { status: "error"; message: string; at: number };

export type AutosaveRecord = { values: FieldValues; version: string; updatedBy: string | null };

export function versionOf(updatedAt: Date): string {
  return String(updatedAt.getTime());
}

export async function runAutosave(input: {
  organizationId: string;
  userId: string;
  formData: FormData;
  fields: readonly string[];
  read: () => Promise<AutosaveRecord | null>;
  write: (values: FieldValues) => Promise<void>;
  knownError: (error: unknown) => Promise<string | null>;
  notFound: string;
}): Promise<AutosaveState> {
  const at = Date.now();
  const { formData, fields } = input;
  const mine: FieldValues = Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "")]));
  const baseline = parseBaseline(formData.get("baseline"), fields) ?? mine;
  const version = String(formData.get("version") ?? "");
  try {
    const current = await input.read();
    if (!current) return { status: "error", message: input.notFound, at };
    let toWrite = mine;
    if (current.version !== version) {
      const { merged, conflicts } = mergeEdits(fields, baseline, mine, current.values);
      if (conflicts.length > 0) {
        let by: string | null = null;
        if (current.updatedBy && current.updatedBy !== input.userId) {
          const team = await listTeam(appDatabase(), input.organizationId);
          by = team.find((member) => member.id === current.updatedBy)?.email ?? "";
        }
        return { status: "conflict", conflicts: conflicts.map((field) => ({ field, theirs: current.values[field] ?? "", mine: mine[field] ?? "" })), stored: current.values, version: current.version, by, at };
      }
      toWrite = merged;
    }
    if (!sameValues(fields, toWrite, current.values)) {
      try {
        await input.write(toWrite);
      } catch (error) {
        const known = await input.knownError(error);
        if (known) return { status: "error", message: known, at };
        throw error;
      }
    }
    const after = await input.read();
    if (!after) return { status: "error", message: input.notFound, at };
    return { status: "saved", values: after.values, version: after.version, at };
  } catch (error) {
    return { status: "error", message: await unexpectedActionError(error), at };
  }
}
