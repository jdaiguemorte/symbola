// Lot 11 — accès commun aux réglages du carnet (session, organisation, module).
import { redirect } from "next/navigation";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isVendorsModuleEnabled } from "../module-access";

export async function vendorSettingsAccess(): Promise<{ organizationId: string; enabled: boolean }> {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  return { organizationId: auth.user.organizationId, enabled: await isVendorsModuleEnabled(auth.user.organizationId) };
}
