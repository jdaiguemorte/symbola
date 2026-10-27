import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localeFromAcceptLanguage } from "@symbola/i18n";

export const LOCALE_COOKIE = "symbola_locale";

// CSP par nonce (SOC-09) : une CSP statique sans script-src (donc
// repliée sur default-src 'self') bloque les scripts inline que Next.js
// injecte lui-même pour l'hydratation de l'App Router — constaté au
// premier déploiement réel (écran blanc, « Refused to execute a script
// because its hash, its nonce, or 'unsafe-inline' appears in neither the
// script-src directive nor the default-src directive »). Un nonce généré
// par requête, posé à la fois sur l'en-tête de requête (que Next.js lit
// pour ses propres scripts) et sur l'en-tête de réponse, évite d'ouvrir
// script-src à 'unsafe-inline'.
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // Le Fast Refresh du serveur de dev de Next.js a besoin d'eval() pour
  // recharger les modules à chaud ; une CSP qui le bloque casse en
  // silence toute interactivité purement cliente en dev (constaté sur
  // AIDE-01 : les boutons de la visite guidée ne répondaient plus).
  // 'unsafe-eval' n'est donc ajouté qu'hors production — jamais envoyé
  // aux utilisateurs réels (pattern documenté par Next.js pour la CSP).
  const scriptSrc = [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`];
  if (process.env.NODE_ENV !== "production") scriptSrc.push("'unsafe-eval'");
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // HUB-04 : langue par défaut du navigateur, posée une seule fois (la
  // Server Action de profil et le choix lié au compte en prennent le
  // relais ensuite) — jamais écrasée si déjà présente.
  if (!request.cookies.get(LOCALE_COOKIE)) {
    response.cookies.set(LOCALE_COOKIE, localeFromAcceptLanguage(request.headers.get("accept-language")), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  // Exclut les assets statiques et images : inutile d'y poser un nonce,
  // et ça évite de recalculer la CSP sur chaque fichier servi.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
