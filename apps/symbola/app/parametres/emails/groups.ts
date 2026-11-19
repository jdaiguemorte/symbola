// Lot 38a (MSG-01 ; D3, D6 ; ADR 0072) — les modèles d'e-mails rangés par sujet, chacun rattaché au
// module qui l'envoie : un modèle d'un module non souscrit n'est pas proposé (CLAUDE.md § 2.2).
import type { EmailLocale, EmailTemplateKind } from "@symbola/contracts";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { isAppointmentsModuleEnabled } from "@/modules/appointments/service";

// Lot 52 : « hub », les e-mails du compte et de l'équipe, toujours proposés.
type TemplateModule = "hub" | "events" | "quotes" | "appointments";

export const EMAIL_TEMPLATE_GROUPS: { key: "links" | "reminders" | "program" | "prospects" | "signatures" | "settlement" | "appointments" | "vendors" | "team"; module: TemplateModule; kinds: EmailTemplateKind[] }[] = [
  // Lot 52 (EVT-06, D3) : le lien du renfort du jour J.
  { key: "links", module: "events", kinds: ["client_link", "client_link_renewed", "vendor_link", "vendor_link_renewed", "day_helper_link"] },
  { key: "reminders", module: "events", kinds: ["task_reminder"] },
  { key: "program", module: "events", kinds: ["program_published"] },
  // Lot 44 (CRM-01, D7) : « Nouvelle demande de contact », à la titulaire.
  // Lot 45 (CRM-05, CRM-06, POR-07 ; D9) : réponse et relance d'un prospect, questionnaire envoyé.
  { key: "prospects", module: "events", kinds: ["prospect_form_received", "prospect_reply", "prospect_follow_up", "questionnaire_sent"] },
  // Lot 47 (PRE-03, PAR-05) : brief aux prestataires, sa relance, feuille de route.
  { key: "vendors", module: "events", kinds: ["vendor_brief", "vendor_brief_reminder", "vendor_roadmap"] },
  { key: "signatures", module: "quotes", kinds: ["quote_signature", "contract_signature", "order_first", "signed_copy"] },
  // Lot 43 (FAC-02, FAC-08, FAC-09, FAC-15 ; D10 ; migration 0169) : proposition et règlement par virement.
  { key: "settlement", module: "quotes", kinds: ["proposal_sent", "proposal_expiry_reminder", "payment_details", "invoice_reminder"] },
  // Lot 46 (RDV-03, D10 ; migration 0158) : e-mails d'un rendez-vous, côté personne qui l'a pris.
  { key: "appointments", module: "appointments", kinds: ["appointment_confirmed", "appointment_reminder", "appointment_rescheduled", "appointment_cancelled"] },
  // Lot 52 (HUB-04, SEC-08 ; migration 0180) : transfert de propriété et alertes de sécurité du compte.
  { key: "team", module: "hub", kinds: ["ownership_transfer", "new_device_login", "identity_changed"] },
];

// La langue du modèle affiché : celle demandée (?langue=), sinon celle de l'écran.
export function templateLocale(requested: string | undefined, interfaceLocale: string): EmailLocale {
  if (requested === "fr" || requested === "en") return requested;
  return interfaceLocale === "en" ? "en" : "fr";
}

export async function enabledTemplateModules(organizationId: string): Promise<Set<TemplateModule>> {
  const [events, quotes, appointments] = await Promise.all([isEventsModuleEnabled(organizationId), isQuotesModuleEnabled(organizationId), isAppointmentsModuleEnabled(organizationId)]);
  const enabled = new Set<TemplateModule>(["hub"]);
  if (events) enabled.add("events");
  if (quotes) enabled.add("quotes");
  if (appointments) enabled.add("appointments");
  return enabled;
}

export async function isTemplateAvailable(organizationId: string, kind: EmailTemplateKind): Promise<boolean> {
  const group = EMAIL_TEMPLATE_GROUPS.find((candidate) => candidate.kinds.includes(kind));
  return group ? (await enabledTemplateModules(organizationId)).has(group.module) : false;
}
