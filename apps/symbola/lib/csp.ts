// SOC-09 — la Content-Security-Policy de chaque réponse, posée par middleware.ts avec un nonce par
// requête (voir le commentaire du middleware). Lot 44 (CRM-01, D1 ; ADR 0084) : `frame-ancestors`
// reste 'none' partout, sauf sur la page encadrée du formulaire de contact
// (/contact/<adresse>/cadre), qui accepte comme parents les seuls sites déclarés par la planner.

// Le chemin de la page encadrée, et l'adresse du formulaire qu'il désigne.
const FRAME_PAGE = /^\/contact\/([a-z0-9]+(?:-[a-z0-9]+)*)\/cadre\/?$/;

export function contactFrameSlug(pathname: string): string | null {
  const match = FRAME_PAGE.exec(pathname);
  return match && match[1]!.length >= 3 && match[1]!.length <= 60 ? match[1]! : null;
}

// Une origine sûre à écrire dans la politique : https, sans chemin, sans joker ni caractère qui
// casserait la directive (la base les a déjà normalisées, on revérifie).
const SAFE_ORIGIN = /^https:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i;

// null : page non encadrable ('none'). Une liste (la page encadrée d'un formulaire ouvert) : Symbola
// lui-même (l'aperçu des réglages) et les sites déclarés.
export function frameAncestors(origins: readonly string[] | null): string {
  if (origins === null) return "'none'";
  return ["'self'", ...origins.filter((origin) => SAFE_ORIGIN.test(origin))].join(" ");
}

export function contentSecurityPolicy(input: { nonce: string; production: boolean; frameAncestors?: readonly string[] | null }): string {
  const scriptSrc = [`'self'`, `'nonce-${input.nonce}'`, `'strict-dynamic'`];
  // Le Fast Refresh du serveur de dev a besoin d'eval() (jamais envoyé en production).
  if (!input.production) scriptSrc.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'nonce-${input.nonce}'`,
    // Lot 11 (ADR 0031) : la carte décode ses tuiles dans un worker servi par l'app, et dessine ses
    // images en mémoire (blob:, data:).
    "worker-src 'self' blob:",
    "img-src 'self' data: blob:",
    `frame-ancestors ${frameAncestors(input.frameAncestors ?? null)}`,
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}
