// Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — suppression logique. Marquer une ligne la fait
// sortir de ce que la base montre (politique restrictive soft_delete_visibility) : marquer,
// démarquer et purger se font donc dans une transaction qui voit la corbeille (inTrash).
import { sql } from "drizzle-orm";
import { includingDeleted } from "./actor";
import { appDatabase } from "./client";
import { withOrganization } from "./with-organization";

type Transaction = Parameters<Parameters<typeof withOrganization>[2]>[0];

// La date (maintenant, ou celle de l'évènement supprimé que suivent ses lignes) et l'auteur, lu
// dans le contexte de la transaction comme le journal d'audit.
export function markDeleted(at?: Date) {
  return {
    deletedAt: at ?? sql`now()`,
    deletedBy: sql`nullif(current_setting('app.actor_id', true), '')::uuid`,
  };
}

export const UNMARKED = { deletedAt: null, deletedBy: null };

export function inTrash<T>(organizationId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return includingDeleted(() => withOrganization(appDatabase(), organizationId, fn));
}
