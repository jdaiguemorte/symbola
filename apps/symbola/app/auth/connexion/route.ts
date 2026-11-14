// Lot 33 (SEC-01, D5) — connexion par la page du fournisseur d'identité (mot de passe, clé
// d'accès, code par e-mail) : demande d'autorisation poussée, puis redirection.
import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { identity, rememberPendingAuthorization } from "@/lib/identity";

export async function GET(): Promise<Response> {
  const { oidc, appPublicUrl } = identity();
  try {
    const { url, pending } = await oidc.authorize({ locale: (await getLocale()) === "en" ? "en" : "fr" });
    await rememberPendingAuthorization(pending);
    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error("connexion : fournisseur d'identité injoignable", error instanceof Error ? error.name : "erreur");
    return NextResponse.redirect(`${appPublicUrl}/login?erreur=connexion`, 303);
  }
}
