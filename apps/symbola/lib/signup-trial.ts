// Lot 54 (HUB-27, NFR-26 ; ADR 0101) — à l'inscription (lot 33), l'essai de 30 jours de la suite
// complète, sans carte, quand l'abonnement en libre-service est ouvert (interrupteur
// « subscription_self_service », fermé pour tous jusqu'à l'ouverture commerciale). Fermé : rien ne
// change, l'organisation reste réglée par l'Exploitation. Un échec ne bloque jamais l'inscription.
import { appDatabase } from "@symbola/db/client";
import { isFeatureEnabled, startTrial } from "@/modules/hub/service";

export async function startTrialAtSignup(organizationId: string, now: Date = new Date()): Promise<boolean> {
  try {
    const db = appDatabase();
    if (!(await isFeatureEnabled(db, organizationId, "subscription_self_service"))) return false;
    await startTrial(db, { organizationId, now });
    return true;
  } catch (error) {
    console.error("essai non commencé à l'inscription", { organizationId, error: error instanceof Error ? error.name : "inconnue" });
    return false;
  }
}
