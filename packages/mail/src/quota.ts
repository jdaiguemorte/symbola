// Lot 24b (SEC-22, décision D5) — plafond d'e-mails par organisation et par
// heure : chaque envoi vers une adresse saisie par l'équipe (signataire d'un
// devis, marié invité) est réservé avant de partir. Au-delà, l'envoi est
// refusé avec le délai à attendre ; la première fois dans l'heure, une ligne
// va au journal de l'organisation, et l'accueil affiche un bandeau. Les
// e-mails de sécurité (verrouillage, mot de passe oublié) n'y sont pas soumis.
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { consumeOrganizationMailQuota, organizationMailQuotaStatus, type MailQuotaStatus } from "@symbola/db/mail-quota";
import { consumeRateLimits } from "@symbola/db/rate-limit";

export class MailQuotaExceededError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("plafond d'envois de l'organisation atteint");
    this.name = "MailQuotaExceededError";
  }
}

export async function reserveOrganizationMail(organizationId: string, options: { cap?: number; now?: Date } = {}): Promise<void> {
  const db = appDatabase();
  const decision = await consumeOrganizationMailQuota(db, organizationId, options);
  if (decision.allowed) return;
  // Une seule ligne au journal par heure et par organisation.
  const alert = await consumeRateLimits(db, [{ bucket: "mail.organization.alert", key: organizationId, limit: 1, windowMs: 60 * 60_000 }], options.now);
  if (alert.allowed) {
    console.warn(`plafond d'envois atteint (organisation ${organizationId})`);
    await recordAudit(db, { organizationId, action: "hub.mail.quota_reached", actor: { kind: "system", id: null } });
  }
  throw new MailQuotaExceededError(decision.retryAfterSeconds);
}

export async function organizationMailQuota(organizationId: string, options: { cap?: number; now?: Date } = {}): Promise<MailQuotaStatus> {
  return organizationMailQuotaStatus(appDatabase(), organizationId, options);
}

export type { MailQuotaStatus };
