// Lot 33 (SEC-07, HUB-01) — ouverture du lien magique : le lien scellé donne l'adresse et le
// jeton à usage unique ; la demande d'autorisation est poussée de serveur à serveur, puis le
// navigateur part chez le fournisseur avec une référence opaque. Le fournisseur consomme le
// jeton (usage unique, quinze minutes) ; un lien échu ou altéré ramène à la connexion.
import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { openMagicLink, readMfaEncryptionKey } from "@symbola/auth";
import { identity, rememberPendingAuthorization } from "@/lib/identity";

export async function GET(_request: Request, { params }: { params: Promise<{ lien: string }> }): Promise<Response> {
  const { oidc, appPublicUrl } = identity();
  const payload = openMagicLink((await params).lien, readMfaEncryptionKey());
  if (!payload) return NextResponse.redirect(`${appPublicUrl}/login?lien=invalide`, 303);
  try {
    const { url, pending } = await oidc.authorize({ loginHint: payload.email, oneTimeToken: payload.token, locale: (await getLocale()) === "en" ? "en" : "fr" });
    await rememberPendingAuthorization(pending);
    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error("lien de connexion : fournisseur d'identité injoignable", error instanceof Error ? error.name : "erreur");
    return NextResponse.redirect(`${appPublicUrl}/login?erreur=connexion`, 303);
  }
}
