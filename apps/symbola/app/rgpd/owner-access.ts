// Module RGPD : réservé à la titulaire du compte (rôle owner, cahier des
// charges § 6) ; un collaborateur n'y a aucun accès, l'Admin non plus.
import { getPlannerAuthContext } from "@/lib/auth-context";

export async function ownerContext(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || auth.user.role !== "owner") return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}
