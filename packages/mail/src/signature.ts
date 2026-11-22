// Lot 66c (HUB-18 ; D5 ; ADR 0113) — composer la signature d'un e-mail à partir de celle d'un membre et
// des éléments que l'organisation affiche. Fonction pure, sans dépendance : l'e-mail (serveur) et
// l'aperçu en direct de « Ma signature » (navigateur) donnent le même résultat.
import type { MailSignature } from "./layout";

export type SignatureElementKey = "photo" | "title" | "organization" | "phone" | "website" | "links";

export type SignatureSource = {
  displayName: string | null;
  jobTitle: string | null;
  phone: string | null;
  website: string | null;
  links: { label: string; url: string }[];
  hasPhoto: boolean;
};

export const SIGNATURE_PHOTO_CID = "signature@symbola";

// L'adresse d'un site telle qu'on la lit dans une signature : sans « https:// » ni barre finale.
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// Sans nom affiché, pas de signature. Lignes : « Fonction · Organisation », puis « Téléphone · site ».
export function composeMailSignature(source: SignatureSource, elements: readonly SignatureElementKey[], organizationName: string): MailSignature | null {
  const name = source.displayName?.trim();
  if (!name) return null;
  const shown = new Set(elements);
  const join = (parts: (string | null | undefined)[]) => parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part)).join(" · ");
  const first = join([shown.has("title") ? source.jobTitle : null, shown.has("organization") ? organizationName : null]);
  const second = join([shown.has("phone") ? source.phone : null, shown.has("website") && source.website ? displayUrl(source.website) : null]);
  return {
    name,
    lines: [first, second].filter(Boolean),
    links: shown.has("links") ? source.links.filter((link) => link.label.trim() && link.url.trim()) : [],
    photoCid: shown.has("photo") && source.hasPhoto ? SIGNATURE_PHOTO_CID : null,
  };
}
