// Lot 66c (HUB-18, MSG-01 ; D5, D6 ; ADR 0113) — la marque des e-mails au départ, en données (CLAUDE.md
// § 2.6) : la police, les éléments affichés des signatures et les noms de liens proposés, par langue.
import { z } from "zod";
import emailBrandingFile from "./email-branding.json";

const FONTS = ["sans", "serif", "elegant", "rounded"] as const;
const ELEMENTS = ["photo", "title", "organization", "phone", "website", "links"] as const;
const label = z.string().trim().min(1).max(40);
const emailBrandingSchema = z.object({
  version: z.literal(1),
  font: z.enum(FONTS),
  signatureElements: z.array(z.enum(ELEMENTS)).max(ELEMENTS.length),
  linkSuggestions: z.object({ fr: z.array(label).min(1).max(12), en: z.array(label).min(1).max(12) }),
});
const emailBranding = emailBrandingSchema.parse(emailBrandingFile);

export type StarterEmailBranding = { font: (typeof FONTS)[number]; signatureElements: (typeof ELEMENTS)[number][] };

export function starterEmailBranding(): StarterEmailBranding {
  return { font: emailBranding.font, signatureElements: [...emailBranding.signatureElements] };
}

export function starterSignatureLinkSuggestions(locale: "fr" | "en"): string[] {
  return [...emailBranding.linkSuggestions[locale]];
}
