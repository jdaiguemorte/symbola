// Lot 24b (SEC-05) — réglages du cookie de session, partagés par la connexion
// (lib/auth-context.ts) et le middleware, qui le prolonge à chaque navigation :
// inaccessible aux scripts (HttpOnly), limité au site (SameSite=Lax) et au
// HTTPS en production (Secure), expiré après 8 heures sans activité, comme la
// session en base (packages/auth, requireUser). Sans dépendance Node : le
// middleware s'exécute hors de Node.
export const SESSION_COOKIE_NAME = "symbola_session";
export const SESSION_IDLE_SECONDS = 8 * 60 * 60;

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

export function sessionCookieOptions(nodeEnv: string | undefined = process.env.NODE_ENV): SessionCookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: nodeEnv === "production", path: "/", maxAge: SESSION_IDLE_SECONDS };
}
