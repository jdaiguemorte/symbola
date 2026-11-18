// Lot 49 (INV-01 à INV-04, INV-07 ; ARC-06, ARC-07, SEC-12, SEC-13) — accès aux écrans du module
// Invités côté équipe : session, organisation, modules Évènements et Invités ouverts ; le rôle dit
// qui voit les régimes nominatifs (la titulaire seule, D8). Contrôlé côté serveur à chaque requête.
import { appDatabase } from "@symbola/db/client";
import type { GuestViewer } from "@symbola/contracts";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isModuleEnabled } from "@/modules/hub/service";

export type GuestsAccess = { organizationId: string; userId: string; owner: boolean; viewer: GuestViewer };

export async function isGuestsAvailable(organizationId: string): Promise<boolean> {
  const db = appDatabase();
  return (await isModuleEnabled(db, organizationId, "events")) && (await isModuleEnabled(db, organizationId, "guests"));
}

export async function guestsAccess(): Promise<GuestsAccess | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isGuestsAvailable(auth.user.organizationId))) return null;
  const owner = auth.user.role === "owner";
  return { organizationId: auth.user.organizationId, userId: auth.user.id, owner, viewer: owner ? { kind: "owner" } : { kind: "member" } };
}
