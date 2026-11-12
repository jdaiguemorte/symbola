// Lot 26a (SEC-17, décision D7 ; ADR 0053) — réglages du cookie d'une session
// ouverte par un lien personnel, partagés par la page /lien et le middleware,
// qui le prolonge à chaque navigation. Comme le cookie des comptes : HttpOnly,
// SameSite=Lax, Secure en production. 30 jours sans visite ; la base refuse de
// toute façon une session au-delà de l'expiration de son lien. Sans dépendance
// Node : le middleware s'exécute hors de Node.
export const LINK_COOKIE_NAME = "symbola_lien";
export const LINK_COOKIE_IDLE_SECONDS = 30 * 24 * 60 * 60;

export type LinkCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

// Lot 26b (D9) : l'espace d'un lien dépend de son public ; le portail est
// celui du client, /prestataire celui du prestataire.
export function linkHomePath(audience: "client" | "vendor" | "guest"): "/portail" | "/prestataire" {
  return audience === "vendor" ? "/prestataire" : "/portail";
}

export function linkCookieOptions(maxAge: number = LINK_COOKIE_IDLE_SECONDS, nodeEnv: string | undefined = process.env.NODE_ENV): LinkCookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: nodeEnv === "production", path: "/", maxAge: Math.min(maxAge, LINK_COOKIE_IDLE_SECONDS) };
}
