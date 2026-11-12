// RGPD-04 — suivi des demandes d'exercice de droits, et réglages RGPD de
// l'organisation (lot 6, ADR 0023). Exposé par service.ts. Tables métier :
// chaque requête passe par withOrganization (RLS forcée). Réservé à la
// titulaire : le contrôle du rôle est fait par l'écran et ses actions.
import { and, asc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { privacyRequests, privacySettings } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { daysBetween, isDueSoon, parisDate, requestDueDate } from "@symbola/privacy";
import { starterPrivacySettings, type StarterPrivacySettings } from "@symbola/starter-templates";

export const PRIVACY_REQUEST_TYPES = ["access", "rectification", "erasure", "portability", "objection"] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];
export type PrivacyRequestStatus = "open" | "extended" | "closed";
export type PrivacySettings = StarterPrivacySettings;

export class PrivacyRequestNotFoundError extends Error {}
export class PrivacyRequestInvalidError extends Error {
  constructor(
    readonly code:
      | "person_missing"
      | "received_in_future"
      | "reason_missing"
      | "already_extended"
      | "closed"
      | "settings_invalid"
      // Lot 18 (RGPD-07) : clôture ou étape demandée trop tôt.
      | "action_missing"
      | "response_missing"
      | "not_manual",
  ) {
    super(code);
  }
}

const LABEL_MAX = 200;
const REASON_MAX = 2000;

// —— Réglages ———————————————————————————————————————————————————————————

export async function getPrivacySettings(db: AppDatabase, organizationId: string): Promise<PrivacySettings> {
  return withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.select().from(privacySettings).where(eq(privacySettings.organizationId, organizationId));
    if (row) {
      return {
        requestAlertDays: row.requestAlertDays,
        prospectRetentionMonths: row.prospectRetentionMonths,
        clientRetentionMonths: row.clientRetentionMonths,
        accountingRetentionMonths: row.accountingRetentionMonths,
        inactiveAccountMonths: row.inactiveAccountMonths,
        signedQuoteRetentionMonths: row.signedQuoteRetentionMonths,
        requestProofRetentionMonths: row.requestProofRetentionMonths,
      };
    }
    // Première lecture : le modèle de départ devient le réglage de l'organisation.
    const settings = starterPrivacySettings();
    await tx.insert(privacySettings).values({ organizationId, ...settings }).onConflictDoNothing();
    return settings;
  });
}

export async function updatePrivacySettings(db: AppDatabase, organizationId: string, settings: PrivacySettings): Promise<void> {
  if (Object.values(settings).some((value) => !Number.isInteger(value) || value <= 0 || value > 1200)) {
    throw new PrivacyRequestInvalidError("settings_invalid");
  }
  await getPrivacySettings(db, organizationId);
  await withOrganization(db, organizationId, (tx) =>
    tx.update(privacySettings).set({ ...settings, updatedAt: new Date() }).where(eq(privacySettings.organizationId, organizationId)),
  );
}

// Lot 26a (RGP-03) — mention d'information des pages à lien personnel, au nom
// de l'organisation : son texte, ou null (texte de départ).
const LINK_NOTICE_MAX = 4000;

export async function getLinkPrivacyNotice(db: AppDatabase, organizationId: string): Promise<string | null> {
  await getPrivacySettings(db, organizationId);
  return withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.select({ notice: privacySettings.linkPrivacyNotice }).from(privacySettings).where(eq(privacySettings.organizationId, organizationId));
    return row?.notice ?? null;
  });
}

// Vide : retour au texte de départ.
export async function updateLinkPrivacyNotice(db: AppDatabase, organizationId: string, notice: string | null): Promise<void> {
  const text = notice?.trim() || null;
  if (text && text.length > LINK_NOTICE_MAX) throw new PrivacyRequestInvalidError("settings_invalid");
  await getPrivacySettings(db, organizationId);
  await withOrganization(db, organizationId, (tx) =>
    tx.update(privacySettings).set({ linkPrivacyNotice: text, updatedAt: new Date() }).where(eq(privacySettings.organizationId, organizationId)),
  );
}

// —— Demandes ——————————————————————————————————————————————————————————

export type PrivacyRequestView = {
  id: string;
  type: PrivacyRequestType;
  personLabel: string;
  receivedOn: string;
  dueOn: string;
  status: PrivacyRequestStatus;
  extensionReason: string | null;
  // Jours restants avant l'échéance (négatif : dépassée) ; null une fois close.
  daysLeft: number | null;
  dueSoon: boolean;
  // Lot 18 (RGPD-07) : jalons du dossier.
  createdAt: Date;
  extendedAt: Date | null;
  actionDoneAt: Date | null;
  responseSentAt: Date | null;
  closedAt: Date | null;
};

function toView(row: typeof privacyRequests.$inferSelect, today: string, alertDays: number): PrivacyRequestView {
  const pending = row.status !== "closed";
  return {
    id: row.id,
    type: row.type,
    personLabel: row.personLabel,
    receivedOn: row.receivedOn,
    dueOn: row.dueOn,
    status: row.status,
    extensionReason: row.extensionReason,
    daysLeft: pending ? daysBetween(today, row.dueOn) : null,
    dueSoon: pending && isDueSoon(today, row.dueOn, alertDays),
    createdAt: row.createdAt,
    extendedAt: row.extendedAt,
    actionDoneAt: row.actionDoneAt,
    responseSentAt: row.responseSentAt,
    closedAt: row.closedAt,
  };
}

// Lot 18 (RGPD-07) : une demande de l'organisation, pour son dossier.
export async function getPrivacyRequest(db: AppDatabase, organizationId: string, requestId: string, now: Date = new Date()): Promise<PrivacyRequestView> {
  const settings = await getPrivacySettings(db, organizationId);
  const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(privacyRequests).where(eq(privacyRequests.id, requestId)));
  if (!row) throw new PrivacyRequestNotFoundError();
  return toView(row, parisDate(now), settings.requestAlertDays);
}

export async function createPrivacyRequest(
  db: AppDatabase,
  input: { organizationId: string; userId: string; type: PrivacyRequestType; personLabel: string; receivedOn: string; now?: Date },
): Promise<PrivacyRequestView> {
  const today = parisDate(input.now ?? new Date());
  const personLabel = input.personLabel.trim().slice(0, LABEL_MAX);
  if (personLabel === "") throw new PrivacyRequestInvalidError("person_missing");
  if (daysBetween(today, input.receivedOn) > 0) throw new PrivacyRequestInvalidError("received_in_future");
  const settings = await getPrivacySettings(db, input.organizationId);
  return withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx
      .insert(privacyRequests)
      .values({
        organizationId: input.organizationId,
        type: input.type,
        personLabel,
        receivedOn: input.receivedOn,
        dueOn: requestDueDate(input.receivedOn, false),
        createdByUserId: input.userId,
      })
      .returning();
    if (!row) throw new Error("création de la demande échouée");
    return toView(row, today, settings.requestAlertDays);
  });
}

export async function listPrivacyRequests(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<PrivacyRequestView[]> {
  const today = parisDate(now);
  const settings = await getPrivacySettings(db, organizationId);
  const rows = await withOrganization(db, organizationId, (tx) => tx.select().from(privacyRequests).orderBy(asc(privacyRequests.dueOn)));
  // Les demandes en cours d'abord (échéance la plus proche en tête), puis les closes.
  return rows
    .map((row) => toView(row, today, settings.requestAlertDays))
    .sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed"));
}

// Tableau de bord du hub : demandes en cours dont l'échéance est proche ou passée.
export async function listDueSoonPrivacyRequests(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<PrivacyRequestView[]> {
  const today = parisDate(now);
  const settings = await getPrivacySettings(db, organizationId);
  const rows = await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(privacyRequests)
      .where(inArray(privacyRequests.status, ["open", "extended"]))
      .orderBy(asc(privacyRequests.dueOn)),
  );
  return rows.map((row) => toView(row, today, settings.requestAlertDays)).filter((view) => view.dueSoon);
}

// « Quand elle prolonge une demande complexe, alors le motif est obligatoire
// et l'échéance passe à trois mois au total. » Une seule prolongation.
export async function extendPrivacyRequest(
  db: AppDatabase,
  input: { organizationId: string; requestId: string; reason: string; now?: Date },
): Promise<PrivacyRequestView> {
  const now = input.now ?? new Date();
  const reason = input.reason.trim().slice(0, REASON_MAX);
  if (reason === "") throw new PrivacyRequestInvalidError("reason_missing");
  const settings = await getPrivacySettings(db, input.organizationId);
  return withOrganization(db, input.organizationId, async (tx) => {
    const [current] = await tx.select().from(privacyRequests).where(eq(privacyRequests.id, input.requestId));
    if (!current) throw new PrivacyRequestNotFoundError();
    if (current.status === "closed") throw new PrivacyRequestInvalidError("closed");
    if (current.status === "extended") throw new PrivacyRequestInvalidError("already_extended");
    const [row] = await tx
      .update(privacyRequests)
      .set({ status: "extended", extensionReason: reason, extendedAt: now, dueOn: requestDueDate(current.receivedOn, true), updatedAt: now })
      .where(and(eq(privacyRequests.id, input.requestId), eq(privacyRequests.status, "open")))
      .returning();
    if (!row) throw new PrivacyRequestNotFoundError();
    return toView(row, parisDate(now), settings.requestAlertDays);
  });
}
