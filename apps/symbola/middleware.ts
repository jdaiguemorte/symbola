import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localeFromAcceptLanguage } from "@symbola/i18n";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./lib/session-cookie";
import { LINK_COOKIE_NAME, linkCookieOptions } from "./lib/link-cookie";
import { contactFrameSlug, contentSecurityPolicy } from "./lib/csp";
// Lot 44 (ADR 0084) : la seule lecture en base du middleware, la liste des sites autorisés d'un
// formulaire ouvert ; importée du module sans son service, pour garder le middleware léger.
import { contactFrameOrigins } from "./modules/events/contact-frame";

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
export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // Le Fast Refresh du serveur de dev de Next.js a besoin d'eval() pour
  // recharger les modules à chaud ; une CSP qui le bloque casse en
  // silence toute interactivité purement cliente en dev (constaté sur
  // AIDE-01 : les boutons de la visite guidée ne répondaient plus).
  // 'unsafe-eval' n'est donc ajouté qu'hors production — jamais envoyé
  // aux utilisateurs réels (pattern documenté par Next.js pour la CSP).
  // Lot 44 (CRM-01, D1 ; ADR 0084) : la page encadrée du formulaire de contact accepte comme parents
  // les sites déclarés par la planner ; toute autre page garde frame-ancestors 'none'.
  const frameSlug = contactFrameSlug(request.nextUrl.pathname);
  const ancestors = frameSlug ? await contactFrameOrigins(frameSlug).catch(() => null) : null;
  const csp = contentSecurityPolicy({ nonce, production: process.env.NODE_ENV === "production", frameAncestors: ancestors });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Lot 12 (ONB-03) : le chemin demandé, pour que la structure d'écran
  // renvoie vers l'assistant de démarrage tant qu'il n'est pas terminé.
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // Lot 24b (SEC-05) : le cookie de session expire après 8 heures sans
  // activité, comme la session en base ; chaque navigation le prolonge. Pas les
  // envois de formulaire (POST) : la déconnexion efface le cookie elle-même.
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (session && request.method === "GET") response.cookies.set(SESSION_COOKIE_NAME, session, sessionCookieOptions());
  // Lot 26a (décision D7) : la session d'un lien personnel dure 30 jours sans
  // visite ; la base la refuse de toute façon après l'expiration du lien.
  const linkSession = request.cookies.get(LINK_COOKIE_NAME)?.value;
  if (linkSession && request.method === "GET") response.cookies.set(LINK_COOKIE_NAME, linkSession, linkCookieOptions());

  // PRD-HUB-04 : langue par défaut du navigateur, posée une seule fois (la
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
  // Lot 44 (ADR 0084) : le middleware lit la base pour la page encadrée (environnement Node.js,
  // stable depuis Next.js 15.5).
  runtime: "nodejs",
};
