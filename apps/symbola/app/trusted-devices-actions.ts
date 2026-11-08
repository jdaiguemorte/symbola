"use server";

// SEC-03 (lot 16, ADR 0038) — « oublier mes appareils » : le code de double
// authentification est de nouveau demandé à la prochaine connexion, partout.
import { forgetTrustedDevices } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { clearTrustedDeviceCookie, getAuthContext } from "@/lib/auth-context";

export type TrustedDevicesFormState = { forgotten?: boolean };

export async function forgetTrustedDevicesAction(_prevState: TrustedDevicesFormState, _formData: FormData): Promise<TrustedDevicesFormState> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return {};
  const { sql, db } = createAppConnection();
  try {
    await forgetTrustedDevices(db, auth.user.id);
  } finally {
    await sql.end();
  }
  await clearTrustedDeviceCookie();
  return { forgotten: true };
}
