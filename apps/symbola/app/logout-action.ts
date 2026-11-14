"use server";

// Lot 33 (SEC-01) : la déconnexion ferme la session Symbola, puis celle du fournisseur
// d'identité, qui ramène sur la page de connexion.
import { redirect } from "next/navigation";
import { destroySession } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { clearSessionCookie, getSessionToken } from "@/lib/auth-context";
import { identity } from "@/lib/identity";

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) await destroySession(appDatabase(), token);
  await clearSessionCookie();
  let target = "/login";
  try {
    target = (await identity().oidc.endSessionUrl()).toString();
  } catch {
    // Fournisseur injoignable : la session Symbola est déjà fermée.
  }
  redirect(target);
}
