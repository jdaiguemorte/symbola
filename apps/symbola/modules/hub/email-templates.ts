// Lot 38a (MSG-01 ; D3, D5, D6 ; ADR 0072) — modèles des e-mails que l'organisation adresse aux tiers,
// par nature et par langue. Un modèle que l'organisation n'a pas réécrit vaut le texte de départ
// (packages/starter-templates) ; « Revenir au texte de départ » supprime sa ligne. Un modèle ne
// s'enregistre que sans variable inconnue et avec ses variables indispensables. Exposé seulement
// par service.ts (ADR 0011).
import { and, desc, eq, gte } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { emailTemplates } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { EMAIL_TEMPLATE_KINDS, type EmailLocale, type EmailTemplateKind, type EmailTemplateText, type EmailTemplateView } from "@symbola/contracts";
import { starterEmailTemplate } from "@symbola/starter-templates";
import { validateEmailTemplate, type EmailTemplateProblems } from "./email-template-rules";

export class EmailTemplateInvalidError extends Error {
  constructor(readonly problems: EmailTemplateProblems & { empty: ("subject" | "body")[] }) {
    super("modèle d'e-mail invalide");
    this.name = "EmailTemplateInvalidError";
  }
}

export function isEmailTemplateKind(value: string): value is EmailTemplateKind {
  return (EMAIL_TEMPLATE_KINDS as readonly string[]).includes(value);
}

export async function listEmailTemplates(organizationId: string, locale: EmailLocale): Promise<EmailTemplateView[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(emailTemplates).where(eq(emailTemplates.locale, locale)));
  const own = new Map(rows.map((row) => [row.kind, row]));
  return EMAIL_TEMPLATE_KINDS.map((kind) => {
    const row = own.get(kind);
    return row ? { kind, locale, subject: row.subject, body: row.body, customized: true } : { kind, locale, ...starterEmailTemplate(kind, locale), customized: false };
  });
}

export async function getEmailTemplate(organizationId: string, kind: EmailTemplateKind, locale: EmailLocale): Promise<EmailTemplateView> {
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx.select().from(emailTemplates).where(and(eq(emailTemplates.kind, kind), eq(emailTemplates.locale, locale))),
  );
  return row ? { kind, locale, subject: row.subject, body: row.body, customized: true } : { kind, locale, ...starterEmailTemplate(kind, locale), customized: false };
}

export async function saveEmailTemplate(input: { organizationId: string; kind: EmailTemplateKind; locale: EmailLocale } & EmailTemplateText): Promise<EmailTemplateView> {
  const text = { subject: input.subject.trim(), body: input.body.replace(/\r\n/g, "\n").trim() };
  const problems = validateEmailTemplate(input.kind, text);
  const empty: ("subject" | "body")[] = [];
  if (!text.subject) empty.push("subject");
  if (!text.body) empty.push("body");
  if (empty.length > 0 || problems.unknown.length > 0 || problems.missingRequired.length > 0 || problems.tooLong.length > 0) {
    throw new EmailTemplateInvalidError({ ...problems, empty });
  }
  await withOrganization(appDatabase(), input.organizationId, (tx) =>
    tx
      .insert(emailTemplates)
      .values({ organizationId: input.organizationId, kind: input.kind, locale: input.locale, ...text })
      .onConflictDoUpdate({ target: [emailTemplates.organizationId, emailTemplates.kind, emailTemplates.locale], set: { ...text, updatedAt: new Date() } }),
  );
  return { kind: input.kind, locale: input.locale, ...text, customized: true };
}

export async function resetEmailTemplate(organizationId: string, kind: EmailTemplateKind, locale: EmailLocale): Promise<EmailTemplateView> {
  await withOrganization(appDatabase(), organizationId, (tx) => tx.delete(emailTemplates).where(and(eq(emailTemplates.kind, kind), eq(emailTemplates.locale, locale))));
  return { kind, locale, ...starterEmailTemplate(kind, locale), customized: false };
}

// D5 — « Aujourd'hui » : les rappels automatiques arrêtés par une variable sans valeur depuis 24 heures
// (lignes du journal), comptés par évènement ; le modèle en cause est celui du plus récent.
export async function recentEmailVariableProblems(organizationId: string, now: Date = new Date()): Promise<{ events: number; kind: EmailTemplateKind; locale: EmailLocale } | null> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ objectId: auditEntries.objectId, details: auditEntries.details })
      .from(auditEntries)
      .where(and(eq(auditEntries.organizationId, organizationId), eq(auditEntries.action, "hub.mail.variable_missing"), gte(auditEntries.occurredAt, since)))
      .orderBy(desc(auditEntries.occurredAt)),
  );
  if (rows.length === 0) return null;
  const kind = String(rows[0]!.details.kind ?? "");
  const locale = rows[0]!.details.locale === "en" ? "en" : "fr";
  return { events: new Set(rows.map((row) => row.objectId)).size, kind: isEmailTemplateKind(kind) ? kind : "task_reminder", locale };
}
