// Lot 24b (SEC-22, décision D5) — plafond d'e-mails envoyés par organisation et
// par heure (signataires d'un devis, mariés invités), réglé par l'Admin
// (hub.platform_settings.mail_hourly_cap, 100 par défaut). Compté dans la table
// de la limitation de débit, par empreinte de l'organisation, sur une fenêtre
// glissante d'une heure.
import { and, eq, gt } from "drizzle-orm";
import type { AppDatabase } from "./client";
import { consumeRateLimits, rateLimitKeyHash, type RateLimitDecision } from "./rate-limit";
import { rateLimitEvents } from "./schema/core";
import { platformSettings } from "./schema/hub";

export const MAIL_QUOTA_BUCKET = "mail.organization";
const MAIL_QUOTA_WINDOW_MS = 60 * 60_000;
const DEFAULT_MAIL_HOURLY_CAP = 100;

export async function mailHourlyCap(db: AppDatabase): Promise<number> {
  const [row] = await db.select({ cap: platformSettings.mailHourlyCap }).from(platformSettings).where(eq(platformSettings.id, 1));
  return row?.cap ?? DEFAULT_MAIL_HOURLY_CAP;
}

// Réserve un envoi ; refusé au-delà du plafond, avec le délai avant qu'une place se libère.
export async function consumeOrganizationMailQuota(
  db: AppDatabase,
  organizationId: string,
  options: { cap?: number; now?: Date } = {},
): Promise<RateLimitDecision> {
  const cap = options.cap ?? (await mailHourlyCap(db));
  return consumeRateLimits(db, [{ bucket: MAIL_QUOTA_BUCKET, key: organizationId, limit: cap, windowMs: MAIL_QUOTA_WINDOW_MS }], options.now);
}

export type MailQuotaStatus = { cap: number; sent: number; reached: boolean; resumesAt: Date | null };

// État pour l'accueil : envois de l'heure écoulée, et l'heure où une place se libère.
export async function organizationMailQuotaStatus(
  db: AppDatabase,
  organizationId: string,
  options: { cap?: number; now?: Date } = {},
): Promise<MailQuotaStatus> {
  const cap = options.cap ?? (await mailHourlyCap(db));
  const now = options.now ?? new Date();
  const sent = await db
    .select({ createdAt: rateLimitEvents.createdAt })
    .from(rateLimitEvents)
    .where(
      and(
        eq(rateLimitEvents.bucket, MAIL_QUOTA_BUCKET),
        eq(rateLimitEvents.keyHash, rateLimitKeyHash(MAIL_QUOTA_BUCKET, organizationId)),
        gt(rateLimitEvents.createdAt, new Date(now.getTime() - MAIL_QUOTA_WINDOW_MS)),
      ),
    )
    .orderBy(rateLimitEvents.createdAt);
  const reached = sent.length >= cap;
  const freed = reached ? sent[sent.length - cap]!.createdAt.getTime() + MAIL_QUOTA_WINDOW_MS : null;
  return { cap, sent: sent.length, reached, resumesAt: freed === null ? null : new Date(freed) };
}
