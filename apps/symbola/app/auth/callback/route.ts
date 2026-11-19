// Lot 33 (SEC-01, HUB-01, HUB-02, ADR 0067) — retour du fournisseur d'identité : jeton vérifié
// (openid-client), puis session Symbola (compte retrouvé, repris ou créé avec son organisation).
// Un nouveau compte part au démarrage ; un accès retiré est refusé sans détail.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signInWithIdentity } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { setSessionCookie } from "@/lib/auth-context";
import { ORGANIZATION_COOKIE_NAME } from "@/lib/active-organization";
import { identity, requireMfaAtProvider, takePendingAuthorization } from "@/lib/identity";
import { requestClientIp } from "@/lib/rate-limit";
import { readDevice, rememberDeviceCookie } from "@/lib/device";
import { sendNewDeviceAlert } from "@/lib/account-alerts";

export async function GET(request: Request): Promise<Response> {
  const { oidc, appPublicUrl } = identity();
  const pending = await takePendingAuthorization();
  if (!pending) return NextResponse.redirect(`${appPublicUrl}/login?erreur=connexion`, 303);
  try {
    const claims = await oidc.complete(new URL(request.url).searchParams, pending);
    const preferredOrganizationId = (await cookies()).get(ORGANIZATION_COOKIE_NAME)?.value ?? null;
    // Lot 52 (HUB-05, SEC-08) : l'appareil (navigateur, identifiant du cookie), jamais l'adresse IP.
    const device = await readDevice();
    const outcome = await signInWithIdentity(appDatabase(), claims, { preferredOrganizationId, clientIp: await requestClientIp(), device });
    if (outcome.outcome === "refused") return NextResponse.redirect(`${appPublicUrl}/login?acces=refuse`, 303);
    // D4 : la double authentification devient obligatoire chez le fournisseur pour la Propriétaire,
    // le Comptable (lot 52) et l'Exploitation, sauf pendant la séance d'inscription.
    if (outcome.requiresMfa && !outcome.isNewAccount) await requireMfaAtProvider(claims.subject);
    await setSessionCookie(outcome.sessionToken);
    await rememberDeviceCookie(outcome.deviceId);
    // SEC-08 : connexion depuis un appareil inconnu de ce compte.
    if (outcome.newDevice) await sendNewDeviceAlert({ userId: outcome.userId, email: claims.email.toLowerCase(), alert: outcome.newDevice });
    return NextResponse.redirect(`${appPublicUrl}${outcome.isNewAccount ? "/demarrage" : "/"}`, 303);
  } catch (error) {
    console.error("retour du fournisseur d'identité refusé", error instanceof Error ? error.name : "erreur");
    return NextResponse.redirect(`${appPublicUrl}/login?erreur=connexion`, 303);
  }
}
