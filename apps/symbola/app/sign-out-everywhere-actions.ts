"use server";

// Lot 24b (SEC-06) — « Déconnecter tous mes autres appareils » : ferme toutes
// les sessions du compte sauf celle en cours, et oublie ses appareils de
// confiance. Utile après la perte d'un téléphone ou sur un ordinateur partagé.
import { revokeOtherSessions } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { clearTrustedDeviceCookie, getAuthContext, getSessionToken } from "@/lib/auth-context";

export type SignOutEverywhereFormState = { closed?: number };

export async function signOutEverywhereAction(_prevState: SignOutEverywhereFormState, _formData: FormData): Promise<SignOutEverywhereFormState> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return {};
  const closed = await revokeOtherSessions(appDatabase(), { userId: auth.user.id, currentSessionToken: await getSessionToken() });
  await clearTrustedDeviceCookie();
  return { closed };
}
