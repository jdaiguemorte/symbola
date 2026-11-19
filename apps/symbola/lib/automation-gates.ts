// Lot 53 (HUB-28 ; D5 ; ADR 0095) — l'interrupteur et le journal d'un automatisme, pour les tâches
// périodiques qui le lancent : null s'il est coupé (rien ne part) ; sinon, ce que reçoit le module
// (AutomationHooks) : le jour de la remise en route (un envoi prévu avant ne part pas, rien n'est
// rattrapé) et la trace de chaque exécution dans le journal de l'automatisme.
import { parisToday } from "@symbola/i18n";
import type { AutomationHooks, AutomationKey } from "@symbola/contracts";
import { getAutomationGate, recordAutomationRun } from "@/modules/hub/service";

export async function automationHooks(organizationId: string, key: AutomationKey, now: Date = new Date()): Promise<AutomationHooks | null> {
  const gate = await getAutomationGate(organizationId, key);
  if (!gate.enabled) return null;
  return {
    notBefore: gate.resumedAt ? parisToday(gate.resumedAt) : null,
    onRun: async (run) => {
      try {
        await recordAutomationRun(organizationId, key, { ...run, ranAt: now });
      } catch (error) {
        // La trace ne doit jamais arrêter un envoi déjà parti.
        console.error(`journal de l'automatisme ${key} non écrit`, error instanceof Error ? error.name : "inconnue");
      }
    },
  };
}
