"use server";

// Lot 39a (UX-07 ; D6 ; ADR 0073) — « Annuler » du bandeau : rend l'élément ou l'objet qui vient
// d'être supprimé. Les droits sont revérifiés ici (membre de l'organisation ; la base ne rend que ce
// qui lui appartient) : le cookie de l'offre ne donne aucun droit.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isUndoKind, type UndoKind } from "@symbola/contracts";
import { requirePlanner } from "@/lib/guards";
import { TrashItemNotFoundError, undoDeletion } from "@/lib/trash";
import { clearUndo } from "@/lib/undo";
import { ContactRestoreConflictError } from "@/modules/hub/service";

export type UndoState = { status: "idle" | "restored" | "gone" | "conflict" };

const inputSchema = z.object({ kind: z.string().refine(isUndoKind), id: z.uuid() });

export async function undoDeletionAction(_previous: UndoState, formData: FormData): Promise<UndoState> {
  const auth = await requirePlanner();
  const parsed = inputSchema.safeParse({ kind: formData.get("kind"), id: formData.get("id") });
  if (!parsed.success) return { status: "gone" };
  try {
    await undoDeletion({ organizationId: auth.user.organizationId, userId: auth.user.id, kind: parsed.data.kind as UndoKind, id: parsed.data.id });
  } catch (error) {
    if (error instanceof ContactRestoreConflictError) return { status: "conflict" };
    if (error instanceof TrashItemNotFoundError) return { status: "gone" };
    throw error;
  }
  await clearUndo();
  revalidatePath("/", "layout");
  return { status: "restored" };
}
