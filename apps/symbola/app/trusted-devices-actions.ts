"use server";

// SEC-03 (lot 16, ADR 0038) — « oublier mes appareils » : le code de double
// authentification est de nouveau demandé à la prochaine connexion, partout.
import { forgetTrustedDevices } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { clearTrustedDeviceCookie, getAuthContext } from "@/lib/auth-context";

export type TrustedDevicesFormState = { forgotten?: boolean };

export async function forgetTrustedDevicesAction(_prevState: TrustedDevicesFormState, _formData: FormData): Promise<TrustedDevicesFormState> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return {};
  const db = appDatabase();
  await forgetTrustedDevices(db, auth.user.id);
  await clearTrustedDeviceCookie();
  return { forgotten: true };
}
