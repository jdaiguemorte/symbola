// Lot 11 — accès commun aux réglages du carnet (session, organisation, module).
import { requirePlanner } from "@/lib/guards";
import { isVendorsModuleEnabled } from "../module-access";

export async function vendorSettingsAccess(): Promise<{ organizationId: string; enabled: boolean }> {
  const auth = await requirePlanner();
  return { organizationId: auth.user.organizationId, enabled: await isVendorsModuleEnabled(auth.user.organizationId) };
}
