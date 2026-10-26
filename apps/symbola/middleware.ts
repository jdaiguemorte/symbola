import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Exclut les assets statiques et images : inutile d'y poser un nonce,
  // et ça évite de recalculer la CSP sur chaque fichier servi.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
