// Lot 54 (HUB-27, DOC-06 ; ADR 0101) — e-mails de Symbola à la Propriétaire : rappels de fin d'essai
// (J-7, J-1), fin de l'essai, résiliation confirmée, quota de stockage (80 %, 95 %, plein). Texte fixe
// des fichiers de traduction ; chaque envoi a sa clé (rejouable sans doublon).
import { eq } from "drizzle-orm";
import { listTeam } from "@symbola/auth";
import type { AppDatabase } from "@symbola/db/client";
import { organizations } from "@symbola/db/schema/hub";
import { parseEnv } from "@symbola/env";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { sendSymbolaEmail } from "./emails";

export type SubscriptionMail = "subscriptionTrialReminder" | "subscriptionTrialEnded" | "subscriptionCancelled" | "storageQuotaAlert" | "storageQuotaFull";

export function subscriptionMail(input: { locale: Locale; mail: SubscriptionMail; organizationName: string; date: Date | null; days?: number; percent?: number; url: string }): { subject: string; text: string; button: string } {
  const t = createTranslator({ locale: input.locale, messages: input.locale === "en" ? enMessages : frMessages, namespace: `Emails.fixed.${input.mail}` });
  const values = { organization: input.organizationName, date: input.date ? formatDateTime(input.date, input.locale) : "", days: input.days ?? 0, percent: input.percent ?? 0, url: input.url };
  return { subject: t("subject", values), text: t("body", values), button: t("button") };
}

// Les e-mails de l'abonnement et du quota vont à la Propriétaire (aux Propriétaires actives).
export async function notifyOwners(db: AppDatabase, input: { organizationId: string; mail: SubscriptionMail; date: Date | null; days?: number; percent?: number; key: string }): Promise<void> {
  try {
    const [[organization], team] = await Promise.all([db.select().from(organizations).where(eq(organizations.id, input.organizationId)), listTeam(db, input.organizationId)]);
    if (!organization) return;
    const env = parseEnv(process.env);
    const locale: Locale = organization.language === "en" ? "en" : "fr";
    const url = `${env.APP_PUBLIC_URL}/parametres/abonnement`;
    const mail = subscriptionMail({ locale, mail: input.mail, organizationName: organization.name, date: input.date, url, ...(input.days !== undefined ? { days: input.days } : {}), ...(input.percent !== undefined ? { percent: input.percent } : {}) });
    for (const owner of team.filter((member) => member.role === "owner" && !member.disabledAt)) {
      await sendSymbolaEmail({ to: owner.email, locale, subject: mail.subject, body: mail.text, button: { label: mail.button, url }, organizationId: input.organizationId, idempotencyKey: `${input.key}:${owner.id}` });
    }
  } catch (error) {
    // L'écran montre l'état de toute façon. Motif technique seulement (SEC-20).
    console.error("e-mail d'abonnement non envoyé", { organizationId: input.organizationId, mail: input.mail, error: error instanceof Error ? error.name : "inconnue" });
  }
}
