"use server";

// Lot 39a (HUB-17, DAT-03 ; D5 ; ADR 0073) — Paramètres › Corbeille : restaurer (toute l'équipe),
// supprimer définitivement (la titulaire seule). Les droits sont vérifiés ici, côté serveur ; la base
// ne rend ni n'efface rien d'une autre organisation.
import { redirect } from "next/navigation";
import { z } from "zod";
import { isTrashKind, type TrashKind } from "@symbola/contracts";
import { requireOwner, requirePlanner } from "@/lib/guards";
import { deleteForGood, restoreFromTrash, TrashItemNotFoundError } from "@/lib/trash";
import { ContactRestoreConflictError } from "@/modules/hub/service";

const inputSchema = z.object({ kind: z.string().refine(isTrashKind), id: z.uuid() });

function parse(formData: FormData): { kind: TrashKind; id: string } | null {
  const parsed = inputSchema.safeParse({ kind: formData.get("kind"), id: formData.get("id") });
  return parsed.success ? { kind: parsed.data.kind as TrashKind, id: parsed.data.id } : null;
}

export async function restoreTrashItemAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  const input = parse(formData);
  if (!input) redirect("/parametres/corbeille?resultat=introuvable");
  let outcome = "rendu";
  try {
    await restoreFromTrash(auth.user.organizationId, input.kind, input.id);
  } catch (error) {
    if (error instanceof ContactRestoreConflictError) outcome = "conflit";
    else if (error instanceof TrashItemNotFoundError) outcome = "introuvable";
    else throw error;
  }
  redirect(`/parametres/corbeille?resultat=${outcome}`);
}

export async function deleteTrashItemForGoodAction(formData: FormData): Promise<void> {
  const auth = await requireOwner();
  if (!auth) redirect("/parametres/corbeille?resultat=reserve");
  const input = parse(formData);
  if (!input) redirect("/parametres/corbeille?resultat=introuvable");
  let outcome = "efface";
  try {
    await deleteForGood(auth.user.organizationId, input.kind, input.id);
  } catch (error) {
    if (error instanceof TrashItemNotFoundError) outcome = "introuvable";
    else throw error;
  }
  redirect(`/parametres/corbeille?resultat=${outcome}`);
}
