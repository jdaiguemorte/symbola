// Lot 46 (RDV-04, ARC-06, ARC-07 ; ADR 0082) — accès aux écrans du module Rendez-vous : la planner
// connectée (requirePlanner), et le module ouvert pour son organisation ; sinon null, et l'écran dit
// « indisponible » (dégradation propre, jamais une erreur).
import { requirePlanner, type InOrganization } from "@/lib/guards";
import { isAppointmentsModuleEnabled } from "@/modules/appointments/service";

export async function appointmentsPlanner(): Promise<InOrganization | null> {
  const auth = await requirePlanner();
  return (await isAppointmentsModuleEnabled(auth.user.organizationId)) ? auth : null;
}
