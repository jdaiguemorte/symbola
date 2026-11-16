// Lot 38a (MSG-01 ; D3, D6 ; ADR 0072) — les modèles d'e-mails rangés par sujet, chacun rattaché au
// module qui l'envoie : un modèle d'un module non souscrit n'est pas proposé (CLAUDE.md § 2.2).
import type { EmailLocale, EmailTemplateKind } from "@symbola/contracts";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { isEventsModuleEnabled } from "@/app/events/module-access";

type TemplateModule = "events" | "quotes";

export const EMAIL_TEMPLATE_GROUPS: { key: "links" | "reminders" | "program" | "signatures"; module: TemplateModule; kinds: EmailTemplateKind[] }[] = [
  { key: "links", module: "events", kinds: ["client_link", "client_link_renewed", "vendor_link", "vendor_link_renewed"] },
  { key: "reminders", module: "events", kinds: ["task_reminder"] },
  { key: "program", module: "events", kinds: ["program_published"] },
  { key: "signatures", module: "quotes", kinds: ["quote_signature", "contract_signature", "order_first", "signed_copy"] },
];

// La langue du modèle affiché : celle demandée (?langue=), sinon celle de l'écran.
export function templateLocale(requested: string | undefined, interfaceLocale: string): EmailLocale {
  if (requested === "fr" || requested === "en") return requested;
  return interfaceLocale === "en" ? "en" : "fr";
}

export async function enabledTemplateModules(organizationId: string): Promise<Set<TemplateModule>> {
  const [events, quotes] = await Promise.all([isEventsModuleEnabled(organizationId), isQuotesModuleEnabled(organizationId)]);
  const enabled = new Set<TemplateModule>();
  if (events) enabled.add("events");
  if (quotes) enabled.add("quotes");
  return enabled;
}

export async function isTemplateAvailable(organizationId: string, kind: EmailTemplateKind): Promise<boolean> {
  const group = EMAIL_TEMPLATE_GROUPS.find((candidate) => candidate.kinds.includes(kind));
  return group ? (await enabledTemplateModules(organizationId)).has(group.module) : false;
}
