// Contrôle commun des Server Actions et routes du module devis : session
// planner valide (owner ou member, double authentification faite),
// organisation, module activé. Jamais de contrôle uniquement côté client.
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isQuotesModuleEnabled } from "./module-access";

export async function authorizedPlanner(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isQuotesModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}
