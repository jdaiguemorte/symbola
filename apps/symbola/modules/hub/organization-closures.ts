// Lot 35c (RGP-11 ; décisions D8 de Julien du 18/11/2026 et D9/Q35 ; ADR 0100) — fermeture d'un
// espace par sa Propriétaire. Fermer demande la double authentification de la session et le nom
// de l'organisation (UX-07). Pendant les 30 jours, l'espace ne sert plus qu'à exporter et à rouvrir :
// les écrans redirigent vers la fermeture, les liens des tiers sont refusés, aucun envoi ne part
// (sauf les e-mails de la fermeture), les traitements de fond l'ignorent. Un e-mail part à la
// fermeture, un autre sept jours avant la suppression. Au 30e jour (minuit à Paris), lib/closure
// efface tout, fichiers compris ; seule reste la trace (hub.organization_closures), sans donnée
// personnelle. La base refuse une fermeture antidatée et toute suppression avant l'heure.
import { and, asc, desc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { listTeam } from "@symbola/auth";
import { appendAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { organizationClosures, organizations, organizationSubscriptions } from "@symbola/db/schema/hub";
import { withActorContext, withOrganization } from "@symbola/db/with-organization";
import { parseEnv } from "@symbola/env";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { closureSchedule } from "./closure-schedule";
import { sendSymbolaEmail } from "./emails";

// Seule la Propriétaire ferme ou rouvre (une Planner, un Comptable, un compte retiré : refusés).
export class OrganizationClosureForbiddenError extends Error {}
// La session n'a pas passé la double authentification.
export class OrganizationClosureMfaRequiredError extends Error {}
// Le nom saisi n'est pas celui de l'organisation (UX-07).
export class OrganizationClosureConfirmationError extends Error {}
export class OrganizationAlreadyClosedError extends Error {}
// Rouvrir : l'espace n'est pas fermé, ou sa date de suppression est passée.
export class OrganizationNotReopenableError extends Error {}

// Clés d'idempotence des e-mails de la fermeture : seuls envois permis d'un espace fermé.
export const CLOSURE_EMAIL_KEY_PREFIX = "closure:";

export type OrganizationClosureView = { closedAt: Date; deletionDueAt: Date; noticeAt: Date; closedByUserId: string | null };

export async function getOrganizationClosure(db: AppDatabase, organizationId: string): Promise<OrganizationClosureView | null> {
  const [row] = await db
    .select({ closedAt: organizations.closedAt, deletionDueAt: organizations.deletionDueAt, closedByUserId: organizations.closedByUserId })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!row?.closedAt || !row.deletionDueAt) return null;
  return { closedAt: row.closedAt, deletionDueAt: row.deletionDueAt, noticeAt: closureSchedule(row.closedAt).noticeAt, closedByUserId: row.closedByUserId };
}

export async function isOrganizationClosed(db: AppDatabase, organizationId: string): Promise<boolean> {
  const [row] = await db.select({ closedAt: organizations.closedAt }).from(organizations).where(eq(organizations.id, organizationId));
  return Boolean(row?.closedAt);
}

async function assertClosingOwner(db: AppDatabase, input: { organizationId: string; userId: string; mfaVerified: boolean }): Promise<void> {
  const member = (await listTeam(db, input.organizationId)).find((candidate) => candidate.id === input.userId);
  if (!member || member.role !== "owner" || member.disabledAt) throw new OrganizationClosureForbiddenError();
  if (!input.mfaVerified) throw new OrganizationClosureMfaRequiredError();
}

function normalizeName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ");
}

export async function closeOrganization(
  db: AppDatabase,
  input: { organizationId: string; userId: string; mfaVerified: boolean; confirmation: string; now?: Date },
): Promise<OrganizationClosureView> {
  const now = input.now ?? new Date();
  await assertClosingOwner(db, input);
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, input.organizationId));
  if (!organization) throw new OrganizationClosureForbiddenError();
  if (normalizeName(input.confirmation) !== normalizeName(organization.name)) throw new OrganizationClosureConfirmationError();
  if (organization.closedAt) throw new OrganizationAlreadyClosedError();
  return markOrganizationClosed(db, { organizationId: input.organizationId, userId: input.userId, now });
}

// Lot 54 (HUB-27, ADR 0101) : à l'échéance d'une résiliation, la même fermeture, lancée par le
// système (la Propriétaire a confirmé la résiliation dans « Mon abonnement »). Sans effet sur un
// espace déjà fermé.
export async function closeOrganizationAtSubscriptionEnd(db: AppDatabase, input: { organizationId: string; userId: string | null; now?: Date }): Promise<OrganizationClosureView | null> {
  const now = input.now ?? new Date();
  if (await isOrganizationClosed(db, input.organizationId)) return null;
  return markOrganizationClosed(db, { organizationId: input.organizationId, userId: input.userId, now });
}

async function markOrganizationClosed(db: AppDatabase, input: { organizationId: string; userId: string | null; now: Date }): Promise<OrganizationClosureView> {
  const now = input.now;
  const schedule = closureSchedule(now);
  const closureId = await withActorContext(db, async (tx) => {
    const [closed] = await tx
      .update(organizations)
      .set({ closedAt: now, closedByUserId: input.userId, deletionDueAt: schedule.deletionDueAt, closureNoticeSentAt: null })
      .where(and(eq(organizations.id, input.organizationId), isNull(organizations.closedAt)))
      .returning({ id: organizations.id });
    if (!closed) throw new OrganizationAlreadyClosedError();
    const [trace] = await tx
      .insert(organizationClosures)
      .values({ organizationId: input.organizationId, closedAt: now, deletionDueAt: schedule.deletionDueAt })
      .returning({ id: organizationClosures.id });
    return trace!.id;
  });
  await withOrganization(db, input.organizationId, (tx) =>
    appendAudit(tx, { organizationId: input.organizationId, action: "hub.organization.closed", objectId: input.organizationId, details: { deletionDueAt: schedule.deletionDueAt.toISOString() } }),
  );
  await notifyOwners(db, { organizationId: input.organizationId, kind: "closed", deletionDueAt: schedule.deletionDueAt, key: `${CLOSURE_EMAIL_KEY_PREFIX}${closureId}:closed` });
  return { closedAt: now, deletionDueAt: schedule.deletionDueAt, noticeAt: schedule.noticeAt, closedByUserId: input.userId };
}

// Rouvrir avant la date de suppression : l'espace reprend comme avant (ses liens compris).
export async function reopenOrganization(db: AppDatabase, input: { organizationId: string; userId: string; mfaVerified: boolean; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await assertClosingOwner(db, input);
  const closure = await getOrganizationClosure(db, input.organizationId);
  if (!closure || closure.deletionDueAt <= now) throw new OrganizationNotReopenableError();
  await withActorContext(db, async (tx) => {
    const [reopened] = await tx
      .update(organizations)
      .set({ closedAt: null, closedByUserId: null, deletionDueAt: null, closureNoticeSentAt: null })
      .where(and(eq(organizations.id, input.organizationId), isNotNull(organizations.closedAt)))
      .returning({ id: organizations.id });
    if (!reopened) throw new OrganizationNotReopenableError();
    await tx
      .update(organizationClosures)
      .set({ reopenedAt: now })
      .where(and(eq(organizationClosures.organizationId, input.organizationId), isNull(organizationClosures.reopenedAt), isNull(organizationClosures.erasedAt)));
  });
  await withOrganization(db, input.organizationId, async (tx) => {
    // Lot 54 (HUB-27, ADR 0101) : un espace fermé à l'échéance de sa résiliation rouvre en lecture
    // seule ; la Propriétaire choisit une offre pour reprendre.
    await tx
      .update(organizationSubscriptions)
      .set({ status: "read_only", readOnlySince: now, cancelledAt: null, cancelledByUserId: null, cancelEffectiveAt: null, endedAt: null })
      .where(and(eq(organizationSubscriptions.organizationId, input.organizationId), isNotNull(organizationSubscriptions.endedAt)));
    await appendAudit(tx, { organizationId: input.organizationId, action: "hub.organization.reopened", objectId: input.organizationId });
  });
}

export type ClosedOrganization = { organizationId: string; closedAt: Date; deletionDueAt: Date; closureNoticeSentAt: Date | null };

export async function listClosedOrganizations(db: AppDatabase): Promise<ClosedOrganization[]> {
  const rows = await db
    .select({ organizationId: organizations.id, closedAt: organizations.closedAt, deletionDueAt: organizations.deletionDueAt, closureNoticeSentAt: organizations.closureNoticeSentAt })
    .from(organizations)
    .where(isNotNull(organizations.closedAt))
    .orderBy(asc(organizations.deletionDueAt));
  return rows.map((row) => ({ organizationId: row.organizationId, closedAt: row.closedAt!, deletionDueAt: row.deletionDueAt!, closureNoticeSentAt: row.closureNoticeSentAt }));
}

// Préavis, sept jours avant la suppression (une fois).
export async function sendClosureNotice(db: AppDatabase, input: { organizationId: string; now?: Date }): Promise<boolean> {
  const now = input.now ?? new Date();
  const closure = await getOrganizationClosure(db, input.organizationId);
  if (!closure || now < closure.noticeAt || now >= closure.deletionDueAt) return false;
  const [marked] = await withActorContext(db, (tx) =>
    tx
      .update(organizations)
      .set({ closureNoticeSentAt: now })
      .where(and(eq(organizations.id, input.organizationId), isNull(organizations.closureNoticeSentAt), lte(organizations.closedAt, now)))
      .returning({ id: organizations.id }),
  );
  if (!marked) return false;
  const [trace] = await db
    .select({ id: organizationClosures.id })
    .from(organizationClosures)
    .where(and(eq(organizationClosures.organizationId, input.organizationId), isNull(organizationClosures.reopenedAt), isNull(organizationClosures.erasedAt)));
  await notifyOwners(db, { organizationId: input.organizationId, kind: "notice", deletionDueAt: closure.deletionDueAt, key: `${CLOSURE_EMAIL_KEY_PREFIX}${trace?.id ?? input.organizationId}:notice` });
  return true;
}

// Trace : l'effacement des données (dans sa transaction), puis celui des fichiers.
export async function recordOrganizationErasure(db: AppDatabase, input: { organizationId: string; rows: number; now?: Date; replay?: boolean }): Promise<void> {
  const now = input.now ?? new Date();
  await withActorContext(db, async (tx) => {
    if (input.replay) {
      await tx.update(organizationClosures).set({ replayedAt: now }).where(and(eq(organizationClosures.organizationId, input.organizationId), isNotNull(organizationClosures.erasedAt)));
      return;
    }
    await tx
      .update(organizationClosures)
      .set({ erasedAt: now, erasedRows: input.rows })
      .where(and(eq(organizationClosures.organizationId, input.organizationId), isNull(organizationClosures.reopenedAt), isNull(organizationClosures.erasedAt)));
  });
}

export async function recordClosureFilesErased(db: AppDatabase, input: { organizationId: string; files: number; now?: Date }): Promise<void> {
  await withActorContext(db, (tx) =>
    tx
      .update(organizationClosures)
      .set({ filesErasedAt: input.now ?? new Date(), erasedFiles: input.files })
      .where(and(eq(organizationClosures.organizationId, input.organizationId), isNotNull(organizationClosures.erasedAt))),
  );
}

export type OrganizationClosureTrace = typeof organizationClosures.$inferSelect;

// Exploitation (et rejeu après une restauration) : toutes les fermetures, les plus récentes d'abord.
export async function listOrganizationClosureTraces(db: AppDatabase): Promise<OrganizationClosureTrace[]> {
  return db.select().from(organizationClosures).orderBy(desc(organizationClosures.closedAt));
}

// Texte de l'e-mail, dans la langue de l'organisation : la date de suppression, et où exporter.
export function organizationClosureMail(input: { locale: Locale; kind: "closed" | "notice"; organizationName: string; deletionDueAt: Date; url: string }): { subject: string; text: string; button: string } {
  const t = createTranslator({ locale: input.locale, messages: input.locale === "en" ? enMessages : frMessages, namespace: `Emails.fixed.${input.kind === "closed" ? "organizationClosed" : "organizationClosureNotice"}` });
  return { subject: t("subject"), text: t("body", { organization: input.organizationName, until: formatDateTime(input.deletionDueAt, input.locale), url: input.url }), button: t("button") };
}

async function notifyOwners(db: AppDatabase, input: { organizationId: string; kind: "closed" | "notice"; deletionDueAt: Date; key: string }): Promise<void> {
  try {
    const [[organization], team] = await Promise.all([db.select().from(organizations).where(eq(organizations.id, input.organizationId)), listTeam(db, input.organizationId)]);
    if (!organization) return;
    const env = parseEnv(process.env);
    const locale: Locale = organization.language === "en" ? "en" : "fr";
    const url = `${env.APP_PUBLIC_URL}/parametres/fermeture`;
    const mail = organizationClosureMail({ locale, kind: input.kind, organizationName: organization.name, deletionDueAt: input.deletionDueAt, url });
    for (const owner of team.filter((member) => member.role === "owner" && !member.disabledAt)) {
      await sendSymbolaEmail({ to: owner.email, locale, subject: mail.subject, body: mail.text, button: { label: mail.button, url }, organizationId: input.organizationId, idempotencyKey: `${input.key}:${owner.id}` });
    }
  } catch (error) {
    // La fermeture reste : l'écran la montre. Motif technique seulement (SEC-20).
    console.error("e-mail de fermeture non envoyé", { organizationId: input.organizationId, kind: input.kind, error: error instanceof Error ? error.name : "inconnue" });
  }
}

// Nom de l'espace, que la Propriétaire écrit pour confirmer la fermeture (UX-07).
export async function getOrganizationName(db: AppDatabase, organizationId: string): Promise<string> {
  const [row] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, organizationId));
  return row?.name ?? "";
}
