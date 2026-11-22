// Lot 65d (MSG-01, HUB-20, HUB-28 ; ADR 0110) — la fenêtre « Préparer l'e-mail » : les messages de la
// relation déposés « À envoyer » (par un geste ou un automatisme), recomposés à l'ouverture par le
// module qui les a déposés, puis mis en texte par le hub. Chaque module est lu par son service
// (ARC-01) ; un module fermé rend son message « indisponible » (ARC-06), jamais une erreur.
import { appDatabase } from "@symbola/db/client";
import type { EmailTemplateKind, PreparedEmailDraft, PreparedEmailView, RelationDraft } from "@symbola/contracts";
import { clientTermForEvent, draftEventsRelationEmail } from "@/modules/events/service";
import { composePreparedEmailText, EmailVariableMissingError, isModuleEnabled, listPreparedEmails } from "@/modules/hub/service";
import { draftQuoteRelationEmail } from "@/modules/quotes/service";

const QUOTES_KINDS: ReadonlySet<EmailTemplateKind> = new Set(["proposal_sent", "proposal_expiry_reminder", "order_first", "payment_details", "invoice_reminder", "payment_due_reminder"]);

export function preparedEmailModule(kind: EmailTemplateKind): "quotes" | "events" {
  return QUOTES_KINDS.has(kind) ? "quotes" : "events";
}

async function draftOf(organizationId: string, item: PreparedEmailView, now: Date): Promise<RelationDraft | null> {
  const module = preparedEmailModule(item.kind);
  if (!(await isModuleEnabled(appDatabase(), organizationId, module))) return null;
  if (module === "quotes") {
    return draftQuoteRelationEmail(organizationId, item, { now, clientTerm: async (eventId, locale) => (await clientTermForEvent(organizationId, eventId, locale)).term });
  }
  return draftEventsRelationEmail(organizationId, item, now);
}

function unavailable(item: PreparedEmailView, problem: "missing_variable" | "unavailable"): PreparedEmailDraft {
  return { id: item.id, kind: item.kind, eventId: item.eventId, to: "", recipientName: "", subject: "", body: "", renewedLink: false, pdfHref: null, problem };
}

// Les messages « à envoyer » demandés, dans l'ordre demandé ; un identifiant d'une autre organisation,
// déjà envoyé ou écarté n'est pas rendu (RLS, puis l'état).
export async function draftPreparedEmails(organizationId: string, ids: string[], now: Date = new Date()): Promise<PreparedEmailDraft[]> {
  const items = await listPreparedEmails(organizationId, { ids, status: "to_send" });
  const byId = new Map(items.map((item) => [item.id, item]));
  const drafts: PreparedEmailDraft[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) continue;
    const draft = await draftOf(organizationId, item, now);
    if (!draft) {
      drafts.push(unavailable(item, "unavailable"));
      continue;
    }
    try {
      const text = draft.text ?? (await composePreparedEmailText({ organizationId, kind: item.kind, locale: draft.locale, values: draft.values }));
      drafts.push({ id: item.id, kind: item.kind, eventId: item.eventId, to: draft.to, recipientName: draft.recipientName, subject: text.subject, body: text.body, renewedLink: draft.renewedLink ?? false, pdfHref: draft.pdfHref ?? null, problem: null });
    } catch (error) {
      if (!(error instanceof EmailVariableMissingError)) throw error;
      drafts.push(unavailable(item, "missing_variable"));
    }
  }
  return drafts;
}

// Après un geste qui a préparé des messages (proposition, brief, programme…) : les messages « à
// envoyer » de cet évènement et de ces modèles (et de ces références, si données), pour ouvrir la
// fenêtre aussitôt.
export async function pendingPreparedEmailIds(organizationId: string, filter: { eventId: string; kinds: EmailTemplateKind[]; ref?: Record<string, string> }): Promise<string[]> {
  const items = await listPreparedEmails(organizationId, { eventId: filter.eventId, status: "to_send" });
  return items
    .filter((item) => filter.kinds.includes(item.kind) && Object.entries(filter.ref ?? {}).every(([key, value]) => item.ref[key] === value))
    .slice(0, 30)
    .map((item) => item.id);
}

// L'adresse de l'écran, avec la fenêtre « Préparer l'e-mail » ouverte (des identifiants seulement).
export function withPreparer(path: string, ids: string[]): string {
  return `${path}${path.includes("?") ? "&" : "?"}preparer=${ids.join(",")}`;
}
