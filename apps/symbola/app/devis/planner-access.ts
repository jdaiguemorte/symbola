// Contrôle commun des Server Actions et routes du module devis : session
// planner valide (owner ou member, double authentification faite),
// organisation, module activé. Jamais de contrôle uniquement côté client.
import { isAccountingReaderRole } from "@symbola/auth";
import { getAuthContext, getPlannerAuthContext } from "@/lib/auth-context";
import { isQuotesModuleEnabled } from "./module-access";

export async function authorizedPlanner(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isQuotesModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

// Lot 52 (HUB-04 ; ADR 0094) — lecture comptable (PDF des factures et avoirs, e-reporting, écritures) :
// la Propriétaire, les Planners et le Comptable, en lecture seule pour ce dernier. ownerOnly : la
// Propriétaire et le Comptable seulement (archive comptable). Refus par défaut, sans dire pourquoi.
export async function authorizedAccountingReader(options: { ownerOnly?: boolean } = {}): Promise<{ organizationId: string; userId: string; readOnly: boolean } | null> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || !isAccountingReaderRole(auth.user.role)) return null;
  if (options.ownerOnly && auth.user.role === "member") return null;
  if (!(await isQuotesModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id, readOnly: auth.user.role === "accountant" };
}
