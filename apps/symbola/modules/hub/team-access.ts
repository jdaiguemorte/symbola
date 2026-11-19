// Lot 52 (HUB-04, EVT-06, SEC-08 ; D2, D6 ; ADR 0094) — côté hub : le réglage « toutes les Planners
// voient tous les évènements », et les e-mails de sécurité d'un compte (nouvel appareil, changement
// d'identité). Un e-mail de compte part avec le modèle de l'organisation active du compte (sa première
// adhésion active), dans la langue du compte ; un compte d'exploitation, sans organisation, reçoit le
// texte fixe de Symbola. Jamais d'adresse dans les journaux (SEC-20).
import { and, asc, eq, isNull } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { memberships, organizations, users } from "@symbola/db/schema/hub";
import type { EmailTemplateKind, EmailValues } from "@symbola/contracts";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { sendOrganizationEmail, sendSymbolaEmail } from "./emails";

export async function getEventVisibility(db: AppDatabase, organizationId: string): Promise<{ allPlannersSeeAll: boolean }> {
  const [row] = await db.select({ allPlannersSeeAll: organizations.allPlannersSeeAllEvents }).from(organizations).where(eq(organizations.id, organizationId));
  return { allPlannersSeeAll: row?.allPlannersSeeAll ?? true };
}

export async function setEventVisibility(db: AppDatabase, input: { organizationId: string; allPlannersSeeAll: boolean; byUserId: string }): Promise<void> {
  await db.update(organizations).set({ allPlannersSeeAllEvents: input.allPlannersSeeAll }).where(eq(organizations.id, input.organizationId));
  await recordAudit(db, {
    organizationId: input.organizationId,
    action: "hub.organization.visibility_changed",
    objectId: input.organizationId,
    details: { allPlannersSeeAll: input.allPlannersSeeAll },
    actor: { kind: "member", id: input.byUserId },
  });
}

export type AccountEmailContext = { locale: "fr" | "en"; organizationId: string | null };

// L'organisation et la langue d'un compte, pour lui écrire.
export async function accountEmailContext(db: AppDatabase, userId: string): Promise<AccountEmailContext | null> {
  const [user] = await db.select({ language: users.language }).from(users).where(eq(users.id, userId));
  if (!user) return null;
  const [membership] = await db
    .select({ organizationId: memberships.organizationId, language: organizations.language })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.disabledAt)))
    .orderBy(asc(memberships.createdAt));
  const locale = user.language ?? membership?.language ?? "fr";
  return { locale: locale === "en" ? "en" : "fr", organizationId: membership?.organizationId ?? null };
}

type AccountEmailKind = Extract<EmailTemplateKind, "new_device_login" | "identity_changed">;

// Un e-mail de sécurité d'un compte, à l'adresse donnée (l'ancienne, pour un changement d'adresse).
export async function sendAccountEmail(db: AppDatabase, input: { userId: string; to: string; kind: AccountEmailKind; values: EmailValues; idempotencyKey?: string }): Promise<void> {
  const context = await accountEmailContext(db, input.userId);
  if (!context) return;
  if (context.organizationId) {
    await sendOrganizationEmail({ organizationId: context.organizationId, to: input.to, kind: input.kind, locale: context.locale, values: input.values, ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}) });
    return;
  }
  const t = createTranslator({ locale: context.locale, messages: context.locale === "en" ? enMessages : frMessages, namespace: "Emails.fixed.accountAlert" });
  const link = input.values.link ?? "";
  const body = input.kind === "new_device_login" ? t("newDeviceBody", { device: input.values.device ?? "", date: input.values.date_time ?? "", link }) : t("identityBody", { change: input.values.change ?? "", date: input.values.date_time ?? "", link });
  await sendSymbolaEmail({
    to: input.to,
    locale: context.locale,
    subject: t(input.kind === "new_device_login" ? "newDeviceSubject" : "identitySubject"),
    body,
    button: { label: t(input.kind === "new_device_login" ? "notMe" : "account"), url: link },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}
